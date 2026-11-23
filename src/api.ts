import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  apiError,
  jsonError,
  jsonResponse,
  parseJsonBody,
  runApiRoute,
} from "kennel-plugins"
import type { ApiRouteSpec } from "kennel-plugins"

import schema from "../schema.json" with { type: "json" }
import validate from "./validate.js"
import type { Post, PostDraftsFile, PostStatus } from "./model.ts"

const fileName = "posts.json"
const postBridgeBase = "https://api.post-bridge.com/v1"

type RouteContext = { folder: string; readOnly: boolean; watch: () => void }

/** Host-provided context for external plugin API handlers. */
type ApiHandlerContext = {
  authorizeFolder: (value: string | null) => string
  readOnly: boolean
  watch: (folder: string) => void
}

function postBridgeKey(): string {
  const key = process.env.POST_BRIDGE_API_KEY
  if (!key)
    throw apiError(
      "failed",
      "Post Bridge is not configured: start the Kennel service with POST_BRIDGE_API_KEY set",
    )
  return key
}

async function loadDocument(
  folder: string,
): Promise<PostDraftsFile | undefined> {
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(resolve(folder, fileName), "utf8"))
  } catch {
    return undefined
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    (raw as Record<string, unknown>).$schema !== schema.$id
  )
    return undefined
  return validate(raw) ? (raw as PostDraftsFile) : undefined
}

function parsedPost(value: unknown): Post {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw apiError("bad-request", "Body must include a post object")
  const candidate = { $schema: schema.$id, posts: [value] }
  if (!validate(candidate)) {
    const detail = (validate.errors ?? [])
      .map(
        (error) =>
          `${error.instancePath || "post"}: ${error.message ?? "invalid"}`,
      )
      .join("; ")
    throw apiError("bad-request", `Invalid post: ${detail}`)
  }
  return value as Post
}

async function saveDocument(
  folder: string,
  document: PostDraftsFile,
): Promise<void> {
  await writeFile(
    resolve(folder, fileName),
    `${JSON.stringify(document, null, 2)}\n`,
  )
}

const accountsRoute: ApiRouteSpec<RouteContext> = {
  method: "GET",
  async handle({ response }) {
    const answer = await fetch(`${postBridgeBase}/social-accounts`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${postBridgeKey()}` },
    })
    if (!answer.ok)
      throw apiError(
        "failed",
        `Post Bridge answered ${answer.status} for social accounts`,
      )
    const document = (await answer.json()) as { data?: unknown }
    jsonResponse(response, 200, { accounts: document.data ?? [] })
  },
}

const sendRoute: ApiRouteSpec<RouteContext> = {
  method: "POST",
  maxBodyBytes: 64 * 1024,
  async handle({ body, context, response }) {
    if (context.readOnly)
      throw apiError("forbidden", "This host is read-only")
    const input = parseJsonBody(body)
    const id = typeof input.id === "string" ? input.id : ""
    const accounts = Array.isArray(input.accounts)
      ? input.accounts.filter(
          (item): item is number => typeof item === "number",
        )
      : []
    if (!id || !accounts.length)
      throw apiError("bad-request", "Body must include a post id and account ids")
    const document = await loadDocument(context.folder)
    if (!document)
      throw apiError("not-found", `No valid ${fileName} in this folder`)
    const post = document.posts.find((item) => item.id === id)
    if (!post) throw apiError("not-found", `No post with id ${id}`)

    const scheduledAt =
      typeof input.scheduled_at === "string"
        ? input.scheduled_at
        : post.scheduledFor
    const payload: Record<string, unknown> = {
      caption: post.body,
      social_accounts: accounts,
    }
    if (scheduledAt) payload.scheduled_at = scheduledAt

    const answer = await fetch(`${postBridgeBase}/posts`, {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${postBridgeKey()}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    })
    const created = (await answer.json().catch(() => undefined)) as
      | { data?: Record<string, unknown>; error?: unknown }
      | undefined
    if (!answer.ok) {
      const message =
        typeof created?.error === "string"
          ? created.error
          : JSON.stringify(created?.error ?? created ?? {})
      throw apiError(
        "failed",
        `Post Bridge refused the post (${answer.status}): ${message.slice(0, 300)}`,
      )
    }
    const data = created?.data ?? {}
    const postbridgeId = String(data.id ?? "")
    const status: PostStatus = scheduledAt ? "scheduled" : "posted"
    const posts = document.posts.map((item) =>
      item.id === id
        ? { ...item, postbridgeId: postbridgeId || undefined, status }
        : item,
    )
    await saveDocument(context.folder, { ...document, posts })
    context.watch()
    jsonResponse(response, 200, {
      dashboard_url: data.dashboard_url,
      postbridge_id: postbridgeId,
      status,
    })
  },
}

const saveRoute: ApiRouteSpec<RouteContext> = {
  method: "POST",
  maxBodyBytes: 256 * 1024,
  async handle({ body, context, response }) {
    if (context.readOnly)
      throw apiError("forbidden", "This host is read-only")
    const post = parsedPost(parseJsonBody(body).post)
    const document = await loadDocument(context.folder)
    if (!document)
      throw apiError("not-found", `No valid ${fileName} in this folder`)
    const posts = [...document.posts]
    const index = posts.findIndex((item) => item.id === post.id)
    if (index >= 0) posts[index] = post
    else posts.push(post)
    await saveDocument(context.folder, { ...document, posts })
    context.watch()
    jsonResponse(response, 200, { post, status: "ok" })
  },
}

const deleteRoute: ApiRouteSpec<RouteContext> = {
  method: "POST",
  maxBodyBytes: 64 * 1024,
  async handle({ body, context, response }) {
    if (context.readOnly)
      throw apiError("forbidden", "This host is read-only")
    const id = parseJsonBody(body).id
    if (typeof id !== "string" || !id)
      throw apiError("bad-request", "Body must include a post id")
    const document = await loadDocument(context.folder)
    if (!document)
      throw apiError("not-found", `No valid ${fileName} in this folder`)
    const posts = document.posts.filter((item) => item.id !== id)
    if (posts.length === document.posts.length)
      throw apiError("not-found", `No post with id ${id}`)
    await saveDocument(context.folder, { ...document, posts })
    context.watch()
    jsonResponse(response, 200, { status: "ok" })
  },
}

/**
 * API handler for the Post Drafts plugin. The host tries every installed
 * plugin's handler in turn; return false for paths this plugin does not own.
 * Routes: POST /api/post-drafts/save|delete|send?path=<folder> and
 * GET /api/post-drafts/accounts.
 */
async function handlePostDraftsApi(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  context: ApiHandlerContext,
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://localhost")
  const route =
    url.pathname === "/api/post-drafts/save"
      ? saveRoute
      : url.pathname === "/api/post-drafts/delete"
        ? deleteRoute
        : url.pathname === "/api/post-drafts/send"
          ? sendRoute
          : url.pathname === "/api/post-drafts/accounts"
            ? accountsRoute
            : undefined
  if (!route) return false
  if (route !== accountsRoute && context.readOnly) {
    jsonError(response, 403, "forbidden", "This host is read-only")
    return true
  }
  const folder = route === accountsRoute ? "" : context.authorizeFolder(url.searchParams.get("path"))
  await runApiRoute(request, response, url, route, {
    folder,
    readOnly: context.readOnly,
    watch: () => context.watch(folder),
  })
  return true
}

// Plugin contract: default export API handler for the host loader.
export default handlePostDraftsApi
