import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import corpus from "../fixtures/agent-skills-authored-corpus.json" with { type: "json" };
import topology from "../fixtures/agent-skills-legacy-topology.json" with { type: "json" };
import {
  CLAUDE_TREE,
  CODEX_TREE,
  OPENCODE_TREE,
  repoPath,
  SKILLS_ROOT,
  SKILLS_SOURCE_ROOT,
  walkFiles,
} from "../helpers.js";

const targets = [SKILLS_ROOT, `${CLAUDE_TREE}/skills`, `${CODEX_TREE}/skills`, `${OPENCODE_TREE}/skills`] as const;
const digest = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");

describe("agent-skills migration contract", () => {
  it("keeps the authored source corpus immutable while changing only Markdown filenames", () => {
    const sourceFiles = walkFiles(repoPath(SKILLS_SOURCE_ROOT));
    expect(sourceFiles).toEqual(corpus.files.map(({ path: file }) => (file.endsWith(".md") ? `${file}.eta` : file)));
    for (const entry of corpus.files) {
      const source = repoPath(SKILLS_SOURCE_ROOT, entry.path.endsWith(".md") ? `${entry.path}.eta` : entry.path);
      expect(digest(fs.readFileSync(source)), entry.path).toBe(entry.sha256);
      expect(fs.statSync(source).mode & 0o777, entry.path).toBe(entry.mode);
    }
  });

  it("renders every target as the authored byte/mode/inventory corpus", () => {
    for (const target of targets) {
      expect(walkFiles(repoPath(target))).toEqual(corpus.files.map(({ path: file }) => file));
      for (const entry of corpus.files) {
        const output = repoPath(target, entry.path);
        expect(fs.lstatSync(output).isSymbolicLink(), `${target}/${entry.path}`).toBe(false);
        expect(digest(fs.readFileSync(output)), `${target}/${entry.path}`).toBe(entry.sha256);
        expect(fs.statSync(output).mode & 0o777, `${target}/${entry.path}`).toBe(entry.mode);
      }
    }
  });

  it("records the intentional legacy symlink-to-regular-tree transition separately", () => {
    expect(topology).toMatchObject({ claudeMode: "120000", codexMode: "100644", opencodeMode: "120000" });
    for (const target of targets) {
      for (const skill of corpus.skills) expect(fs.lstatSync(repoPath(target, skill)).isDirectory()).toBe(true);
    }
  });
});
