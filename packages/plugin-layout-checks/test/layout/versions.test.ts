import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { CLAUDE_TREE, CODEX_TREE, readJson, repoPath } from "../helpers.js";

interface Surface {
  label: string;
  version: string;
}

function marketplaceGoodfootVersion(): string {
  const registry = readJson<{ plugins: { name: string; version?: string }[] }>(".claude-plugin/marketplace.json");
  const entry = registry.plugins.find((plugin) => plugin.name === "goodfoot");
  if (!entry) throw new Error("marketplace.json has no goodfoot entry");
  return entry.version as string;
}

describe("version lockstep", () => {
  // Source of truth is the claude manifest; scripts/sync-plugin-versions.sh
  // propagates from it. This test fails closed on any drift.
  it("reports one version across all four surfaces", () => {
    const surfaces: Surface[] = [
      {
        label: "plugins-claude/goodfoot/.claude-plugin/plugin.json",
        version: readJson<{ version: string }>(`${CLAUDE_TREE}/.claude-plugin/plugin.json`).version,
      },
      {
        label: "plugins-codex/goodfoot/.codex-plugin/plugin.json",
        version: readJson<{ version: string }>(`${CODEX_TREE}/.codex-plugin/plugin.json`).version,
      },
      {
        label: "plugins-opencode/goodfoot/package.json",
        version: readJson<{ version: string }>("plugins-opencode/goodfoot/package.json").version,
      },
      { label: ".claude-plugin/marketplace.json goodfoot entry", version: marketplaceGoodfootVersion() },
    ];

    const distinct = [...new Set(surfaces.map((surface) => surface.version))];
    expect(
      distinct,
      `version drift detected: ${surfaces.map((s) => `${s.label}=${s.version}`).join(", ")}`,
    ).toHaveLength(1);

    expect(distinct[0]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("reports one agent-skills version across package, CLI, companion plugin, and marketplace", () => {
    const packageVersion = readJson<{ version: string }>("packages/agent-skills/package.json").version;
    const pluginVersion = readJson<{ version: string }>("plugins/agent-skills/.claude-plugin/plugin.json").version;
    const registry = readJson<{ plugins: { name: string; version?: string }[] }>(".claude-plugin/marketplace.json");
    const marketplaceVersion = registry.plugins.find(({ name }) => name === "agent-skills")?.version;
    const cliVersion = execFileSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "packages/agent-skills/src/cli.ts", "--version"],
      {
        cwd: repoPath(),
        encoding: "utf8",
      },
    ).trim();
    const packageChangelog = fs.readFileSync(repoPath("packages/agent-skills/CHANGELOG.md"), "utf8");
    const pluginChangelog = fs.readFileSync(repoPath("plugins/agent-skills/CHANGELOG.md"), "utf8");

    expect(packageVersion).toMatch(/^1\.0\.\d+$/);
    expect({ pluginVersion, marketplaceVersion, cliVersion }).toEqual({
      pluginVersion: packageVersion,
      marketplaceVersion: packageVersion,
      cliVersion: packageVersion,
    });
    const escapedVersion = packageVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const releaseHeading = new RegExp(`^## ${escapedVersion}$`, "m");
    expect(packageChangelog).toMatch(releaseHeading);
    expect(pluginChangelog).toMatch(releaseHeading);
  });
});
