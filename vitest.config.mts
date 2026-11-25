import { defineConfig } from "vitest/config";

export default defineConfig({
  // n8n-workflow ships sourcemaps without their sources; Vite warns for each file.
  logLevel: "error",
  test: {
    include: ["test/**/*.test.ts"],
  },
});
