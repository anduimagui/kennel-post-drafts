import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import type {
  FolderPluginContext,
  FolderPluginData,
  FolderPluginDetection,
} from "kennel-plugins/server"

import schema from "../schema.json" with { type: "json" }
import validate from "./validate.js"
import type { PostDraftsDataset, PostDraftsFile } from "./model.ts"

type ContentIssue = { path: string; message: string }

const fileName = "posts.json"

/**
 * Read the folder's `posts.json`. The document must set `$schema` to this
 * plugin's schema URL so other JSON files never trigger this plugin.
 */
async function load(
  folder: string,
): Promise<{ issues: ContentIssue[]; document?: PostDraftsFile }> {
  const path = resolve(folder, fileName)
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return { issues: [] }
    return {
      issues: [
        { path: fileName, message: `Could not be read: ${String(error)}` },
      ],
    }
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    (raw as Record<string, unknown>).$schema !== schema.$id
  )
    return { issues: [] }
  if (!validate(raw)) {
    return {
      issues: (validate.errors ?? []).map(
        (error: {
          instancePath: string
          message?: string
          params?: unknown
        }) => ({
          path: `${fileName}${error.instancePath}`,
          message: `${error.message ?? "Invalid value"} ${JSON.stringify(error.params)}`,
        }),
      ),
    }
  }
  return { issues: [], document: raw as PostDraftsFile }
}

/**
 * Server hooks for the Post Drafts plugin. Identity, label, icon, and trigger
 * come from `kennel.json`; the host attaches them when it loads this module.
 */
export function createPostDraftsPlugin() {
  return {
    async detect(context: FolderPluginContext): Promise<FolderPluginDetection> {
      const { issues, document } = await load(context.folder)
      if (issues.length)
        return {
          status: "error",
          error: issues
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join("\n"),
        }
      return document
        ? { status: "available", count: document.posts.length }
        : { status: "unavailable" }
    },
    async handle(
      context: FolderPluginContext,
      subpath: string,
    ): Promise<FolderPluginData> {
      if (subpath !== "") return { kind: "unavailable" }
      const { issues, document } = await load(context.folder)
      if (issues.length)
        return {
          kind: "available",
          data: { status: "error", issues },
        }
      if (!document) return { kind: "unavailable" }
      const dataset: PostDraftsDataset = {
        topic: document.topic,
        platforms: document.platforms,
        posts: [...document.posts].sort((a, b) => a.id.localeCompare(b.id)),
      }
      return {
        kind: "available",
        data: { status: "available", dataset },
      }
    },
    async init() {
      return {
        files: [{ path: fileName, content: starterPostDraftsSource() }],
      }
    },
  }
}

export function starterPostDraftsSource(): string {
  return `${JSON.stringify(
    {
      $schema: schema.$id,
      topic: "Example topic",
      posts: [
        {
          id: "launch-announcement",
          title: "Launch announcement",
          platforms: ["x", "linkedin"],
          body: "We shipped something new. Here is what it does and why it matters. Give it a try and tell us what you think!",
          hashtags: ["buildinpublic", "launch"],
          status: "draft",
        },
        {
          id: "behind-the-scenes",
          title: "Behind the scenes",
          platforms: ["x"],
          body: "A short story about the problem we hit this week and how we fixed it. Threads of lessons learned.",
          hashtags: ["buildinpublic"],
          status: "scheduled",
          scheduledFor: "2030-01-01T09:00:00",
        },
      ],
    },
    null,
    2,
  )}\n`
}

// Plugin contract: default export hook factory for the host loader.
export default createPostDraftsPlugin
