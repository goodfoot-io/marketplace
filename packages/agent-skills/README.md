# @goodfoot/agent-skills

Compile one Eta skill source tree into deterministic platform-specific trees, and lint templates and rendered Markdown for portability defects.

## Install

Two things ship under the `agent-skills` name. The **npm package** is the compiler and
linter you build skill trees with. The **plugin** carries the `agent-skills` skill, which
teaches a coding agent how to author templates against this package — install it in
whichever agent you develop with.

### The npm package

```bash
yarn add --dev @goodfoot/agent-skills
# or npm install, pnpm, etc.
```

### The plugin, for development

All four hosts install from the published marketplace at
[`goodfoot-io/marketplace`](https://github.com/goodfoot-io/marketplace). Claude Code and
Codex resolve the repository directly; Antigravity and OpenCode need a local checkout
because neither exposes a remote marketplace for skills.

#### Claude Code

```bash
claude plugin marketplace add goodfoot-io/marketplace
claude plugin install agent-skills@goodfoot
```

Verify with `claude plugin list` — `agent-skills@goodfoot` should be listed as enabled.

#### Codex

```bash
codex plugin marketplace add goodfoot-io/marketplace
codex plugin add agent-skills@goodfoot
```

The marketplace source must be a repository, git URL, or directory; passing the manifest
path itself is rejected. `codex plugin add` requires the `<plugin>@<marketplace>` form.
Verify with `codex plugin list --json`; the skill tree lands under
`$CODEX_HOME/plugins/cache/goodfoot/agent-skills/<version>/skills`.

#### Antigravity

`agy` has no marketplace command, so install from a checkout:

```bash
git clone https://github.com/goodfoot-io/marketplace.git
agy plugin install ./marketplace/plugins-antigravity/agent-skills
```

A successful install reports `skills : N processed`; `agents`, `commands`, `mcpServers`,
and `hooks` report `skipped (not found)`, which is expected for a skills-only plugin.
Verify with `agy plugin list`.

#### OpenCode

OpenCode plugins are hook-transport modules and cannot contribute skills — skills load
only from `skills.paths`. `opencode plugin` will not install this. Clone the repository
and register the skill directory in `opencode.json`:

```bash
git clone https://github.com/goodfoot-io/marketplace.git
```

```json
{
  "skills": {
    "paths": ["./marketplace/plugins-opencode/agent-skills/skills"]
  }
}
```

Verify with `opencode debug skill`, which lists every discovered skill.

## Quick start

```eta
---
name: demo
description: Portable demonstration
---

Load <%= it.skillRef("cards:markdown") %>.
```

```sh
agent-skills build --root skills-src/goodfoot --target claude-code=plugins-claude/goodfoot/skills --target codex=plugins-codex/goodfoot/skills '**/*.md.eta'
agent-skills lint --root skills-src/goodfoot --target claude-code=plugins-claude/goodfoot/skills --target codex=plugins-codex/goodfoot/skills '**/*.md.eta'
```

Build renders each selected platform once, transactionally replaces target trees, removes stale generated files, and copies opaque inputs byte-for-byte. Destinations are always explicit.

## Templates

Eta uses `autoEscape: false` and `autoTrim: false`. Helpers are available on `it`: platform predicates and variants, skill and agent references, subagent/worktree operations, logical platform directories, and stable frontmatter. Unsupported facts fail only when read and identify the helper and platform.

Optional configuration starts at byte zero and is stripped before rendering:

```markdown
<!-- agent-skills
platforms: [codex, opencode]
outputName: AGENTS.md
kind: documentation
-->
```

Only `platforms`, `outputName`, `kind`, and line-bounded `lintSuppressions` are accepted. `@codex` is the only variant alias and expands to Codex and OpenCode. Antigravity facts remain visibly verified, provisional, or unavailable and never fall through to another dialect.

## CLI

```text
agent-skills <build|lint> [--root DIR] --target PLATFORM=DIR [--target ...] [--platform PLATFORM] [--platform-dir PLATFORM:KIND=PATH] <file-or-glob...>
```

Platforms are `claude-code`, `codex`, `opencode`, and `antigravity`. Help, version, successful build, and clean lint exit 0. Invalid arguments, zero matches, render failures, unsafe/colliding paths, and lint findings exit 1. Clean lint is silent; diagnostics use stderr.

A build whose publication committed but whose cleanup left residues still exits 0. The CLI emits one deterministic stderr warning per retained residue, including its kind, path, and cleanup error, so successful output is not mistaken for cleanup completion.

`--platform-dir codex:skills=custom/codex/skills` overrides a logical helper path. Repeat it for each platform and logical kind (`skills`, `agents`, `hooks`, `plugin`, or `conventions`). The programmatic equivalent is `platformDirs` on `BuildOptions` and `LintOptions`.

## Helper reference

The generated reference model covers `it.platform`, `it.is`, `it.variant`, `it.skillRef`, `it.skillInvoke`, `it.agentRef`, `it.agentSlotVar`, `it.conventionsFile`, `it.hostIdentity`, `it.pluginRootVar`, `it.platformDir`, `it.frontmatter`, every `it.subagent.*` operation, and both `it.worktree.*` operations. Each row reports accepted inputs plus verified, provisional, or unavailable output for every platform. Render the full current table with `renderHelperReferenceMarkdown()`; this README and the companion plugin consume that same model rather than maintaining a second platform table.

## API and development

The closed export map exposes the root API plus `./types`, `./platforms`, and `./helper-reference`. Companion documentation should import `getHelperReferenceModel()` or `renderHelperReferenceMarkdown()` from `@goodfoot/agent-skills/helper-reference`.

`build()` reports post-commit cleanup failures in `BuildResult.residues` as typed backup, stage, or lock paths. A non-empty residue list means every target was already published atomically; the listed paths are intentionally retained for operator cleanup and are never used to roll back committed output.

Run `typecheck`, `lint`, `build`, and `test` through `yarn workspace @goodfoot/agent-skills`. Use `release:dry-run` before release.
