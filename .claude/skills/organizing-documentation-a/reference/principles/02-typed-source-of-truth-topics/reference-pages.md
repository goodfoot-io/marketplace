# Reference pages

Scope: author reference pages — precise, complete-in-scope lookup; generate from source to avoid drift. Owns reference-page structure for Principle 2.

## In the repo

Prefer reference generated from code, schema, or config: a stable topic with volatile data keeps the page stable and generates or links the data from its owner, with provenance and generation time (`reference/foundations.md` layered source of truth).

## Diagnostics → actions

- **Make the scope precise and structured.**
- **Values are incomplete**: fill the gaps or mark the incompleteness explicitly within the declared scope.
- **Label the source of truth and the owner** — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
- **Represent schemas, fields, states, commands, endpoints, limits, and error codes as structured data**, not prose.
- **Mark whether examples are normative (required patterns) or illustrative.**
- **Add version applicability and change history** — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
- **Label status per value**: current, deprecated, experimental.
- **Prose would be better as a table, schema, enum, or generated doc**: convert it.
- **State what is out of scope and link adjacent references** — `reference/principles/04-multiple-paths/cross-linking.md`.
- **Manual data drifts**: generate it from the authoritative source with owner-review rules — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-governance.md`.
