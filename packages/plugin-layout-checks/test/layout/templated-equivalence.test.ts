import { execFileSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { CLAUDE_ROOT_TOKEN, CODEX_ROOT_TOKEN } from "../gates.js";
import { readJson, repoPath } from "../helpers.js";
import { PLUGINS, skillsInTarget } from "../registry.js";

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

/**
 * agent-hooks is the one plugin whose two main skills are not two renderings
 * of one document: `claude-code` and `codex` are sibling skills with different
 * `name:` and different subject matter, both shipped to every platform, so
 * their build commands, doc URLs, and hook-type vocabulary are substance and
 * stay verbatim in every tree (plan A2/A3, refined by this card's read).
 *
 * What genuinely varies per tree is the `codex` skill pointing at its own
 * sibling reference files. Reproduced here by construction against the pinned
 * original so the 9 substitution sites are the only permitted drift.
 */
const agentHooksReference = (body: string, platform: string) => {
  if (platform === "claude-code") return body;
  const root =
    platform === "opencode" ? "plugins-opencode/agent-hooks/skills/codex" : `${CODEX_ROOT_TOKEN}/skills/codex`;
  return body.replaceAll(`${CLAUDE_ROOT_TOKEN}/skills/codex`, root);
};

/**
 * gmail's SKILL.md is the one genuinely non-byte-faithful body in this card
 * (plan sections C3/D3): its ```! credential-check fence only auto-executes
 * on Claude Code, and its 4 `${CLAUDE_PLUGIN_ROOT}/skills/gmail/advanced/
 * oauth-setup.md` references resolve per-platform. Byte-comparing the body
 * against the original here would be asserting a false equivalence the
 * migration deliberately does not provide, so the divergence is reproduced
 * by construction against the pinned original text and compared to output —
 * a stricter check than "renders", since it still fails on any unintended
 * drift outside the 3 known substitution sites.
 */
const BODY_TRANSFORMS: Record<string, Record<string, (body: string, platform: string) => string>> = {
  gmail: {
    "gmail/SKILL.md": (body, platform) => {
      if (platform === "claude-code") return body;
      const withFence = body.replace("```!", "```bash");
      const withNote = withFence.replace(
        "top-level await.\n",
        `top-level await.\n\n> This environment check auto-executes on Claude Code load. On ${
          platform === "codex" ? "Codex" : "OpenCode"
        } it is documented example code above — run it manually to verify Gmail credentials before use.\n`,
      );
      const reference =
        platform === "opencode"
          ? "plugins-opencode/gmail/skills/gmail/advanced/oauth-setup.md"
          : `${CODEX_ROOT_TOKEN}/skills/gmail/advanced/oauth-setup.md`;
      return withNote.replaceAll(`${CLAUDE_ROOT_TOKEN}/skills/gmail/advanced/oauth-setup.md`, reference);
    },
  },
  "agent-hooks": {
    "codex/SKILL.md": agentHooksReference,
  },
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
    expect(
      fs.existsSync(repoPath(`packages/plugin-layout-checks/test/fixtures/${name}-pre-migration-corpus.json`)),
    ).toBe(true);
  });

  for (const plugin of fixturePlugins) {
    const fixturePath = repoPath(
      `packages/plugin-layout-checks/test/fixtures/${plugin.name}-pre-migration-corpus.json`,
    );
    if (!fs.existsSync(fixturePath)) continue;
    const fixture = readJson<Fixture>(
      `packages/plugin-layout-checks/test/fixtures/${plugin.name}-pre-migration-corpus.json`,
    );

    describe(`${plugin.name}`, () => {
      it("fixture entries match their pinned git blob exactly", () => {
        for (const entry of fixture.files) {
          const blob = catFile(entry.gitObject);
          expect(digest(blob), entry.path).toBe(entry.sha256);
        }
      });

      for (const target of plugin.targets) {
        const shipped = skillsInTarget(plugin, target.platform);

        it(`renders ${target.platform} tree (${target.path}) as the pinned corpus, parsed-frontmatter-plus-body`, () => {
          for (const entry of fixture.files) {
            // A front-config `platforms:` restriction keeps a skill out of
            // this tree entirely. Asserted as absent rather than skipped, so
            // the restriction cannot quietly stop applying.
            const owner = entry.path.split("/")[0] ?? "";
            if (!shipped.includes(owner)) {
              expect(
                fs.existsSync(repoPath(target.path, entry.path)),
                `${target.path}/${entry.path} is platform-restricted and must not be generated`,
              ).toBe(false);
              continue;
            }

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
              target.platform === "opencode"
                ? (OPENCODE_NAME_OVERRIDE[plugin.name]?.[skill] ?? originalFm.name)
                : originalFm.name;

            expect(outputFm.name, `${target.path}/${entry.path} name`).toBe(expectedName);
            expect(outputFm.description, `${target.path}/${entry.path} description`).toBe(originalFm.description);
            const bodyTransform = BODY_TRANSFORMS[plugin.name]?.[entry.path];
            const expectedBody = bodyTransform ? bodyTransform(original.body, target.platform) : original.body;
            expect(output.body, `${target.path}/${entry.path} body`).toBe(expectedBody);
          }
        });
      }
    });
  }
});
