import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  pluginReleaseSequence,
  resolveReleaseIdentity,
  validateReleaseIdentityRegistry,
} from "../../../../scripts/release-identity.mjs";
import { REPO_ROOT, repoPath } from "../helpers.js";
import { PLUGINS, type Registry, type RegistryPlugin, validateReleaseIdentities } from "../registry.js";

const INDEPENDENT = ["agent-hooks", "claude-code-skill-reader", "jsdoczoom", "voice"];

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
});
