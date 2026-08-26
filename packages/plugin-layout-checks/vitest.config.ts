import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globals: false,
    // The generated-fresh spec runs two full esbuild bundle builds; everything
    // else is filesystem/git work. Defaults are fine except for that one.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
