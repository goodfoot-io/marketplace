import { describe, expect, it } from "vitest";
import { git } from "../helpers.js";

describe("dead-path check", () => {
  // The pre-split location must be gone everywhere: build configs included,
  // so no rebuild can resurrect the deleted tree with fresh bundles.
  it("leaves no live tracked reference to plugins/goodfoot", () => {
    let matches: string;
    try {
      matches = git([
        "grep",
        "-I",
        "-n",
        "-e",
        "plugins/goodfoot",
        "--",
        ".",
        ":(exclude)packages/plugin-layout-checks/test/layout/dead-path.test.ts",
      ]);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 1) return; // exit 1 = no matches
      throw error;
    }

    const lines = matches.trim().split("\n").filter(Boolean);
    expect(lines, `stale references to the deleted plugins/goodfoot path:\n${lines.join("\n")}`).toEqual([]);
  });
});
