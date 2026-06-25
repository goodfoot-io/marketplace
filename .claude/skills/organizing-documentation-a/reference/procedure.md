# Procedure

Scope: the audit → translate → author → validate → govern loop, ordered and tool-aware. The spine of any organizing job; run one real pass on the target repo. Each step routes to the principle or tool that owns its detail.

## 1. Set scope and job

Identify the repository root and which job this is. Treat any repository as editable.

- **Creating**: set one naming convention and a root hub first, then continue this loop.
- **Updating**: run the audit, then change only what a failure signal (Step 9) justifies.
- **Maintaining**: run drift detection and governance (Steps 9–10) on a cadence.

## 2. Audit — inventory and baseline

Establish the corpus's real state with counts before recommending anything. Commands are in `reference/tools/inventory-grep.md`; the full audit checklist is `reference/principles/08-validate-and-iterate/baseline-audit.md`. Record: corpus size, existing hubs, orphans, duplicates, stale pages and meshes, owning code areas (provenance), current drift. This audit is the evidence base for every later change.

## 3. Translate — read for intent and decision history

Learn who reads, why, and what is load-bearing. Segment readers and intents with `reference/principles/01-organize-around-user-intent/index.md`. Use `reference/tools/git-history.md` for who-works-where, staleness, and co-change. Distrust a coupling whose two sides share one author or that a type or test already enforces.

## 4. Translate — route each topic to its layer and mode

Route every fact to its layer (`reference/foundations.md`) and pick its mode and genre (`reference/principles/02-typed-source-of-truth-topics/modes-and-genres.md`). Split any page that mixes modes; resolve competing pages to one source of truth (`reference/principles/02-typed-source-of-truth-topics/canonicality.md`).

## 5. Author — establish or repair the navigation layer

Add or fix hubs and wire the alternate projections; resolve orphans. Hubs: `reference/principles/03-hubs-orientation-and-routing/index.md`. Projections, cross-links, orphans: `reference/principles/04-multiple-paths/index.md`. Reorganize existing structure only where Step 2 surfaced a real failure — never for tidiness.

## 6. Author — durable docs with the tools

For cross-file synthesis, run the wiki authoring loop and cover line-ranged links with meshes (`reference/tools/wiki.md`). For a load-bearing coupling that needs no page, mint a mesh from mined candidates (`reference/tools/git-mesh.md`). Anchor every load-bearing claim so drift is mechanically detectable.

## 7. Author — vocabulary and metadata

Normalize names to one convention; add aliases for old and informal terms; reuse existing metadata before inventing fields. See `reference/principles/05-controlled-vocabulary-and-metadata/index.md`.

## 8. Author — scent pass

Make every directory name, file name, README first line, heading, and commit subject predict its target. See `reference/principles/06-information-scent/index.md`.

## 9. Validate

`wiki check` and `git mesh stale` exit clean; every inter-doc link resolves; spot-check first-click scent on each hub (can a reader predict the destination before clicking?). Methods: `reference/principles/08-validate-and-iterate/index.md`. These checks read the working tree — run them without committing. Fix what fails before handoff.

## 10. Govern and hand off

Surface the review triggers (release, code-ownership change, drift signal, stale date) for the maintainer; gate drift detection in a git hook or CI (keep the gate side-effect-free); record what changing the IA would need. See `reference/principles/08-validate-and-iterate/governance.md`. **Commits and pushes belong to the repo owner**: this skill changes the working tree, and validation (Step 9) needs no commit. Commit only if you have authority and no active constraint (a git freeze, restricted permissions, or "leave git to me") forbids it; otherwise hand off a record of what changed and what remains to commit rather than blocking the doc work. If a tool errors unexpectedly, stop and report it.
