---
name: questions
description: Walk the user through open questions one at a time, each with
  context, stakes, and a recommendation. Use when the user says "questions",
  "what's still open", "walk me through the decisions", or when unresolved
  choices are blocking progress.
---

<user-request>
$ARGUMENTS
</user-request>

<instructions>

## 1. Collect the Open Questions

Gather every question still unresolved in the current work — the decisions the user has yet to make, not the ones already settled.

- **Fewer than two questions**: Ask the single remaining question and stop; the one-by-one walkthrough earns nothing at that size.
- **No open questions**: Say so and stop.

## 2. Walk the Questions One at a Time

Ask each through the `AskUserQuestion` tool, one per turn, in an order that puts questions whose answers change later questions first.

Before each question, write four plainly separated parts, in prose aimed at comprehension:

- **Explanation** — One sentence to one paragraph on what is being decided.
- **Examples** — One or more illustrations of the question and its possible answers, when they clarify anything.
- **Stakes** — What changes depending on the answer.
- **Recommendation** — The option you would choose, and why.

## 3. Stop When the Questions Run Out

End after the last question. Do not summarize the answers back, and do not act on them — this skill surfaces decisions, it does not make them.

</instructions>
