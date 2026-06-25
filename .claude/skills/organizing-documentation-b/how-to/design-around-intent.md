# How to design around user intent

Scope: organize the corpus around what readers come to do — the translate stage. How-to. Applies Principle 1.

## 1. Enumerate the readers

`git shortlog -sn`, `git log --author`, and `CODEOWNERS` reveal who works where. Segments: maintainers, contributors, reviewers, operators, newcomers — and agents grepping with no navigation context. Make the primary segments the audience for the root and module hubs; serve secondary segments through alternate entry points.

## 2. Map each intent to a topic type

- **Learn** → concept; **do** → task; **debug** → troubleshooting; **operate under pressure** → runbook.
- **Decide / compare** → decision criteria plus links to the decision record (commits/PRs/ADRs).
- **Verify a detail** → a fast, precise reference page; **understand why** → link to rationale in history.
- **Onboard** → a progressive path, each destination self-contained; **recover** → diagnosis, rollback, escalation.
- **Answer compliance/audit** → an evidence page naming source, owner, scope, version.
- Give the most common intents the shortest paths.

## 3. Route tasks by frequency, risk, and span

- Top recurring tasks → short paths from hubs. Rare, high-stakes tasks → a reviewed runbook with approvals, rollback limits, evidence capture.
- Multi-team tasks → show handoffs, ownership boundaries (`CODEOWNERS`), escalation. Prerequisites before steps. Irreversible steps → warnings, backup, rollback first.
- Frequently-done-wrong tasks → guardrails and verification. Branches by env/version/config → branch only where behavior differs and carry applicability metadata.

## 4. Add situational entry points

Create doors for incident, onboarding, audit, and handoff. An arrival from a stack trace or file path lands on the owning directory's `README`. An arrival from an alert or ticket links the artifact back and adds the symptom string as an alias. Surface environment/version markers before instructions where a reader may act in the wrong place.

## 5. Prioritize

Common → shortest; valuable → elevate even if infrequent; costly-when-unsupported → high-priority gap; repeated support question → a source-of-truth page or FAQ; organized-around-teams → re-map to user-task and lifecycle views; low-frequency but safety/compliance/incident-critical → promote; cited externally → give a stable identifier.

Related: why intent comes first `../explanation/principles/01-organize-around-user-intent.md`; reader discovery `../reference/tools/git-history.md`; then type the topics `type-a-topic.md`.
