import { loadCacheContract, withTestOutput } from "@goodfoot/vitest-cache/policy";
import { defineConfig } from "vitest/config";

export default withTestOutput(
  defineConfig({
    test: {
      include: ["test/**/*.test.ts"],
      exclude: ["test/fixtures/**/*.test.ts"],
      globals: false,
    },
  }),
  loadCacheContract(new URL("./vitest.cache.json", import.meta.url)),
);
