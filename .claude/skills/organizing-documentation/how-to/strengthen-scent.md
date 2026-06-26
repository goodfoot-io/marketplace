# How to strengthen information scent

Scope: make every label predict its destination. How-to (author stage). Applies Principle 6.

## 1. Fix titles

Rename until the promise is obvious; use the preferred term; add a topic-type cue; include common search language; drop shorthand and ambiguous nouns; use verb-object for tasks; make the title self-describing in a result and as link text; add version/environment/status qualifiers where mis-selection matters. File names are titles — rename vague files, since readers grep names. Commit subjects are titles for history — write the standing property, not the diff (`git log --oneline` to judge).

## 2. Fix link labels

Name the destination's value; add object/action/scope; phrase around the reader's goal; replace "click here / more / details"; add qualifiers for near-neighbors; align the label with the destination title; let the surrounding sentence say why to click; group under meaningful headings; emphasize high-value links and prune low-value ones; disclose risk/permission/applicability. Every inter-doc link states when and why to follow it.

## 3. Add summaries and previews

Open a touched page — Markdown or reStructuredText, README or reference — with a one-sentence scope-and-value summary stating what it covers and who it is for; for a directory, also where you are in the repo. Use ownership language for a source module ("this module owns X") and containment for a collection or example ("this directory contains X"). **Apply the value test first**: a scope line or "where you are" line earns its place only when it tells a cold arrival something the title and first paragraph do not. If landing here from a search hit or a direct link, would this line add anything the title alone does not? If no, skip it — restating the title ("Release History" → "this file records the release history") is noise, not scent. Add one where the page is long enough to be entered mid-scroll, the title is cute or ambiguous, or the page spans several discrete topics worth enumerating; do not stamp the same line onto every file by reflex. Put a hub's scope in its first paragraph; write an informative `summary` frontmatter (used by `wiki check` and retrieval); frame matrix cells and link groups; say who-for, when, and what is not covered; distinguish current from legacy; support direct arrivals.

## 4. Make headings signposts

Write informative headings that name the reader's goal rather than the page's contents, matching user questions and tasks; use verbs for procedures; standardize by genre; let the outline reveal the page logic; promote buried answers; split long sections; ensure the table of contents alone predicts relevance; use specific headings that preserve scope when a chunk is extracted.

## 5. Disambiguate the confusable

Add comparison notes and cross-links for confusable pages; glossary entries and "not X" sections for concepts; qualifiers for overloaded names; warnings for similar-but-riskier tasks; rename or namespace similar titles; comparison tables; redirects only to the correct replacement (else disambiguate); scope aliases to the valid domain.

## 6. Cut the cost of a click

Shorten paths to common, valuable, critical, or high-risk pages; bypass generic hubs; collapse needless intermediate hubs; prune and group competing links; reorder by frequency and value; keep emergency paths short; make reference facts scannable; show prerequisites and risk before commit; promote low-frequency, high-consequence paths.

Related: why scent matters `../explanation/principles/06-information-scent.md`; scent on hub links `build-hubs.md`; check titles/summaries resolve `../reference/tools/wiki.md`.
