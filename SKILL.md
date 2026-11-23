---
name: kennel-post-drafts
description: Create, update, inspect, and verify posts.json social media post drafts for the Kennel Post Drafts plugin while keeping the JSON document valid against the published schema.
---

# Kennel Post Drafts Plugin

Use this skill for Post Drafts plugin data in `posts.json`.

## When to add drafts

When the user discusses promoting something from this folder — a product, a
launch, a write-up, a service, an idea — draft social media posts for it:

1. Read `posts.json` if it exists, keeping existing post `id` values stable.
2. Write one draft per distinct angle (announcement, behind the scenes,
   lesson learned, question to the audience). Do not repeat one angle.
3. Match the angle to the network: X posts stay short and punchy, LinkedIn
   posts lead with the outcome, Reddit and Hacker News posts lead with the
   story and never sound like marketing.
4. Include ready-to-post text in `body`, with hashtags inline for X-style
   networks and in `hashtags` for filtering.
5. Set `status` to `draft` unless the user schedules or posts it. Record
   `scheduledFor` and `postedUrl` when known.

If `posts.json` does not exist, create it with the `$schema` field set to the
schema URL below, a `topic` naming the subject being promoted, and a `posts`
array.

## JSON authoring

Work directly in a JSON document that matches the published schema:
[`https://raw.githubusercontent.com/anduimagui/kennel-post-drafts/main/schema.json`](https://raw.githubusercontent.com/anduimagui/kennel-post-drafts/main/schema.json).
Include the document's `$schema` URL. Use only fields allowed by the schema,
keep post IDs stable and unique, and validate the complete document before
reporting success.

Do not invent claims, metrics, or quotes. Base each draft on the discussion
or the folder's real content.

## Verification

From the plugin repository, run the relevant checks after changes:

```sh
bun run schema:check
bun run typecheck
```
