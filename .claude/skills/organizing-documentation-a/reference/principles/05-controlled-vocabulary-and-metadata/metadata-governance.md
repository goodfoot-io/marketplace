# Metadata governance

Scope: detect vocabulary drift, stale terms, and deprecated terms and surface them; reuse existing metadata. Authority and enforcement are the maintainer's. Owns vocabulary and metadata governance for Principle 5; page- and hub-level review triggers and handoff live in `reference/principles/08-validate-and-iterate/governance.md`.

## Diagnostics → actions

- **Taxonomy authority is the maintainer's**: who defines terms, facets, and metadata values, who may add a tag or rename a preferred term, and rename approvals are theirs to set; Claude detects drift — new, duplicate, or competing terms — and surfaces it, and on an approved rename adds the redirect link — `reference/principles/08-validate-and-iterate/governance.md`.
- **Vocabulary enforcement is the maintainer's** (templates, validation, linting, review): Claude detects violations — off-convention names, uncontrolled tags, missing navigation-critical fields — and surfaces them; prefer controlled tags in what Claude authors.
- **Metadata can be generated from an authoritative system**: generate it, validate values, and record source and generation time; override rules are the maintainer's — `reference/foundations.md`.
- **Required metadata is missing**: surface it in a report for the maintainer; alerting and enforcement are theirs to wire.
- **You need to detect stale pages**: use review dates, last-commit dates (`git log -1 --format=%cs`), release changes, and incidents — `reference/tools/git-history.md`, `reference/principles/08-validate-and-iterate/baseline-audit.md`.
- **Deprecated terms linger**: find and replace them with search, redirects via links, synonym maps, linting, and terminology audits, distinguishing preferred, nonpreferred, deprecated, and scoped-alias terms — `vocabulary.md`.
