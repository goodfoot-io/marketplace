import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { readJson, repoPath } from "../helpers.js";
import {
  allowedTargetPaths,
  allTargets,
  derivedSuppressions,
  PLUGINS,
  pluginNamed,
  REGISTRY,
  SHARED_OPENCODE_ROOT,
} from "../registry.js";

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
   * the whole target directory away, so `--target claude-code=plugins-voice/voice`
   * and `--target claude-code=plugins-voice/voice/skills` differ by six characters
   * and the first one silently deletes bin/, .mcp.json, and the manifest on a
   * build that exits 0.
   *
   * The two shapes that mistake actually took — a plugin root, and a path
   * under plugins* not ending in /skills — were only the two that had already
   * been observed. `skills-src/gmail` is neither, and would have published
   * over the authored templates. So the check is the allow-list, not those
   * two rules.
   */
  it.each(PLUGINS.map((plugin) => plugin.name))("publishes %s only into its own skills leaves", (name) => {
    const plugin = PLUGINS.find((candidate) => candidate.name === name);
    if (!plugin) throw new Error(`unreachable: ${name}`);
    const allowed = allowedTargetPaths(plugin);
    for (const target of plugin.targets) {
      expect(allowed.has(target.path), `${name}: target ${target.path} is not one of ${[...allowed].join(", ")}`).toBe(
        true,
      );
    }
  });

  // The shared root is the allow-list's one exception, so it carries the
  // exception's conditions: OpenCode-only, and explained where it is declared.
  it("admits the shared OpenCode root only as an explained OpenCode target", () => {
    for (const target of allTargets().filter((candidate) => candidate.path === SHARED_OPENCODE_ROOT)) {
      expect(target.platform, `${target.plugin}: the shared root is OpenCode-only`).toBe("opencode");
      expect((target.note ?? "").length, `${target.plugin}: the shared root needs a note`).toBeGreaterThan(0);
    }
  });

  // Every shape the allow-list must keep out, including the ones the old
  // two-rule guard let through. Without this the allow-list could be widened
  // to `true` and the suite would stay green.
  it.each([
    ["a plugin root", "plugins-voice/voice"],
    ["a Claude tree root", "plugins-claude/goodfoot"],
    ["an authored template root", "skills-src/gmail"],
    ["another plugin's leaf", "plugins-claude/linear/skills"],
    ["a sibling of the leaf", "plugins-voice/voice/bin"],
    ["a nested path under the leaf", "plugins-voice/voice/skills/handbook"],
    ["the repo root", "."],
    ["an empty path", ""],
  ])("rejects %s as a target for voice", (_shape, candidate) => {
    expect(allowedTargetPaths(pluginNamed("voice")).has(candidate)).toBe(false);
  });

  it("allows exactly the declared Antigravity skills leaf", () => {
    const plugin = { ...pluginNamed("voice"), antigravityPluginRoot: "plugins-antigravity/voice" };
    expect(allowedTargetPaths(plugin)).toContain("plugins-antigravity/voice/skills");
    expect(allowedTargetPaths(plugin)).not.toContain("plugins-antigravity/voice");
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

/**
 * The budget above counts; this identifies. A count-only gate is blind in
 * both directions at once: thirteen declared entries named `.md` where the
 * template is `.md.eta` anchored to nothing at all, and the total still
 * matched the budget, because a suppression that exists in a template and a
 * declaration that points at no file cancel each other out one-for-one.
 *
 * So the inventory is derived from the templates and compared as a set. A
 * declared entry with no template behind it and an undeclared suppression in
 * a template now fail separately, and neither can be hidden by the other.
 */
describe("lint suppression inventory", () => {
  it.each(PLUGINS.map((plugin) => plugin.name))("matches %s's declared suppressions to its templates", (name) => {
    const plugin = pluginNamed(name);
    expect([...plugin.lintSuppressions].sort()).toEqual(derivedSuppressions(plugin, repoPath(".")));
  });

  // The derivation itself has to be able to see a suppression, or every
  // comparison above passes by finding nothing on both sides.
  it("finds the suppressions agent-skills' templates actually declare", () => {
    expect(derivedSuppressions(pluginNamed("agent-skills"), repoPath(".")).length).toBeGreaterThan(0);
  });
});
