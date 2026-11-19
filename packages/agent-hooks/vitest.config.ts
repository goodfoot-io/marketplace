import { loadCacheContract, withTestOutput } from "@goodfoot/vitest-cache/policy";
import { defineConfig, defineProject } from "vitest/config";
import { CLI_HOOK_TIMEOUT_MS, CLI_TEST_TIMEOUT_MS } from "./tests/helpers/cli-timeouts.js";

export default withTestOutput(
  defineConfig({
    test: {
      reporters: "verbose",
      projects: [
        defineProject({
          test: {
            name: "agent-hooks",
            globals: true,
            environment: "node",
            include: ["tests/**/*.test.ts"],
            exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
            // These tests also spawn cold tsx/esbuild processes, including three
            // sequential 45s builds in a topology test. Bound the whole sequence
            // and fixture setup, not just the old 5s test / 10s hook defaults.
            testTimeout: CLI_TEST_TIMEOUT_MS,
            hookTimeout: CLI_HOOK_TIMEOUT_MS,
          },
        }),
        defineProject({
          test: {
            name: "agent-hooks-e2e",
            globals: true,
            environment: "node",
            include: ["e2e/**/*.test.ts"],
            exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
            // Ported from claude-code-hooks' e2e project: e2e tests spawn the CLI
            // via tsx (and scaffold tests run Yarn installs inside generated
            // projects), which need explicit test and fixture deadlines under load.
            testTimeout: 120000,
            hookTimeout: 60000,
          },
        }),
      ],
    },
  }),
  loadCacheContract(new URL("./vitest.cache.json", import.meta.url)),
);
