# Principle 3 — Make hubs orientation and routing layers

Scope: build hubs that tell a reader where they are, which path to choose, and why — before the click — without duplicating the facts that other layers own.

## In the repo

The root README is the product hub; `AGENTS.md`/`CLAUDE.md` are agent hubs; a README at each major module boundary is a local hub. A wiki hub page serves a cross-cutting domain (`reference/tools/wiki.md`). A hub routes and orients; it does not restate code facts. Inventory existing hubs with `git ls-files '**/README.md' '**/AGENTS.md' 'CLAUDE.md' '**/CLAUDE.md'` (`reference/tools/inventory-grep.md`).

## Combined navigation surface

Two improvements are required for any repo with cross-reference indexes:

1. **Root README**: open with a one-sentence scope statement, then a dedicated navigation section routing to every major surface and content area with a one-line description and a count where relevant (alphabetical index, cross-reference indexes, content directories, preface, help guide, contributing guide). For a multi-area repo the root README is a dispatcher, not a summary: scope answers "what is this", the navigation section answers "where do I find X".
2. **Every cross-reference / secondary index file**: Add a brief introductory blurb explaining what the index maps and linking back to the root README or alphabetical index. Use a consistent pattern across all files. A reader who lands on a cross-reference index from a search engine gets context and escape hatches.
3. **Alphabetical index (if present)**: Add an inter-index cross-reference line below the header linking to all other indexes.

Do one without the other and the navigation surface is incomplete.

## Long document rule

Every document over 500 lines needs BOTH a scope statement at the top AND a table of contents. Shorter documents need a scope statement. Never add only one of scope or TOC to a long document — both are required.

## Thin README rule

A README too thin to orient a direct arrival — 3 lines or fewer, or any directory README that states only a name or one-sentence purpose with no file listing, navigation, or cross-references — must expand to at minimum: a heading with a purpose clause, a scope statement, a "How it works" or "Quick start" section, a file table when the directory holds many files (`hub-content.md`), and cross-references to related documents. Do not leave a stub.

## Alphabetical index rules

When maintaining an alphabetical index:
- Entries within each letter section MUST be in strict alphabetical order by link text. When inserting a new entry, reorder existing entries as needed — do not preserve pre-existing disorder.
- Each entry's link text MUST match the exact H1 title of the referenced file. Verify by reading `head -1` of each target. Do not abbreviate, shorten, or rephrase.
- After all entries are added, run a count command and update the header count to match exactly — never estimate.

## Descriptive subtitles

For top-level meta-documents (Preface, HelpGuide, CONTRIBUTING, GOVERNANCE), if the title is a single short phrase, add a descriptive subtitle after a double dash. This strengthens information scent for readers scanning a file listing.

## Route within this principle

- **You must decide where a hub is warranted**: read `hub-necessity.md` — the three-or-more-docs threshold and the don't-build-an-empty-hub rule.
- **A hub needs a clear scope and organizing frame**: read `hub-scope.md` — scope, audience, organizing frame, and exclusions.
- **A hub must tell readers where to start and what to skip**: read `orientation.md` — where-am-I, what-to-read-first, and what-to-skip cues.
- **You must choose and group the hub's links**: read `link-selection.md` — which links belong, how to group them, and risk cues before the click.
- **You must decide what a hub holds beyond links**: read `hub-content.md` — what a hub holds beyond links: overview, map, status, onboarding/incident paths.
- **A hub is restating facts and will go stale**: read `anti-duplication.md` — keep hubs about routing, not facts, so they do not go stale.
