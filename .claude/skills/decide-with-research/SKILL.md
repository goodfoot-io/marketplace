---
name: decide-with-research
description: Use when the user says "help me decide", "work through these decisions", "research these questions and ask me", "make each of these decisions with me", or hands over a list of open questions, cards, tickets, or design choices.
---

<instructions>

## 1. Inventory the Decisions

Read every item the user handed over in full, including any attached comments, prior decisions, or linked sources, before dispatching research.

- **An item is already decided** (a prior comment or note records the ruling): do not re-pose it. Verify the codebase still matches the item's stated current state and record that verification. Treat it as implementation, not a decision.
- **An item cites a source that does not exist** in the checkout or its history: say so once, up front, and work from the item's own paraphrase plus direct code reading. Do not invent the source's contents.
- **Items have an ordering constraint** ("precede X", "depends on Y"): note it; it shapes the sequencing recommendation at the end, not the order questions are asked.

Sequence the questions so that decisions others depend on come first.

## 2. Research in Parallel

Dispatch one research subagent per decision in a single message, using a cheaper model than the one driving the conversation, read-only. Give each agent a numbered list of concrete things to find, each anchored to a file, symbol, or grep target, and a word budget. Ask for file:line references and quoted code for the load-bearing pieces.

Each brief should ask for:

- What the code does today at the decision point, quoted.
- Every consumer or classifier that would have to agree with the decision, so the blast radius is known.
- Existing tests and docs touching the behavior, and whether the contested case is tested at all.
- Any constant, limit, or contract the decision must fit inside.

- **The decision concerns policy where industry practice exists** (security posture, retry semantics, error contracts, API shape, limits): after the code report arrives, send each agent a second brief to search the web for what named vendors and standards actually document, with source URLs, and to flag anything it could not verify. Do this before asking any question that best practice would bear on, even when the recommendation seems obvious. Ask the user only if unsure whether they want the web pass; when they ask for it mid-flow, run it for every remaining decision, not only the current one.

Do not ask any question until the research for that question is in hand. Continue other work while waiting.

## 3. Present Each Decision Before Asking

For each decision, in this order, write:

1. **A heading** numbering the decision within the set ("Decision 3 of 6") and naming the item.
2. **The question in plain terms.** One short paragraph, no jargon, no internal codenames. A reader outside the codebase should understand what is being chosen.
3. **What the research found.** The current behavior, the concrete divergences, and the external evidence. Put numbers and vendor comparisons in a table, not prose. Name the stakes: what goes wrong if the choice is too loose and what goes wrong if it is too strict.
4. **Options.** Two to four, numbered. Under each, a **Good** line listing the outcomes that follow from choosing it and a **Bad** line listing the costs and failure modes. Include the "do nothing" option only when it is genuinely defensible; otherwise omit it or state in one line why it is not acceptable.
5. **Any sub-rule the decision carries** (edge-case handling, strictness split, scope limit) stated as part of the recommendation so the answer settles it too.
6. **Recommendation.** Name the option and give the one reason that decides it.

Then pose the question with `AskUserQuestion`: one question, the recommended option first with "(Recommended)" in its label, each option's description restating its concrete effect in one sentence. Never batch multiple decisions into one prompt.

- **The user answers with a change of process** rather than an option (asks for more research, reorders, adds a constraint): do what they asked, then re-pose the same question with the new evidence folded in. Do not treat the process request as an answer.

## 4. Confirm the Resulting Work Before Writing

After the last answer, present one table of every decision and its ruling, then list exactly what will change in the tracking system: which items close, which get a decision record, which new work items are created and how they relate. State the plan and wait for the user's confirmation or silence before writing anything.

## 5. Record Decisions and Create Follow-on Work

- **An item was a decision, and the decision is now made**: record the ruling, the code evidence with file references, the external sources with URLs, and the rejected options in a comment on the item, then close or archive it. Create a new work item for the implementation, related back to the decision item and to any items the ordering constraints named.
- **A decision produced a deferred follow-up** (a second phase the user chose not to do now): create it as its own work item, related to the primary implementation item, and state the dependency in its description.
- **Two new work items share a mechanism** (the same header, constant, or rule): relate them to each other after both exist; parallel writers cannot know each other's IDs, so add cross-relations in a final pass.

Fan the writing out one worker per item when there are more than two; give each worker the full ruling and evidence text so it does not re-derive it. Verify at the end that every item's status is what was announced, every relation is present, and every working tree is clean.

## 6. Close

Report the decisions table, the new items with their relations, a suggested implementation sequence honoring the ordering constraints, and any findings the workers surfaced outside their scope that change the implementation.

</instructions>
