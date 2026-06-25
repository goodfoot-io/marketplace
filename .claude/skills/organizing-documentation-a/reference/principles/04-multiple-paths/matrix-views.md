# Matrix views

Scope: build a matrix or table projection over facets that helps readers choose, and keep its cells honest. Owns matrix projections for Principle 4. A matrix is a projection over facets (`facets.md`), not a second architecture.

## Diagnostics → actions

- **Pick the row facet** that best helps the target users compare in this view, and a complementary, user-meaningful **column facet** — do not assume columns must be user intent. Choose both from observed browsing and task evidence plus corpus structure.
- **Fill each cell** with a link to a hub (orientation) and/or a source-of-truth page (facts); make empty or ambiguous cells explicit.
- **A cell is empty**: label it missing, not applicable, intentionally absent, or not yet classified — and turn a "missing" cell into a backlog item — `reference/principles/08-validate-and-iterate/baseline-audit.md`.
- **The matrix creates artificial categories**: collapse the ones that do not match real user paths.
- **The matrix exposes duplicate or competing pages**: resolve them to a source of truth — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.
- **The matrix overwhelms rather than helps**: simplify until the next click is obvious — `reference/principles/06-information-scent/cost-of-click.md`.
- **The matrix can be generated**: build it from controlled, validated metadata with provenance and review so drift does not create misleading cells — `reference/principles/05-controlled-vocabulary-and-metadata/retrieval.md`.
