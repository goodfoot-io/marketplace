import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CLAUDE_TREE, git, REPO_ROOT } from "../helpers.js";

describe("generated bundle freshness", () => {
  // The wiki gate: rebuild both esbuild pipelines whose outputs are committed
  // into the shared bin home, then require a clean tree. A stale or
  // hand-edited bundle must never ship silently.
  it("leaves the bin home byte-identical after a full rebuild", { timeout: 600_000 }, () => {
    execSync("yarn workspace @goodfoot/print build", {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 240_000,
      env: { ...process.env },
    });
    execSync("yarn workspace @goodfoot/typescript-metrics build", {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 240_000,
      env: { ...process.env },
    });

    const dirty = git(["status", "--porcelain", "--", `${CLAUDE_TREE}/bin`]).trim();
    expect(dirty, `committed bundles went stale after rebuild:\n${dirty}`).toBe("");
  });
});
