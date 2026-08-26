import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_TREE,
  CODEX_TREE,
  EXPECTED_SKILL_BIN,
  indexEntries,
  indexMode,
  OPENCODE_TREE,
  repoPath,
  SKILLS_ROOT,
  walkFiles,
} from "../helpers.js";

describe("bin executability", () => {
  it("tracks every bin file at mode 100755 through relocation", () => {
    const entries = indexEntries(`${CLAUDE_TREE}/bin`);
    expect(entries.length).toBeGreaterThan(0);

    const wrongMode = entries.filter((entry) => entry.mode !== "100755");
    expect(
      wrongMode.map((entry) => `${entry.mode} ${entry.path}`),
      "relocation dropped the executable bit in the git index",
    ).toEqual([]);
  });

  it("keeps filesystem execute bits set on every bin file", () => {
    const binDir = repoPath(CLAUDE_TREE, "bin");
    for (const relFile of walkFiles(binDir)) {
      const abs = path.join(binDir, relFile);
      fs.accessSync(abs, fs.constants.X_OK);
    }
  });

  it("resolves the opencode bin link to the claude bin home", () => {
    const linkAbs = repoPath(OPENCODE_TREE, "bin");
    expect(fs.readlinkSync(linkAbs)).toBe("../../plugins-claude/goodfoot/bin");

    const claudeBin = fs.realpathSync(repoPath(CLAUDE_TREE, "bin"));
    expect(fs.realpathSync(linkAbs)).toBe(claudeBin);

    // OpenCode loads local plugin trees in place rather than cache-copying;
    // this lstat assertion trips if that assumption ever breaks.
    expect(fs.lstatSync(linkAbs).isSymbolicLink()).toBe(true);
  });

  it("keeps skill-owned bin/ scripts executable at every physical location", () => {
    for (const [skill, files] of Object.entries(EXPECTED_SKILL_BIN)) {
      for (const file of files) {
        for (const abs of [
          repoPath(SKILLS_ROOT, skill, "bin", file),
          repoPath(CLAUDE_TREE, "skills", skill, "bin", file),
          repoPath(CODEX_TREE, "skills", skill, "bin", file),
        ]) {
          fs.accessSync(abs, fs.constants.X_OK);
        }
        expect(indexMode(path.join(SKILLS_ROOT, skill, "bin", file))).toBe("100755");
        expect(indexMode(path.join(CODEX_TREE, "skills", skill, "bin", file))).toBe("100755");
      }
    }
  });
});
