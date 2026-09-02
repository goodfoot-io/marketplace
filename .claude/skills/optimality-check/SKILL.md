---
title: Optimality Check
summary: After concluding a behavior is correct or a fix has landed, check whether the design is optimal before closing the investigation.
name: optimality-check
description: "Use right after concluding 'not a bug', 'working as designed', 'expected behavior', or that a fix landed and tests pass — before reporting the investigation done. Also use when a user asks how to improve UX/design/architecture after you already explained why something happens. Runs a deliberate reframe from 'is this correct' to 'is this the best available design', since the two are different questions and confirming one says nothing about the other."
---

# Optimality Check

Correctness and optimality are different questions. "Does this behave as designed" and "is this the best available design" search different spaces — confirming the first tells you nothing about the second. Don't let a correctness verdict end the investigation.

## When to run this

Immediately after concluding any of:
- "not a bug" / "expected behavior" / "working as designed"
- a fix landed (by anyone, including you, including moments ago) and checks pass
- you've explained *why* something failed and the explanation stayed inside the current mechanism

Run it once, silently, before reporting done — don't wait for the user to ask "but is this the best way."

## How to make the shift

1. **State the underlying goal**, not the current mechanism's job. Not "why did the opener fail" but "what does the user actually need." The mechanism is a means; re-derive it from the goal instead of assuming it.
2. **Widen the search past the current implementation.** "Is this correct" only ranges over {defect, not-defect}. "Of every way to reach the goal, is this the best one" admits answers outside the existing code path — including replacing the mechanism.
3. **Don't let recency imply correctness.** A fix from five minutes ago is one candidate design, not proof of settledness. Reopen it under the optimality question exactly like any older code.
4. **Step up one level of abstraction, not deeper into the current one.** If root-causing stayed inside one mechanism (which binary failed, which config was wrong), also ask whether that mechanism is the right layer to own the problem at all.
5. **Surface it as a recommendation, not a rewrite.** State the better approach and its main tradeoff in 2-3 sentences; let the user decide before you implement.

## Anti-pattern

Treating "why didn't you suggest that first" as new information you lacked, when it's actually a different *kind* of question you weren't asking yet. If your answer to an improvement request is explaining or defending the current design, you're still answering the correctness question, not the optimality one.
