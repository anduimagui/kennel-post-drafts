import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  FolderPluginDataset,
  FolderPluginPayloadError,
} from "kennel-plugins"
import type { FolderPluginViewProps } from "kennel-plugins/client"
import type {
  Post,
  PostDraftsDataset,
  PostPlatform,
  PostStatus,
} from "../model.ts"

const allPlatforms: PostPlatform[] = [
  "x",
  "linkedin",
  "reddit",
  "hackernews",
  "mastodon",
  "bluesky",
  "threads",
  "instagram",
  "facebook",
  "telegram",
  "newsletter",
]

const statuses: PostStatus[] = ["draft", "scheduled", "posted"]

const platformLabel: Record<PostPlatform, string> = {
  x: "X",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  hackernews: "Hacker News",
  mastodon: "Mastodon",
  bluesky: "Bluesky",
  threads: "Threads",
  instagram: "Instagram",
  facebook: "Facebook",
  telegram: "Telegram",
  newsletter: "Newsletter",
}

const platformDomain: Record<PostPlatform, string | undefined> = {
  x: "x.com",
  linkedin: "linkedin.com",
  reddit: "reddit.com",
  hackernews: "news.ycombinator.com",
  mastodon: "mastodon.social",
  bluesky: "bsky.app",
  threads: "threads.net",
  instagram: "instagram.com",
  facebook: "facebook.com",
  telegram: "telegram.org",
  newsletter: undefined,
}

/** Small platform icon: the network's favicon, or a text badge without one. */
function PlatformIcon({ platform }: { platform: PostPlatform }) {
  const domain = platformDomain[platform]
  if (!domain)
    return (
      <span
        aria-label={platformLabel[platform]}
        className="inline-flex size-4 items-center justify-center rounded border text-[9px] leading-none"
        title={platformLabel[platform]}
      >
        ✉
      </span>
    )
  return (
    <img
      alt={platformLabel[platform]}
      className="inline size-4 rounded-sm align-text-bottom"
      loading="lazy"
      src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
      title={platformLabel[platform]}
    />
  )
}

const statusStyle: Record<PostStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800",
  posted: "bg-green-100 text-green-800",
}

/**
 * Web share intent for one platform. undefined means the platform has no
 * draft-text intent (Instagram, newsletter): copy the text instead.
 */
function intentUrl(platform: PostPlatform, post: Post): string | undefined {
  const text = encodeURIComponent(post.body)
  const title = encodeURIComponent(post.title ?? post.id)
  const url = encodeURIComponent(post.postedUrl ?? "")
  switch (platform) {
    case "x":
      return `https://twitter.com/intent/tweet?text=${text}`
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${text}`
    case "threads":
      return `https://www.threads.net/intent/post?text=${text}`
    case "mastodon":
      return `https://mastodon.social/share?text=${text}`
    case "linkedin":
      return "https://www.linkedin.com/sharing/share-offsite/"
    case "reddit":
      return `https://www.reddit.com/submit?title=${title}&text=${text}`
    case "hackernews":
      return `https://news.ycombinator.com/submit?title=${title}`
    case "telegram":
      return `https://t.me/share/url?url=${url}&text=${text}`
    case "facebook":
      return url
        ? `https://www.facebook.com/sharer/sharer.php?u=${url}`
        : undefined
    default:
      return undefined
  }
}

/** Render post text with #hashtags and links highlighted. */
function PostBody({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-snug">
      {text.split(/(\s+)/).map((token, index) =>
        /^#[\w-]+$/.test(token) || /^https?:\/\/\S+$/.test(token) ? (
          <span className="text-sky-600" key={index}>
            {token}
          </span>
        ) : (
          token
        ),
      )}
    </p>
  )
}

const inputClass =
  "w-full rounded-md border bg-transparent px-3 py-2 text-sm"

function PostEditor({
  folder,
  isNew,
  platformOptions,
  post,
  onCancel,
  onSaved,
}: {
  folder: string
  isNew: boolean
  platformOptions: PostPlatform[]
  post: Post
  onCancel: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Post>(post)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<Post>) =>
    setDraft((current) => ({ ...current, ...patch }))

  const save = async () => {
    setSaving(true)
    setError(undefined)
    try {
      const response = await fetch(
        `/api/post-drafts/save?path=${encodeURIComponent(folder)}`,
        {
          body: JSON.stringify({ post: draft }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      )
      if (!response.ok) {
        const detail = (await response.json().catch(() => undefined)) as
          | { error?: { message?: string } }
          | undefined
        throw new Error(
          detail?.error?.message ?? `Save failed (${response.status})`,
        )
      }
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    setError(undefined)
    try {
      const response = await fetch(
        `/api/post-drafts/delete?path=${encodeURIComponent(folder)}`,
        {
          body: JSON.stringify({ id: draft.id }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      )
      if (!response.ok) {
        const detail = (await response.json().catch(() => undefined)) as
          | { error?: { message?: string } }
          | undefined
        throw new Error(
          detail?.error?.message ?? `Delete failed (${response.status})`,
        )
      }
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="space-y-3 rounded-xl border border-sky-300 bg-card p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <p className="font-semibold">
          {isNew ? "New post draft" : `Edit: ${post.id}`}
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle[draft.status ?? "draft"]}`}
        >
          {draft.status ?? "draft"}
        </span>
      </header>
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          className={inputClass}
          onChange={(event) => set({ title: event.target.value })}
          type="text"
          value={draft.title ?? ""}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Post text
        <textarea
          className={`${inputClass} min-h-32`}
          onChange={(event) => set({ body: event.target.value })}
          value={draft.body}
        />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        Platforms
        <div className="flex flex-wrap gap-2">
          {platformOptions.map((platform) => {
            const active = (draft.platforms ?? []).includes(platform)
            return (
              <label
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                  active ? "border-sky-500 bg-sky-50" : ""
                }`}
                key={platform}
              >
                <input
                  checked={active}
                  onChange={(event) =>
                    set({
                      platforms: event.target.checked
                        ? [...(draft.platforms ?? []), platform]
                        : (draft.platforms ?? []).filter(
                            (item) => item !== platform,
                          ),
                    })
                  }
                  type="checkbox"
                />
                {platformLabel[platform]}
              </label>
            )
          })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Hashtags (comma separated, no #)
          <input
            className={inputClass}
            onChange={(event) =>
              set({
                hashtags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim().replace(/^#/, ""))
                  .filter(Boolean),
              })
            }
            type="text"
            value={(draft.hashtags ?? []).join(", ")}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            className={inputClass}
            onChange={(event) =>
              set({ status: event.target.value as PostStatus })
            }
            value={draft.status ?? "draft"}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status[0].toLocaleUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Scheduled for
          <input
            className={inputClass}
            onChange={(event) => set({ scheduledFor: event.target.value })}
            type="datetime-local"
            value={(draft.scheduledFor ?? "").slice(0, 16)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Posted URL
          <input
            className={inputClass}
            onChange={(event) => set({ postedUrl: event.target.value })}
            type="url"
            value={draft.postedUrl ?? ""}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <input
          className={inputClass}
          onChange={(event) => set({ notes: event.target.value })}
          type="text"
          value={draft.notes ?? ""}
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <footer className="flex flex-wrap items-center gap-2 border-t pt-3">
        <button
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          disabled={saving}
          onClick={save}
          type="button"
        >
          {saving ? "Saving…" : "Save to posts.json"}
        </button>
        <button
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        {!isNew ? (
          <button
            className="ml-auto rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            disabled={saving}
            onClick={remove}
            type="button"
          >
            {saving ? "Deleting…" : "Delete"}
          </button>
        ) : null}
      </footer>
    </article>
  )
}

function PostCard({
  folder,
  platformOptions,
  post,
  onEdit,
  onDeleted,
}: {
  folder: string
  platformOptions: PostPlatform[]
  post: Post
  onEdit: () => void
  onDeleted: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()
  const [deleting, setDeleting] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(post.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const remove = async () => {
    setDeleting(true)
    setError(undefined)
    try {
      const response = await fetch(
        `/api/post-drafts/delete?path=${encodeURIComponent(folder)}`,
        {
          body: JSON.stringify({ id: post.id }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      )
      if (!response.ok) {
        const detail = (await response.json().catch(() => undefined)) as
          | { error?: { message?: string } }
          | undefined
        throw new Error(
          detail?.error?.message ?? `Delete failed (${response.status})`,
        )
      }
      onDeleted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setDeleting(false)
    }
  }
  const pushTargets = (post.platforms?.length
    ? post.platforms.filter((platform) => platformOptions.includes(platform))
    : platformOptions
  ).filter((platform) => intentUrl(platform, post))
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <header className="flex items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {(post.platforms ?? platformOptions).map((platform) => (
            <PlatformIcon key={platform} platform={platform} />
          ))}
        </div>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
          {post.title ?? post.id}
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle[post.status ?? "draft"]}`}
        >
          {post.status ?? "draft"}
        </span>
      </header>
      <div className="mt-2">
        <PostBody text={post.body} />
      </div>
      {post.hashtags?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.hashtags.map((tag) => (
            <span
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-sky-700"
              key={tag}
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
      {post.notes ? (
        <p className="mt-2 text-sm text-muted-foreground">{post.notes}</p>
      ) : null}
      <footer className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-sm text-muted-foreground">
        {post.scheduledFor ? (
          <span className="text-xs">
            {new Date(post.scheduledFor).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        ) : null}
        {post.postedUrl ? (
          <a
            className="text-xs underline"
            href={post.postedUrl}
            rel="noreferrer"
            target="_blank"
          >
            View posted
          </a>
        ) : null}
        <span className="ml-auto" />
        {pushTargets.map((platform) => (
          <a
            aria-label={`Push to ${platformLabel[platform]}`}
            className="rounded-md border p-1 hover:bg-muted"
            href={intentUrl(platform, post)}
            key={platform}
            rel="noreferrer"
            target="_blank"
            title={`Push to ${platformLabel[platform]}`}
          >
            <PlatformIcon platform={platform} />
          </a>
        ))}
        <button
          className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
          onClick={copy}
          type="button"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
          onClick={onEdit}
          type="button"
        >
          Edit
        </button>
        <button
          aria-label="Delete post"
          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          disabled={deleting}
          onClick={remove}
          type="button"
        >
          {deleting ? "…" : "Delete"}
        </button>
      </footer>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  )
}

export default function PostDraftsPage(props: FolderPluginViewProps) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<
    { post: Post; isNew: boolean } | undefined
  >()
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all")
  const [platformFilter, setPlatformFilter] = useState<PostPlatform | "all">(
    "all",
  )
  const query = useQuery({
    queryKey: ["folder", props.folderId, "post-drafts", props.subpath],
    queryFn: ({ signal }) =>
      props.request(props.subpath, { signal }) as Promise<
        FolderPluginDataset<PostDraftsDataset> | FolderPluginPayloadError
      >,
  })
  const payload = query.data
  const data = payload?.status === "available" ? payload : undefined
  const failure = query.error
    ? String(query.error)
    : payload?.status === "error"
      ? (payload.message ?? "Invalid post drafts data.")
      : undefined

  // Configured networks come from posts.json `platforms`; fall back to
  // every network used by a post in this file.
  const platformOptions =
    data?.dataset.platforms?.length
      ? data.dataset.platforms
      : data?.dataset.posts.some((post) => post.platforms?.length)
        ? [
            ...new Set(
              data.dataset.posts.flatMap((post) => post.platforms ?? []),
            ),
          ].filter((platform) => allPlatforms.includes(platform))
        : allPlatforms

  const posts =
    data?.dataset.posts.filter(
      (post) =>
        (statusFilter === "all" || (post.status ?? "draft") === statusFilter) &&
        (platformFilter === "all" ||
          (post.platforms ?? []).includes(platformFilter)),
    ) ?? []

  const refresh = () => {
    setEditing(undefined)
    void queryClient.invalidateQueries({
      queryKey: ["folder", props.folderId, "post-drafts"],
    })
  }

  const newDraft = (): Post => ({
    id: `draft-${Date.now()}`,
    body: "",
    platforms: [],
    status: "draft",
  })

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4 text-foreground">
      {props.subpath ? (
        <a className="text-sm underline" href={props.listHref}>
          All post drafts
        </a>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold">
          Post Drafts{data?.dataset.topic ? `: ${data.dataset.topic}` : ""}
        </h2>
        <button
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          onClick={() => setEditing({ isNew: true, post: newDraft() })}
          type="button"
        >
          New draft
        </button>
      </div>
      {query.isPending ? <p role="status">Loading post drafts…</p> : null}
      {failure ? (
        <section role="alert" className="space-y-2 rounded-lg border p-3">
          <p>{failure}</p>
          {payload?.status === "error" ? (
            <ul>
              {payload.issues?.map((issue, index) => (
                <li className="break-words text-sm" key={index}>
                  {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            className="underline"
            type="button"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </section>
      ) : null}
      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              Status
              <select
                className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
                onChange={(event) =>
                  setStatusFilter(event.target.value as PostStatus | "all")
                }
                value={statusFilter}
              >
                <option value="all">All</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status[0].toLocaleUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Platform
              <select
                className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
                onChange={(event) =>
                  setPlatformFilter(event.target.value as PostPlatform | "all")
                }
                value={platformFilter}
              >
                <option value="all">All</option>
                {platformOptions.map((platform) => (
                  <option key={platform} value={platform}>
                    {platformLabel[platform]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {editing ? (
            <PostEditor
              folder={props.folder}
              isNew={editing.isNew}
              key={editing.post.id}
              onCancel={() => setEditing(undefined)}
              onSaved={refresh}
              platformOptions={platformOptions}
              post={editing.post}
            />
          ) : null}
          {posts.length ? (
            <div className="grid min-w-0 gap-4">
              {posts.map((post) => (
                <PostCard
                  folder={props.folder}
                  key={post.id}
                  onDeleted={refresh}
                  onEdit={() =>
                    setEditing({ isNew: false, post: { ...post } })
                  }
                  platformOptions={platformOptions}
                  post={post}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {data.dataset.posts.length
                ? "No posts match these filters."
                : "No post drafts yet. Add entries to posts.json, or ask your agent to draft posts from the current discussion."}
            </p>
          )}
        </>
      ) : null}
    </main>
  )
}
