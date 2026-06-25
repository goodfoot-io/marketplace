# Glossary — preferred terms

Scope: the corpus's controlled vocabulary — the framework's preferred terms with a one-line definition and the topic that owns each. Use these terms consistently; map synonyms and old names to them (`reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`). This is the "by term" path into the skill.

| Term | Definition | Owner |
|---|---|---|
| Documentation mode | the reader's intent: learning, doing, looking up, understanding | `documentation-modes.md` |
| Topic type | the information structure: concept, task, reference, troubleshooting, glossary | `topic-types.md` |
| Page genre | how a page is used: hub, runbook, ADR, changelog, etc. | `page-genres.md` |
| Metadata | scope, ownership, applicability, status, version, retrieval context | `metadata-model.md` |
| Source-of-truth page | the editorial authority for a topic (not the best-ranked page) | `reference/principles/02-typed-source-of-truth-topics/canonicality.md` |
| Layered source of truth | each fact routed to the layer that owns it; a repo has no single source-of-truth page | `reference/foundations.md` |
| Preferred term | the vocabulary-controlled label for a concept | `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md` |
| Durable / stable identifier | a long-lived reference target: a SHA-pinned fragment link or a mesh name | `reference/foundations.md` |
| Canonical URL | an SEO duplicate-consolidation mechanism — not editorial authority; avoid the term for that sense | `reference/foundations.md` |
| Hub | a page that orients and routes rather than holding facts | `reference/principles/03-hubs-orientation-and-routing/index.md` |
| Facet / projection | an alternate path over a faceted model (role, lifecycle, failure-mode, API surface) | `reference/principles/04-multiple-paths/facets.md` |
| Matrix view | a table projection over two facets | `reference/principles/04-multiple-paths/matrix-views.md` |
| Information scent | cues that let a reader predict what lies behind a link before clicking | `reference/principles/06-information-scent/index.md` |
| Orphan / dead end | a page with no inbound path / no useful onward path | `reference/principles/04-multiple-paths/orphans-and-dead-ends.md` |
| Berrypicking | seeking by accumulating partial answers and reformulating | `reference/principles/07-nonlinear-information-seeking/berrypicking.md` |
| Progressive disclosure | answer first, depth linked or below | `reference/principles/07-nonlinear-information-seeking/progressive-disclosure.md` |
| Mesh | a recorded load-bearing coupling that no type, test, or import enforces | `reference/tools/git-mesh.md` |
| Fragment link / anchor | a source-anchored link, pinned to a commit SHA, that makes drift detectable | `reference/tools/wiki.md` |
| Drift | code moving out from under the prose that describes it | `reference/principles/08-validate-and-iterate/governance.md` |
| Blast radius | the set of files a change could affect, via mesh co-occurrence (`git mesh tree`) | `reference/tools/git-mesh.md` |
