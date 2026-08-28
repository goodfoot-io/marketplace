# agent-skills plugin changelog

## 1.0.18

Documents the operational lessons from migrating the companion skills: generated targets are replaced whole and must not contain maintained or ignored local state; opaque assets fan out to every selected platform; declared targets must render trackable content; and platform support is proven by a real host skill load rather than installation or file presence alone.

## 1.0.17

Aligns the Antigravity authoring policy with the verified native subagent dialect. It now documents dispatch through `invoke_subagent`, state inspection through `manage_subagents`, and communication through `send_message`, while retaining the explicit boundary for unsupported direct worktree operations.

## 1.0.16

Publishes all applicable authored skills through a complete, positively validated Antigravity plugin root and updates the Antigravity policy to distinguish supported skill packaging from unavailable hooks and MCP capabilities.

## 1.0.15

Verifies Antigravity's plugin root, skill and agent directories, frontmatter, conventions file, and prose skill invocation against official documentation and positive `agy` processing. Adds native Antigravity subagent instructions using `invoke_subagent`, `send_message`, and `manage_subagents` while retaining explicit unavailable or provisional classifications where the host does not document an equivalent.

## 1.0.14

Relocates the Claude Code plugin to `plugins-claude/agent-skills` and updates its registry, marketplace, and helper-reference synchronization paths. The generated Codex and OpenCode trees remain at their existing roots with unchanged behavior.

## 1.0.13

Adds portable block and inline embedded-Bash helpers backed by an explicit platform capability fact. Claude Code renders native execution syntax, while platforms without verified support receive deterministic instructions, and the generated helper reference now publishes the capability boundary.

## 1.0.12

Brings the plugin's release surfaces under one gate. The Codex manifest, the OpenCode package, the npm package, and the CLI's own `--version` string were each maintained separately, so installing 1.0.11 could mean four different things depending on which file you read; they now move together or not at all, and CI fails when they disagree.

Adds release notes to that set. Every other surface holds a version and can be stamped, but an entry here has to say what changed, so a bump without one is refused rather than filled in with an empty heading — which is why this entry exists at all.

## 1.0.11

Synchronizes the companion release with this commit's own hook-managed marketplace bump.

## 1.0.10

Migrates this plugin's own documentation onto the `@goodfoot/agent-skills` bundler it ships, completing card main-8-1: `platform-behavior`, `cli-and-helpers`, `reference/helper-reference.md`, `template-authoring`, and `antigravity` are now generated from `skills-src/agent-skills/` rather than hand-maintained, and render identically across the Claude Code, Codex, and OpenCode trees.

## 1.0.9

Synchronizes the companion release with this commit's own hook-managed marketplace bump.

## 1.0.8

Records the automated companion-plugin patch release.

## 1.0.7

Synchronizes the documentation plugin with the package release after agent-hooks' migration bumped the hook-managed marketplace version.

## 1.0.6

Documents this card's migration lessons — dialect vs. substance, the `it.variant()` antigravity-branch and `it.pluginRootVar` OpenCode guards, and the `skill-relative-path` false positive — captured in `platform-behavior` and `cli-and-helpers`.

## 1.0.5

Synchronizes the documentation plugin with the package release after automated marketplace versioning.

## 1.0.4

Records the automated companion-plugin patch release.

## 1.0.3

Synchronizes the companion release with the corrected compiler contracts and complete generated helper catalog.

## 1.0.2

Carries the evaluator-driven documentation and release-alignment updates.

## 1.0.1

Synchronizes the companion plugin's shared helper reference from the executable `@goodfoot/agent-skills` platform model and documents the namespaced `skills-src/goodfoot` authoring root used by the repository generator. Antigravity guidance continues to preserve the model's explicit provisional and unavailable classifications without borrowing another platform's conventions.

## 1.0.0

Initial documentation plugin for `@goodfoot/agent-skills`. Provides focused guidance for authoring Eta skill templates, using the build and lint CLI, applying portable helpers, understanding per-platform output, and preserving the explicit fail-closed boundary around Antigravity conventions.
