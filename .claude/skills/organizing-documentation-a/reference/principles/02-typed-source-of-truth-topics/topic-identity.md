# Topic identity

Scope: decide what deserves its own source-of-truth page versus a section, and route each fact to its owning layer. Owns the topic-granularity rules for Principle 2.

## The test

The smallest meaningful topic is the unit of documentation when it stands alone, has distinct retrieval value, and can carry enough local context. A subject deserves its own page when it is reusable, frequently linked, disputed, operationally important, independently searchable (an agent would grep for it), or needed as a durable reference target. Keep it embedded as a section when it has no independent intent, ownership, or retrieval value.

## Diagnostics → actions

- **A concept reappears in many places**: extract it to one concept page and cross-link — `concept-pages.md`, `reference/principles/04-multiple-paths/cross-linking.md`.
- **A task is tangled with its explanation**: split why from how — `concept-pages.md` and `task-pages.md`.
- **Reference data sits in prose**: move it to a scoped reference page, schema, or generated table — `reference-pages.md`.
- **Troubleshooting is mixed into normal-operation docs**: split a symptom-led page — `troubleshooting-and-runbooks.md`.
- **Decision history sits in current instructions**: move it to the ADR/commit/PR and link it — `reference/foundations.md` decision-history layer.
- **Content is duplicated across pages**: pick one source of truth and replace the rest with links — `canonicality.md`.
- **The topic is stable but its data is volatile**: keep the page stable and generate or link the data from its owner — `reference-pages.md`, `reference/foundations.md`.
- **Two files must change together and no type, test, or import enforces it**: do not write a page restating it — record the coupling as a mesh — `reference/tools/git-mesh.md`.
- **Content is obsolete but historically important**: archive it with status, date, scope, and a replacement link — `canonicality.md`.
