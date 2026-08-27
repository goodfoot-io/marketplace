import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, readJson, repoPath } from "../helpers.js";
import { PLUGINS, pluginNamed, versionDrift } from "../registry.js";

describe("version lockstep", () => {
  // Every surface the registry declares, for every registry plugin, compared
  // against that plugin's own versionSurfaces.source. The list is derived
  // rather than written here so this test and scripts/sync-plugin-versions.sh
  // cannot disagree about what a release surface is — they did, and the
  // disagreement was the two CHANGELOGs, which the script propagated to
  // nothing while reporting convergence.
  it.each(PLUGINS.map((plugin) => plugin.name))("moves every declared %s surface together", (name) => {
    const drift = versionDrift(pluginNamed(name), REPO_ROOT);
    expect(drift, `version drift detected:\n  ${drift.join("\n  ")}`).toEqual([]);
  });

  // The declared literal says what the CLI is supposed to print; this runs it.
  // A regex that matched the wrong line would keep the check above green while
  // `agent-skills --version` reported something else entirely.
  it("prints the declared version when the CLI is actually run", () => {
    const plugin = pluginNamed("agent-skills");
    const declared = readJson<{ version: string }>(plugin.versionSurfaces.source).version;
    const printed = execFileSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "packages/agent-skills/src/cli.ts", "--version"],
      { cwd: repoPath(), encoding: "utf8" },
    ).trim();
    expect(printed).toBe(declared);
  });
});
