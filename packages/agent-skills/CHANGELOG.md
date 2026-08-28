# @goodfoot/agent-skills npm package changelog

## 1.0.22

Adds an Install section to the README covering both the npm package and the plugin, with verified per-host instructions for Claude Code, Codex, Antigravity, and OpenCode. Drops a stale `assets` entry from the package's `files` list, which named a directory that does not exist. No changes to the compiler, CLI, or published code.

## 1.0.21

Maintenance release accompanying the consolidation of the authored skill sources: the agent-skills and agent-hooks documentation skills each collapse into a single hub skill with reference files, and the agent-hooks antigravity platform gate is dropped. No changes to the compiler, CLI, or package contents.

## 1.0.20

Confirms the automated release pipeline end to end following the package's first npm publish: OIDC trusted publishing, the registry-driven plugin reference update, and the repaired CI install smokes. No functional changes.

## 1.0.19

Maintenance release. Republishes the 1.0.18 content unchanged after the post-migration verification pass: the four-platform smoke test (Claude Code, Codex, OpenCode, Antigravity) and the reconciliation of the repository's release checks confirmed the shipped compiler, skills, and generated trees; no functional changes.

## 1.0.18

- Expands the companion authoring guidance with migration-proven safety boundaries: whole-target replacement, ignored-file protection, deliberate opaque-asset fanout, trackable non-empty platform targets, and live host discovery checks.

## 1.0.17

Corrects the generated Antigravity authoring policy to match the package's verified native helper dialect: subagents can be dispatched with `invoke_subagent`, inspected with `manage_subagents`, and contacted with `send_message`. Direct worktree operations remain explicitly unavailable.

## 1.0.16

Publishes all applicable authored skills through a complete, positively validated Antigravity plugin root and documents the verified packaging and skill-discovery boundary without widening unavailable runtime capabilities.

## 1.0.15

- Verifies Antigravity's plugin root, skill and agent directories, frontmatter, conventions file, and prose skill invocation against official documentation and positive `agy` processing. Adds native Antigravity subagent instructions using `invoke_subagent`, `send_message`, and `manage_subagents` while retaining explicit unavailable or provisional classifications where the host does not document an equivalent.

## 1.0.14

- Relocates the companion Claude Code plugin to `plugins-claude/agent-skills` and updates helper-reference synchronization to the new root. The compiler package and its generated Codex and OpenCode outputs retain their existing behavior.

## 1.0.13

- Adds portable block and inline embedded-Bash helpers backed by an explicit platform capability fact. Claude Code renders native execution syntax, while platforms without verified support receive deterministic instructions, and the generated helper reference now publishes the capability boundary.

## 1.0.12

- `agent-skills --version` now reports the version the package actually shipped. The number was hand-maintained in `src/cli.ts` and had fallen behind the published one, so the first thing anyone checks when a build behaves unexpectedly was answering for a release that did not exist.
- The version in `package.json` is propagated from the companion plugin's manifest by the same mechanism that moves every other release surface, rather than being corrected by hand one commit later.
- This CHANGELOG is now a release surface in its own right: a bump that leaves it without an entry is refused rather than published, so a version you install always has notes describing it.

## 1.0.11

- Aligns every release surface after this commit's own hook-managed bump.

## 1.0.10

- Records the companion plugin's automated patch release after agent-skills' own self-migration.

## 1.0.9

- Aligns every release surface after this commit's own hook-managed bump.

## 1.0.8

- Records the companion plugin's automated patch release.

## 1.0.7

- Aligns the package release surface with the companion plugin's hook-managed version bump following agent-hooks' migration.

## 1.0.6

- Aligns the package release surface with the companion plugin's hook-managed version bump.

## 1.0.5

- Aligns every release surface after automated companion-plugin versioning.

## 1.0.4

- Records the companion plugin's automated patch release.

## 1.0.3

- Keeps package and companion-plugin release surfaces aligned after the adversarial-review fixes.

## 1.0.2

- Expands transactional, lint, helper, and path-safety coverage from the first evaluator pass.

## 1.0.1

- Makes multi-target replacement coordinated and rollback-safe, hardens target alias and discovery boundaries, completes portability lint and helper validation, and documents configurable platform directories.

## 1.0.0

- Introduces the deterministic agent skill compiler, portability linter, typed platform helpers, and CLI.
