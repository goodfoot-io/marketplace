import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPath } from "../helpers.js";

const read = (path: string) => fs.readFileSync(repoPath(path), "utf8");

describe("Antigravity semantic consistency", () => {
  it("keeps the native boundary non-contradictory with foreign-host guidance", () => {
    const root = repoPath("plugins-antigravity/agent-hooks/skills");
    expect(fs.readdirSync(root).sort()).toEqual(["agent-hooks"]);
    const boundary = read("plugins-antigravity/agent-hooks/skills/agent-hooks/reference/antigravity.md");
    // Antigravity now builds, so the boundary inverts: the doc must document the
    // real import and the host-specific manifest location. It previously asserted
    // the opposite, which encoded the pre-implementation state of the CLI.
    expect(boundary).toContain("Import from `@goodfoot/agent-hooks/antigravity`");
    expect(boundary).toContain("--agent antigravity");
    // The host's contract file is the only oracle for Antigravity payload shapes;
    // inferring them from Claude Code or Codex previously shipped a fictional
    // typed surface that compiled and could never work.
    expect(boundary).toContain("CONTRACT.md");
    for (const doc of ["reference/antigravity.md", "reference/claude-code.md", "reference/codex.md"]) {
      expect(read(`plugins-antigravity/agent-hooks/skills/agent-hooks/${doc}`)).not.toMatch(
        /plugins-antigravity\/.*\/(?:hooks\.json|\.codex\/hooks\.json)/,
      );
    }
  });

  it.each([
    ["plugins-claude", "plugins-claude", "reference/claude-code.md"],
    ["plugins-claude", "plugins-claude", "reference/claude-code/installation.md"],
    ["plugins-codex", "plugins-claude", "reference/claude-code.md"],
    ["plugins-codex", "plugins-claude", "reference/claude-code/installation.md"],
    ["plugins-opencode", "plugins-claude", "reference/claude-code.md"],
    ["plugins-opencode", "plugins-claude", "reference/claude-code/installation.md"],
    ["plugins-antigravity", "plugins-claude", "reference/claude-code.md"],
    ["plugins-antigravity", "plugins-claude", "reference/claude-code/installation.md"],
    ["plugins-claude", "plugins-codex", "reference/codex.md"],
    ["plugins-claude", "plugins-codex", "reference/codex/installation.md"],
    ["plugins-codex", "plugins-codex", "reference/codex.md"],
    ["plugins-codex", "plugins-codex", "reference/codex/installation.md"],
    ["plugins-opencode", "plugins-codex", "reference/codex.md"],
    ["plugins-opencode", "plugins-codex", "reference/codex/installation.md"],
    ["plugins-antigravity", "plugins-codex", "reference/codex.md"],
    ["plugins-antigravity", "plugins-codex", "reference/codex/installation.md"],
  ])("keeps %s/%s/%s on its subject-platform authoring root", (tree, subjectRoot, file) => {
    const text = read(`${tree}/agent-hooks/skills/agent-hooks/${file}`);
    expect(text).toContain(`../../${subjectRoot}/my-plugin`);
    expect(text).not.toContain("plugins-antigravity/my-plugin");
  });

  it.each([
    "plugins-claude",
    "plugins-codex",
    "plugins-opencode",
    "plugins-antigravity",
  ])("aligns %s agent-skills policy with verified native subagent operations", (tree) => {
    const policy = read(`${tree}/agent-skills/skills/agent-skills/reference/antigravity.md`);
    expect(policy).toContain("`invoke_subagent`");
    expect(policy).toContain("`send_message`");
    expect(policy).toContain("`manage_subagents`");
    expect(policy).toContain("worktree operations remain unavailable");
    expect(policy).not.toMatch(/subagent dispatch[^.\n]*(?:unavailable|prohibit)/i);
  });
});
