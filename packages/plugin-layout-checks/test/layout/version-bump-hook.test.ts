import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { repoPath } from "../helpers.js";
import { type RegistryPlugin, versionDrift } from "../registry.js";

/**
 * The bump hook and the propagation script, run together over a real git
 * index.
 *
 * They were separate mechanisms that disagreed: the hook wrote the Claude
 * plugin manifest and the marketplace entry, sync-plugin-versions.sh knew
 * about the Codex manifest, the OpenCode package, the npm package, and the
 * `--version` literal, and nothing invoked the second after the first. Every
 * hook-driven commit therefore shipped a plugin whose four other surfaces were
 * a patch behind, and four commits on this card exist only to close that gap
 * by hand.
 *
 * A unit check on either half would have stayed green throughout, because
 * neither half was individually wrong. So the exercise is the composition: run
 * the hook over a staged change, then run the check the hook is supposed to
 * make unnecessary and require it to pass.
 *
 * It runs in a fixture repository rather than this one — the real scripts, a
 * real index, but no risk of staging a concurrent session's work.
 */

const HOOK = repoPath(".githooks/pre-commit.plugin-version-bump.sh");
const SYNC = repoPath("scripts/sync-plugin-versions.sh");
const LITERAL = repoPath("scripts/rewrite-version-literal.mjs");
const CHANGELOG_CHECK = repoPath("scripts/check-changelog-entry.mjs");
const CHANGELOG_SURFACES = repoPath("scripts/changelog-surfaces.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "version-bump-hook-"));

afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

function run(cwd: string, command: string, args: string[]): string {
  return execFileSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, OSTYPE: "linux-gnu" } });
}

function write(root: string, rel: string, body: string): void {
  fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), body);
}

/** A repository shaped like this one: one registry plugin, all eight surfaces. */
function makeFixture(): string {
  const root = fs.mkdtempSync(path.join(scratch, "repo-"));
  run(root, "git", ["init", "-q", "-b", "main"]);
  run(root, "git", ["config", "user.email", "fixture@example.invalid"]);
  run(root, "git", ["config", "user.name", "Fixture"]);

  for (const [rel, source] of [
    [".githooks/pre-commit.plugin-version-bump.sh", HOOK],
    ["scripts/sync-plugin-versions.sh", SYNC],
    ["scripts/rewrite-version-literal.mjs", LITERAL],
    ["scripts/check-changelog-entry.mjs", CHANGELOG_CHECK],
    ["scripts/changelog-surfaces.mjs", CHANGELOG_SURFACES],
  ] as const) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(source, path.join(root, rel));
    fs.chmodSync(path.join(root, rel), 0o755);
  }

  write(root, "skills-src/demo/thing/SKILL.md.eta", "original template\n");
  write(
    root,
    "plugins/demo/.claude-plugin/plugin.json",
    `${JSON.stringify({ name: "demo", version: "1.0.0" }, null, 2)}\n`,
  );
  write(root, "plugins/demo/skills/thing/SKILL.md", "original template\n");
  write(
    root,
    "plugins-codex/demo/.codex-plugin/plugin.json",
    `${JSON.stringify({ name: "demo", version: "1.0.0" }, null, 2)}\n`,
  );
  write(root, "plugins-opencode/demo/package.json", `${JSON.stringify({ name: "demo", version: "1.0.0" }, null, 2)}\n`);
  write(
    root,
    "packages/demo/package.json",
    `${JSON.stringify({ name: "@fixture/demo", version: "1.0.0" }, null, 2)}\n`,
  );
  write(root, "packages/demo/src/cli.ts", 'export const banner = () => stdout("1.0.0\\n");\n');
  // Notes for the release this fixture's hook is about to cut. Unlike every
  // other surface these are written by the author ahead of the bump, because
  // nothing can generate the sentence for them.
  for (const rel of ["packages/demo/CHANGELOG.md", "plugins/demo/CHANGELOG.md"]) {
    write(
      root,
      rel,
      "# Changelog\n\n## 1.0.1\n\nDescribes what this fixture release changed.\n\n## 1.0.0\n\nFirst release.\n",
    );
  }
  write(
    root,
    ".claude-plugin/marketplace.json",
    `${JSON.stringify({ metadata: { version: "2.0.0" }, plugins: [{ name: "demo", source: "./plugins/demo", version: "1.0.0" }] }, null, 2)}\n`,
  );
  write(
    root,
    "packages/plugin-layout-checks/registry/plugins.json",
    `${JSON.stringify(
      {
        sharedOpencodeRoot: "skills",
        plugins: [
          {
            name: "demo",
            skillsSrc: "skills-src/demo",
            claudePluginRoot: "plugins/demo",
            codexPluginRoot: "plugins-codex/demo",
            opencodePluginRoot: "plugins-opencode/demo",
            marketplace: { claude: "demo", codex: null },
            versionSurfaces: {
              source: "plugins/demo/.claude-plugin/plugin.json",
              codexManifest: "plugins-codex/demo/.codex-plugin/plugin.json",
              opencodePackage: "plugins-opencode/demo/package.json",
              packageJson: "packages/demo/package.json",
              literals: [
                {
                  path: "packages/demo/src/cli.ts",
                  match: 'stdout\\("([0-9]+\\.[0-9]+\\.[0-9]+)\\\\n"\\)',
                },
              ],
              // No `changelogs` list: the release notes above are found because
              // they exist beside the plugin root and the package root, which
              // is the only thing that decides now.
            },
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "-qm", "fixture"]);
  return root;
}

function versions(root: string): Record<string, string> {
  const json = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")) as { version: string };
  const cli = /stdout\("([0-9]+\.[0-9]+\.[0-9]+)\\n"\)/.exec(
    fs.readFileSync(path.join(root, "packages/demo/src/cli.ts"), "utf8"),
  );
  const marketplace = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin/marketplace.json"), "utf8")) as {
    plugins: { name: string; version: string }[];
  };
  return {
    source: json("plugins/demo/.claude-plugin/plugin.json").version,
    codexManifest: json("plugins-codex/demo/.codex-plugin/plugin.json").version,
    opencodePackage: json("plugins-opencode/demo/package.json").version,
    packageJson: json("packages/demo/package.json").version,
    literal: cli?.[1] ?? "<unmatched>",
    marketplaceEntry: marketplace.plugins[0].version,
  };
}

describe("pre-commit version bump", () => {
  it("converges every declared surface from one staged skill edit", () => {
    const root = makeFixture();
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "skills-src/demo/thing/SKILL.md.eta"]);

    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);

    // All six move together, which is the whole point: the failure was five of
    // six moving and the sixth being fixed in a later commit by hand.
    expect(versions(root)).toEqual({
      source: "1.0.1",
      codexManifest: "1.0.1",
      opencodePackage: "1.0.1",
      packageJson: "1.0.1",
      literal: "1.0.1",
      marketplaceEntry: "1.0.1",
    });
  });

  it("leaves the lockstep check passing, so nothing is left to fix by hand", () => {
    const root = makeFixture();
    write(root, "plugins/demo/skills/thing/SKILL.md", "edited output\n");
    run(root, "git", ["add", "plugins/demo/skills/thing/SKILL.md"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);

    // The exact check CI runs. Before the unification it failed here.
    expect(() => run(root, "bash", ["scripts/sync-plugin-versions.sh", "--check"])).not.toThrow();
  });

  it("stages every surface it rewrote", () => {
    const root = makeFixture();
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "skills-src/demo/thing/SKILL.md.eta"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);

    // A surface rewritten but left unstaged is the same broken commit with an
    // extra step: the commit ships the old version and the diff looks fixed.
    expect(run(root, "git", ["diff", "--name-only"]).trim()).toBe("");
  });

  it("does not bump when only version surfaces are staged", () => {
    const root = makeFixture();
    const manifest = path.join(root, "plugins/demo/.claude-plugin/plugin.json");
    fs.writeFileSync(manifest, `${JSON.stringify({ name: "demo", version: "1.0.5" }, null, 2)}\n`);
    run(root, "git", ["add", "plugins/demo/.claude-plugin/plugin.json"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);

    // Otherwise the hook's own output is an input, and each commit justifies
    // the next one indefinitely.
    expect(versions(root).source).toBe("1.0.5");
  });

  it("bumps a plugin edited only through its Codex tree", () => {
    const root = makeFixture();
    write(root, "plugins-codex/demo/skills/thing/SKILL.md", "edited codex output\n");
    run(root, "git", ["add", "plugins-codex/demo/skills/thing/SKILL.md"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);

    // Ownership, not one directory prefix: the old hook matched `plugins/` and
    // `codex-plugins/`, a path that has not existed since the trees were
    // renamed, so a Codex-only edit bumped nothing at all.
    expect(versions(root).source).toBe("1.0.1");
  });

  it("leaves an untouched plugin alone", () => {
    const root = makeFixture();
    write(root, "README.md", "unrelated\n");
    run(root, "git", ["add", "README.md"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);
    expect(versions(root).source).toBe("1.0.0");
  });

  /**
   * The one surface a script cannot write. Every other release surface holds a
   * version and nothing else, so the bump can stamp it; a CHANGELOG entry holds
   * a sentence, and stamping a bare heading would close the gate while leaving
   * a user who installs the release with a heading that says nothing. So the
   * hook refuses — and refuses before writing anything, so the author edits the
   * CHANGELOG and commits again rather than finding four surfaces already moved
   * by the run that rejected them.
   */
  it("refuses the commit when the release it would cut has no notes", () => {
    const root = makeFixture();
    write(root, "packages/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n");
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);

    expect(() => run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"])).toThrow(/1\.0\.1/);
    // Nothing moved, so re-running after the author writes the entry produces
    // exactly one bump rather than compounding a half-applied one.
    expect(versions(root).source).toBe("1.0.0");
  });

  // The legacy `plugins/<name>/` path used to reach registry plugins too: the
  // registry path above deliberately declines to bump when only a declared
  // surface is staged, but the legacy path knows nothing about surfaces or
  // changelogs and bumped it anyway. Editing a CHANGELOG alone therefore cut
  // an ungated release — exactly the "version with no notes" this gate exists
  // to prevent.
  it("does not let the legacy path bump a registry plugin behind the gate", () => {
    const root = makeFixture();
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.1\n\nEdited notes.\n\n## 1.0.0\n\nFirst.\n");
    run(root, "git", ["add", "plugins/demo/CHANGELOG.md"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);

    expect(versions(root).source).toBe("1.0.0");
    const marketplace = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin/marketplace.json"), "utf8")) as {
      metadata: { version: string };
    };
    expect(marketplace.metadata.version).toBe("2.0.0");
  });

  it("refuses a heading with no body, rather than accepting it as notes", () => {
    const root = makeFixture();
    write(root, "packages/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.1\n\n## 1.0.0\n\nFirst release.\n");
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);

    expect(() => run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"])).toThrow(/no body/);
    expect(versions(root).source).toBe("1.0.0");
  });
});

/**
 * What the hook does when it cannot read the registry.
 *
 * The registry block used to be wrapped in `if jq is installed and the registry
 * is a file`. Everything that makes a registry plugin safe lives inside it: the
 * changelog gate, the propagation to all six surfaces, and the claim that stops
 * the legacy single-surface loop below from touching a registry plugin. So the
 * one condition under which the hook knew least was the condition under which
 * it did the most — a bump through the legacy path, no gate, no propagation,
 * exit 0, and a marketplace bump on top because that arm only needs `sed`.
 *
 * It cannot know which plugins are gated without the registry, so it refuses.
 */
/** A PATH carrying everything the hook needs except the named tool. */
function pathWithout(missing: string): string {
  const farm = fs.mkdtempSync(path.join(scratch, `no-${missing}-bin-`));
  for (const tool of ["sh", "bash", "git", "node", "jq", "sed", "grep", "mv", "rm", "cat", "mkdir", "dirname", "env"]) {
    if (tool === missing) continue;
    const resolved = execFileSync("sh", ["-c", `command -v ${tool} || true`], { encoding: "utf8" }).trim();
    if (resolved.length > 0) fs.symlinkSync(resolved, path.join(farm, tool));
  }
  return farm;
}

describe("registry unreadable", () => {
  const pathWithoutJq = () => pathWithout("jq");

  function runHook(root: string, env: NodeJS.ProcessEnv): { status: number | null; stderr: string } {
    const result = spawnSync("bash", [".githooks/pre-commit.plugin-version-bump.sh"], {
      cwd: root,
      encoding: "utf8",
      env,
    });
    return { status: result.status, stderr: result.stderr ?? "" };
  }

  function stageAnEdit(root: string): void {
    write(root, "plugins/demo/skills/thing/SKILL.md", "edited output\n");
    run(root, "git", ["add", "plugins/demo/skills/thing/SKILL.md"]);
  }

  it("refuses the commit when jq is not installed", () => {
    const root = makeFixture();
    stageAnEdit(root);
    const farm = pathWithoutJq();
    expect(execFileSync("sh", ["-c", "command -v jq || true"], { env: { PATH: farm }, encoding: "utf8" }).trim()).toBe(
      "",
    );

    const { status, stderr } = runHook(root, { PATH: farm, OSTYPE: "linux-gnu" });

    expect(status, stderr).not.toBe(0);
    expect(stderr).toContain("jq is required");
    // The failure that mattered was not the refusal but the bump: silently
    // taking the legacy path moved one surface and the marketplace, leaving
    // three numbers where there should be one.
    expect(versions(root).source).toBe("1.0.0");
  });

  it("refuses the commit when the registry is not parseable", () => {
    const root = makeFixture();
    stageAnEdit(root);
    write(root, "packages/plugin-layout-checks/registry/plugins.json", "{ this is not json\n");

    const { status, stderr } = runHook(root, { ...process.env, OSTYPE: "linux-gnu" });

    expect(status, stderr).not.toBe(0);
    expect(stderr).toContain("not parseable JSON");
    expect(versions(root).source).toBe("1.0.0");
  });

  it("refuses the commit when the registry is missing", () => {
    const root = makeFixture();
    stageAnEdit(root);
    fs.rmSync(path.join(root, "packages/plugin-layout-checks/registry/plugins.json"));

    const { status, stderr } = runHook(root, { ...process.env, OSTYPE: "linux-gnu" });

    expect(status, stderr).not.toBe(0);
    expect(stderr).toContain("cannot tell which plugins it gates");
    expect(versions(root).source).toBe("1.0.0");
  });

  // Without this the guards could refuse every commit and all three refusals
  // above would still pass.
  it("still commits normally when the registry is readable", () => {
    const root = makeFixture();
    stageAnEdit(root);
    const { status, stderr } = runHook(root, { ...process.env, OSTYPE: "linux-gnu" });
    expect(status, stderr).toBe(0);
    expect(versions(root).source).toBe("1.0.1");
  });
});

/**
 * The changelog gate applies to whichever plugins have release notes, not to
 * whichever plugins had them written down.
 *
 * It used to iterate `versionSurfaces.changelogs`. Exactly one plugin of eight
 * ever filled that in, so for the other seven the loop ran zero times and
 * reported success — including agent-hooks, which has a real CHANGELOG and
 * reached 1.0.3 while its newest entry still said 1.0.0. Nothing was wrong with
 * the gate; it was simply never told the file existed.
 */
describe("changelog gate follows the files, not the declaration", () => {
  it("gates a plugin whose changelog was never declared anywhere", () => {
    const root = makeFixture();
    // The fixture registry declares no changelogs at all — the same position
    // agent-hooks was in. Staleness alone has to be enough to refuse.
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n");
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);

    expect(() => run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"])).toThrow(/1\.0\.1/);
    expect(versions(root).source).toBe("1.0.0");
  });

  it("gates a changelog that appears after the plugin already shipped without one", () => {
    const root = makeFixture();
    fs.rmSync(path.join(root, "plugins/demo/CHANGELOG.md"));
    fs.rmSync(path.join(root, "packages/demo/CHANGELOG.md"));
    run(root, "git", ["add", "-A"]);
    run(root, "git", ["commit", "-qm", "no changelogs"]);

    // A plugin with no notes anywhere is not gated: there is no file to be
    // stale. This is the state six of the eight plugins are in.
    write(root, "skills-src/demo/thing/SKILL.md.eta", "first edit\n");
    run(root, "git", ["add", "-A"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);
    expect(versions(root).source).toBe("1.0.1");

    // The moment someone adds one, the next release is gated by it, with
    // nothing added to the registry. Under the declared list this file would
    // have stayed invisible until a human remembered to enumerate it.
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.1\n\nNotes for the release just cut.\n");
    write(root, "skills-src/demo/thing/SKILL.md.eta", "second edit\n");
    run(root, "git", ["add", "-A"]);

    expect(() => run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"])).toThrow(/1\.0\.2/);
    expect(versions(root).source).toBe("1.0.1");
  });

  /**
   * The gate's advice has to match the file it is complaining about.
   *
   * update-package-changelog.sh derives its version from
   * `packages/<name>/package.json` and writes beside it, so aimed at a
   * plugin-level CHANGELOG it does not fail — it prepends an entry to the npm
   * package's changelog, stamped with the npm version, and prints success. When
   * that version already heads the file (agent-hooks: npm 1.0.5 against a
   * `## 1.0.5` heading) the author gets a duplicate heading in a file that was
   * correct, no progress on the file that was wrong, and the same refusal next
   * commit. Nothing downstream catches a duplicate heading, so it survives
   * review looking deliberate.
   */
  it("tells the author to write a plugin changelog by hand rather than naming a packages-only tool", () => {
    const root = makeFixture();
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n");
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);

    const result = spawnSync("bash", [".githooks/pre-commit.plugin-version-bump.sh"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OSTYPE: "linux-gnu" },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("plugins/demo/CHANGELOG.md");
    expect(result.stderr).toContain("No script writes this file");
    expect(result.stderr).not.toContain("update-package-changelog.sh writes one");
  });

  it("still names the writer for a packages-tree changelog, which does have one", () => {
    const root = makeFixture();
    write(root, "packages/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n");
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);

    const result = spawnSync("bash", [".githooks/pre-commit.plugin-version-bump.sh"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OSTYPE: "linux-gnu" },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("update-package-changelog.sh writes one");
  });

  it("agrees with sync --check about which plugins have notes to keep current", () => {
    const root = makeFixture();
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);

    // A changelog nobody declared still has to hold the propagating script to
    // the same answer, or the hook and CI disagree about what shipped.
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nStale.\n");
    expect(() => run(root, "bash", ["scripts/sync-plugin-versions.sh", "--check"])).toThrow();
  });
});

/**
 * The lockstep gate and the propagating script, held to the same answer.
 *
 * Both read the same versionSurfaces declaration, but reading the same
 * declaration is not the same as agreeing about it: `--check` exited 0 over a
 * repository whose lockstep test was red, because the script's idea of a
 * release surface stopped at the six it could stamp. So this desyncs each
 * declared surface in turn and requires both to go red on that one surface —
 * a control that fails if any single surface is dropped from either side,
 * rather than one that special-cases the surface that was missing.
 */
describe("declared surfaces move together or not at all", () => {
  function fixturePlugin(root: string): RegistryPlugin {
    const registry = JSON.parse(
      fs.readFileSync(path.join(root, "packages/plugin-layout-checks/registry/plugins.json"), "utf8"),
    ) as { plugins: RegistryPlugin[] };
    return registry.plugins[0];
  }

  function setJsonVersion(root: string, rel: string, version: string): void {
    const body = JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")) as { version: string };
    body.version = version;
    fs.writeFileSync(path.join(root, rel), `${JSON.stringify(body, null, 2)}\n`);
  }

  const DESYNCS: [string, (root: string) => void][] = [
    ["the Codex manifest", (root) => setJsonVersion(root, "plugins-codex/demo/.codex-plugin/plugin.json", "9.9.9")],
    ["the OpenCode package", (root) => setJsonVersion(root, "plugins-opencode/demo/package.json", "9.9.9")],
    ["the npm package", (root) => setJsonVersion(root, "packages/demo/package.json", "9.9.9")],
    [
      "the CLI version literal",
      (root) => write(root, "packages/demo/src/cli.ts", 'export const banner = () => stdout("9.9.9\\n");\n'),
    ],
    [
      "the marketplace entry",
      (root) => {
        const rel = ".claude-plugin/marketplace.json";
        const body = JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")) as {
          plugins: { version: string }[];
        };
        body.plugins[0].version = "9.9.9";
        fs.writeFileSync(path.join(root, rel), `${JSON.stringify(body, null, 2)}\n`);
      },
    ],
    [
      "the package changelog",
      (root) => write(root, "packages/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n"),
    ],
    [
      "the plugin changelog",
      (root) => write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n"),
    ],
  ];

  it("agrees that a converged repository is converged", () => {
    const root = makeFixture();
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);

    expect(versionDrift(fixturePlugin(root), root)).toEqual([]);
    expect(() => run(root, "bash", ["scripts/sync-plugin-versions.sh", "--check"])).not.toThrow();
  });

  it.each(DESYNCS)("both the gate and --check go red when %s is skipped", (_label, desync) => {
    const root = makeFixture();
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);
    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);
    desync(root);

    expect(versionDrift(fixturePlugin(root), root)).not.toEqual([]);
    expect(() => run(root, "bash", ["scripts/sync-plugin-versions.sh", "--check"])).toThrow();
  });
});

/**
 * A worklist that could not be computed is not a worklist with nothing on it.
 *
 * The changelog gate asked `changelog-surfaces.mjs` for its worklist through
 * `< <(...)`, and `set -e` cannot see an exit status inside a process
 * substitution. Every way of making that script fail therefore produced an empty
 * list, indistinguishable from "this plugin ships no release notes": the loop
 * body never ran, the gate reported success, and the hook cut an undocumented
 * release with exit 0.
 */
describe("changelog worklist failures refuse rather than empty out", () => {
  function stageStaleChangelog(root: string): void {
    // The plugin is at 1.0.0 and about to be bumped to 1.0.1, with notes that
    // stop at 1.0.0. Every test here is the same commit, which must be refused.
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n");
    write(root, "packages/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n");
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);
  }

  it("refuses the commit when node is not on PATH", () => {
    const root = makeFixture();
    stageStaleChangelog(root);
    const farm = pathWithout("node");

    const result = spawnSync("bash", [".githooks/pre-commit.plugin-version-bump.sh"], {
      cwd: root,
      encoding: "utf8",
      env: { PATH: farm, OSTYPE: "linux-gnu" },
    });

    expect(result.status, result.stderr).not.toBe(0);
    // Named, with a way forward, the way the jq guard names jq. The first
    // version of this refusal described a process-substitution bug to someone
    // whose actual problem was a PATH.
    expect(result.stderr).toContain("node is required");
    expect(result.stderr).toContain("commit again");
    // The bump is what mattered: without node the gate saw no changelogs to
    // check and advanced all six surfaces past release notes that stop at 1.0.0.
    expect(versions(root).source).toBe("1.0.0");
  });

  it("lets a commit that touches no plugin through without node", () => {
    const root = makeFixture();
    write(root, "README.md", "A change that belongs to no plugin.\n");
    run(root, "git", ["add", "README.md"]);
    const farm = pathWithout("node");

    const result = spawnSync("bash", [".githooks/pre-commit.plugin-version-bump.sh"], {
      cwd: root,
      encoding: "utf8",
      env: { PATH: farm, OSTYPE: "linux-gnu" },
    });

    // Failing closed is right when the thing that cannot be checked is in
    // scope. Asking for the worklist before asking whether the plugin has
    // anything staged put every commit in scope, so a contributor with no node
    // on their PATH could not fix a typo in this file.
    expect(result.status, result.stderr).toBe(0);
    expect(versions(root).source).toBe("1.0.0");
  });

  it("ignores AGENT_SKILLS_REGISTRY rather than gating against another registry", () => {
    const root = makeFixture();
    stageStaleChangelog(root);
    // A valid registry naming the same plugin, pointed at a tree with no release
    // notes in it. Honouring this variable answered "demo has no changelogs" and
    // the gate passed; the layout suite's build and lint drivers legitimately
    // accept the override, but a release gate must not be redirectable.
    write(
      root,
      "decoy-registry.json",
      `${JSON.stringify({
        sharedOpencodeRoot: "skills",
        plugins: [
          {
            name: "demo",
            claudePluginRoot: "plugins/nowhere",
            versionSurfaces: { source: "plugins/nowhere/.claude-plugin/plugin.json" },
          },
        ],
      })}\n`,
    );

    const result = spawnSync("bash", [".githooks/pre-commit.plugin-version-bump.sh"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OSTYPE: "linux-gnu", AGENT_SKILLS_REGISTRY: "decoy-registry.json" },
    });

    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain("1.0.1");
    expect(versions(root).source).toBe("1.0.0");
  });

  it("keeps --check gating under the same redirected registry", () => {
    const root = makeFixture();
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 0.9.0\n\nOlder release.\n");
    write(root, "decoy-registry.json", `${JSON.stringify({ sharedOpencodeRoot: "skills", plugins: [] })}\n`);

    const result = spawnSync("bash", ["scripts/sync-plugin-versions.sh", "--check"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OSTYPE: "linux-gnu", AGENT_SKILLS_REGISTRY: "decoy-registry.json" },
    });

    expect(result.status, result.stderr).not.toBe(0);
  });
});

/**
 * A release between two documented ones is still a release.
 *
 * The gate compared only the newest heading against the version being cut, so a
 * changelog that ran 1.0.4, 1.0.6 matched at every commit and the 1.0.5 that
 * agent-hooks actually shipped was simply gone — not described, not marked
 * skipped, and invisible to `--check` and to the whole suite.
 */
describe("interior versions are accounted for", () => {
  /** Commits `version` into the fixture's version source, occupying it. */
  function release(root: string, version: string, notes: string | null): void {
    write(root, "plugins/demo/.claude-plugin/plugin.json", `${JSON.stringify({ name: "demo", version }, null, 2)}\n`);
    if (notes !== null) {
      const existing = fs.readFileSync(path.join(root, "plugins/demo/CHANGELOG.md"), "utf8");
      write(
        root,
        "plugins/demo/CHANGELOG.md",
        existing.replace("# Changelog\n", `# Changelog\n\n## ${version}\n\n${notes}\n`),
      );
    }
    run(root, "git", ["add", "-A"]);
    run(root, "git", ["commit", "-qm", `release ${version}`, "--no-verify"]);
  }

  const check = (root: string, version: string) =>
    spawnSync(
      "node",
      [
        "scripts/check-changelog-entry.mjs",
        "plugins/demo/CHANGELOG.md",
        version,
        "plugins/demo/.claude-plugin/plugin.json",
      ],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

  it("passes when every occupied version has an entry", () => {
    const root = makeFixture();
    release(root, "1.0.1", "Described.");
    release(root, "1.0.2", "Also described.");

    const result = check(root, "1.0.2");
    expect(result.status, result.stderr).toBe(0);
  });

  it("names the version that was released and never written down", () => {
    const root = makeFixture();
    release(root, "1.0.1", "Described.");
    release(root, "1.0.2", null);
    release(root, "1.0.3", "Described.");

    const result = check(root, "1.0.3");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("released 1.0.2");
    // The advice has to point at the plugin's own version line. `git tag --list
    // '<plugin>-v*'` names the npm package's tags, which for agent-hooks sit at
    // versions the plugin.json never held.
    expect(result.stderr).toContain("git log -- plugins/demo/.claude-plugin/plugin.json");
    expect(result.stderr).not.toContain("git tag");
  });

  it("does not demand notes for a version that was withdrawn", () => {
    const root = makeFixture();
    release(root, "1.0.1", "Described.");
    // A spurious hook bump, reverted in the next commit with the changelog
    // untouched — exactly what 2e6cbf8 did to agent-skills' 1.0.13.
    release(root, "1.0.2", null);
    release(root, "1.0.1", null);

    const result = check(root, "1.0.1");
    expect(result.status, result.stderr).toBe(0);
  });

  it("does not reach back before the oldest documented release", () => {
    const root = makeFixture();
    // The fixture's history starts at 1.0.0, which the changelog documents; a
    // plugin whose notes begin later is documenting from that point on rather
    // than concealing everything before it.
    const existing = fs.readFileSync(path.join(root, "plugins/demo/CHANGELOG.md"), "utf8");
    write(root, "plugins/demo/CHANGELOG.md", existing.replace(/\n## 1\.0\.0\n\nFirst release\.\n/, "\n"));
    run(root, "git", ["add", "-A"]);
    run(root, "git", ["commit", "-qm", "trim", "--no-verify"]);

    const result = check(root, "1.0.1");
    expect(result.status, result.stderr).toBe(0);
  });
});

/**
 * The interior check needs the whole history, and says so when it cannot have it.
 *
 * `git log` on a shallow clone succeeds and returns what it has. The check read
 * that truncated list as the plugin's entire release sequence and found no gaps
 * in it, so the same tree was refused at full depth and accepted at `--depth 1`
 * — with CI, which checks out at depth 1 by default, on the accepting side.
 */
describe("truncated history is not a history with no gaps", () => {
  /** A `--depth 1` clone of `root`, carrying this repo's current scripts. */
  function shallowCloneOf(root: string): string {
    const clone = fs.mkdtempSync(path.join(scratch, "shallow-"));
    fs.rmSync(clone, { recursive: true, force: true });
    execFileSync("git", ["clone", "-q", "--depth", "1", `file://${root}/.git`, clone], { encoding: "utf8" });
    return clone;
  }

  /**
   * A fixture that occupied 1.0.0, 1.0.1 and 1.0.2 but documents only the ends.
   *
   * The gap has to be interior: the check does not reach below the oldest
   * heading, so a missing version older than everything written down is a
   * changelog that starts late, not one with a hole in it.
   */
  function fixtureWithAGap(): string {
    const root = makeFixture();
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n");
    for (const version of ["1.0.1", "1.0.2"]) {
      write(root, "plugins/demo/.claude-plugin/plugin.json", `${JSON.stringify({ name: "demo", version }, null, 2)}\n`);
      if (version === "1.0.2") {
        write(
          root,
          "plugins/demo/CHANGELOG.md",
          `# Changelog\n\n## 1.0.2\n\nDescribed.\n\n## 1.0.0\n\nFirst release.\n`,
        );
      }
      run(root, "git", ["add", "-A"]);
      run(root, "git", ["commit", "-qm", `release ${version}`, "--no-verify"]);
    }
    return root;
  }

  const check = (cwd: string) =>
    spawnSync(
      "node",
      [
        "scripts/check-changelog-entry.mjs",
        "plugins/demo/CHANGELOG.md",
        "1.0.2",
        "plugins/demo/.claude-plugin/plugin.json",
      ],
      { cwd, encoding: "utf8" },
    );

  it("finds the gap at full depth", () => {
    const result = check(fixtureWithAGap());
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("released 1.0.1");
  });

  it("refuses instead of passing the identical tree at depth 1", () => {
    const clone = shallowCloneOf(fixtureWithAGap());
    expect(execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: clone, encoding: "utf8" }).trim()).toBe(
      "true",
    );

    const result = check(clone);

    // 3, not 1: "could not check" is a different answer from "nothing to
    // find", and callers summarise them differently.
    expect(result.status).toBe(3);
    expect(result.stderr).toContain("shallow");
    expect(result.stderr).toContain("git fetch --unshallow");
  });

  it("separates could-not-check from nothing-to-find by exit code", () => {
    const missing = check(fixtureWithAGap());
    const unreadable = check(shallowCloneOf(fixtureWithAGap()));

    expect(missing.status).toBe(1);
    expect(unreadable.status).toBe(3);
  });

  /**
   * Both callers summarise after the per-file message, and a summary that
   * assumes the wrong cause contradicts the line directly above it. On a
   * shallow checkout the author was told the history could not be read and
   * then, one line later, to write notes that were already written.
   */
  describe("the summary does not contradict the line above it", () => {
    it("sync says the notes could not be verified, not that they are missing", () => {
      const clone = shallowCloneOf(fixtureWithAGap());
      // The package changelog is genuinely behind in this fixture, which is a
      // real missing-notes failure and would legitimately print the summary
      // under test. Bring it level so the shallow history is the only cause
      // left standing.
      write(clone, "packages/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.2\n\nDescribed.\n");

      const result = spawnSync("bash", ["scripts/sync-plugin-versions.sh", "--check"], {
        cwd: clone,
        encoding: "utf8",
        env: { ...process.env, OSTYPE: "linux-gnu" },
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("could not be verified");
      expect(result.stderr).not.toContain("no script can write them for you");
    });

    it("the hook says the notes could not be checked, not that they are absent", () => {
      const clone = shallowCloneOf(fixtureWithAGap());
      // The notes for the version this commit creates are present, so the
      // check gets past "missing" and fails on the history it cannot read —
      // which is the only way to reach the summary under test.
      write(
        clone,
        "plugins/demo/CHANGELOG.md",
        "# Changelog\n\n## 1.0.3\n\nDescribed.\n\n## 1.0.2\n\nDescribed.\n\n## 1.0.0\n\nFirst release.\n",
      );
      write(clone, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
      run(clone, "git", ["add", "-A"]);

      const result = spawnSync("bash", [".githooks/pre-commit.plugin-version-bump.sh"], {
        cwd: clone,
        encoding: "utf8",
        env: { ...process.env, OSTYPE: "linux-gnu" },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("could not be checked");
      expect(result.stderr).not.toContain("has no notes");
    });
  });

  it("withholds the git log bound from a shallow author rather than caveating it", () => {
    const clone = shallowCloneOf(fixtureWithAGap());
    // A different failure — the newest heading is stale — which prints the
    // remediation and is reached before the shallow refusal. Handing an author
    // a bound computed from two commits, presented as the whole release, is
    // worse than the empty tag listing that advice replaced.
    const result = spawnSync(
      "node",
      [
        "scripts/check-changelog-entry.mjs",
        "plugins/demo/CHANGELOG.md",
        "1.0.9",
        "plugins/demo/.claude-plugin/plugin.json",
      ],
      { cwd: clone, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("git log --");
    expect(result.stderr).toContain("git fetch --unshallow");
  });

  it("refuses to run at all without a version source to check against", () => {
    const root = fixtureWithAGap();
    const result = spawnSync("node", ["scripts/check-changelog-entry.mjs", "plugins/demo/CHANGELOG.md", "1.0.2"], {
      cwd: root,
      encoding: "utf8",
    });

    // The argument was optional for one round, and omitting it skipped the
    // whole interior check in silence — the third time on this card that an
    // absence read as a pass.
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("versionSource");
  });
});

/**
 * Asking whether a plugin is in scope must not itself become the answer.
 *
 * The worklist lookup costs node, so it now runs behind a prefilter — but the
 * changelogs it returns are the *exclusion* list, and all of them live inside
 * the directories their plugin owns. A prefilter that decided the whole
 * question would therefore count a staged CHANGELOG as bump-triggering content
 * and cut the release after the one the author had just documented, rebuilding
 * the ratchet the exclusion exists to prevent one step earlier. The prefilter
 * excludes only the registry surfaces, which makes it a strict superset of the
 * full test: it can skip work that would have found nothing, and nothing else.
 */
describe("the prefilter admits, it does not decide", () => {
  it("does not bump when only the plugin's changelog is staged", () => {
    const root = makeFixture();
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release, described at last.\n");
    run(root, "git", ["add", "plugins/demo/CHANGELOG.md"]);

    const result = spawnSync("bash", [".githooks/pre-commit.plugin-version-bump.sh"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OSTYPE: "linux-gnu" },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(versions(root).source).toBe("1.0.0");
  });

  it("does not bump when only the package changelog is staged", () => {
    const root = makeFixture();
    write(root, "packages/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release, described at last.\n");
    run(root, "git", ["add", "packages/demo/CHANGELOG.md"]);

    const result = spawnSync("bash", [".githooks/pre-commit.plugin-version-bump.sh"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OSTYPE: "linux-gnu" },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(versions(root).source).toBe("1.0.0");
  });

  it("still bumps when a changelog is staged alongside real content", () => {
    const root = makeFixture();
    // Without this the two tests above would pass on a hook that had stopped
    // bumping altogether.
    write(root, "plugins/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.1\n\nDescribed.\n\n## 1.0.0\n\nFirst release.\n");
    write(root, "packages/demo/CHANGELOG.md", "# Changelog\n\n## 1.0.1\n\nDescribed.\n\n## 1.0.0\n\nFirst release.\n");
    write(root, "skills-src/demo/thing/SKILL.md.eta", "edited template\n");
    run(root, "git", ["add", "-A"]);

    run(root, "bash", [".githooks/pre-commit.plugin-version-bump.sh"]);

    expect(versions(root).source).toBe("1.0.1");
  });
});

/**
 * The run-wide summary speaks over every failing file at once; the per-file
 * remediation speaks about one path and is the only line that knows whether a
 * generator exists for it. So the summary cannot make a remediation claim
 * without contradicting some file it covers.
 *
 * agent-skills is the live case: it is the only managed plugin carrying both a
 * plugins-tree and a packages-tree CHANGELOG, and this card migrated it. One
 * surface prints "No script writes this file", the other prints
 * "update-package-changelog.sh writes one" — and the summary used to answer
 * both with "no script can write them for you". This fixture has the same two
 * surfaces, and needs no shallow clone to reach it.
 */
describe("the summary claims nothing a per-file line can contradict", () => {
  // Both modes, because the two reach different users. CI runs --check
  // (.github/workflows/plugin-layout.yml), so every failed layout job prints
  // this; a contributor fixing the drift it reports runs the same script with
  // no argument. The gate call and both summaries sit outside every
  // CHECK_ONLY branch, so they are mode-independent by construction — this
  // pins that rather than trusting it.
  for (const [mode, argv] of [
    ["--check", ["scripts/sync-plugin-versions.sh", "--check"]],
    ["write", ["scripts/sync-plugin-versions.sh"]],
  ] as const) {
    it(`stays true in ${mode} mode when one tree has a generator and the other does not`, () => {
      const root = makeFixture();
      // Both changelogs top out at 1.0.1; putting the source ahead leaves both
      // behind at once, which is what makes the two remediations disagree.
      write(
        root,
        "plugins/demo/.claude-plugin/plugin.json",
        `${JSON.stringify({ name: "demo", version: "1.0.5" }, null, 2)}\n`,
      );

      const result = spawnSync("bash", [...argv], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, OSTYPE: "linux-gnu" },
      });

      expect(result.status).not.toBe(0);
      // Both per-file lines are present and say opposite things...
      expect(result.stderr).toContain("update-package-changelog.sh writes one");
      expect(result.stderr).toContain("No script writes this file");
      // ...so the summary must not take a side.
      expect(result.stderr).not.toContain("no script can write them for you");
      expect(result.stderr).toContain("each file's own message");
    });
  }
});
