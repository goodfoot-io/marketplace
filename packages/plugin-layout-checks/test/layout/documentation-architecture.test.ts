import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPath } from "../helpers.js";

const read = (path: string): string => fs.readFileSync(repoPath(path), "utf8");
const readJson = <T>(path: string): T => JSON.parse(read(path)) as T;

const readme = read("README.md");
const authoring = read("documentation/claude-plugin-authoring.md");
const docs = `${readme}\n${authoring}`;

describe("primary documentation matches the registry-driven architecture", () => {
  it("preserves the established authoring reference topics", () => {
    for (const heading of [
      "## MCP Server Tool Naming",
      "## MCP Slash Commands (Prompts)",
      "## Plugin Subagent Naming",
      "## Plugin Skill Naming",
      "## Plugin Slash Command Naming",
      "## Embedded Bash in Commands and Skills",
      "## Plugin Hook Event Naming",
      "## Plugin and Marketplace Naming",
      "## Common Mistakes",
      "## Best Practices",
    ]) {
      expect(authoring, `missing preserved heading: ${heading}`).toContain(heading);
    }
    expect(authoring.length).toBeGreaterThan(30_000);
    expect(readme).toContain("## Development");
    expect(readme).toContain("## Contributing");
    expect(readme).toContain("### Working with MCP Servers");
  });

  it("names the authored source, generated roots, and supported validation entry points", () => {
    for (const witness of [
      "skills-src/<plugin>",
      "plugins-claude/<plugin>",
      "plugins-codex/<plugin>",
      "plugins-opencode/<plugin>",
      "plugins-antigravity/<plugin>",
      "packages/plugin-layout-checks/registry/plugins.json",
      "yarn build:agent-skills",
      "yarn lint:agent-skills",
      "agy plugin validate",
    ]) {
      expect(docs, `missing architecture witness: ${witness}`).toContain(witness);
    }
    expect(docs).toContain("positive processed");
    expect(docs).toContain("plugins-voice/voice");
  });

  it("publishes the actual marketplace identity and complete discoverable roster", () => {
    const marketplace = readJson<{ name: string; plugins: Array<{ name: string }> }>(".claude-plugin/marketplace.json");
    expect(marketplace.name).toBe("goodfoot");
    expect(readme).toContain("/plugin install agent-skills@goodfoot");
    expect(marketplace.plugins.map((plugin) => plugin.name).sort()).toEqual([
      "agent-hooks",
      "agent-skills",
      "claude-code-skill-reader",
      "expansion",
      "gmail",
      "goodfoot",
      "jsdoczoom",
      "linear",
      "typescript-hooks",
      "voice",
    ]);
    for (const plugin of marketplace.plugins) expect(readme).toContain(`\`${plugin.name}\``);
  });

  it("keeps local links live and removes the retired architecture and placeholders", () => {
    for (const path of [
      "documentation/claude-plugin-authoring.md",
      "documentation/claude-code-cli-skill-style-guide.md",
      "packages/agent-skills/README.md",
    ]) {
      expect(fs.existsSync(repoPath(path)), `missing documented path: ${path}`).toBe(true);
    }
    for (const obsolete of [
      "documentation/cc-plugins",
      "investigation-toolkit",
      "code-quality-suite",
      "Plugins are being prepared for distribution",
      "Every `SKILL.md` physically exists exactly once",
      "Codex byte-copy",
      "four surfaces",
      "/plugin marketplace add /workspace",
    ]) {
      expect(docs).not.toContain(obsolete);
    }
    expect(readme).toContain("From the repository root, start Claude Code");
    expect(readme).toContain("/plugin marketplace add ./");
  });

  it("states applicability and Antigravity release boundaries without universal-platform claims", () => {
    expect(docs).toContain("does not imply that every plugin targets every platform");
    expect(docs).toContain("root `hooks.json`");
    expect(docs).toContain("does not publish Antigravity hooks or MCP server payloads");
    expect(authoring).toContain("Antigravity root manifest when applicable");
    expect(authoring).toContain("The registry is the source of truth");
  });
});
