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

  it("treats a backticked token as a mention, not a use", () => {
    // agent-hooks' codex/SKILL.md:285 and :300 verbatim. The skill documenting
    // Codex hooks ships to Claude Code readers, so these render into the
    // *Claude* tree while correctly describing what Codex emits. Note :300
    // carries the brace form and the bare form in one sentence — the
    // brace-vs-bare rule above cannot save it on its own.
    const table = `| **plugin** | \`--plugin-root\` | \`node "${CODEX_ROOT_TOKEN}/hooks/<name>.mjs"\` | stable |`;
    const prose =
      `Plugin mode emits \`${CODEX_ROOT_TOKEN}\`-relative commands and stable filenames. ` +
      "Codex injects `PLUGIN_ROOT` (and `CLAUDE_PLUGIN_ROOT` for compatibility).";
    expect(scanText("claude-code", "codex/SKILL.md", table)).toEqual([]);
    expect(scanText("claude-code", "codex/SKILL.md", prose)).toEqual([]);
  });

  it("still flags an unbackticked use on a prose line", () => {
    // The mention exemption is delimiter-scoped, not token-scoped: the same
    // token one character outside the backticks is still a leak.
    const reference = `See @${CODEX_ROOT_TOKEN}/skills/agent-hooks/reference/x.md for details.`;
    expect(scanText("claude-code", "f.md", reference)).toEqual([{ file: "f.md", line: 1, token: CODEX_ROOT_TOKEN }]);
  });

  it("still sees a backticked token inside a fenced block", () => {
    // Fenced content is what agent-skills lint cannot see and what this gate
    // exists for, so the inline-code exemption must not reach inside a fence.
    // A backtick in shell is command substitution, not a markdown code span.
    const fenced = ["```bash", `echo \`cat ${CLAUDE_ROOT_TOKEN}/skills/x/SKILL.md\``, "```"].join("\n");
    expect(scanText("codex", "codex/SKILL.md", fenced)).toEqual([
      { file: "codex/SKILL.md", line: 2, token: CLAUDE_ROOT_TOKEN },
    ]);
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
