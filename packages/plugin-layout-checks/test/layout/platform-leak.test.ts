import { describe, expect, it } from "vitest";
import { CLAUDE_ROOT_TOKEN, CODEX_ROOT_TOKEN, scanText, scanTree } from "../gates.js";
import { allTargets } from "../registry.js";

describe("Gate B — wrong-platform tokens in generated output", () => {
  it("sees inside fenced code blocks", () => {
    // agent-skills lint blanks every fenced line before any rule runs, so a
    // template whose ```! fence carries a Claude path lints clean and builds
    // that literal verbatim into the Codex tree. This gate is the detector.
    const fenced = [
      "# Setup",
      "```bash",
      `echo "@${CLAUDE_ROOT_TOKEN}/skills/gmail/advanced/oauth-setup.md"`,
      "```",
    ].join("\n");
    expect(scanText("codex", "codex/SKILL.md", fenced)).toEqual([
      { file: "codex/SKILL.md", line: 3, token: CLAUDE_ROOT_TOKEN },
    ]);
  });

  it("matches the substitution form, not the bare identifier", () => {
    // Correct Codex prose about Codex, which must survive verbatim.
    const prose = "Codex injects `PLUGIN_ROOT` (and `CLAUDE_PLUGIN_ROOT` for compatibility)";
    expect(scanText("codex", "codex/SKILL.md", prose)).toEqual([]);
    expect(scanText("claude-code", "claude/SKILL.md", prose)).toEqual([]);
  });

  it("flags the Codex root variable in a Claude tree", () => {
    const usage = `run ${CODEX_ROOT_TOKEN}/bin/x`;
    expect(scanText("claude-code", "f.md", usage)).toEqual([{ file: "f.md", line: 1, token: CODEX_ROOT_TOKEN }]);
    expect(scanText("codex", "f.md", usage)).toEqual([]);
  });

  it("flags a tree path that does not match the tree it sits in", () => {
    expect(scanText("codex", "f.md", "see plugins-claude/gmail/skills/gmail/SKILL.md")).toEqual([
      { file: "f.md", line: 1, token: "plugins-claude/" },
    ]);
    expect(scanText("codex", "f.md", "see plugins-codex/gmail/skills/gmail/SKILL.md")).toEqual([]);
  });

  it.each(
    allTargets().map((target) => [target.plugin, target.platform, target.path] as const),
  )("leaks no wrong-platform token from %s into the %s tree at %s", (_plugin, platform, treePath) => {
    const leaks = scanTree(platform, treePath);
    expect(
      leaks,
      `wrong-platform tokens:\n${leaks.map((leak) => `${leak.file}:${leak.line} ${leak.token}`).join("\n")}`,
    ).toEqual([]);
  });
});
