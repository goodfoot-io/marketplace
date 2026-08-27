import { execFileSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import { readJson, repoPath } from "../helpers.js";
import { PLUGINS } from "../registry.js";

/**
 * F2/J3's equivalence contract for the plugins migrated under card main-8-1,
 * distinct from goodfoot's agent-skills-migration.test.ts: that suite asserts
 * digest(source) === digest(output), which only holds for goodfoot's
 * zero-Eta-tag byte copies. Every plugin here calls it.frontmatter(), which
 * measurably reflows 7 of 8 SKILL.md files byte-wise (E4), so the contract
 * here is parsed-frontmatter-plus-body-bytes against the pre-migration git
 * blob pinned in each plugin's fixture — never against the migration's own
 * rendered output, which would make the check tautological.
 */

interface FixtureFile {
  path: string;
  mode: number;
  gitObject: string;
  sha256: string;
}
interface Fixture {
  sourceRevision: string;
  authoredRoot: string;
  skills: string[];
  files: FixtureFile[];
}

const digest = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");

/**
 * The one approved, named exception (plan section B2): OpenCode strips
 * namespaces, so a genuine `name: cli` collision between jsdoczoom and
 * claude-code-skill-reader is disambiguated on the OpenCode leg only, to
 * avoid OpenCode's last-writer-wins loader silently dropping one skill
 * entirely. Claude Code and Codex keep the original name.
 */
const OPENCODE_NAME_OVERRIDE: Record<string, Record<string, string>> = {
  jsdoczoom: { cli: "jsdoczoom-cli" },
  "claude-code-skill-reader": { cli: "claude-code-skill-reader-cli" },
};

function splitFrontmatter(text: string): { header: string; body: string } {
  if (!text.startsWith("---\n")) return { header: "", body: text };
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("frontmatter opened but never closed");
  return { header: text.slice(4, end), body: text.slice(end + 5) };
}

/** Reads a plugin's pre-migration file content directly from its pinned git blob. */
function catFile(gitObject: string): Buffer {
  return execFileSync("git", ["-C", repoPath(), "cat-file", "-p", gitObject], { maxBuffer: 64 * 1024 * 1024 });
}

// Plugins carrying a fixture: every registry plugin except goodfoot, which is
// covered by its own byte-identity contract in agent-skills-migration.test.ts.
const fixturePlugins = PLUGINS.filter((plugin) => plugin.name !== "goodfoot");

describe("templated-plugin equivalence (pre-migration blob vs generated output)", () => {
  it.each(fixturePlugins.map((plugin) => plugin.name))("declares a pre-migration fixture for %s", (name) => {
    expect(fs.existsSync(repoPath(`packages/plugin-layout-checks/test/fixtures/${name}-pre-migration-corpus.json`)))
      .toBe(true);
  });

  for (const plugin of fixturePlugins) {
    const fixturePath = repoPath(`packages/plugin-layout-checks/test/fixtures/${plugin.name}-pre-migration-corpus.json`);
    if (!fs.existsSync(fixturePath)) continue;
    const fixture = readJson<Fixture>(`packages/plugin-layout-checks/test/fixtures/${plugin.name}-pre-migration-corpus.json`);

    describe(`${plugin.name}`, () => {
      it("fixture entries match their pinned git blob exactly", () => {
        for (const entry of fixture.files) {
          const blob = catFile(entry.gitObject);
          expect(digest(blob), entry.path).toBe(entry.sha256);
        }
      });

      for (const target of plugin.targets) {
        it(`renders ${target.platform} tree (${target.path}) as the pinned corpus, parsed-frontmatter-plus-body`, () => {
          for (const entry of fixture.files) {
            const originalBytes = catFile(entry.gitObject);
            const originalText = originalBytes.toString("utf8");
            const outputPath = repoPath(target.path, entry.path);
            expect(fs.existsSync(outputPath), `${target.path}/${entry.path} missing`).toBe(true);
            const outputText = fs.readFileSync(outputPath, "utf8");

            const original = splitFrontmatter(originalText);
            const output = splitFrontmatter(outputText);

            if (original.header === "" && output.header === "") {
              // No frontmatter on either side (a reference/*.md asset): body
              // bytes must be untouched, since no helper ever runs on these.
              expect(fs.readFileSync(outputPath), entry.path).toEqual(originalBytes);
              continue;
            }

            const originalFm = parseYaml(original.header) as { name?: string; description?: string };
            const outputFm = parseYaml(output.header) as { name?: string; description?: string };

            const skill = entry.path.split("/")[0];
            const expectedName =
              target.platform === "opencode" ? (OPENCODE_NAME_OVERRIDE[plugin.name]?.[skill] ?? originalFm.name) : originalFm.name;

            expect(outputFm.name, `${target.path}/${entry.path} name`).toBe(expectedName);
            expect(outputFm.description, `${target.path}/${entry.path} description`).toBe(originalFm.description);
            expect(output.body, `${target.path}/${entry.path} body`).toBe(original.body);
          }
        });
      }
    });
  }
});
