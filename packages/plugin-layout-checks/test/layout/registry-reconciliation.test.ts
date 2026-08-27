import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { readJson, repoPath } from "../helpers.js";
import { allTargets, PLUGINS, REGISTRY } from "../registry.js";

interface ClaudeMarketplace {
  plugins: { name: string; source: string; version?: string }[];
}

interface CodexMarketplace {
  plugins: { name: string; source: { path: string } }[];
}

const claudeMarketplace = readJson<ClaudeMarketplace>(".claude-plugin/marketplace.json");
const codexMarketplace = readJson<CodexMarketplace>(".agents/plugins/marketplace.json");

describe("marketplace reconciliation", () => {
  // The absence of this check is what let ./plugins/jest-mock-prevention
  // survive in the manifest for many commits after commit 5500686 deleted the
  // directory: nine of eleven entries were never touched by any assertion.
  it.each(
    claudeMarketplace.plugins.map((entry) => [entry.name, entry.source] as const),
  )("resolves the Claude marketplace source for %s (%s)", (_name, source) => {
    expect(fs.existsSync(repoPath(source))).toBe(true);
  });

  it.each(
    codexMarketplace.plugins.map((entry) => [entry.name, entry.source.path] as const),
  )("resolves the Codex marketplace source for %s (%s)", (_name, source) => {
    expect(fs.existsSync(repoPath(source))).toBe(true);
  });

  it("classifies every Claude marketplace plugin as managed or explicitly unmanaged", () => {
    const managed = PLUGINS.map((plugin) => plugin.marketplace.claude);
    const unmanaged = REGISTRY.unmanaged.map((entry) => entry.name);
    const declared = new Set([...managed, ...unmanaged]);
    const listed = claudeMarketplace.plugins.map((entry) => entry.name);

    const unclassified = listed.filter((name) => !declared.has(name));
    expect(
      unclassified,
      `marketplace plugins in neither the registry nor unmanaged: ${unclassified.join(", ")}`,
    ).toEqual([]);

    const phantom = [...declared].filter((name) => !listed.includes(name));
    expect(phantom, `declared plugins with no marketplace entry: ${phantom.join(", ")}`).toEqual([]);
  });

  it("never lists a plugin as both managed and unmanaged", () => {
    const managed = new Set(PLUGINS.map((plugin) => plugin.marketplace.claude));
    const both = REGISTRY.unmanaged.filter((entry) => managed.has(entry.name)).map((entry) => entry.name);
    expect(
      both,
      `a plugin migrating into the registry must leave unmanaged in the same commit: ${both.join(", ")}`,
    ).toEqual([]);
  });

  it("gives every unmanaged plugin a reason", () => {
    for (const entry of REGISTRY.unmanaged) {
      expect(entry.reason.length, `unmanaged ${entry.name} needs a reason`).toBeGreaterThan(0);
    }
  });

  it("registers every registry plugin that declares a Codex marketplace name", () => {
    const listed = codexMarketplace.plugins.map((entry) => entry.name);
    const expected = PLUGINS.map((plugin) => plugin.marketplace.codex).filter((name): name is string => name !== null);
    expect(listed.sort()).toEqual([...expected].sort());
  });
});

describe("registry path invariants", () => {
  it.each(PLUGINS.map((plugin) => plugin.name))("resolves every declared path for %s", (name) => {
    const plugin = PLUGINS.find((candidate) => candidate.name === name);
    if (!plugin) throw new Error(`unreachable: ${name}`);
    for (const relPath of [
      plugin.skillsSrc,
      plugin.claudePluginRoot,
      plugin.codexPluginRoot,
      plugin.opencodePluginRoot,
      plugin.versionSurfaces.source,
      plugin.versionSurfaces.codexManifest,
      plugin.versionSurfaces.opencodePackage,
      ...plugin.targets.map((target) => target.path),
    ]) {
      expect(fs.existsSync(repoPath(relPath)), `${name}: ${relPath} does not exist`).toBe(true);
    }
  });

  /**
   * Decision 1 makes this load-bearing. materializeAll() publishes by renaming
   * the whole target directory away, so `--target claude-code=plugins/voice`
   * and `--target claude-code=plugins/voice/skills` differ by six characters
   * and the first one silently deletes bin/, .mcp.json, and the manifest on a
   * build that exits 0.
   */
  it("never points a target at a plugin root", () => {
    const roots = new Set(
      PLUGINS.flatMap((plugin) => [plugin.claudePluginRoot, plugin.codexPluginRoot, plugin.opencodePluginRoot]),
    );
    for (const target of allTargets()) {
      expect(roots.has(target.path), `${target.plugin}: target ${target.path} is a plugin root`).toBe(false);
      if (target.path.startsWith("plugins")) {
        expect(target.path.endsWith("/skills"), `${target.plugin}: target ${target.path} must end in /skills`).toBe(
          true,
        );
      }
    }
  });

  it("declares no two plugins sharing an output tree", () => {
    const paths = allTargets().map((target) => target.path);
    expect(paths.length, `overlapping targets erase each other silently: ${paths.join(", ")}`).toBe(
      new Set(paths).size,
    );
  });

  /**
   * E2's suppression budget. Adding a suppression turns this red until the
   * number is deliberately raised in the same commit, which puts every
   * addition in a diff a reviewer sees.
   */
  it("holds the lint suppression total at the declared budget", () => {
    const total = PLUGINS.reduce((count, plugin) => count + plugin.lintSuppressions.length, 0);
    expect(total).toBe(REGISTRY.lintSuppressionBudget);
  });
});
