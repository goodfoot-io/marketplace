# How to build and maintain hubs

Scope: create and repair hubs that orient and route without owning the facts they link to. How-to (author stage). Applies Principle 3.

## 1. Decide if a hub is needed

Create one for a high-volume or high-complexity domain, workflow, role, lifecycle stage, incident class, product area, or architecture layer. **Threshold**: a directory with three or more docs and no overview → add a hub; fewer → let the directory name carry it (a hub that says little is worse than none). Inventory existing hubs with `git ls-files '**/README.md' '**/AGENTS.md'`; a "hub" that is really a long article → split orientation from content.

## 2. Expand thin READMEs

A README too thin to orient on arrival (a bare title or one-liner; no scope, no listing, no cross-refs — 3 lines or fewer is the usual tell) must expand to at minimum: a heading with a purpose clause; a scope / "where you are" line (ownership language for a source module — "owns X"; containment for a collection — "contains X"); a complete file table when the directory holds several non-obvious files (§8); a "How it works" or "Quick start" section; and see-also cross-references to the related docs, examples, and source (`add-paths.md`). Do not leave a stub.

## 3. Add scope statement and TOC for long documents

Every document over 500 lines needs BOTH a scope statement at the top AND a table of contents. Shorter documents need a scope statement (one sentence: what this covers, who it is for). Never add only one of scope or TOC to a long document — both are required.

## 4. Scope it

State the scope in the opening line; add explicit exclusions and links to adjacent hubs; label the audience and prior knowledge; choose one dominant organizing frame (domain, workflow, role, lifecycle, problem class) and make it visible in the headings.

## 5. Orient the reader

Add a where-you-are paragraph and "use this when" guidance; elevate "start here"; separate beginner from expert, normal from emergency, learning from action, current from legacy; add "not the same as" notes; say what to read first and what to skip; add situational doors; keep it clear for direct grep arrivals.

## 6. Select and group links

Include only links serving the scope; move too-detailed links down; add missing source-of-truth and high-intent paths; remove redundant links; update or redirect stale ones; replace non-source-of-truth targets; group by intent/lifecycle/role/system/failure; elevate or demote; add risk/permission/version cues before the click. Every link carries scent — state when and why to follow it.

## 7. Build the combined navigation surface

Two improvements are required, not one or the other:

1. **Root README**: open with a one-sentence scope statement (what this repo is), then a navigation hub that routes to every major surface with a one-line description and a count where it helps (each content directory's README, the agent orientation file, the policy docs, the alphabetical and cross-reference indexes, preface, help guide, draft area, contributing guide). For a multi-area repo the root README is a dispatcher, not a summary: scope answers "what is this," the hub answers "where do I find X."
2. **Every cross-reference / secondary index file**: Add a brief introductory blurb explaining what the index maps and linking back to the root README or alphabetical index. Use a consistent pattern across all files. A reader who lands on a cross-reference index from a search engine gets context and escape hatches.
3. **Alphabetical index (if present)**: Add an inter-index cross-reference line below the header linking to all other indexes. Entries within each letter section MUST be in strict alphabetical order by link text. When inserting a new entry, reorder existing entries as needed — do not preserve pre-existing disorder. Each entry's link text MUST match the exact H1 title of the referenced file; verify by reading `head -1` of each target. After all entries are added, run a count command and update the header count to match exactly — never estimate.

## 8. Choose hub content

Enough overview to orient; a domain map where relationships matter; common tasks, failures, concepts, and reference links; decision-record links where rationale affects use; owner/escalation and maturity/status indicators; "new here?" and "under incident pressure?" guidance.

When the hub fronts a directory of many similar files (per-language, per-component, per-endpoint), its primary content is a complete table mapping each file to its human-readable identifier, generated from `git ls-files` — never a hand-count or a sampled list. A reader who knows the identifier but not the filename scans straight to it, and the table doubles as a coverage check against the filesystem (`validate.md`).

## 9. Add descriptive subtitles to terse meta-documents

For top-level meta-documents (Preface, HelpGuide, CONTRIBUTING, GOVERNANCE), if the title is a single short phrase, add a descriptive subtitle after a double dash (e.g., `# Help Guide -- navigation, features, and troubleshooting`). This strengthens information scent for readers scanning a file listing.

## 10. Author the agent orientation file

The orientation file (`AGENTS.md` / `CLAUDE.md` — use whichever name the repo or its toolchain already loads; follow that convention and do not duplicate across both unless the project wants both) is a typed hub for agents and contributors. Give it real structure:

- A one-line repo description and a **repo-type framing** — documentation corpus, software project, or mixed — so an agent does not hunt for build/test infra that is not there.
- An annotated directory tree to the file level for the key directories, with a size cue on large files so an agent knows what is safe to read whole.
- The **layered source-of-truth model** (`../explanation/foundations.md` §1): which layer owns which facts, and the rule that when a fact has two homes the owning layer wins and the other copy becomes a link.
- **Working norms**: language, build, test, lint, CI, and commit conventions.
- A **routing table by both reader intent and task** — "to understand X → …" and "to do Y → these specific files." Both are legitimate facets; do not force one.
- **Load-bearing conventions**: the rules an agent would violate blind (formatting, ordering, policy, CI constraints), each naming the specific files it governs.

State its relationship to directory READMEs — the orientation file owns agent-specific conventions and routing; directory READMEs own navigation for both audiences; neither duplicates the other. Link it from the root README and the docs index (`add-paths.md`).

## 11. Keep facts out

Restated owned content → a summary plus a link; volatile detail → the owning page or a generated reference; duplicated status/ownership/version → generate or link to the metadata. The hub's authority is routing and orientation, not the facts.

Related: why hubs route, not own `../explanation/principles/03-hubs-orientation-and-routing.md`; a hub is a genre `../reference/page-genres.md`; write the link scent `strengthen-scent.md`; the wiki hub threshold `../reference/tools/wiki.md`.
