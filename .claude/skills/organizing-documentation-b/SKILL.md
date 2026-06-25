---
name: organizing-documentation-b
description: Create, maintain, and organize a git repository as a documentation corpus by applying eight information-architecture principles (user intent; typed source-of-truth topics; hubs; multiple paths; controlled vocabulary and metadata; information scent; nonlinear seeking; validate-and-iterate) with grep, git, git-mesh, and wiki. Use when organizing a repo's docs/READMEs/wiki, improving doc findability, auditing doc structure, resolving doc duplication or drift, or setting up doc governance.
---

<instructions>

## 1. Scope

Treat a git repository as a documentation corpus and make it findable, typed, and self-maintaining. Readers are maintainers, contributors, reviewers, operators, newcomers — and agents arriving by grep or retrieval with no navigation context.

This skill is organized the way it teaches: typed topics separated by mode — `explanation/` (why), `how-to/` (doing), `reference/` (look up) — routed by what you are trying to do, with the eight principles as a concept facet rather than the file hierarchy. Start from an entry below and load one topic before acting on it; do not act from this hub alone.

**Process discipline**: before any edit, Read the file. Copy `old_string` from Read output, never from memory. Verify every count with a command. Break work into read-then-edit phases. Full rules: `how-to/procedure.md` §Process discipline.

## 2. Orient

- **Key distinctions** — layered source of truth, repo-native stable identifier, agents as first-class readers, the four design dimensions: `explanation/foundations.md`. Load before authoring.
- **The loop** — three jobs (create, update, organize), one loop: audit → translate → author → validate → govern: `how-to/procedure.md`.

## 3. Start from your job

The most common entry. Each job runs the same loop with a different starting move.

- **Creating a corpus**: Load `how-to/procedure.md`; set a naming convention, a root hub, and topic types before content grows.
- **Updating a corpus**: Load `how-to/audit-the-corpus.md` first, then load only the how-to each finding needs.
- **Organizing / maintaining**: Load `how-to/govern.md` for drift gates and review triggers; reorganize only on an observed failure.

## 4. Start from a trigger

A problem you noticed — the diagnostic index ("you may be looking for…").

| You notice | Load |
|---|---|
| A directory holds several docs and no overview | `how-to/build-hubs.md` — add a routing hub at the right threshold |
| Two pages say the same thing; a fact is duplicated | `how-to/type-a-topic.md` — resolve to one source-of-truth owner |
| A doc contradicts the code, or may have drifted | `how-to/validate.md` + `reference/tools/git-mesh.md` — anchor the claim, detect drift mechanically |
| A page nothing links to (orphan) | `how-to/add-paths.md` — link, redirect, or retire it |
| A reader or agent cannot find a page by grep | `how-to/support-nonlinear-seeking.md` + `how-to/set-vocabulary-and-metadata.md` — aliases, scope lines, retrieval |
| Names or paths are inconsistent | `how-to/set-vocabulary-and-metadata.md` — one naming convention |
| A link's destination is not predictable before the click | `how-to/strengthen-scent.md` — titles, labels, summaries, headings |
| You do not know which pages are stale | `how-to/audit-the-corpus.md` — baseline counts |
| A page mixes tutorial, how-to, and reference | `how-to/type-a-topic.md` — separate by Diátaxis mode |
| Docs are organized around teams, not reader needs | `how-to/design-around-intent.md` — re-map to intent and lifecycle views |

## 5. Browse by mode

- **`explanation/`** — why each practice matters: the four design dimensions (`explanation/foundations.md`) and the eight principles (`explanation/principles/index.md`).
- **`how-to/`** — the procedures, by loop stage and authoring task (`how-to/procedure.md` indexes them).
- **`reference/`** — catalogs and tool commands to look up (genres, topic types, metadata fields, validation signals, and `reference/tools/`).

## 6. Understand the why

The eight principles, as a concept facet you consult for rationale: `explanation/principles/index.md`. Each principle page links to the how-to that applies it.

## 7. Tools

- **Inventory** — `reference/tools/inventory-grep.md`: size, hubs, orphans, duplicates.
- **History** — `reference/tools/git-history.md`: decision history, co-change, staleness.
- **git-mesh** — `reference/tools/git-mesh.md`: record an unenforced coupling, detect drift.
- **wiki** — `reference/tools/wiki.md`: source-anchored pages with mechanical drift checks.

## 8. Validate the work

Before handoff: `wiki check` and `git mesh stale` exit clean; every inter-doc link resolves; each hub passes a first-click scent check. Load `how-to/validate.md` then `how-to/govern.md`.

</instructions>
