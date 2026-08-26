import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { git, REPO_ROOT, SKILLS_ROOT } from "../helpers.js";

describe("generated bundle freshness", () => {
  // The wiki gate: rebuild the esbuild pipeline whose output is committed,
  // then require a clean tree. A stale or hand-edited bundle must never ship
  // silently.
  it("leaves the typescript-metrics skill bin/ byte-identical after a full rebuild", { timeout: 600_000 }, () => {
    execSync("yarn workspace @goodfoot/typescript-metrics build", {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 240_000,
      env: { ...process.env },
    });

    const dirty = git(["status", "--porcelain", "--", `${SKILLS_ROOT}/typescript-metrics/bin`]).trim();
    expect(dirty, `committed bundle went stale after rebuild:\n${dirty}`).toBe("");
  });
});
