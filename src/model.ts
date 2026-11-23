export type PostPlatform =
  | "x"
  | "linkedin"
  | "reddit"
  | "hackernews"
  | "mastodon"
  | "bluesky"
  | "threads"
  | "instagram"
  | "facebook"
  | "telegram"
  | "newsletter"

export type PostStatus = "draft" | "scheduled" | "posted"

export type Post = {
  id: string
  title?: string
  platforms?: PostPlatform[]
  body: string
  hashtags?: string[]
  status?: PostStatus
  scheduledFor?: string
  postedUrl?: string
  notes?: string
}

export type PostDraftsFile = {
  topic?: string
  platforms?: PostPlatform[]
  posts: Post[]
}
export type PostDraftsDataset = {
  topic?: string
  platforms?: PostPlatform[]
  posts: Post[]
}
