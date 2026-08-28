import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { repoPath } from "../helpers.js";

const workflow = fs.readFileSync(repoPath(".github/workflows/plugin-layout.yml"), "utf8");
const parsed = parseYaml(workflow) as {
  jobs?: { "layout-checks"?: { steps?: Array<{ name?: string; run?: string }> } };
};
const steps = parsed.jobs?.["layout-checks"]?.steps ?? [];
const runFor = (name: string): string => steps.find((step) => step.name === name)?.run ?? "";

describe("plugin-layout CI execution contract", () => {
  it("provisions and verifies the pinned Antigravity validator before use", () => {
    const install = runFor("Install pinned Antigravity CLI");
    const validate = runFor("Validate Antigravity plugin roots");

    expect(install).toContain('AGY_VERSION="1.1.21"');
    expect(install).toContain("sha512sum --check");
    expect(install).toContain('test "$(agy --version)" = "$AGY_VERSION"');
    expect(workflow.indexOf("Install pinned Antigravity CLI")).toBeLessThan(
      workflow.indexOf("Validate Antigravity plugin roots"),
    );
    expect(validate).toContain("command -v agy");
    expect(validate).toContain('agy plugin validate "$root"');
    expect(validate).toContain("skills[[:space:]]*: [1-9][0-9]* processed");
  });

  it("uses supported Claude validation with explicit non-empty structural witnesses", () => {
    const validateSkills = runFor("Validate Claude skills trees");
    expect(validateSkills).not.toContain("--strict");
    expect(validateSkills).toContain("for root in ./skills ./plugins-claude/agent-skills");
    expect(validateSkills).toContain("yarn claude plugin validate ./plugins-claude/agent-skills");
    expect(validateSkills).not.toContain("yarn claude plugin validate ./skills");
    expect(validateSkills).toContain('find "$root" -type f -name SKILL.md -size +0c');
    expect(validateSkills).toContain("contains no non-empty SKILL.md");
  });

  it("smokes every marketplace-owned Claude plugin from a neutral project without mutating the checkout", () => {
    const smoke = runFor("Claude install smoke");
    const marketplace = JSON.parse(fs.readFileSync(repoPath(".claude-plugin/marketplace.json"), "utf8")) as {
      plugins: Array<{ name: string }>;
    };

    expect(marketplace.plugins.map((plugin) => plugin.name)).toEqual([
      "goodfoot",
      "typescript-hooks",
      "linear",
      "gmail",
      "agent-hooks",
      "agent-skills",
      "jsdoczoom",
      "claude-code-skill-reader",
      "expansion",
      "voice",
    ]);
    expect(smoke).toContain('cd "$smoke_project"');
    expect(smoke).toContain('plugin marketplace add "$checkout"');
    expect(smoke).toContain('export CLAUDE_CONFIG_DIR="$smoke_home/.claude"');
    expect(smoke).toContain("plugin list --json");
    expect(smoke).not.toContain("plugin details");
    expect(smoke).not.toContain("plugin marketplace add ./");
    expect(smoke).toContain(".plugins[].name");
    expect(smoke).toContain('plugin uninstall "$name@goodfoot"');
    expect(smoke).toContain("all(.[]; .id != $name)");
    expect(smoke).toContain("plugin marketplace remove goodfoot");
    expect(smoke).toContain('test "$after_status" = "$before_status"');
    expect(smoke).toContain("git diff --exit-code");

    execFileSync("bash", ["-c", smoke], {
      cwd: repoPath("."),
      encoding: "utf8",
      env: { ...process.env, GITHUB_ACTIONS: "false" },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300_000,
    });
  }, 310_000);
});
