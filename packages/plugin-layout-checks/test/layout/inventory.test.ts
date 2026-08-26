import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_TREE,
  CODEX_TREE,
  EXPECTED_AGENTS,
  EXPECTED_BIN,
  EXPECTED_BIN_TESTS,
  EXPECTED_COMMANDS,
  EXPECTED_SKILLS,
  indexMode,
  OPENCODE_TREE,
  readJson,
  repoPath,
  SKILLS_ROOT,
} from "../helpers.js";

describe("claude tree inventory", () => {
  it("carries exactly the expected top-level components", () => {
    expect(fs.readdirSync(repoPath(CLAUDE_TREE)).sort()).toEqual([
      ".claude-plugin",
      "agents",
      "bin",
      "commands",
      "hooks",
      "skills",
    ]);
  });

  it("exposes all six skills as directory entries", () => {
    const skillsDir = repoPath(CLAUDE_TREE, "skills");
    expect(fs.readdirSync(skillsDir).sort()).toEqual([...EXPECTED_SKILLS].sort());
  });

  it("ships the seven commands verbatim", () => {
    const commandsDir = repoPath(CLAUDE_TREE, "commands");
    expect(fs.readdirSync(commandsDir).sort()).toEqual([...EXPECTED_COMMANDS].sort());
  });

  it("ships the two agents verbatim", () => {
    const agentsDir = repoPath(CLAUDE_TREE, "agents");
    expect(fs.readdirSync(agentsDir).sort()).toEqual([...EXPECTED_AGENTS].sort());
  });

  it("hosts the shared bin home physically with the full script inventory", () => {
    const binDir = repoPath(CLAUDE_TREE, "bin");
    const entries = fs.readdirSync(binDir).filter((name) => name !== "tests");
    expect(entries.sort()).toEqual([...EXPECTED_BIN].sort());

    const testsDir = repoPath(CLAUDE_TREE, "bin", "tests");
    expect(fs.readdirSync(testsDir).sort()).toEqual([...EXPECTED_BIN_TESTS].sort());
  });

  it("declares a claude manifest for goodfoot", () => {
    const manifest = readJson<{ name: string; version: string }>(path.join(CLAUDE_TREE, ".claude-plugin/plugin.json"));
    expect(manifest.name).toBe("goodfoot");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("carries the hook pattern files", () => {
    expect(fs.existsSync(repoPath(CLAUDE_TREE, "hooks/hooks.json"))).toBe(true);
    expect(fs.existsSync(repoPath(CLAUDE_TREE, "hooks/bin/post-tool-use.mjs"))).toBe(true);
  });
});

describe("codex tree inventory", () => {
  it("carries exactly the expected top-level components and no bin home", () => {
    expect(fs.readdirSync(repoPath(CODEX_TREE)).sort()).toEqual([".codex-plugin", "hooks", "skills"]);
    // A symlinked or copied bin would either vanish on install (symlink,
    // spike-proven) or triple ~59MB of generated bundles (copy).
    expect(fs.existsSync(repoPath(CODEX_TREE, "bin"))).toBe(false);
  });

  it("declares a codex manifest with interface block and skills pointer", () => {
    const manifest = readJson<{
      name: string;
      skills?: string;
      interface?: Record<string, unknown>;
    }>(path.join(CODEX_TREE, ".codex-plugin/plugin.json"));
    expect(manifest.name).toBe("goodfoot");
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.interface).toBeTypeOf("object");
    expect(Object.keys(manifest.interface ?? {})).toContain("displayName");
  });

  it("carries the hook pattern files with PLUGIN_ROOT transport", () => {
    expect(fs.existsSync(repoPath(CODEX_TREE, "hooks/hooks.json"))).toBe(true);
    expect(fs.existsSync(repoPath(CODEX_TREE, "hooks/post-tool-use.mjs"))).toBe(true);
  });
});

describe("opencode tree inventory", () => {
  it("carries exactly the expected top-level components", () => {
    expect(fs.readdirSync(repoPath(OPENCODE_TREE)).sort()).toEqual(["bin", "index.js", "package.json", "skills"]);
  });

  it("declares a private local plugin package exporting index.js", () => {
    const pkg = readJson<{ name: string; private?: boolean; exports?: Record<string, string> }>(
      path.join(OPENCODE_TREE, "package.json"),
    );
    expect(pkg.name).toBe("@goodfoot/opencode-goodfoot");
    expect(pkg.private).toBe(true);
    expect(pkg.exports?.["."]).toBe("./index.js");
  });

  it("exposes all six skills as directory entries", () => {
    const skillsDir = repoPath(OPENCODE_TREE, "skills");
    expect(fs.readdirSync(skillsDir).sort()).toEqual([...EXPECTED_SKILLS].sort());
  });

  it("reaches the shared bin through its symlink", () => {
    const binLink = repoPath(OPENCODE_TREE, "bin");
    expect(fs.readlinkSync(binLink)).toBe("../../plugins-claude/goodfoot/bin");
    expect(fs.realpathSync(binLink)).toBe(fs.realpathSync(repoPath(CLAUDE_TREE, "bin")));
  });
});

describe("shared skill source", () => {
  it("holds each of the six skills at the repo root with a SKILL.md", () => {
    expect(fs.readdirSync(repoPath(SKILLS_ROOT)).sort()).toEqual([...EXPECTED_SKILLS].sort());
    for (const skill of EXPECTED_SKILLS) {
      expect(fs.statSync(repoPath(SKILLS_ROOT, skill, "SKILL.md")).isFile()).toBe(true);
    }
  });
});

describe("git link integrity", () => {
  it.each([...EXPECTED_SKILLS])("records plugins-claude/goodfoot/skills/%s at symlink mode 120000", (skill) => {
    const rel = path.join(CLAUDE_TREE, "skills", skill);
    expect(indexMode(rel)).toBe("120000");
  });

  it.each([...EXPECTED_SKILLS])("records plugins-opencode/goodfoot/skills/%s at symlink mode 120000", (skill) => {
    const rel = path.join(OPENCODE_TREE, "skills", skill);
    expect(indexMode(rel)).toBe("120000");
  });

  it("records the opencode bin link at symlink mode 120000", () => {
    expect(indexMode(path.join(OPENCODE_TREE, "bin"))).toBe("120000");
  });
});
