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
 * agent-hooks is the one plugin whose two main documents are not two
 * renderings of one text: `claude-code` and `codex` teach different subject
 * matter, both shipped to every platform, so their build commands, doc URLs,
 * and hook-type vocabulary are substance and stay verbatim in every tree
 * (plan A2/A3, refined by this card's read).
 *
 * The consolidation folded each plugin's sibling skills into one hub skill:
 * the former SKILL.md bodies now ship as plain reference files (frontmatter
 * absorbed into the hub), links between them became same-skill relative
 * paths, and every file is identical across the four trees. The transforms
 * below reconstruct that from the pinned pre-migration blobs so the named
 * substitution sites stay the only permitted drift.
 */
const claudeAuthoringRoot = (body: string) => body.replaceAll("plugins/", "plugins-claude/");
const codexAuthoringRoot = (body: string) => body.replaceAll("plugins/", "plugins-codex/");

/** Former claude-code SKILL.md: gains the hub-era H1; its reference links move under claude-code/. */
const agentHooksClaudeCode = (body: string) =>
  `# Claude Code hooks\n\n${claudeAuthoringRoot(body).replaceAll("](reference/", "](claude-code/")}`;

/**
 * Former codex SKILL.md: gains the hub-era H1, and its 9 per-platform
 * plugin-root reference links become same-skill relative paths — identical in
 * every tree, which is what dissolved agent-hooks' per-platform drift.
 */
const agentHooksCodex = (body: string) =>
  `# Codex hooks\n\n${codexAuthoringRoot(body).replaceAll(`(@${CLAUDE_ROOT_TOKEN}/skills/codex/reference/`, "(codex/")}`;

/**
 * agent-skills' two prose documents each pointed once at the shared
 * `reference/helper-reference.md` through a per-platform plugin-root path;
 * consolidation made that file a sibling inside the one skill, so the link is
 * now a bare relative filename in every tree.
 */
const agentSkillsCliReference = (body: string) =>
  body.replace(
    `Use the shared reference at \`${CLAUDE_ROOT_TOKEN}/skills/reference/helper-reference.md\` for`,
    "Use the sibling reference `helper-reference.md` for",
  );

const agentSkillsPlatformReference = (body: string) =>
  body.replace(
    `Consult \`${CLAUDE_ROOT_TOKEN}/skills/reference/helper-reference.md\` for`,
    "Consult the sibling reference `helper-reference.md` for",
  );

/**
 * `template-authoring` used to route its cross-skill pointer through
 * `it.skillRef("agent-skills:cli-and-helpers")`; the target is now a sibling
 * file inside the same skill, so the pointer is a plain relative filename.
 */
const agentSkillsSkillRef = (body: string) =>
  body.replace(
    "Load the `agent-skills:cli-and-helpers` skill for",
    "Consult the sibling reference `cli-and-helpers.md` for",
  );

const agentSkillsCliLessons = (body: string) =>
  agentSkillsCliReference(body)
    .replace(
      "Builds are fail-closed and transactional. Do not compensate for an error by partially copying output: validation or rendering failure is required to leave every destination untouched. `lint` diagnoses sources and rendered manifests; it does not check whether committed generated trees are fresh.",
      "Builds are fail-closed and transactional. Do not compensate for an error by partially copying output: validation or rendering failure is required to leave every destination untouched. `lint` diagnoses sources and rendered manifests; it does not check whether committed generated trees are fresh.\n\nA build publishes by replacing each target directory as a unit, not by merging files into it. Point every target at the generated leaf (normally `<plugin>/skills`), never at a plugin root that also contains manifests, binaries, changelogs, or other maintained content. Before publishing, account for every untracked entry in the target, including ignored files: an ignored cache or local configuration is still data the directory swap would destroy. A freshness gate should rebuild all registry targets and require a clean diff; lint alone cannot prove that committed output matches its source.",
    )
    .replace(
      "Use `it.skillInvoke(...)`, rather than `it.skillRef(...)`, when the output must actively load a skill. Invocation may be a block-level construct, so do not embed it inside a sentence.",
      "Use `it.skillInvoke(...)`, rather than `it.skillRef(...)`, when the output must actively load a skill. Invocation may be a block-level construct, so do not embed it inside a sentence.\n\nWhen a migration adds a platform, verify discovery with that host's real headless invocation. Installing the plugin, listing its files, or validating frontmatter proves packaging only; it does not prove the host can discover and load the skill. Exercise at least one skill from each migrated plugin on every platform where that plugin actually ships, and treat a provider outage separately from a discovery failure.",
    );

const agentSkillsPlatformLessons = (body: string) =>
  agentSkillsPlatformReference(body)
    .replace(
      "A helper keys on *rendering platform* — which tree a file is being published into. It does not, and must not, key on *subject matter* — which host's API or behavior a document is actually about. These coincide for a single-subject skill rendered three ways, so it is easy to assume they are the same axis. They are not, and a plugin whose skills each teach a different host's behavior (for example, one skill documenting Claude Code hooks and a sibling skill documenting Codex hooks, both shipped from the same plugin) exposes the difference directly: the Claude-Code-hooks skill's build command, doc links, and examples stay about Claude Code in every rendered tree, including the Codex and OpenCode copies of that same skill. Routing that content through `it.variant()` because it \"looks platform-shaped\" renders a *wrong* document — a Codex tree's copy of the Claude-Code-hooks skill would incorrectly start teaching Codex's command.",
      "A helper keys on *rendering platform* — which tree a file is being published into. It does not, and must not, key on *subject matter* — which host's API or behavior a document is actually about. These coincide for a single-subject skill rendered three ways, so the two axes look identical. They are not. A plugin whose skills each teach a different host — one documenting Claude Code hooks, a sibling documenting Codex hooks — exposes the difference: the Claude-Code-hooks skill's build command, links, and examples stay about Claude Code in every rendered tree, including the Codex and OpenCode copies. Routing that through `it.variant()` because it \"looks platform-shaped\" renders a *wrong* document: the Codex tree's copy would start teaching Codex's command.",
    )
    .replace(
      "The test before reaching for a helper: does this value's correct form depend on which tree the current file is being rendered into, or does it depend on what the file is about? Only the former is dialect. A recurring difference that is actually subject matter — a different API, a different capability set, a document that would be wrong if \"corrected\" to match its sibling — stays as separate, undoctored prose in its own template, optionally scoped with front-config `platforms:` when it should not render for a host at all.",
      "The test before reaching for a helper: does this value's correct form depend on which tree the file renders into, or on what the file is about? Only the former is dialect. Subject matter — a different API, a different capability set, a document that would be wrong if \"corrected\" to match its sibling — stays as undoctored prose in its own template, scoped with front-config `platforms:` when it should not render for a host at all.",
    )
    .replace(
      "Judge byte-faithful ports against parsed frontmatter values and body bytes, not raw file bytes: `it.frontmatter()` may reflow a long `description`'s YAML line-folding on rewrite even when the parsed value is unchanged, so a rendered file that differs only in where its description wraps is not a regression. Build the equivalence check against a pinned pre-migration copy of the source (a git blob at a known revision), never against the migration's own rendered output — the latter only proves the renderer is consistent with itself, not that it preserved the original.",
      "Judge byte-faithful ports against parsed frontmatter values and body bytes, not raw file bytes: `it.frontmatter()` may reflow a long `description`'s YAML folding even when the parsed value is unchanged. Build the equivalence check against a pinned pre-migration copy of the source (a git blob at a known revision), never against the migration's own rendered output — that only proves the renderer is self-consistent, not that it preserved the original.\n\n## Distribution and verification\n\nInstalling is delivery, not function. One passing route per platform is not coverage: each host ships through several routes that fail independently — a marketplace, a direct git URL, a local path, an npm name, a packed tarball. Enumerate the routes, exercise the ones you claim, and say which you exercised.\n\nLabel every result `behavioral`, `structural`, or `blocked`. A weaker result never borrows the word \"pass\" from a stronger one: a validated manifest, a listed file, or a successful install proves packaging, and only the host loading and running the skill proves function. Report an unauthenticated or unrunnable host as blocked, not as passing.\n\nWhen an installer rejects the package, clone the installer's source and read its detection logic instead of inferring it from the error text. Prove the fix by A/B against the unpatched published copy at the same version; a patched install that merely succeeds does not establish that the patch caused it.\n\nWhere a plugin ships a companion binary as per-platform npm packages, `npm pack` each one and run `file` on the binary inside to confirm it matches the package's declared `os`/`cpu`. A same-OS foreign architecture often runs under emulation and proves little; another OS's binary cannot run at all. Structural verification is the ceiling here.\n\n### OpenCode's dual-purpose manifest\n\n`plugins-opencode/<name>/package.json` is both the npm publishing manifest and a version-bearing release surface, so it is hand-maintained; only the generated skill leaf beneath it is build output.\n\nThe installer detects targets from that manifest alone, never from the module's exports. A package exposing only `exports[\".\"]` is rejected with `No plugin targets found` even though the code is correct. Declare `main`, `exports[\"./tui\"]`, or `exports[\"./server\"]`. Adding one is inert for consumers: OpenCode patches its config with the package name, so runtime resolution still goes through `exports[\".\"]`.",
    )
    .replace(
    "Render each selected platform and review the output in that platform's dialect. Check exact bytes and inventory, including opaque assets, rather than comparing only Markdown meaning. In particular, inspect skill and agent references, conventions filenames, native frontmatter keys, logical destination roots, block-level invocation whitespace, and forbidden plugin-root variables inside skill Markdown.",
    "Render each selected platform and review the output in that platform's dialect. Check exact bytes and inventory, including opaque assets, rather than comparing only Markdown meaning. In particular, inspect skill and agent references, conventions filenames, native frontmatter keys, logical destination roots, block-level invocation whitespace, and forbidden plugin-root variables inside skill Markdown.\n\nKeep the declared platform set honest. A build target that intentionally renders zero files cannot be represented in Git and will be recreated only on machines that happen to run the build; omit unsupported targets instead of declaring empty output trees. Conversely, do not infer support from a generated directory alone. Confirm each shipped tree with the host's real skill-loading command, and record deliberate platform exceptions where the taught capability exists on only one host:\n\n| Platform | Skill-loading check |\n| --- | --- |\n| Claude Code | `claude plugin list` |\n| Codex | `codex plugin list --json` |\n| OpenCode | `opencode debug skill` |\n| Antigravity | `agy plugin list` |\n\n`opencode debug skill` emits whole skill bodies. Redirect it to a file and search there; piping it to `head` truncates the JSON mid-string and reports a present skill as missing.",
  );

const agentSkillsTemplateLessons = (body: string) =>
  agentSkillsSkillRef(body)
    .replace(
      "Use one source tree for every platform. Markdown templates end in `.md.eta` and render to the same relative path without `.eta`. Files that are not templates are opaque assets: keep them beside the templates so the build copies their bytes and executable mode into each selected output tree.",
      "Use one source tree for every platform. Markdown templates end in `.md.eta` and render to the same relative path without `.eta`. Files that are not templates are opaque assets: keep them beside the templates so the build copies their bytes and executable mode into each selected output tree.\n\nOpaque copying is unconditional for every selected target. Keep a script beside a template only when each rendered skill tree genuinely needs that script at runtime. Repository verification programs, fixtures, and migration witnesses belong outside the generated target and should be wired into their own typecheck or test graph; otherwise the build silently multiplies unchecked code across platforms and makes disposable output look authoritative.\n\nNot everything under a platform tree is generated. \"Never hand-edit a generated tree\" is a default, not a universal: a plugin root can hold a hand-maintained manifest beside a generated skill leaf. Decide by provenance — grep the renderer and the packer for writes to the path — before editing or reverting one. Getting it backwards costs time in both directions: reverting a legitimate manifest fix as \"generated output\", or hand-patching a page the next build discards.",
    )
    .replace(
      "- Opaque binaries and scripts remain beside their owning template and preserve executable intent.",
      "- Opaque binaries and scripts remain beside their owning template and preserve executable intent.\n- Generated targets contain no hand-maintained siblings or ignored local state that whole-directory publication could erase.",
    );

/**
 * Verified Antigravity publication replaces the former validation-only policy
 * claims, and the later `agy` verification pass replaces the residual ones:
 * `agy plugin install` is runnable, so the install command is no longer a
 * do-not-invent item and `agy plugin validate` is no longer the ceiling.
 */
const agentSkillsAntigravityPolicy = (body: string) =>
  body
    .replace(
      "# Antigravity boundary\n\nAntigravity support is intentionally fail-closed. This repository does not yet have a shipped Antigravity skill tree or a complete authoritative set of host conventions. Do not infer missing behavior from Claude Code, Codex, or OpenCode.",
      "# Antigravity support\n\nAntigravity plugin roots are generated from the same authored skill sources as the other platforms. Each root has an `agy`-validated `plugin.json` and at least one processed skill — evidence for packaging and skill discovery only, not for hooks, MCP servers, or other host behaviors.",
    )
    .replace(
      "The current platform model may classify individual facts as `provisional` when they are grounded only in available public documentation. Provisional values must remain visibly labeled in generated reference material and diagnostics. They are not permission to claim end-to-end support.",
      "Facts grounded only in public documentation are classified `provisional`. Keep them visibly labeled in generated reference material and diagnostics; they are not permission to claim end-to-end support.",
    )
    .replace(
      "Currently provisional areas include prose skill references and invocation, the `AGENTS.md` conventions filename, and related platform identity values recorded by the package's platform table. Currently unavailable areas include subagent dispatch, canonical agent references, worktree operations, and any other helper cell the table does not define. An unavailable helper must throw at render time and identify both the helper and `antigravity`.",
      "Prose skill invocation and the `AGENTS.md` conventions filename are verified. Related platform identity values remain visibly provisional where the platform table says so. Canonical agent-reference spelling remains unavailable because native agents are invoked by name rather than through a rendered reference.\n\nNative subagent operations are verified and exposed by the helpers:\n\n- Dispatch by delegating to a named subagent with `invoke_subagent`.\n- Re-engage by checking state with `manage_subagents`, then using `send_message` when the subagent is live.\n- Deliver results to the orchestrator with `send_message`.\n\nDirect worktree operations remain unavailable: Antigravity can request isolation for a subagent, but it has no documented enter/remove pair matching the helper lifecycle. Any other unavailable helper must throw at render time and identify both the helper and `antigravity`.",
    )
    .replace(
      "Do not invent an Antigravity plugin-root variable, agent naming transformation, subagent operation, worktree tool, frontmatter key, directory convention, install command, or behavioral smoke test. Do not silently use a Codex or OpenCode value because it looks similar.",
      "Do not invent an Antigravity plugin-root variable, agent naming transformation, worktree tool, frontmatter key, or behavioral smoke test. Do not silently use a Codex or OpenCode value because it looks similar. The verified directory convention is a complete plugin root under `plugins-antigravity/<name>` with a populated skill leaf.",
    )
    .replace(
      "When a user needs an unavailable feature, state which helper or convention is unknown and treat the request as platform-contract work. The required next evidence is an authoritative host contract and a runnable validation surface; until then, Antigravity is validation-only.",
      "When a user needs an unavailable feature, state which helper or convention is unknown and treat the request as platform-contract work.\n\n## Verified `agy` surface\n\n`agy plugin validate <root>` and `agy plugin install <root>` both run unattended. Install takes a local path or a git URL with the in-repo path appended: `agy plugin install https://github.com/<org>/<repo>.git/plugins-antigravity/<name>`.\n\nThe `#subdir` fragment form fails with `could not detect plugin structure`. Installed files land in `~/.gemini/config/plugins/<name>/`; `agy plugin list` reports the import and its components.\n\nBehavioral invocation remains unavailable: `agy -p` requires an authenticated session, so structural verification is the ceiling unattended. Report an unauthenticated run as unauthenticated, never as a behavioral pass.",
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
  const relocated = body
    .replace(
      "plugins/agent-skills/scripts/sync-helper-reference.mjs",
      "plugins-claude/agent-skills/scripts/sync-helper-reference.mjs",
    )
    .replace(
      "This file is shared by the `agent-skills` documentation skills.",
      "This file is the `agent-skills` skill's helper catalog.",
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
    "claude-code/SKILL.md": agentHooksClaudeCode,
    "claude-code/reference/installation.md": claudeAuthoringRoot,
    "codex/SKILL.md": agentHooksCodex,
    "codex/reference/installation.md": codexAuthoringRoot,
  },
  "agent-skills": {
    "antigravity/SKILL.md": agentSkillsAntigravityPolicy,
    "cli-and-helpers/SKILL.md": agentSkillsCliLessons,
    "platform-behavior/SKILL.md": agentSkillsPlatformLessons,
    "template-authoring/SKILL.md": agentSkillsTemplateLessons,
    "reference/helper-reference.md": helperReferenceTable,
  },
};

/**
 * Where the consolidation moved each pinned pre-migration file. Fixture paths
 * are immutable (they name git blobs), so the mapping to today's generated
 * layout lives here. A fixture entry absent from a plugin's map keeps its
 * original path. The hub SKILL.md files are new authored material with no
 * pre-migration counterpart; their correctness is owned by the freshness and
 * lint gates, not this equivalence contract.
 */
const CONSOLIDATED_PATHS: Record<string, Record<string, string>> = {
  "agent-hooks": {
    "antigravity/SKILL.md": "agent-hooks/reference/antigravity.md",
    "claude-code/SKILL.md": "agent-hooks/reference/claude-code.md",
    "claude-code/reference/environment.md": "agent-hooks/reference/claude-code/environment.md",
    "claude-code/reference/input-types.md": "agent-hooks/reference/claude-code/input-types.md",
    "claude-code/reference/installation.md": "agent-hooks/reference/claude-code/installation.md",
    "claude-code/reference/logging.md": "agent-hooks/reference/claude-code/logging.md",
    "claude-code/reference/output-builders.md": "agent-hooks/reference/claude-code/output-builders.md",
    "claude-code/reference/porting.md": "agent-hooks/reference/claude-code/porting.md",
    "codex/SKILL.md": "agent-hooks/reference/codex.md",
    "codex/reference/environment.md": "agent-hooks/reference/codex/environment.md",
    "codex/reference/input-types.md": "agent-hooks/reference/codex/input-types.md",
    "codex/reference/installation.md": "agent-hooks/reference/codex/installation.md",
    "codex/reference/logging.md": "agent-hooks/reference/codex/logging.md",
    "codex/reference/output-builders.md": "agent-hooks/reference/codex/output-builders.md",
    "codex/reference/porting.md": "agent-hooks/reference/codex/porting.md",
  },
  "agent-skills": {
    "antigravity/SKILL.md": "agent-skills/reference/antigravity.md",
    "cli-and-helpers/SKILL.md": "agent-skills/reference/cli-and-helpers.md",
    "platform-behavior/SKILL.md": "agent-skills/reference/platform-behavior.md",
    "template-authoring/SKILL.md": "agent-skills/reference/template-authoring.md",
    "reference/helper-reference.md": "agent-skills/reference/helper-reference.md",
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
            const generatedPath = CONSOLIDATED_PATHS[plugin.name]?.[entry.path] ?? entry.path;

            // A front-config `platforms:` restriction keeps a skill out of
            // this tree entirely. Asserted as absent rather than skipped, so
            // the restriction cannot quietly stop applying.
            const owner = generatedPath.split("/")[0] ?? "";
            if (!shipped.includes(owner)) {
              expect(
                fs.existsSync(repoPath(target.path, generatedPath)),
                `${target.path}/${generatedPath} is platform-restricted and must not be generated`,
              ).toBe(false);
              continue;
            }

            const originalBytes = catFile(entry.gitObject);
            const originalText = originalBytes.toString("utf8");
            const outputPath = repoPath(target.path, generatedPath);
            expect(fs.existsSync(outputPath), `${target.path}/${generatedPath} missing`).toBe(true);
            const outputText = fs.readFileSync(outputPath, "utf8");

            const original = splitFrontmatter(originalText);
            const output = splitFrontmatter(outputText);
            const bodyTransform = BODY_TRANSFORMS[plugin.name]?.[entry.path];

            // Consolidation demoted a former SKILL.md to a plain reference
            // file: its frontmatter was absorbed into the plugin's single hub
            // SKILL.md, and only the body ships. Anything else losing its
            // frontmatter is drift, so the demotion is permitted only where a
            // path remap says the file moved.
            if (original.header !== "" && output.header === "") {
              expect(
                CONSOLIDATED_PATHS[plugin.name]?.[entry.path],
                `${target.path}/${generatedPath} lost its frontmatter without a consolidation remap`,
              ).toBeDefined();
              // splitFrontmatter leaves the separator newline on the body;
              // the demoted file starts at its first content line.
              const demotedBody = original.body.replace(/^\n/, "");
              const expectedBody = bodyTransform ? bodyTransform(demotedBody, target.platform) : demotedBody;
              expect(outputText, entry.path).toBe(expectedBody);
              continue;
            }

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
