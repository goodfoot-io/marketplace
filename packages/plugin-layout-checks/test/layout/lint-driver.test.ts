import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { repoPath } from "../helpers.js";
import { PLUGINS, REGISTRY } from "../registry.js";

/**
 * The bundler ships a portability linter that nothing invoked.
 *
 * Seven plugins were migrated onto agent-skills without `agent-skills lint`
 * ever running over their templates, so every rule it implements — dialect
 * leakage, non-portable skill references, platform-literal prose — was
 * enforced by review alone. This exercises the driver that now runs it, in
 * both directions: the repository's real templates against their declared
 * baselines, and a planted diagnostic that must be reported rather than
 * absorbed.
 */

const DRIVER = repoPath("scripts/lint-agent-skills.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lint-driver-"));

afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

function runDriver(registryPath?: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [DRIVER], {
    cwd: repoPath("."),
    encoding: "utf8",
    env: registryPath ? { ...process.env, AGENT_SKILLS_REGISTRY: registryPath } : process.env,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/**
 * A registry naming a scratch template root, so a deliberately unportable
 * template can be linted without planting one in the repository. Lint never
 * writes, and the roots are scratch paths, so the allow-list is satisfied by
 * construction rather than by exception.
 */
function scratchRegistry(templates: Record<string, string>, baseline: string[]): string {
  const dir = fs.mkdtempSync(path.join(scratch, "case-"));
  const skillsSrc = path.join(dir, "skills-src");
  for (const [rel, body] of Object.entries(templates)) {
    fs.mkdirSync(path.join(skillsSrc, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(skillsSrc, rel), body);
  }
  const registry = {
    sharedOpencodeRoot: REGISTRY.sharedOpencodeRoot,
    plugins: [
      {
        name: "scratch",
        skillsSrc,
        claudePluginRoot: path.join(dir, "claude"),
        codexPluginRoot: path.join(dir, "codex"),
        opencodePluginRoot: path.join(dir, "opencode"),
        targets: [
          { platform: "claude-code", path: path.join(dir, "claude", "skills") },
          { platform: "codex", path: path.join(dir, "codex", "skills") },
          { platform: "opencode", path: path.join(dir, "opencode", "skills") },
        ],
        platformDirs: [],
        lintBaseline: { reason: "fixture", diagnostics: baseline },
      },
    ],
  };
  const registryPath = path.join(dir, "registry.json");
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  return registryPath;
}

const PORTABLE = `<%~ it.frontmatter({ name: "scratch", description: "A portable scratch skill." }) %>
Body text with no platform literals.
`;

// `title` is not a supported frontmatter key on any platform, so this renders
// a frontmatter-key diagnostic at a known site on every target.
const UNPORTABLE = `---
name: scratch
description: A scratch skill with an unsupported frontmatter key.
title: Not a supported key
---

Body text.
`;

describe("registry-driven agent-skills lint", () => {
  // One real run, asserted against many times: linting eight plugins across
  // three targets each is the expensive part, and repeating it per assertion
  // would trade minutes for nothing.
  const real = runDriver();

  it("runs over every registry plugin and matches each declared baseline", () => {
    expect(real.status, real.stderr).toBe(0);
    for (const plugin of PLUGINS) {
      expect(real.stdout, `${plugin.name} was not linted`).toContain(`${plugin.name}: `);
    }
  });

  // The seven migrated plugins carry no baseline, so the check is a real zero
  // rather than an inventory of accepted damage.
  it.each(
    PLUGINS.filter((plugin) => plugin.lintBaseline.diagnostics.length === 0).map((plugin) => plugin.name),
  )("reports %s clean", (name) => {
    expect(real.stdout).toContain(`${name}: clean`);
  });

  it("gives every baselined diagnostic a reason", () => {
    for (const plugin of PLUGINS) {
      if (plugin.lintBaseline.diagnostics.length === 0) continue;
      expect(plugin.lintBaseline.reason.length, `${plugin.name} baselines without a reason`).toBeGreaterThan(0);
    }
  });

  it("passes a scratch plugin whose templates are portable", () => {
    const { status, stderr } = runDriver(scratchRegistry({ "scratch/SKILL.md.eta": PORTABLE }, []));
    expect(status, stderr).toBe(0);
  });

  it("fails on a diagnostic the baseline does not declare", () => {
    const { status, stderr } = runDriver(scratchRegistry({ "scratch/SKILL.md.eta": UNPORTABLE }, []));
    expect(status, stderr).not.toBe(0);
    expect(stderr).toContain("not in the registry baseline");
    expect(stderr).toContain("frontmatter-key");
  });

  // The half a one-directional check misses: a baseline outliving the problem
  // it excused keeps a rule permanently disabled at that site.
  it("fails on a baseline entry that no longer occurs", () => {
    const { status, stderr } = runDriver(
      scratchRegistry({ "scratch/SKILL.md.eta": PORTABLE }, ["scratch/SKILL.md:4:frontmatter-key"]),
    );
    expect(status, stderr).not.toBe(0);
    expect(stderr).toContain("no longer occur");
  });

  // A driver nothing runs is the state this finding was raised about, so the
  // wiring is asserted rather than assumed.
  it("is invoked by CI and reachable as a repository script", () => {
    expect(fs.readFileSync(repoPath(".github/workflows/plugin-layout.yml"), "utf8")).toContain(
      "yarn lint:agent-skills",
    );
    const rootPackage = JSON.parse(fs.readFileSync(repoPath("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(rootPackage.scripts["lint:agent-skills"]).toContain("scripts/lint-agent-skills.mjs");
  });

  it("fails a plugin that declares no baseline at all", () => {
    const registryPath = scratchRegistry({ "scratch/SKILL.md.eta": PORTABLE }, []);
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    registry.plugins[0].lintBaseline = undefined;
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    const { status, stderr } = runDriver(registryPath);
    expect(status, stderr).not.toBe(0);
    expect(stderr).toContain("declares no lintBaseline");
  });
});
