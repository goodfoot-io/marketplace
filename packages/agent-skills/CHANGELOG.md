# @goodfoot/agent-skills npm package changelog

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
