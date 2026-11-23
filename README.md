# kennel-post-drafts

A Kennel plugin for draft social media posts. It discovers a `posts.json`
document in the current folder and renders its posts as social-media-style
cards in the Kennel viewer, with status and platform filters and copy-to-
clipboard for each draft.

Each post draft targets one or more networks (X, LinkedIn, Reddit, Hacker
News, Mastodon, Bluesky, Threads, Instagram, Facebook, Telegram, newsletter)
and moves through a `draft` → `scheduled` → `posted` life cycle. The bundled
agent skill (`SKILL.md`) teaches coding agents to add new drafts to
`posts.json` from the current discussion.

## Install

```sh
kennel plugin add https://github.com/anduimagui/kennel-post-drafts.git --install-skill
```

Or from a local checkout:

```sh
kennel plugin add /path/to/kennel-post-drafts --install-skill
```

Then scaffold a starter `posts.json` in any folder with:

```sh
kennel init --plugin post-drafts
```

## Data format

`posts.json` validates against [`schema.json`](./schema.json):

```json
{
  "$schema": "https://raw.githubusercontent.com/anduimagui/kennel-post-drafts/main/schema.json",
  "topic": "My product launch",
  "posts": [
    {
      "id": "launch-announcement",
      "title": "Launch announcement",
      "platforms": ["x", "linkedin"],
      "body": "We shipped something new.",
      "hashtags": ["launch"],
      "status": "draft"
    }
  ]
}
```

## Development

```sh
bun install
bun run schema:build   # regenerate src/validate.js from schema.json
bun run schema:check   # verify the validator matches schema.json
bun run typecheck
```
