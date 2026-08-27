import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { readJson, repoPath } from "../helpers.js";
import { PLUGINS } from "../registry.js";

interface Surface {
  label: string;
  version: string;
}

function marketplaceVersionOf(name: string): string {
  const registry = readJson<{ plugins: { name: string; version?: string }[] }>(".claude-plugin/marketplace.json");
  const entry = registry.plugins.find((plugin) => plugin.name === name);
  if (!entry) throw new Error(`marketplace.json has no ${name} entry`);
  return entry.version as string;
}

describe("version lockstep", () => {
  // Source of truth is each plugin's declared `versionSurfaces.source`;
  // scripts/sync-plugin-versions.sh propagates from it. This fails closed on
  // any drift, for every registry plugin rather than for two hardcoded names.
  it.each(PLUGINS.map((plugin) => plugin.name))("reports one %s version across all four surfaces", (name) => {
    const plugin = PLUGINS.find((candidate) => candidate.name === name);
    if (!plugin) throw new Error(`unreachable: ${name}`);
    const surfaces: Surface[] = [
      {
        label: plugin.versionSurfaces.source,
        version: readJson<{ version: string }>(plugin.versionSurfaces.source).version,
      },
      {
        label: plugin.versionSurfaces.codexManifest,
        version: readJson<{ version: string }>(plugin.versionSurfaces.codexManifest).version,
      },
      {
        label: plugin.versionSurfaces.opencodePackage,
        version: readJson<{ version: string }>(plugin.versionSurfaces.opencodePackage).version,
      },
      {
        label: `.claude-plugin/marketplace.json ${plugin.marketplace.claude} entry`,
        version: marketplaceVersionOf(plugin.marketplace.claude),
      },
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
