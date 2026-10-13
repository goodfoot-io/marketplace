import { fileURLToPath } from "node:url";
import { loadCacheContract, withTestOutput } from "@goodfoot/vitest-cache/policy";
import { defineConfig } from "vitest/config";

export default withTestOutput(
  defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    test: {
      globals: true,
      environment: "node",
      reporters: "verbose",
      include: ["tests/**/*.test.ts", "e2e/**/*.test.ts"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    },
  }),
  loadCacheContract(new URL("./vitest.cache.json", import.meta.url)),
);
