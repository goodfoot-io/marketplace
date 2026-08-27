import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { resolveReleaseIdentity } from "../../../../scripts/release-identity.mjs";
import { REPO_ROOT, repoPath } from "../helpers.js";
import { PLUGINS, validateReleaseIdentities } from "../registry.js";

const INDEPENDENT = ["agent-hooks", "claude-code-skill-reader", "jsdoczoom", "voice"];

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
});
