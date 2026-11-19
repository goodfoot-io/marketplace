/** GOO-143: inspect the actual inline project after the cache policy has wrapped it. */
import { describe, expect, it } from "vitest";
import configuration from "../../vitest.config.js";
import { CLI_HOOK_TIMEOUT_MS, CLI_SPAWN_TIMEOUT_MS, CLI_TEST_TIMEOUT_MS } from "../helpers/cli-timeouts.js";

async function unitTimeouts() {
  const config = await configuration;
  const projects = await Promise.all(config.test?.projects ?? []);
  const unit = projects.find(
    (project) => typeof project === "object" && project !== null && project.test?.name === "agent-hooks",
  );
  if (typeof unit !== "object" || unit === null || unit.test === undefined) {
    throw new Error("The agent-hooks unit project is missing");
  }
  return {
    testTimeout: unit.test.testTimeout,
    hookTimeout: unit.test.hookTimeout,
  };
}

describe("CLI subprocess timeout budgets", () => {
  it("applies the configured deadline to the running worker", ({ task }) => {
    expect(task.timeout).toBe(CLI_TEST_TIMEOUT_MS);
  });

  it("keeps the three-build topology sequence inside a finite test deadline", async () => {
    const { testTimeout } = await unitTimeouts();
    expect(Number.isFinite(testTimeout)).toBe(true);
    expect(testTimeout).toBeGreaterThan(3 * CLI_SPAWN_TIMEOUT_MS);
    expect(testTimeout).toBe(CLI_TEST_TIMEOUT_MS);
  });

  it("gives cold fixture setup a finite deadline above the child-process allowance", async () => {
    const { hookTimeout } = await unitTimeouts();
    expect(Number.isFinite(hookTimeout)).toBe(true);
    expect(hookTimeout).toBeGreaterThan(CLI_SPAWN_TIMEOUT_MS);
    expect(hookTimeout).toBe(CLI_HOOK_TIMEOUT_MS);
  });
});
