# Procedure

Scope: the audit → translate → author → validate → govern loop, ordered and tool-aware. The spine of any organizing job; run one real pass on the target repo. Each step routes to the principle or tool that owns its detail. Tool overview at `reference/tools/index.md`; concept overview at `reference/concepts/index.md`.

## Process discipline (read before starting the loop)

Every edit in this skill must succeed on the first attempt. Protocol violations and stale-state errors waste tool calls and break the audit trail.

- **Read before edit.** Before editing any file, you MUST have Read it in the current conversation. Identify all files that need changes → Read every one → then issue all Edits. Do NOT interleave reads and edits in a way that causes you to edit a file you have not yet read.
- **Copy edit strings from Read output.** When constructing an Edit call, copy the `old_string` directly from the most recent Read output for that file. Do not reconstruct it from memory. If the Read output is more than two turns old, re-Read the relevant section before constructing the edit.
- **Verify counts with a command, never estimate.** After adding entries to an index or hub, run a count command (`grep -c`, `wc -l`) and use the exact result. Do not hand-count or estimate.
- **Verify index entries against source files.** When building an alphabetical index or link list, each entry's link text MUST match the exact H1 title of the referenced file. Read the first heading of each target file (`head -1` or equivalent). Do not abbreviate, shorten, or rephrase.
- **Break work into read-phase then edit-phase.** For any scope beyond ~3 files: (1) identify the file list, (2) Read every file, (3) then Edit each. This prevents the typical failure pattern of reading file A, editing A, then attempting to edit file B without having read it.

## Breadth vs. depth

Prefer breadth when the per-file change is formulaic (adding a scope line, a cross-reference, a metadata field). A consistent scope-statement pass across 13 files with identical quality is better than a deep pass on 4 files that leaves obvious gaps elsewhere. Go deep where the file's content demands it (long manuals, thin stubs, mixed-mode pages). Balance both: after a systematic pass, do a second pass to check for gaps the first pass could not catch (orphans, missing TOCs, dead ends).

## 1. Set scope and job

Identify the repository root and which job this is. Treat any repository as editable.

- **Creating**: set one naming convention and a root hub first, then continue this loop.
- **Updating**: run the audit, then change only what a failure signal (Step 9) justifies.
- **Maintaining**: run drift detection and governance (Steps 9–10) on a cadence.

## 2. Audit — inventory and baseline

Establish the corpus's real state with counts before recommending anything. Commands are in `reference/tools/inventory-grep.md`; the full audit checklist is `reference/principles/08-validate-and-iterate/baseline-audit.md`. Record: corpus size, existing hubs, orphans, duplicates, stale pages and meshes, owning code areas (provenance), current drift. Flag thin READMEs (≤3 lines), long documents (>500 lines) lacking a TOC, and directories with 3+ .md files and no README. This audit is the evidence base for every later change.

## 3. Translate — read for intent and decision history

Learn who reads, why, and what is load-bearing. Segment readers and intents with `reference/principles/01-organize-around-user-intent/index.md`. Use `reference/tools/git-history.md` for who-works-where, staleness, and co-change. Distrust a coupling whose two sides share one author or that a type or test already enforces.

## 4. Translate — route each topic to its layer and mode

Route every fact to its layer (`reference/foundations.md`) and pick its mode and genre (`reference/principles/02-typed-source-of-truth-topics/modes-and-genres.md`). Split any page that mixes modes; resolve competing pages to one source of truth (`reference/principles/02-typed-source-of-truth-topics/canonicality.md`).

## 5. Author — establish or repair the navigation layer

Add or fix hubs and wire the alternate projections; resolve orphans. Hubs: `reference/principles/03-hubs-orientation-and-routing/index.md`. Projections, cross-links, orphans: `reference/principles/04-multiple-paths/index.md`. Reorganize existing structure only where Step 2 surfaced a real failure — never for tidiness.

When building hubs or indexes:
- Combine a comprehensive README navigation section with contextual blurbs on every cross-reference index file. Do one without the other and the navigation surface is incomplete.
- Entries in an alphabetical index MUST be in strict alphabetical order by link text within each letter section. Reorder existing entries as needed — do not preserve pre-existing disorder.
- Each index entry MUST match the exact H1 title of the referenced file. Verify with `head -1`.
- After adding entries, update the header count using exact command output, never an estimate.
- For top-level meta-documents with terse titles, add a descriptive subtitle after a double dash.

## 6. Author — durable docs with the tools

For cross-file synthesis, run the wiki authoring loop and cover line-ranged links with meshes (`reference/tools/wiki.md`). For a load-bearing coupling that needs no page, mint a mesh from mined candidates (`reference/tools/git-mesh.md`). Anchor every load-bearing claim so drift is mechanically detectable.

## 7. Author — vocabulary and metadata

Normalize names to one convention; add aliases for old and informal terms; reuse existing metadata before inventing fields. See `reference/principles/05-controlled-vocabulary-and-metadata/index.md`.

## 8. Author — scent pass

Make every directory name, file name, README first line, heading, and commit subject predict its target. See `reference/principles/06-information-scent/index.md`.

## 9. Validate

`wiki check` and `git mesh stale` exit clean; every inter-doc link resolves; spot-check first-click scent on each hub (can a reader predict the destination before clicking?). Audit cross-layer completeness: related resources across layers link to each other (a doc page and its example, a source-directory README and that module's docs, the root README and the orientation file), and every index that enumerates files matches the filesystem with no missing or dangling entries (`reference/principles/04-multiple-paths/cross-linking.md`, `reference/principles/08-validate-and-iterate/baseline-audit.md`). Verify every reported count with an exact command; if the command disagrees, fix the reported number. Methods: `reference/principles/08-validate-and-iterate/index.md`. These checks read the working tree — run them without committing. Fix what fails before handoff.

## 10. Govern and hand off

Surface the review triggers (release, code-ownership change, drift signal, stale date) for the maintainer; gate drift detection in a git hook or CI (keep the gate side-effect-free); record what changing the IA would need. See `reference/principles/08-validate-and-iterate/governance.md`. **Commits and pushes belong to the repo owner**: this skill changes the working tree, and validation (Step 9) needs no commit. Commit only if you have authority and no active constraint (a git freeze, restricted permissions, or "leave git to me") forbids it; otherwise hand off a record of what changed and what remains to commit rather than blocking the doc work. If a tool errors unexpectedly, stop and report it.

## Combined checklist (all jobs)

Every organizing pass must consider every item below, regardless of which job triggered the work. Skip only when the repo has no applicable surface.

| Check | Owned by |
|---|---|
| Add a scope / "where you are" line to every touched doc page, any format | `reference/principles/06-information-scent/summaries-and-previews.md` |
| Add table of contents to documents over 500 lines | `reference/principles/03-hubs-orientation-and-routing/index.md` |
| Add cross-references between related documents, and link related resources across layers bidirectionally (doc↔example, source README↔docs, README↔orientation file) | `reference/principles/04-multiple-paths/cross-linking.md` |
| Detect and link orphaned files (skip ISSUE_TEMPLATE dirs); populate or remove empty/placeholder files | `reference/principles/04-multiple-paths/orphans-and-dead-ends.md` |
| Reconcile every file-enumerating index against the filesystem (no missing or dangling entries) | `reference/principles/08-validate-and-iterate/baseline-audit.md` |
| Surface policy files (CoC, security, governance) on the landing page | `reference/principles/03-hubs-orientation-and-routing/link-selection.md` |
| Expand thin READMEs (≤3 lines or one-liner stubs) to heading + scope + how-to + file table + cross-refs | `reference/principles/03-hubs-orientation-and-routing/index.md` |
| Create directory READMEs for dirs with 3+ .md files; give a many-file directory a complete file-index table | `reference/principles/03-hubs-orientation-and-routing/hub-content.md` |
| Add contextual blurbs to every cross-reference / secondary index file | `reference/principles/03-hubs-orientation-and-routing/index.md` |
| Generate an agent orientation file (name per repo convention) with repo-type framing, annotated directory tree, doc philosophy, working norms, intent- and task-routing tables, and load-bearing conventions | `reference/jobs/creating.md` |
| Enforce alphabetical ordering in alphabetical indexes | `reference/principles/03-hubs-orientation-and-routing/index.md` |
| Add descriptive subtitles to meta-documents with terse titles | `reference/principles/06-information-scent/index.md` |
