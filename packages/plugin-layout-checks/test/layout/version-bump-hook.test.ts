import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { repoPath } from "../helpers.js";

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

/** A repository shaped like this one: one registry plugin, all six surfaces. */
function makeFixture(): string {
  const root = fs.mkdtempSync(path.join(scratch, "repo-"));
  run(root, "git", ["init", "-q", "-b", "main"]);
  run(root, "git", ["config", "user.email", "fixture@example.invalid"]);
  run(root, "git", ["config", "user.name", "Fixture"]);

  for (const [rel, source] of [
    [".githooks/pre-commit.plugin-version-bump.sh", HOOK],
    ["scripts/sync-plugin-versions.sh", SYNC],
    ["scripts/rewrite-version-literal.mjs", LITERAL],
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
});
