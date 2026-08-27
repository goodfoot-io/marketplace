import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { git, repoPath } from "../helpers.js";
import { type Platform, REGISTRY } from "../registry.js";

/**
 * The allow-list and the untracked-content refusal, exercised through the
 * driver that actually runs them rather than through a copy of the rule.
 *
 * This matters more than the usual unit-versus-integration preference: the
 * failure being guarded is unrecoverable. materializeAll() publishes a target
 * by renaming the whole directory away, so a misdirected target does not
 * report an error — it deletes, atomically, on a build that exits 0. A rule
 * asserted only in TypeScript while the driver carries its own drifted copy
 * would be a green suite over a live hazard.
 *
 * Every case here is refused before any build runs, so nothing is published
 * and the repository is never the thing under test.
 */

const DRIVER = repoPath("scripts/build-agent-skills.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "build-driver-refusal-"));

afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

function runDriverWith(registry: unknown): { status: number | null; stderr: string } {
  const registryPath = path.join(scratch, `registry-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  const result = spawnSync(process.execPath, [DRIVER, "--check-targets"], {
    cwd: repoPath("."),
    encoding: "utf8",
    env: { ...process.env, AGENT_SKILLS_REGISTRY: registryPath },
  });
  return { status: result.status, stderr: result.stderr ?? "" };
}

/** The real registry with one plugin's targets replaced, everything else intact. */
function registryWithTarget(pluginName: string, targetPath: string, platform: Platform = "claude-code"): unknown {
  const clone = JSON.parse(JSON.stringify(REGISTRY)) as typeof REGISTRY;
  const plugin = clone.plugins.find((candidate) => candidate.name === pluginName);
  if (!plugin) throw new Error(`unreachable: ${pluginName}`);
  plugin.targets = [{ platform, path: targetPath }];
  clone.plugins = [plugin];
  return clone;
}

describe("build driver target allow-list", () => {
  it("accepts an Antigravity target at its declared plugin skills leaf", () => {
    const clone = JSON.parse(JSON.stringify(REGISTRY)) as typeof REGISTRY;
    const plugin = clone.plugins.find((candidate) => candidate.name === "voice");
    if (!plugin) throw new Error("unreachable: voice");
    plugin.antigravityPluginRoot = "plugins-antigravity/voice";
    plugin.skillPlatforms = { handbook: ["claude-code", "antigravity"] };
    plugin.targets = [{ platform: "antigravity", path: "plugins-antigravity/voice/skills" }];
    clone.plugins = [plugin];
    const { status, stderr } = runDriverWith(clone);
    expect(status, stderr).toBe(0);
  });

  it("rejects an Antigravity target without an Antigravity plugin root", () => {
    const clone = JSON.parse(JSON.stringify(REGISTRY)) as typeof REGISTRY;
    const plugin = clone.plugins.find((candidate) => candidate.name === "voice");
    if (!plugin) throw new Error("unreachable: voice");
    plugin.skillPlatforms = { handbook: ["claude-code", "antigravity"] };
    plugin.targets = [{ platform: "antigravity", path: "plugins-antigravity/voice/skills" }];
    clone.plugins = [plugin];
    const { status, stderr } = runDriverWith(clone);
    expect(status, stderr).not.toBe(0);
    expect(stderr).toContain("requires antigravityPluginRoot");
  });

  it.each([
    ["a plugin root", "plugins-voice/voice"],
    ["a Claude tree root", "plugins-claude/goodfoot"],
    // The shape neither of the two rules this replaced would have caught. It
    // does not start with "plugins" and is not a plugin root, so the old guard
    // published into it — over the authored templates the build reads from.
    ["the authored template root", "skills-src/voice"],
    ["another plugin's leaf", "plugins-claude/linear/skills"],
    ["a sibling of the leaf", "plugins-voice/voice/bin"],
    ["the repo root", "."],
  ])("refuses to build with %s as a target", (_shape, targetPath) => {
    const { status, stderr } = runDriverWith(registryWithTarget("voice", targetPath));
    expect(status, stderr).not.toBe(0);
    expect(stderr).toContain("is not a declared skills tree");
  });

  // Without these the allow-list could be narrowed to reject everything and
  // every refusal above would still pass.
  it("accepts the plugin's own declared leaf", () => {
    const { status, stderr } = runDriverWith(registryWithTarget("voice", "plugins-voice/voice/skills"));
    expect(status, stderr).toBe(0);
  });

  it("accepts the declared shared OpenCode root", () => {
    const { status, stderr } = runDriverWith(registryWithTarget("goodfoot", REGISTRY.sharedOpencodeRoot));
    expect(status, stderr).toBe(0);
  });

  it("accepts the registry the repository actually builds from", () => {
    const result = spawnSync(process.execPath, [DRIVER, "--check-targets"], {
      cwd: repoPath("."),
      encoding: "utf8",
    });
    expect(result.status, result.stderr ?? "").toBe(0);
  });
});

describe("build driver empty-tree refusal", () => {
  /**
   * A target no skill renders into publishes a directory with nothing in it,
   * and git cannot store one. `git status` stays clean, the layout suite passes
   * on any machine that has run a build, and a fresh checkout fails on trees
   * that were never in the commit. Voice's Codex and OpenCode targets sat in
   * the registry like that through two review rounds precisely because every
   * measurement was taken after a build.
   *
   * The refusal is declared against skillPlatforms rather than discovered from
   * the filesystem, so the empty tree is never created in the first place.
   */
  it.each([
    ["codex", "plugins-codex/voice/skills"],
    ["opencode", "plugins-opencode/voice/skills"],
  ] as [Platform, string][])("refuses a %s target no skill renders to", (platform, targetPath) => {
    const { status, stderr } = runDriverWith(registryWithTarget("voice", targetPath, platform));
    expect(status, stderr).not.toBe(0);
    expect(stderr).toContain("would publish an empty directory");
    expect(stderr).toContain(`No skill renders to ${platform}`);
  });

  // Without this the guard could refuse every target and the two refusals above
  // would still pass. voice/handbook does render to claude-code.
  it("permits a target its skills do render to", () => {
    const { status, stderr } = runDriverWith(registryWithTarget("voice", "plugins-voice/voice/skills", "claude-code"));
    expect(status, stderr).toBe(0);
  });
});

describe("build driver untracked-content refusal", () => {
  /**
   * Publishing renames the target directory away with everything in it.
   * Tracked losses come back from the index; untracked ones do not, which is
   * how a peer session lost in-progress work to a build it did not know it had
   * started. The refusal is the only place that loss can be prevented.
   */
  it("refuses to publish into a target holding untracked files", () => {
    const target = "plugins-voice/voice/skills";
    const planted = repoPath(target, ".untracked-work-in-progress.md");
    expect(fs.existsSync(planted), "fixture path is already in use").toBe(false);
    fs.writeFileSync(planted, "work a build must not silently destroy\n");
    try {
      const { status, stderr } = runDriverWith(registryWithTarget("voice", target));
      expect(status, stderr).not.toBe(0);
      expect(stderr).toContain("untracked files that publishing would destroy");
      expect(stderr).toContain(".untracked-work-in-progress.md");
    } finally {
      fs.rmSync(planted, { force: true });
    }
  });

  it("refuses to publish into a target holding ignored untracked files", () => {
    const target = "plugins-voice/voice/skills";
    const planted = repoPath(target, ".DS_Store");
    expect(fs.existsSync(planted), "fixture path is already in use").toBe(false);
    fs.writeFileSync(planted, "ignored work a build must not silently destroy\n");
    try {
      const { status, stderr } = runDriverWith(registryWithTarget("voice", target));
      expect(status, stderr).not.toBe(0);
      expect(stderr).toContain("untracked files that publishing would destroy");
      expect(stderr).toContain(".DS_Store");
    } finally {
      fs.rmSync(planted, { force: true });
    }
  });

  it("permits a target whose contents are all tracked", () => {
    expect(git(["ls-files", "--others", "--exclude-standard", "--", "plugins-voice/voice/skills"]).trim()).toBe("");
    const { status, stderr } = runDriverWith(registryWithTarget("voice", "plugins-voice/voice/skills"));
    expect(status, stderr).toBe(0);
  });
});
