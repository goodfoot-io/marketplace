import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  pluginReleaseSequence,
  resolveReleaseIdentity,
  validateReleaseIdentityRegistry,
} from "../../../../scripts/release-identity.mjs";
import { REPO_ROOT, repoPath } from "../helpers.js";
import { PLUGINS, type Registry, type RegistryPlugin, validateReleaseIdentities } from "../registry.js";

const INDEPENDENT = ["agent-hooks", "claude-code-skill-reader", "jsdoczoom", "voice"];
const scratchRoots: string[] = [];

afterAll(() => {
  for (const root of scratchRoots) fs.rmSync(root, { recursive: true, force: true });
});

function historyFixture(versions: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-identity-"));
  scratchRoots.push(root);
  fs.mkdirSync(path.join(root, "plugins/demo/.claude-plugin"), { recursive: true });
  fs.mkdirSync(path.join(root, "packages/plugin-layout-checks/registry"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "packages/plugin-layout-checks/registry/plugins.json"),
    JSON.stringify({
      plugins: [
        {
          name: "demo",
          claudePluginRoot: "plugins/demo",
          versionSurfaces: { source: "plugins/demo/.claude-plugin/plugin.json" },
          releaseIdentity: {
            plugin: {
              identity: "demo",
              label: "demo plugin",
              versionSource: "plugins/demo/.claude-plugin/plugin.json",
              historySource: "manifest-git-history",
              authoritativeRoot: "plugins/demo",
            },
            npm: null,
          },
        },
      ],
    }),
  );
  spawnSync("git", ["init", "-q"], { cwd: root });
  spawnSync("git", ["config", "user.email", "fixture@example.com"], { cwd: root });
  spawnSync("git", ["config", "user.name", "Fixture"], { cwd: root });
  for (const version of versions) {
    fs.writeFileSync(
      path.join(root, "plugins/demo/.claude-plugin/plugin.json"),
      `${JSON.stringify({ name: "demo", version })}\n`,
    );
    spawnSync("git", ["add", "."], { cwd: root });
    spawnSync("git", ["commit", "-qm", `demo ${version}`], { cwd: root });
  }
  return root;
}

function fixtureSequence(root: string): { versions: string[] } {
  const result = fixtureSequenceResult(root);
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as { versions: string[] };
}

function fixtureSequenceResult(root: string) {
  return spawnSync(
    process.execPath,
    [repoPath("scripts/release-identity.mjs"), "demo", "plugin", "--sequence", "--repo-root", root],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
}

function expectBothValidatorsToReject(mutate: (voice: RegistryPlugin) => void, expected: RegExp): void {
  for (const validate of [validateReleaseIdentities, validateReleaseIdentityRegistry]) {
    const registry = structuredClone({ plugins: PLUGINS }) as Pick<Registry, "plugins">;
    const voice = registry.plugins.find((plugin) => plugin.name === "voice");
    if (!voice) throw new Error("fixture: voice is missing");
    mutate(voice);
    expect(() => validate(registry, REPO_ROOT)).toThrow(expected);
  }
}

describe("explicit release identities", () => {
  it.each(INDEPENDENT)("keeps %s plugin and npm releases independent", (pluginName) => {
    const plugin = resolveReleaseIdentity({ pluginName, surface: "plugin" });
    const npm = resolveReleaseIdentity({ pluginName, surface: "npm" });
    expect(plugin.relationship).toBe("independent");
    expect(npm.relationship).toBe("independent");
    expect(plugin.currentVersion).not.toBe(npm.currentVersion);
    expect(plugin.historySource).toBe("manifest-git-history");
    expect(npm.historySource).toBe("legacy-npm-tags");
  });

  it("keeps agent-skills lockstep", () => {
    const plugin = resolveReleaseIdentity({ pluginName: "agent-skills", surface: "plugin" });
    const npm = resolveReleaseIdentity({ pluginName: "agent-skills", surface: "npm" });
    expect(plugin.relationship).toBe("lockstep");
    expect(plugin.currentVersion).toBe(npm.currentVersion);
  });

  it.each(["goodfoot", "linear", "gmail"])("fails explicitly when %s has no npm release", (pluginName) => {
    expect(() => resolveReleaseIdentity({ pluginName, surface: "npm" })).toThrow(/no npm release identity/i);
  });

  it("rejects an undeclared same-name npm package", () => {
    const registry = structuredClone({ plugins: PLUGINS });
    const voice = registry.plugins.find((plugin) => plugin.name === "voice");
    if (!voice) throw new Error("fixture: voice is missing");
    voice.releaseIdentity.npm = null;
    expect(() => validateReleaseIdentities(registry, REPO_ROOT)).toThrow(
      /voice.*packages\/voice\/package\.json.*undeclared/i,
    );
  });

  it("rejects package propagation for an independent npm twin", () => {
    const registry = structuredClone({ plugins: PLUGINS });
    const voice = registry.plugins.find((plugin) => plugin.name === "voice");
    if (!voice?.releaseIdentity.npm) throw new Error("fixture: voice npm identity is missing");
    voice.versionSurfaces.packageJson = voice.releaseIdentity.npm.packageJson;
    expect(() => validateReleaseIdentities(registry, REPO_ROOT)).toThrow(/voice.*packageJson.*independent/i);
  });

  it("requires both CLI arguments", () => {
    const result = spawnSync(process.execPath, [repoPath("scripts/release-identity.mjs"), "voice"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("<plugin-name> <plugin|npm>");
  });

  it.each([
    [
      "plugin root",
      (voice: RegistryPlugin) => {
        voice.releaseIdentity.plugin.authoritativeRoot = "plugins/linear";
      },
      /voice.*plugin\.authoritativeRoot.*plugins\/linear/i,
    ],
    [
      "npm root",
      (voice: RegistryPlugin) => {
        if (!voice.releaseIdentity.npm) throw new Error("fixture: voice npm identity is missing");
        voice.releaseIdentity.npm.authoritativeRoot = "packages/agent-hooks";
      },
      /voice.*npm\.authoritativeRoot.*packages\/agent-hooks/i,
    ],
    [
      "plugin history",
      (voice: RegistryPlugin) => {
        voice.releaseIdentity.plugin.historySource = "legacy-npm-tags" as "manifest-git-history";
      },
      /voice.*plugin\.historySource.*legacy-npm-tags/i,
    ],
    [
      "empty label",
      (voice: RegistryPlugin) => {
        voice.releaseIdentity.plugin.label = "  ";
      },
      /voice.*plugin\.label.*nonempty/i,
    ],
    [
      "unknown relationship",
      (voice: RegistryPlugin) => {
        if (!voice.releaseIdentity.npm) throw new Error("fixture: voice npm identity is missing");
        voice.releaseIdentity.npm.relationship = "mystery" as "independent";
      },
      /voice.*npm\.relationship.*mystery/i,
    ],
  ] as const)("rejects invalid %s through both validators", (_name, mutate, expected) => {
    expectBothValidatorsToReject(mutate, expected);
  });

  it.each(["goodfoot", "voice", "agent-skills"])("accepts valid %s identity variants", (pluginName) => {
    const registry = structuredClone({ plugins: [PLUGINS.find((plugin) => plugin.name === pluginName)] }) as Pick<
      Registry,
      "plugins"
    >;
    expect(() => validateReleaseIdentities(registry, REPO_ROOT)).not.toThrow();
    expect(() => validateReleaseIdentityRegistry(registry, REPO_ROOT)).not.toThrow();
  });
});

describe("plugin manifest history sequence", () => {
  it.each(PLUGINS.map((plugin) => plugin.name))("reads %s from plugin manifest Git history", (pluginName) => {
    const identity = resolveReleaseIdentity({ pluginName, surface: "plugin" });
    const sequence = pluginReleaseSequence({ pluginName, surface: "plugin" });
    expect(sequence.pluginName).toBe(pluginName);
    expect(sequence.surface).toBe("plugin");
    expect(sequence.historySource).toBe("manifest-git-history");
    expect(sequence.versionSource).toBe(identity.versionSource);
    expect(sequence.versions.length).toBeGreaterThan(0);
    expect(sequence.versions.at(-1)).toBe(identity.currentVersion);
    expect(new Set(sequence.versions).size).toBe(sequence.versions.length);
  });

  it.each(INDEPENDENT)("does not admit %s npm-tag-only versions", (pluginName) => {
    const sequence = pluginReleaseSequence({ pluginName, surface: "plugin" });
    const tagVersions = spawnSync("git", ["tag", "--list", `${pluginName}-v*`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
      .stdout.trim()
      .split("\n")
      .filter(Boolean)
      .map((tag) => tag.slice(`${pluginName}-v`.length));
    const npmTagOnly = tagVersions.filter((version) => !sequence.versions.includes(version));
    expect(npmTagOnly.length).toBeGreaterThan(0);
    expect(sequence.versions).not.toContain(npmTagOnly[0]);
  });

  it.each(["goodfoot", "linear", "gmail"])("reads %s despite no npm tag identity", (pluginName) => {
    expect(pluginReleaseSequence({ pluginName, surface: "plugin" }).versions.length).toBeGreaterThan(0);
  });

  it("requires the plugin surface", () => {
    expect(() => pluginReleaseSequence({ pluginName: "voice", surface: "npm" })).toThrow(
      /plugin release sequence.*plugin.*surface/i,
    );
  });

  it("exposes the sequence through the CLI", () => {
    const result = spawnSync(
      process.execPath,
      [repoPath("scripts/release-identity.mjs"), "voice", "plugin", "--sequence"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    const sequence = JSON.parse(result.stdout) as { versions: string[]; historySource: string };
    expect(sequence.historySource).toBe("manifest-git-history");
    expect(sequence.versions.at(-1)).toBe("1.0.77");
  });

  it("excludes a dirty working-tree bump", () => {
    const root = historyFixture(["1.0.1", "1.0.2"]);
    fs.writeFileSync(
      path.join(root, "plugins/demo/.claude-plugin/plugin.json"),
      `${JSON.stringify({ name: "demo", version: "9.9.9" })}\n`,
    );
    expect(fixtureSequence(root).versions).toEqual(["1.0.1", "1.0.2"]);
  });

  it("does not let a dirty downgrade suppress committed releases", () => {
    const root = historyFixture(["1.0.1", "1.0.2", "1.0.3"]);
    fs.writeFileSync(
      path.join(root, "plugins/demo/.claude-plugin/plugin.json"),
      `${JSON.stringify({ name: "demo", version: "1.0.1" })}\n`,
    );
    expect(fixtureSequence(root).versions).toEqual(["1.0.1", "1.0.2", "1.0.3"]);
  });

  it("orders rollback and reoccupation by each version's newest commit", () => {
    const root = historyFixture(["1.0.1", "1.0.2", "1.0.1", "1.0.3"]);
    expect(fixtureSequence(root).versions).toEqual(["1.0.2", "1.0.1", "1.0.3"]);
  });

  it("refuses shallow committed history", () => {
    const origin = historyFixture(["1.0.1", "1.0.2"]);
    const clone = fs.mkdtempSync(path.join(os.tmpdir(), "release-identity-shallow-"));
    fs.rmSync(clone, { recursive: true, force: true });
    scratchRoots.push(clone);
    spawnSync("git", ["clone", "-q", "--depth", "1", `file://${origin}`, clone]);
    const result = fixtureSequenceResult(clone);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/history.*shallow.*refusing/i);
  });

  it("refuses a missing manifest instead of returning an empty sequence", () => {
    const root = historyFixture(["1.0.1"]);
    fs.rmSync(path.join(root, "plugins/demo/.claude-plugin/plugin.json"));
    const result = fixtureSequenceResult(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/versionSource.*does not exist/i);
  });

  it("refuses Git errors instead of returning an empty sequence", () => {
    const root = historyFixture(["1.0.1"]);
    fs.renameSync(path.join(root, ".git"), path.join(root, ".git-disabled"));
    const result = fixtureSequenceResult(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/could not read[\s\S]*history[\s\S]*refusing/i);
  });
});
