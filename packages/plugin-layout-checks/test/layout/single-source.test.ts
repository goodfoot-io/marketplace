import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_TREE,
  CODEX_TREE,
  EXPECTED_SKILLS,
  git,
  indexMode,
  OPENCODE_TREE,
  repoPath,
  SKILLS_ROOT,
  skillLinkText,
  walkFiles,
} from "../helpers.js";

const SKILL_SOURCE_ROOTS = [
  `${SKILLS_ROOT}/`,
  `${CLAUDE_TREE}/skills/`,
  `${CODEX_TREE}/skills/`,
  `${OPENCODE_TREE}/skills/`,
] as const;

describe("single-source rule", () => {
  it("keeps every tracked SKILL.md inside the four known roots", () => {
    const tracked = git(["ls-files", "--", "*SKILL.md"])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const strays = tracked.filter((filePath) => !SKILL_SOURCE_ROOTS.some((root) => filePath.startsWith(root)));
    expect(strays).toEqual([]);
  });

  it.each([...EXPECTED_SKILLS])("sources %s physically once, at the repo root", (skill) => {
    const rootSkillMd = repoPath(SKILLS_ROOT, skill, "SKILL.md");
    const stat = fs.lstatSync(rootSkillMd);
    expect(stat.isFile()).toBe(true);
    expect(stat.isSymbolicLink()).toBe(false);
  });
});

describe("symlinked skill surfaces (claude + opencode)", () => {
  for (const tree of [CLAUDE_TREE, OPENCODE_TREE]) {
    it.each([...EXPECTED_SKILLS])(`links ${tree}/skills/%s relatively at the shared source`, (skill) => {
      const rel = path.join(tree, "skills", skill);
      const abs = repoPath(rel);

      expect(indexMode(rel)).toBe("120000");
      expect(fs.readlinkSync(abs)).toBe(skillLinkText(skill));

      const resolved = fs.realpathSync(abs);
      expect(resolved).toBe(fs.realpathSync(repoPath(SKILLS_ROOT, skill)));
      expect(fs.existsSync(path.join(resolved, "SKILL.md"))).toBe(true);
    });
  }
});

describe("codex byte-copy surface", () => {
  // Spike-proven exception to the symlink rule: Codex installs silently drop
  // mode-120000 entries, so this surface ships real files whose bytes are
  // guarded equal to the source. When openai/codex#24770 lands, flip these to
  // symlinks and relax back to mode assertions.

  it.each([...EXPECTED_SKILLS])("copies %s as a full regular-file tree", (skill) => {
    const sourceDir = repoPath(SKILLS_ROOT, skill);
    const copyDir = repoPath(CODEX_TREE, "skills", skill);

    expect(fs.existsSync(copyDir)).toBe(true);

    const sourceFiles = walkFiles(sourceDir);
    const copyFiles = walkFiles(copyDir);
    expect(copyFiles).toEqual(sourceFiles);

    for (const relFile of sourceFiles) {
      const copyAbs = path.join(copyDir, relFile);
      const copyStat = fs.lstatSync(copyAbs);
      expect(copyStat.isSymbolicLink(), `${copyAbs} must not be a symlink`).toBe(false);
      expect(copyStat.isFile(), `${copyAbs} must be a regular file`).toBe(true);

      const sourceBytes = fs.readFileSync(path.join(sourceDir, relFile));
      const copyBytes = fs.readFileSync(copyAbs);
      expect(
        copyBytes.equals(sourceBytes),
        `${path.join(CODEX_TREE, "skills", skill, relFile)} has drifted from ${SKILLS_ROOT}/${skill}/${relFile}`,
      ).toBe(true);
    }
  });
});
