# Reference: page genres

Scope: catalog of page genres and what each optimizes for. Reference mode — look up when typing a topic. Pick exactly one primary genre per page; separate documentation modes (`../explanation/foundations.md` §4).

| Genre | Optimize for | Authored via |
|---|---|---|
| Hub | orientation, scope, routing, link quality | `../how-to/build-hubs.md` |
| Concept / explanation | mental model, purpose, examples, prerequisites | `../how-to/type-a-topic.md` |
| How-to / task | steps, prerequisites, permissions, verification | `../how-to/type-a-topic.md` |
| Reference | precise lookup, structured data, versioning, authority | `../how-to/type-a-topic.md` |
| Troubleshooting | symptoms, diagnosis, fixes, evidence, escalation | `../how-to/type-a-topic.md` |
| Runbook | time pressure, safety, rollback, verification, handoff | `../how-to/type-a-topic.md` |
| Decision record (ADR) | context, options, decision, consequences, date | `tools/git-history.md` |
| Glossary entry | preferred term, definition, synonyms, scope, disambiguation | `../how-to/set-vocabulary-and-metadata.md` |
| Onboarding | a sequenced path; each destination self-contained | `../how-to/design-around-intent.md` |
| Changelog | chronology, affected scope, versions, links | `tools/git-history.md` |
| Architecture overview | system boundaries, relationships, links to components | `../how-to/build-hubs.md` |
| Policy | authority, applicability, requirements, exceptions, evidence | `../how-to/set-vocabulary-and-metadata.md` |
| Checklist | completion, order, ownership, confirmation | `../how-to/type-a-topic.md` |
| Migration guide | before/after states, steps, risks, rollback | `../how-to/type-a-topic.md` |

- **A page combines genres or modes**: separate the intents structurally; split into pages only when the combined page weakens findability, usability, ownership, or maintainability.
- **A historical genre** (a decision record, a changelog, or a recorded plan or spike): correct as a record of its moment — when superseded, mark it historical (status + date + scope + replacement link) and preserve the content; do not rewrite it to the current state (`../how-to/type-a-topic.md`).

Related: the required structure of each topic type `topic-types.md`; choose and author a topic `../how-to/type-a-topic.md`; why typing matters `../explanation/principles/02-typed-source-of-truth-topics.md`.
