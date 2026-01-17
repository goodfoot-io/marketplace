import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/fixtures/**/*.test.ts"],
    globals: false,
  },
});
