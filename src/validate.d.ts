import type { ValidateFunction } from "ajv"
import type { PostDraftsFile } from "./model.ts"

declare const validate: ValidateFunction<PostDraftsFile>
export default validate
