# Job: updating after a change

Scope: a change landed; bring the docs back into truth with minimal, evidence-driven edits. Runs `reference/procedure.md` with update emphasis (Principles 2, 8).

## Process discipline for updating

Every edit must succeed on the first attempt. Protocol violations and stale-state errors waste tool calls.

- **Read before edit.** Before editing any file, you MUST have Read it in the current conversation. Plan: identify all files → Read every one → then Edit. Never edit a file you have not yet read.
- **Copy from Read output.** Construct `old_string` by copying directly from the most recent Read output. Do not reconstruct from memory. If the Read is more than two turns old, re-Read the section first.
- **Verify counts with a command.** After adding entries to an index or hub, run `grep -c` or `wc -l` and use the exact result. Never estimate.
- **Match index entries to source H1s.** Each entry in an alphabetical index MUST use the exact H1 title from the referenced file. Read `head -1` of each target. Do not abbreviate, shorten, or rephrase.
- **Break work into read-phase then edit-phase.** For any scope beyond ~3 files: (1) identify the file list, (2) Read every file, (3) then Edit each. This prevents the typical failure pattern of reading file A, editing A, then attempting to edit file B without having read it.

## First moves

- **Audit before editing** — `reference/principles/08-validate-and-iterate/baseline-audit.md`; never restructure for tidiness.
- **Detect the drift the change caused** — `git mesh stale` and `wiki check` (`reference/tools/git-mesh.md`, `reference/tools/wiki.md`).
- **Re-route facts if behavior moved** — `reference/foundations.md` layered source of truth.
- **Resolve any new duplication to one source of truth** — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.
- **Change only what a failure signal justifies**, then re-validate.

## Index and navigation updates

When updating an alphabetical index or navigation hub:

- **Strict alphabetical order.** Within each letter section, entries MUST be in strict alphabetical order by link text. When inserting a new entry, reorder existing entries as needed — do not preserve pre-existing disorder.
- **Exact H1 match.** Each entry's link text must match the target file's H1 character-for-character, including punctuation, hyphenation, and parenthetical expansions.
- **Verified count.** After all entries are added, run a count command and update the header count to match exactly. If the command disagrees with the header, fix the header.
- **Combined navigation surface.** Add both a comprehensive navigation section in the root README AND contextual blurbs with backlinks on every cross-reference index file. Do one without the other and the navigation surface is incomplete.
- **Inter-index cross-references.** In the alphabetical index, add a line below the header linking to all other indexes. On every cross-reference index, add an introductory blurb explaining what the index maps and linking back to the alphabetical index. Use a consistent pattern across all files.
- **Directory-level READMEs.** For every directory with 3+ .md files that lacks a README, create one covering what the directory contains, how to find things, naming conventions, and links to related resources.

Run the loop from the audit step: `reference/procedure.md`.
