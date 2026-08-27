import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPath } from "../helpers.js";

describe("dead-path check", () => {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repoPath("."), encoding: "utf8" })
    .split("\0")
    .filter(Boolean);

  it("does not track the removed top-level plugins directory", () => {
    expect(tracked.filter((file) => file.startsWith("plugins/"))).toEqual([]);
    expect(fs.existsSync(repoPath("plugins"))).toBe(false);
  });

  it("leaves no live tracked reference to the removed top-level plugins directory", () => {
    const fixtureFiles = new Set([
      // These tests construct isolated legacy repositories; their literals are
      // inputs to compatibility behavior, not paths in this repository.
      "packages/agent-hooks/tests/cli.test.ts",
      "packages/plugin-layout-checks/test/layout/release-identity.test.ts",
      // Named transforms reconstruct immutable pre-migration corpus paths.
      "packages/plugin-layout-checks/test/layout/templated-equivalence.test.ts",
      "packages/plugin-layout-checks/test/layout/version-bump-hook.test.ts",
      "packages/plugin-layout-checks/test/layout/dead-path.test.ts",
    ]);
    const violations: string[] = [];

    for (const file of tracked) {
      if (
        fixtureFiles.has(file) ||
        file.startsWith("packages/plugin-layout-checks/test/fixtures/") ||
        file.startsWith(".span/") ||
        file.endsWith("CHANGELOG.md")
      ) {
        continue;
      }
      const bytes = fs.readFileSync(repoPath(file));
      if (bytes.includes(0)) continue;
      bytes
        .toString("utf8")
        .split("\n")
        .forEach((line, index) => {
          // Installed/cache paths are intentionally not repository authoring
          // destinations and retain their platform-defined names.
          const scrubbed = line
            .replaceAll(".claude/plugins/", "")
            .replaceAll(".agents/plugins/", "")
            .replaceAll(".yarn/plugins/", "");
          if (/(^|[^A-Za-z0-9_.-])plugins\//.test(scrubbed)) {
            violations.push(`${file}:${index + 1}:${line.trim()}`);
          }
        });
    }

    expect(violations, `live references to the removed plugins/ root:\n${violations.join("\n")}`).toEqual([]);
  });
});
