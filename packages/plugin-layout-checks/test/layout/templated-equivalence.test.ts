import { execFileSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { renderHelperReferenceMarkdown } from "../../../agent-skills/src/helper-reference.js";
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
    platform === "opencode"
      ? "plugins-opencode/agent-hooks/skills/codex"
      : platform === "antigravity"
        ? "plugins-antigravity/agent-hooks/skills/codex"
        : `${CODEX_ROOT_TOKEN}/skills/codex`;
  return body.replaceAll(`${CLAUDE_ROOT_TOKEN}/skills/codex`, root);
};

const claudeAuthoringRoot = (body: string) => body.replaceAll("plugins/", "plugins-claude/");
const codexAuthoringRoot = (body: string) => body.replaceAll("plugins/", "plugins-codex/");

const agentHooksCodex = (body: string, platform: string) =>
  codexAuthoringRoot(agentHooksReference(body, platform));

/**
 * agent-skills' two prose skills each point once at their sibling
 * `reference/helper-reference.md`, which resolves per-platform the same way
 * agent-hooks' codex references do.
 */
const agentSkillsReference = (body: string, platform: string) => {
  if (platform === "claude-code") return body;
  const root =
    platform === "opencode"
      ? "plugins-opencode/agent-skills/skills"
      : platform === "antigravity"
        ? "plugins-antigravity/agent-skills/skills"
        : `${CODEX_ROOT_TOKEN}/skills`;
  return body.replaceAll(
    `${CLAUDE_ROOT_TOKEN}/skills/reference/helper-reference.md`,
    `${root}/reference/helper-reference.md`,
  );
};

/**
 * `template-authoring` tells the reader to prefer portable helpers over
 * literal platform syntax, and used to demonstrate the opposite: a hardcoded
 * Claude-dialect `agent-skills:cli-and-helpers` that resolves to nothing on
 * Codex and OpenCode. It now routes through `it.skillRef()`. The expected
 * strings are written out rather than re-derived from the helper, so this
 * stays falsifiable — a helper that changed dialect wrongly would move the
 * tree and a derived expectation together and prove nothing.
 */
const agentSkillsSkillRef = (body: string, platform: string) => {
  if (platform === "claude-code") return body;
  const rendered =
    platform === "opencode"
      ? "`$cli-and-helpers`"
      : platform === "antigravity"
        ? "`cli-and-helpers`"
        : "`$agent-skills:cli-and-helpers`";
  return body.replaceAll("`agent-skills:cli-and-helpers`", rendered);
};

/** Verified Antigravity publication replaces only the former validation-only policy claims. */
const agentSkillsAntigravityPolicy = (body: string) =>
  body
    .replace(
      "# Antigravity boundary\n\nAntigravity support is intentionally fail-closed. This repository does not yet have a shipped Antigravity skill tree or a complete authoritative set of host conventions. Do not infer missing behavior from Claude Code, Codex, or OpenCode.",
      "# Antigravity support\n\nThis repository ships Antigravity plugin roots generated from the same authored skill sources as the other platforms. Each root has an `agy`-validated `plugin.json` and at least one processed skill. Treat that validation as evidence for plugin packaging and skill discovery, not as evidence for hooks, MCP servers, or unavailable host behaviors.",
    )
    .replace(
      "Currently provisional areas include prose skill references and invocation, the `AGENTS.md` conventions filename, and related platform identity values recorded by the package's platform table. Currently unavailable areas include subagent dispatch, canonical agent references, worktree operations, and any other helper cell the table does not define. An unavailable helper must throw at render time and identify both the helper and `antigravity`.",
      "Prose skill invocation and the `AGENTS.md` conventions filename are verified. Related platform identity values remain visibly provisional where the platform table says so. Canonical agent-reference spelling remains unavailable because native agents are invoked by name rather than through a rendered reference.\n\nNative subagent operations are verified and exposed by the helpers:\n\n- Dispatch by delegating to a named subagent with `invoke_subagent`.\n- Re-engage by checking state with `manage_subagents`, then using `send_message` when the subagent is live.\n- Deliver results to the orchestrator with `send_message`.\n\nDirect worktree operations remain unavailable: Antigravity can request isolation for a subagent, but it has no documented enter/remove pair matching the helper lifecycle. Any other unavailable helper must throw at render time and identify both the helper and `antigravity`.",
    )
    .replace(
      "Do not invent an Antigravity plugin-root variable, agent naming transformation, subagent operation, worktree tool, frontmatter key, directory convention, install command, or behavioral smoke test. Do not silently use a Codex or OpenCode value because it looks similar.",
      "Do not invent an Antigravity plugin-root variable, agent naming transformation, worktree tool, frontmatter key, install command, or behavioral smoke test. Do not silently use a Codex or OpenCode value because it looks similar. The verified directory convention is a complete plugin root under `plugins-antigravity/<name>` with a populated skill leaf.",
    )
    .replace(
      "When a user needs an unavailable feature, state which helper or convention is unknown and treat the request as platform-contract work. The required next evidence is an authoritative host contract and a runnable validation surface; until then, Antigravity is validation-only.",
      "When a user needs an unavailable feature, state which helper or convention is unknown and treat the request as platform-contract work. `agy plugin validate` is the runnable packaging boundary today; behavior beyond the positively processed skill category still requires authoritative host evidence.",
    );

const HELPER_TABLE_BEGIN = "<!-- BEGIN GENERATED AGENT-SKILLS HELPER REFERENCE -->";
const HELPER_TABLE_END = "<!-- END GENERATED AGENT-SKILLS HELPER REFERENCE -->";

/**
 * The helper reference is the one file here whose body is part hand-authored
 * prose and part machine-generated table, and the two need different contracts.
 *
 * The prose keeps the pinned-blob contract unchanged. The table cannot: its
 * pre-migration bytes are the output of a renderer this card fixed, and its
 * cells legitimately moved when the forced fact cast came out — statuses that
 * read `undefined`, blank cells that could not be told from missing ones, and
 * a composite `logicalPaths` fact that is now five rows carrying their own
 * statuses. Enumerating those as textual substitutions would not be a check;
 * it would be transcribing the new output into the fixture under the guise of
 * reconstructing it, which is exactly the tautology F2 exists to prevent.
 *
 * So the region is spliced from the live renderer, and its correctness is owned
 * by the two dedicated controls in helper-reference-live.test.ts: shipped bytes
 * must equal the live render, and the live render must have no blank,
 * `undefined`, or `[object Object]` cell and no status outside the vocabulary.
 * What this transform still proves is that everything *outside* the markers is
 * byte-identical to the pre-migration blob.
 */
const helperReferenceTable = (body: string) => {
  const relocated = body.replace(
    "plugins/agent-skills/scripts/sync-helper-reference.mjs",
    "plugins-claude/agent-skills/scripts/sync-helper-reference.mjs",
  );
  const begin = relocated.indexOf(HELPER_TABLE_BEGIN);
  const end = relocated.indexOf(HELPER_TABLE_END);
  if (begin < 0 || end <= begin) throw new Error("pinned helper reference has no generated-region markers");
  const head = relocated.slice(0, begin + HELPER_TABLE_BEGIN.length);
  return `${head}\n\n${renderHelperReferenceMarkdown()}\n${relocated.slice(end)}`;
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
function embeddedBash(body: string, platform: string): string {
  if (platform === "claude-code") return body;
  return body.replace(/^```!\n/m, "Run this command and report its output:\n\n```bash\n");
}

const BODY_TRANSFORMS: Record<string, Record<string, (body: string, platform: string) => string>> = {
  jsdoczoom: {
    "cli/SKILL.md": embeddedBash,
    "style/SKILL.md": embeddedBash,
  },
  "claude-code-skill-reader": {
    "cli/SKILL.md": embeddedBash,
  },
  linear: {
    "linear/SKILL.md": embeddedBash,
  },
  gmail: {
    "gmail/SKILL.md": (body, platform) => {
      if (platform === "claude-code") return body;
      const withFence = body.replace("```!", "```bash");
      const withNote = withFence.replace(
        "top-level await.\n",
        `top-level await.\n\n> This environment check auto-executes on Claude Code load. On ${
          platform === "codex" ? "Codex" : platform === "antigravity" ? "Antigravity" : "OpenCode"
        } it is documented example code above — run it manually to verify Gmail credentials before use.\n`,
      );
      const reference =
        platform === "opencode"
          ? "plugins-opencode/gmail/skills/gmail/advanced/oauth-setup.md"
          : platform === "antigravity"
            ? "plugins-antigravity/gmail/skills/gmail/advanced/oauth-setup.md"
          : `${CODEX_ROOT_TOKEN}/skills/gmail/advanced/oauth-setup.md`;
      return withNote.replaceAll(`${CLAUDE_ROOT_TOKEN}/skills/gmail/advanced/oauth-setup.md`, reference);
    },
  },
  "agent-hooks": {
    "claude-code/SKILL.md": claudeAuthoringRoot,
    "claude-code/reference/installation.md": claudeAuthoringRoot,
    "codex/SKILL.md": agentHooksCodex,
    "codex/reference/installation.md": codexAuthoringRoot,
  },
  "agent-skills": {
    "antigravity/SKILL.md": agentSkillsAntigravityPolicy,
    "cli-and-helpers/SKILL.md": agentSkillsReference,
    "platform-behavior/SKILL.md": agentSkillsReference,
    "template-authoring/SKILL.md": agentSkillsSkillRef,
    "reference/helper-reference.md": helperReferenceTable,
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
            const bodyTransform = BODY_TRANSFORMS[plugin.name]?.[entry.path];

            if (original.header === "" && output.header === "") {
              // No frontmatter on either side (a reference/*.md asset). These
              // carry no helper calls, so the body is byte-faithful unless a
              // transform names an approved substitution site.
              const expectedText = bodyTransform
                ? bodyTransform(originalText, target.platform)
                : originalBytes.toString("utf8");
              expect(outputText, entry.path).toBe(expectedText);
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
            const expectedBody = bodyTransform ? bodyTransform(original.body, target.platform) : original.body;
            expect(output.body, `${target.path}/${entry.path} body`).toBe(expectedBody);
          }
        });
      }
    });
  }
});
