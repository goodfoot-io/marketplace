import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_TREE,
  CODEX_TREE,
  EXPECTED_SKILLS,
  OPENCODE_TREE,
  repoPath,
  SKILLS_ROOT,
  SKILLS_SOURCE_ROOT,
  walkFiles,
} from "../helpers.js";

const outputs = [SKILLS_ROOT, `${CLAUDE_TREE}/skills`, `${CODEX_TREE}/skills`, `${OPENCODE_TREE}/skills`] as const;

describe("generated skill surfaces", () => {
  it("keeps Markdown authored only as Eta templates", () => {
    expect(fs.readdirSync(repoPath("skills-src"))).toEqual(["goodfoot"]);
    const templates = walkFiles(repoPath(SKILLS_SOURCE_ROOT)).filter((file) => file.endsWith(".md.eta"));
    expect(templates.length).toBeGreaterThan(0);
    expect(walkFiles(repoPath(SKILLS_SOURCE_ROOT)).filter((file) => file.endsWith(".md"))).toEqual([]);
  });

  it.each(outputs)("contains a complete regular-file tree at %s", (output) => {
    expect(fs.readdirSync(repoPath(output)).sort()).toEqual([...EXPECTED_SKILLS].sort());
    for (const file of walkFiles(repoPath(output))) {
      const stat = fs.lstatSync(path.join(repoPath(output), file));
      expect(stat.isSymbolicLink(), `${output}/${file}`).toBe(false);
      expect(stat.isFile(), `${output}/${file}`).toBe(true);
    }
  });

  it("contains no symlink anywhere in a generated skill tree", () => {
    for (const output of outputs) {
      const pending = [repoPath(output)];
      while (pending.length > 0) {
        const current = pending.pop();
        if (!current) continue;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const absolute = path.join(current, entry.name);
          expect(fs.lstatSync(absolute).isSymbolicLink(), absolute).toBe(false);
          if (entry.isDirectory()) pending.push(absolute);
        }
      }
    }
  });
});
