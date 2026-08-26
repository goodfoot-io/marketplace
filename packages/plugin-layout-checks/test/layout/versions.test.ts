import { describe, expect, it } from "vitest";
import { CLAUDE_TREE, CODEX_TREE, readJson } from "../helpers.js";

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
});
