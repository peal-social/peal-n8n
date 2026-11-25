import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import vitest from "ultracite/oxlint/vitest";

import { untouched } from "./oxfmt.config.mts";

export default defineConfig({
  env: core.env ?? {},
  extends: [core, antiSlop, vitest],
  ignorePatterns: [...(core.ignorePatterns ?? []), ...untouched, "dist/**"],
  // Rules that read types, through tsgolint: floating promises, unsafe `any` and the like.
  options: { typeAware: true },
  overrides: [
    {
      // n8n loads each node and credential by its file name, and its own lint
      // requires the class to be named after it: `Peal.node.ts` holds `Peal`.
      files: ["**/*.node.ts", "**/*.credentials.ts"],
      rules: { "unicorn/filename-case": "off" },
    },
    {
      // n8n calls a node's hooks, load-option and webhook methods with its
      // execution context as `this`. It loads nodes with require(), unbundled.
      files: ["nodes/**"],
      rules: { "oxc/no-this-in-exported-function": "off" },
    },
    {
      // n8n types every request hook as returning a promise, whether or not
      // it awaits anything, and awaits the promise each one returns.
      files: ["nodes/Peal/hooks.ts"],
      rules: { "eslint/require-await": "off" },
    },
    {
      // The one boundary with untyped data, n8n's parameters and Peal's JSON.
      // n8n Cloud refuses runtime dependencies, so there is no schema library:
      // these readers check each shape and return typed values.
      files: ["nodes/shared/parse.ts"],
      rules: {
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unknown-returns": "off",
        "anti-slop/no-unsafe-dictionary-type": "off",
      },
    },
  ],
});
