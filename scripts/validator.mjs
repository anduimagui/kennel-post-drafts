import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import Ajv2020 from "ajv/dist/2020.js"
import standaloneCode from "ajv/dist/standalone/index.js"
import { build } from "esbuild"

const root = new URL("../", import.meta.url)
const schema = JSON.parse(await readFile(new URL("schema.json", root), "utf8"))
const ajv = new Ajv2020({ allErrors: true, code: { source: true, esm: true } })
const validate = ajv.compile(schema)
const result = await build({
  stdin: {
    contents: standaloneCode(ajv, validate),
    resolveDir: fileURLToPath(root),
    sourcefile: "post-drafts-validator.js",
  },
  absWorkingDir: fileURLToPath(root),
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
  minify: true,
  banner: {
    js: "// Generated from schema.json by bun run schema:build. Do not edit.",
  },
})
const content = result.outputFiles[0].text
const target = new URL("src/validate.js", root)
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== content) {
    throw new Error(
      "Validator does not match schema.json. Run bun run schema:build.",
    )
  }
  console.log("Validator matches schema.json.")
} else {
  await writeFile(target, content)
  console.log("Wrote src/validate.js (self-contained schema validator).")
}
