import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/fixtures/**/*.test.ts"],
    globals: false,
    // TypeAnalyzer.test.ts spawns the type-analysis CLI via execSync up to
    // four times in beforeAll; each run builds a full TypeScript program
    // (~1.5s per run at load 8, worse under heavier load). The defaults
    // (5000ms tests / 10000ms hooks) are too tight on a shared devcontainer.
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
