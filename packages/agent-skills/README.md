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

All four hosts install from
[`goodfoot-io/marketplace`](https://github.com/goodfoot-io/marketplace). Claude Code and
Codex add the repository as a marketplace and install by name. Antigravity installs one
plugin root at a time. OpenCode needs a checkout, because these plugin packages are not
published to npm.

#### Claude Code

```bash
claude plugin marketplace add goodfoot-io/marketplace
claude plugin install agent-skills@goodfoot
```

Verify with `claude plugin list` — `agent-skills@goodfoot` should be listed as enabled.
`claude plugin details agent-skills` reports the component inventory, confirming the skill
itself arrived rather than just the plugin.

#### Codex

```bash
codex plugin marketplace add goodfoot-io/marketplace
codex plugin add agent-skills@goodfoot
```

The marketplace source must be a repository, git URL, or directory; passing the manifest
path itself is rejected. A bare plugin name is rejected even when exactly one marketplace
is configured — qualify it as `agent-skills@goodfoot` or pass `--marketplace goodfoot`. If
you set `CODEX_HOME`, create that directory first; Codex will not create it and fails with
`failed to resolve CODEX_HOME`.

Verify with `codex plugin list`, which lists every marketplace plugin with a `STATUS`
column. Do not use `codex plugin list --json` for this: on codex-cli 0.150.1 its
`available` array is empty even when the plain listing shows all seven plugins, so a
correctly installed plugin can look missing. The skill tree lands under
`$CODEX_HOME/plugins/cache/goodfoot/agent-skills/<version>/skills`.

#### Antigravity

`agy` installs one plugin root at a time, from a git URL with the in-repo path appended:

```bash
agy plugin install https://github.com/goodfoot-io/marketplace.git/plugins-antigravity/agent-skills
```

There is no marketplace form that installs several at once: pointing `agy plugin install`
at the repository root is rejected with `could not detect plugin structure`, as is the
`#subdir` fragment form other tools accept. A local path works the same way: `agy plugin
install ./plugins-antigravity/agent-skills`.

To add the sibling plugins, repeat the command for each root you want —
`plugins-antigravity/` carries `agent-hooks`, `agent-skills`, `claude-code-skill-reader`,
`gmail`, `goodfoot`, `jsdoczoom`, and `linear`.

A successful install reports `skills : 1 processed`; `agents`, `commands`, `mcpServers`,
and `hooks` report `skipped (not found)`, expected for a skills-only plugin. Files land
in `~/.gemini/config/plugins/agent-skills/`. Verify with `agy plugin list`, which reports
`"components": ["skills"]` for the installed plugin.

#### OpenCode

These plugin packages are not published to npm, so `opencode plugin` takes a path into a
checkout rather than a module name:

```bash
git clone https://github.com/goodfoot-io/marketplace.git
opencode plugin "$PWD/marketplace/plugins-opencode/agent-skills"
```

Pass a path, not a bare name. `opencode plugin` resolves a specifier containing a
separator as a path — absolute, `./`-prefixed, and plain relative forms all load on
OpenCode 1.18.23. A single segment with no separator (`agent-skills`) is instead resolved as an
npm package name and silently fails to load, with nothing logged. The absolute form
above avoids the ambiguity.

That is the whole install — no `opencode.json` editing. `opencode plugin` writes only the
top-level `plugin` key, and OpenCode keeps `plugin` and `skills` as disjoint config keys,
so registering the module would not by itself surface its skills. The plugin closes that
gap from the inside: its `config` hook runs against the resolved config before use and
appends its own bundled `skills/` directory to `skills.paths`, resolved relative to
wherever the package was installed. Installing is enough.

Without flags this installs into the current project's `.opencode/opencode.json`. Add
`-g` to install into the global config instead.

Verify with `opencode debug skill`. Its output is large and embeds whole skill bodies:
redirect it to a file and search there. Piping it to `head` truncates the JSON mid-string
and reports a present skill as missing.

#### Updating an existing install

Re-running the install command does not move the version on every host.

- **Claude Code** — `plugin install` is a no-op once the plugin is installed: it reports
  success and leaves the old version pinned. Use `claude plugin marketplace update
  goodfoot`, then `claude plugin update agent-skills@goodfoot`. A restart applies it.
- **Codex** — `codex plugin marketplace upgrade goodfoot` moves the installed version;
  there is no separate plugin-update command.
- **Antigravity** — re-run `agy plugin install`.
- **OpenCode** — pull the checkout; the plugin resolves its skills from that directory, so
  no reinstall is needed. Re-run with `-f` to replace a pinned plugin version.

Check the installed version rather than the exit code. Several hosts report success while
leaving a stale version in place, and a newer directory in a host's cache proves only that
it was fetched, not that it is the active install.

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
