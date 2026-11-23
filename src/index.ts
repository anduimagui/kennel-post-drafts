// Browser entry. `kennel.json` binds its view to `PostDraftsPage`; keep this
// module free of Node-only imports.
export { default as PostDraftsPage } from "./pages/posts-page.tsx"
export type {
  Post,
  PostPlatform,
  PostStatus,
  PostDraftsDataset,
  PostDraftsFile,
} from "./model.ts"
