# agent-skills plugin changelog

## 1.0.25

Strengthens the four-client smoke-test guidance so every generated skill is loaded through each host's own discovery path and results are labelled behavioral, structural, or blocked. Corrects the Antigravity authenticated invocation and clarifies that generated documents are idiomatic equivalents rather than byte-identical outputs.

## 1.0.24

Maintenance release. Repairs the repository's version-bump hook, which exempted a plugin's whole version-surface file rather than just its version: a real edit to a manifest or to a version-bearing source file took no bump and no release notes. No changes to the skills.

## 1.0.23

Corrects the Antigravity reference. `agy plugin install` is verified, from a local path or a git URL with the in-repo path appended, so the skill no longer tells Claude that an install command must not be invented or that `agy plugin validate` is the packaging boundary. Behavioral invocation stays unavailable, since `agy -p` requires an authenticated session. Names the per-host skill-loading check in the porting reference, and records that `opencode debug skill` output truncates under `head` and reports a present skill as missing.

Adds a distribution-and-verification section to the porting reference. One passing route per platform is not coverage, because each host ships through several independently failing routes; results are labelled behavioral, structural, or blocked, and a weaker result may not borrow the word "pass" from a stronger one. When an installer rejects a package, read its detection logic from source rather than the error text, and prove the fix by A/B against the unpatched copy at the same version. Records OpenCode's dual-purpose manifest: `package.json` is both the publishing manifest and a version surface, so it is hand-maintained, and the installer detects targets from it alone — a package exposing only `exports["."]` is rejected with `No plugin targets found` despite correct code.

Qualifies the never-hand-edit-a-generated-tree rule in the authoring reference: it is a default, not a universal, and provenance decides — a plugin root can hold a hand-maintained manifest beside a generated skill leaf.

## 1.0.22

Documents how to install the plugin for development on all four supported hosts. Claude Code and Codex install from the `goodfoot-io/marketplace` marketplace directly; Antigravity and OpenCode install from a checkout, because neither exposes a remote marketplace for skills.

## 1.0.21

Consolidates the cli-and-helpers, platform-behavior, template-authoring, and antigravity skills into a single `agent-skills` skill: one hub SKILL.md routes to `reference/*.md` files, and the formerly shared helper-reference table now lives at `reference/helper-reference.md` inside the skill. Documentation content is otherwise unchanged.

## 1.0.20

Confirms the automated release pipeline end to end following the package's first npm publish: OIDC trusted publishing, the registry-driven plugin reference update, and the repaired CI install smokes. No functional changes.

## 1.0.19

Maintenance release. Republishes the 1.0.18 content unchanged after the post-migration verification pass: the four-platform smoke test (Claude Code, Codex, OpenCode, Antigravity) and the reconciliation of the repository's release checks confirmed the shipped compiler, skills, and generated trees; no functional changes.

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
