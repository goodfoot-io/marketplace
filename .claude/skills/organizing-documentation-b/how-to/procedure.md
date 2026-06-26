# Procedure: the loop

Scope: the one loop every job runs — audit → translate → author → validate → govern — tool-aware. How-to hub; load when starting or resuming organizing work.

## Process discipline (read before starting the loop)

Every edit in this skill must succeed on the first attempt. Protocol violations and stale-state errors waste tool calls and break the audit trail.

- **Read before edit.** Before editing any file, you MUST have Read it in the current conversation. Identify all files that need changes → Read every one → then issue all Edits. Do NOT interleave reads and edits in a way that causes you to edit a file you have not yet read.
- **Copy edit strings from Read output.** When constructing an Edit call, copy the `old_string` directly from the most recent Read output for that file. Do not reconstruct it from memory. If the Read output is more than two turns old, re-Read the relevant section before constructing the edit.
- **Verify counts with a command, never estimate.** After adding entries to an index or hub, run a count command (`grep -c`, `wc -l`) and use the exact result. Do not hand-count or estimate.
- **Verify index entries against source files.** When building an alphabetical index or link list, each entry's link text MUST match the exact H1 title of the referenced file. Read the first heading of each target file (`head -1` or equivalent). Do not abbreviate, shorten, or rephrase.
- **Break work into read-phase then edit-phase.** For any scope beyond ~3 files: (1) identify the file list, (2) Read every file, (3) then Edit each. This prevents the typical failure pattern of reading file A, editing A, then attempting to edit file B without having read it.

## Breadth vs. depth

Prefer breadth when the per-file change is formulaic (adding a scope line, a cross-reference, a metadata field). A consistent scope-statement pass across 13 files with identical quality is better than a deep pass on 4 files that leaves obvious gaps elsewhere. Go deep where the file's content demands it (long manuals, thin stubs, mixed-mode pages). Balance both: after a systematic pass, do a second pass to check for gaps the first pass could not catch (orphans, missing TOCs, dead ends).

## Entry by job

- **Creating**: run Step 1 once to set conventions and a root hub, then loop.
- **Updating**: start at Step 1 (audit); act only where a signal appears.
- **Organizing (maintenance)**: run Steps 1, 4, 5 on a cadence (release, dependency change).

## The stages

1. **Audit** — establish the corpus's real state and counts: `audit-the-corpus.md`. Use exact command output for every count. Flag thin READMEs (≤3 lines) and long documents (>500 lines) that lack structural elements, empty/stub files, and indexes out of sync with the filesystem.
2. **Translate** — read for reader intent and decision history, then map work to it: `design-around-intent.md` (history via `../reference/tools/git-history.md`).
3. **Author** — build and repair the structure with the right technique:
   - Type and own each topic: `type-a-topic.md`.
   - Add and repair hubs: `build-hubs.md`.
   - Wire alternate paths: `add-paths.md`.
   - Set names and metadata: `set-vocabulary-and-metadata.md`.
   - Strengthen scent: `strengthen-scent.md`.
   - Support nonlinear seeking: `support-nonlinear-seeking.md`.
4. **Validate** — check against observed behavior, read-only on the working tree (no commit): `validate.md`. Verify every count and link.
5. **Govern** — triggers, drift gates, handoff; reorganize only on failure; committing is the owner's call: `govern.md`.

## Combined checklist (all jobs)

Every organizing pass must consider every item below, regardless of which job triggered the work. Skip only when the repo has no applicable surface.

| Check | Owned by |
|---|---|
| Add scope statements to every README | `build-hubs.md` |
| Add table of contents to documents over 500 lines | `build-hubs.md` |
| Add cross-references between related documents | `add-paths.md` |
| Detect and link orphaned files (skip ISSUE_TEMPLATE dirs); populate or remove empty/stub files | `audit-the-corpus.md` → `add-paths.md` |
| Audit cross-layer links — doc↔example, source-README↔docs, README↔orientation file, hub↔leaves — all bidirectional | `add-paths.md` |
| Reconcile every enumerating index against the filesystem (add missing, drop dangling) | `audit-the-corpus.md` → `validate.md` |
| Surface policy files (CoC, security, governance) on the landing page | `build-hubs.md` |
| Expand thin READMEs (≤3 lines) to heading + scope + file table + how-to + cross-refs | `build-hubs.md` |
| Create directory READMEs for dirs with 3+ .md files; give a directory of many similar files a complete file-listing table from `git ls-files` | `build-hubs.md` |
| Add contextual blurbs to every cross-reference / secondary index file | `build-hubs.md` |
| Generate an agent orientation file (AGENTS.md/CLAUDE.md, repo's convention): repo-type framing, annotated tree with size cues, layered source-of-truth model, working norms, intent+task routing, load-bearing conventions, relationship to directory READMEs | `build-hubs.md` |
| Enforce alphabetical ordering in alphabetical indexes | `build-hubs.md` |
| Add descriptive subtitles to meta-documents with terse titles | `strengthen-scent.md` |

Related: why the loop and its distinctions `../explanation/foundations.md`, `../explanation/principles/08-validate-and-iterate.md`; the trigger and job index `../SKILL.md`.
