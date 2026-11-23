import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type {
  FolderPluginDataset,
  FolderPluginPayloadError,
} from "kennel-plugins"
import type { FolderPluginViewProps } from "kennel-plugins/client"
import type { PostDraftsDataset, Post, PostPlatform, PostStatus } from "../model.ts"

const platforms: PostPlatform[] = [
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

const statusStyle: Record<PostStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800",
  posted: "bg-green-100 text-green-800",
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

function PostCard({
  post,
  handle,
}: {
  post: Post
  handle: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(post.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <header className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
          {(post.title ?? "PD")
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0]?.toLocaleUpperCase())
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{post.title ?? post.id}</p>
          <p className="truncate text-sm text-muted-foreground">@{handle}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle[post.status ?? "draft"]}`}
        >
          {post.status ?? "draft"}
        </span>
      </header>
      <div className="mt-3">
        <PostBody text={post.body} />
      </div>
      {post.hashtags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
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
        <p className="mt-3 text-sm text-muted-foreground">{post.notes}</p>
      ) : null}
      <footer className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm text-muted-foreground">
        {post.platforms?.map((platform) => (
          <span
            className="rounded border px-2 py-0.5 text-xs font-medium"
            key={platform}
          >
            {platformLabel[platform]}
          </span>
        )) ?? null}
        {post.scheduledFor ? (
          <span className="text-xs">
            Scheduled for{" "}
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
        <button
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
          onClick={copy}
          type="button"
        >
          {copied ? "Copied" : "Copy text"}
        </button>
      </footer>
    </article>
  )
}

export default function PostDraftsPage(props: FolderPluginViewProps) {
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

  const handle = useMemo(() => {
    const folder = data ? (data as { folder?: string }).folder : undefined
    const base = folder?.split("/").filter(Boolean).pop()
    return (base ?? "folder").toLocaleLowerCase().replace(/\s+/g, "")
  }, [data])

  const posts =
    data?.dataset.posts.filter(
      (post) =>
        (statusFilter === "all" || (post.status ?? "draft") === statusFilter) &&
        (platformFilter === "all" ||
          (post.platforms ?? []).includes(platformFilter)),
    ) ?? []

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4 text-foreground">
      {props.subpath ? (
        <a className="text-sm underline" href={props.listHref}>
          All post drafts
        </a>
      ) : null}
      <h2 className="text-lg font-semibold">
        Post Drafts{data?.dataset.topic ? `: ${data.dataset.topic}` : ""}
      </h2>
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
                  setPlatformFilter(
                    event.target.value as PostPlatform | "all",
                  )
                }
                value={platformFilter}
              >
                <option value="all">All</option>
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platformLabel[platform]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {posts.length ? (
            <div className="grid min-w-0 gap-4">
              {posts.map((post) => (
                <PostCard handle={handle} key={post.id} post={post} />
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
