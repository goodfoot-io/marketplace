---
name: organizing-documentation-a
description: Create, maintain, and organize a git repository as a documentation corpus. Applies an eight-principle information-architecture framework — user intent, typed source-of-truth topics, hubs, multiple paths, controlled vocabulary and metadata, information scent, nonlinear seeking, validation — with grep, git, git-mesh, and wiki. Use when structuring or auditing READMEs, AGENTS.md/CLAUDE.md, docs, or wiki pages; fixing orphans, duplication, weak findability, or doc/code drift; or making a repo navigable by both humans and agents.
---

<instructions>

This file is the hub: it orients and routes around what you are trying to do. Each concept is owned by exactly one file below — load that file when its condition fires. Inter-file paths are relative to this skill's root. Do not work from this page alone.

## 1. Scope

Organize a git repository as a documentation corpus — create it, update it, and maintain its findability — by applying eight information-architecture principles with `grep`, `git`, `git mesh`, and `wiki`. Treat any repository as editable. Readers are humans and agents; agents arrive by grep and retrieval with no navigation context, so every file must orient on arrival. The corpus has no single source-of-truth page: each fact lives with the layer that owns it.

Enter the skill the way a reader enters a corpus — by intent. Start from your **job** (§2) or your **symptom** (§3); reach for the **conceptual model** (§4), the **principles** (§5), the **workflow** (§6), and the **tools** (§7) as those paths need them.

## 2. Start from your job

The primary path — organize around what you are doing (Principle 1).

- **Standing up documentation from little**: read `reference/jobs/creating.md` — establish conventions and a root hub first, with creation-phase emphasis.
- **A change landed and docs must catch up**: read `reference/jobs/updating.md` — audit first; change only what a failure signal justifies.
- **Maintaining an existing corpus over time**: read `reference/jobs/organizing.md` — drift detection and governance on a cadence.
- **Not sure which**: read `reference/jobs/index.md` — the three-jobs / one-loop overview.

## 3. Start from a symptom

- **You have an observed problem** (orphan, duplication, drift, mixed-mode page, weak scent, missing hub): read `reference/diagnostics.md` — a symptom→fix index routing to the owning topic.

## 4. The conceptual model

What the framework is made of — load when you must type a page, name a thing, or settle a distinction.

- **Typing a page along the four dimensions** (mode / topic type / genre / metadata, kept distinct): read `reference/concepts/design-dimensions.md`.
- **Looking up a preferred term**: read `reference/concepts/glossary.md` — the framework's preferred terms, with definitions and owners.
- **Settling a foundational distinction** (layered source of truth, durable identifier vs. canonical URL, agents as readers): read `reference/foundations.md`.

## 5. The eight principles

The lens — why each move matters. Reach for a principle to go deep on one concern; the jobs and diagnostics route here for you.

- **Organize around user intent**: `reference/principles/01-organize-around-user-intent/index.md` — segment readers; route by intent, task, situation, and priority.
- **Typed, source-of-truth topics**: `reference/principles/02-typed-source-of-truth-topics/index.md` — one typed owner per topic; separate modes; resolve duplicates to one source of truth.
- **Hubs as orientation and routing**: `reference/principles/03-hubs-orientation-and-routing/index.md` — hubs that orient and route without duplicating owned facts.
- **Multiple paths to a topic**: `reference/principles/04-multiple-paths/index.md` — facets, projections, cross-links, and entry points beyond the directory tree.
- **Controlled vocabulary and metadata**: `reference/principles/05-controlled-vocabulary-and-metadata/index.md` — one naming convention; reuse existing metadata; expose only navigation-critical fields.
- **Information scent at every click**: `reference/principles/06-information-scent/index.md` — names, first lines, headings, and commit subjects that predict their target.
- **Nonlinear information seeking**: `reference/principles/07-nonlinear-information-seeking/index.md` — self-orienting files for grep, berrypicking, recovery, and retrieval.
- **Validate and iterate**: `reference/principles/08-validate-and-iterate/index.md` — baseline audit, repo-native validation proxies, drift gates, and governance.

## 6. The workflow

- **Running a full pass end to end**: read `reference/procedure.md` — the audit → translate → author → validate → govern loop that every job specializes. **Load this first** — it contains process discipline rules (read-before-edit, copy-from-Read-output, verify-counts-with-commands, read-phase-then-edit-phase) that apply to every edit in this skill, plus the combined checklist of what every organizing pass must consider.

## 7. Tools

- **Inventory and baseline counts**: read `reference/tools/inventory-grep.md` — `grep`, `Glob`, `git ls-files`.
- **Intent, staleness, and co-change coupling**: read `reference/tools/git-history.md` — `git log`/`blame`/`--follow`/`-L`.
- **Load-bearing unenforced couplings and their drift**: read `reference/tools/git-mesh.md` — `git mesh add`/`why`/`stale`/`tree`.
- **Source-anchored synthesis pages and drift checks**: read `reference/tools/wiki.md` — the wiki authoring loop and `wiki check`.

## 8. Validate the work

Before handoff: `wiki check` and `git mesh stale` exit clean, every inter-doc link resolves, and each hub passes a first-click scent check. See `reference/principles/08-validate-and-iterate/index.md`.

</instructions>
