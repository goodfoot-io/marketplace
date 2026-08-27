import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPath } from "../helpers.js";

const read = (path: string) => fs.readFileSync(repoPath(path), "utf8");

describe("Antigravity semantic consistency", () => {
  it("keeps the native boundary non-contradictory with foreign-host guidance", () => {
    const root = repoPath("plugins-antigravity/agent-hooks/skills");
    expect(fs.readdirSync(root).sort()).toEqual(["antigravity", "claude-code", "codex"]);
    const boundary = read("plugins-antigravity/agent-hooks/skills/antigravity/SKILL.md");
    expect(boundary).toContain("Antigravity is not a consumable `@goodfoot/agent-hooks` target yet");
    expect(boundary).toContain("Do not suggest imports from `@goodfoot/agent-hooks/antigravity`");
    for (const skill of ["antigravity/SKILL.md", "claude-code/SKILL.md", "codex/SKILL.md"]) {
      expect(read(`plugins-antigravity/agent-hooks/skills/${skill}`)).not.toMatch(
        /plugins-antigravity\/.*\/(?:hooks\.json|\.codex\/hooks\.json)/,
      );
    }
  });

  it.each([
    ["plugins-claude", "claude-code", "plugins-claude", "SKILL.md"],
    ["plugins-claude", "claude-code", "plugins-claude", "reference/installation.md"],
    ["plugins-codex", "claude-code", "plugins-claude", "SKILL.md"],
    ["plugins-codex", "claude-code", "plugins-claude", "reference/installation.md"],
    ["plugins-opencode", "claude-code", "plugins-claude", "SKILL.md"],
    ["plugins-opencode", "claude-code", "plugins-claude", "reference/installation.md"],
    ["plugins-antigravity", "claude-code", "plugins-claude", "SKILL.md"],
    ["plugins-antigravity", "claude-code", "plugins-claude", "reference/installation.md"],
    ["plugins-claude", "codex", "plugins-codex", "SKILL.md"],
    ["plugins-claude", "codex", "plugins-codex", "reference/installation.md"],
    ["plugins-codex", "codex", "plugins-codex", "SKILL.md"],
    ["plugins-codex", "codex", "plugins-codex", "reference/installation.md"],
    ["plugins-opencode", "codex", "plugins-codex", "SKILL.md"],
    ["plugins-opencode", "codex", "plugins-codex", "reference/installation.md"],
    ["plugins-antigravity", "codex", "plugins-codex", "SKILL.md"],
    ["plugins-antigravity", "codex", "plugins-codex", "reference/installation.md"],
  ])("keeps %s/%s/%s on its subject-platform authoring root", (tree, skill, subjectRoot, file) => {
    const text = read(`${tree}/agent-hooks/skills/${skill}/${file}`);
    expect(text).toContain(`../../${subjectRoot}/my-plugin`);
    expect(text).not.toContain("plugins-antigravity/my-plugin");
  });

  it.each(["plugins-claude", "plugins-codex", "plugins-opencode", "plugins-antigravity"])(
    "aligns %s agent-skills policy with verified native subagent operations",
    (tree) => {
      const policy = read(`${tree}/agent-skills/skills/antigravity/SKILL.md`);
      expect(policy).toContain("`invoke_subagent`");
      expect(policy).toContain("`send_message`");
      expect(policy).toContain("`manage_subagents`");
      expect(policy).toContain("worktree operations remain unavailable");
      expect(policy).not.toMatch(/subagent dispatch[^.\n]*(?:unavailable|prohibit)/i);
    },
  );
});
