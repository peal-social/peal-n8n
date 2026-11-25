import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

// n8n's lint checks that eslint.config.mjs is the file its CLI generates, byte
// for byte (strict mode, in package.json's `n8n`), so it stays as written.
export const untouched = [
  "eslint.config.mjs",
  "pnpm-lock.yaml",
  "CHANGELOG.md",
];

export default defineConfig({
  ...ultracite,
  ignorePatterns: [...(ultracite.ignorePatterns ?? []), ...untouched],
  // Keep prose wrapped as written rather than joining each paragraph into one line.
  proseWrap: "preserve",
});
