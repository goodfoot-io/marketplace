# Support and operations (repo proxy)

Scope: convert repeated questions and incident findings into source-of-truth docs. Owns support-driven validation for Principle 8.

## The repo proxy

Read the recurring questions in issues, PRs, and review comments; note which file gets linked in answers; harvest postmortem documentation action items (`reference/tools/git-history.md`).

## Diagnostics → actions

- **A question is asked repeatedly**: convert the answer into a source-of-truth page or FAQ with a clear scope — `reference/principles/02-typed-source-of-truth-topics/topic-identity.md`, `reference/principles/01-organize-around-user-intent/prioritization.md`.
- **A file is repeatedly linked in answers**: promote and maintain it as a support asset.
- **A page should exist but does not**: add it to the backlog — `baseline-audit.md`.
- **A page is known to be distrusted**: review, rewrite, or archive it.
- **A page causes follow-up questions**: add the missing context, examples, troubleshooting, or links — `reference/principles/07-nonlinear-information-seeking/cross-reference.md`.
- **An incident revealed a documentation gap**: create a post-incident documentation task and track it to completion.
- **A support answer conflicts with a source-of-truth page**: resolve it against the source of truth and update the page, the answer, or both — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.
- **Support phrases reveal the language people actually use**: add candidate aliases and glossary entries after validating meaning and scope — `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
