# How to type a source-of-truth topic

Scope: make a topic a typed, single-owner authority and author it in the right mode. How-to (author stage). Applies Principle 2.

## 1. Decide whether it deserves its own page

Give a subject a page when it can stand alone, has distinct retrieval value, and carries enough local context (reusable, frequently linked, disputed, operationally important, independently searchable, or needed for durable references). Otherwise keep it a section. Apply the layered source of truth first — a fact may belong in code, not a page (`../explanation/foundations.md` §1).

- Reusable concept in many places → extract one page, replace copies with links.
- Reference data buried in prose → a reference page or generated table.
- Troubleshooting mixed with normal operation → split.
- Decision history folded into instructions → move to commit/PR/ADR.
- Duplicated across pages → one owner, migrate, link the rest.
- Stable topic with volatile data → keep the page, generate or link the data.

## 2. Choose the mode, type, and genre

Separate by Diátaxis mode — no page is tutorial, how-to, and reference at once. Pick the topic type and page genre from the catalogs (`../reference/page-genres.md`, `../reference/topic-types.md`); do not collapse the four dimensions (`../explanation/foundations.md` §4).

## 3. Author by type

- **Concept**: title = the concept and its promise; why it exists before implementation; the learning outcome; scope; examples; link prerequisites, dependent tasks, and the formal reference — do not embed procedures.
- **Task**: title = the action; success/end-state first; role and permission; prerequisites and inputs before ordered, testable steps with verification; troubleshooting link at the failure point; warnings and rollback (or state none); branch only where behavior differs.
- **Reference**: precise, structured scope; mark completeness; label the source of truth; schemas/fields/states/limits/error-codes as structured data; mark examples normative vs illustrative; version and status per value; generate from code where possible with provenance and review; state out-of-scope and adjacent links.
- **Troubleshooting / runbook**: title from the symptom; diagnostics before fixes; causes by probability/severity/cost; cheap checks first; mark safe vs risky actions; escalation thresholds; evidence to collect; rollback and post-fix verification; false-positive and lookalike notes; a runbook optimizes for time pressure, safety, and handoff.

## 4. Resolve to one source of truth

Pick the owning layer (`../explanation/foundations.md` §1) and route links to it; merge, archive, or reconcile competitors; mark source-of-truth status via metadata, not the title; rename to the preferred term; add a review date if useful; give an externally-cited page a stable identifier; resolve contradictions toward the more-enforced layer (code over prose). A page that presents stale facts as current is a drift failure — rewrite or redirect it; a page that records a past plan, spike, or decision is correct as history — mark it historical (status + date + scope + replacement link) and leave the content intact (`../reference/page-genres.md`).

Related: why typing matters `../explanation/principles/02-typed-source-of-truth-topics.md`; the catalogs `../reference/page-genres.md`, `../reference/topic-types.md`; record an unenforced coupling `../reference/tools/git-mesh.md`; find duplicates `../reference/tools/inventory-grep.md`.
