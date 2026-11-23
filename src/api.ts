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
import type { Post, PostDraftsFile } from "./model.ts"

const fileName = "posts.json"

type RouteContext = { folder: string; watch: () => void }

/** Host-provided context for external plugin API handlers. */
type ApiHandlerContext = {
  authorizeFolder: (value: string | null) => string
  readOnly: boolean
  watch: (folder: string) => void
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

const saveRoute: ApiRouteSpec<RouteContext> = {
  method: "POST",
  maxBodyBytes: 256 * 1024,
  async handle({ body, context, response }) {
    const post = parsedPost(parseJsonBody(body).post)
    const document = await loadDocument(context.folder)
    if (!document)
      throw apiError("not-found", `No valid ${fileName} in this folder`)
    const posts = [...document.posts]
    const index = posts.findIndex((item) => item.id === post.id)
    if (index >= 0) posts[index] = post
    else posts.push(post)
    await writeFile(
      resolve(context.folder, fileName),
      `${JSON.stringify({ ...document, posts }, null, 2)}\n`,
    )
    context.watch()
    jsonResponse(response, 200, { post, status: "ok" })
  },
}

const deleteRoute: ApiRouteSpec<RouteContext> = {
  method: "POST",
  maxBodyBytes: 64 * 1024,
  async handle({ body, context, response }) {
    const id = parseJsonBody(body).id
    if (typeof id !== "string" || !id)
      throw apiError("bad-request", "Body must include a post id")
    const document = await loadDocument(context.folder)
    if (!document)
      throw apiError("not-found", `No valid ${fileName} in this folder`)
    const posts = document.posts.filter((item) => item.id !== id)
    if (posts.length === document.posts.length)
      throw apiError("not-found", `No post with id ${id}`)
    await writeFile(
      resolve(context.folder, fileName),
      `${JSON.stringify({ ...document, posts }, null, 2)}\n`,
    )
    context.watch()
    jsonResponse(response, 200, { status: "ok" })
  },
}

/**
 * API handler for the Post Drafts plugin. The host tries every installed
 * plugin's handler in turn; return false for paths this plugin does not own.
 * Routes: POST /api/post-drafts/save?path=<folder> and
 * POST /api/post-drafts/delete?path=<folder>.
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
        : undefined
  if (!route) return false
  if (context.readOnly) {
    jsonError(response, 403, "forbidden", "This host is read-only")
    return true
  }
  let folder: string
  try {
    folder = context.authorizeFolder(url.searchParams.get("path"))
  } catch {
    jsonError(response, 403, "forbidden", "Unknown folder")
    return true
  }
  await runApiRoute(request, response, url, route, {
    folder,
    watch: () => context.watch(folder),
  })
  return true
}

// Plugin contract: default export API handler for the host loader.
export default handlePostDraftsApi
