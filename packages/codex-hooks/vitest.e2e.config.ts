import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["e2e/**/*.test.ts"],
    globals: false,
  },
});
