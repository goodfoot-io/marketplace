import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { CLAUDE_TREE, indexEntries, OPENCODE_TREE, repoPath, walkFiles } from "../helpers.js";

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
});
