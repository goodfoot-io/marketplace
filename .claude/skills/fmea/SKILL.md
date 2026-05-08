---
name: fmea
description: Use for failure-mode analysis
---

# Plan Risk Review

Help the user pressure-test a plan. Speak about *their plan* in their words. Never name the method, the stages, or the subroutines below. Draft and propose; let the user ratify.

## Main flow

Walk `<stages>` in order. At each stage: apply §ASK to advance, draft into `<artifacts>` via §COMMIT, fire other subroutines as their triggers hit, and apply §CLOSE_GUARD before leaving.

Stop when the user signals done.

## Subroutines

### §ASK
**When:** about to call `AskUserQuestion`.
Preface in one or two sentences: what was just produced, what this question decides. Ask one question. If the question is a choice (solution, score band, action), draft 2–4 options with one recommended; reserve free-form prompts for genuinely open answer spaces.

### §VIEWPOINTS
**When:** entering the viewpoints stage; or a new class of affected party emerges.
Confirm the roster with the user in their terms. Spawn subagents in parallel, blind to one another, one per viewpoint, plus one chartered to find reasons the plan fails. Subagent prompts may use internal names; the merge step rewrites returned text per `<language>` before display.

### §TROUBLE_HUNT
**When:** opening the trouble stage; briefing §VIEWPOINTS subagents for it.
Frame in completed past tense: *"The plan ran its course and failed. Walk me through what happened."* Do not ask "what could go wrong?"

### §OUTSIDE_VIEW
**When:** about to estimate likelihood for any row.
Ask about plans like this one — base rates, common failure shapes — before the inside-view read. Name the class, roughly how many cases, and how it was chosen.

### §CATEGORY_SWEEP
**When:** leaving the trouble stage; once more before final review.
Walk `<categories>` silently, asking per bucket. Stop a bucket after one or two plausible items; an empty bucket is a finding, not a failure to look harder.

### §RANGE_ELICIT
**When:** scoring "how bad" or "how likely."
Elicit bounds first, then a best guess inside them. Phrase the range so the user would be surprised if the truth fell outside. Then ask what evidence would move the high end down or the low end up.

### §ANCHOR_DEFUSE
**When:** a number for this row was named in the last few turns.
Offer a pessimist's and an optimist's read instead of one number.

### §DISAGREEMENT
**When:** §VIEWPOINTS subagents diverge materially.
Show round-2 subagents the anonymized arguments but not the vote distribution. Re-poll once. Then ask the user to settle.

### §STEELMAN
**When:** about to commit a score, accept "we're done," or drop a risk.
When committing or accepting "done," ask for the strongest reason the read is too rosy or too narrow. When dropping a risk or committing an action, ask for the strongest reason it is too pessimistic or irreversible.

### §CAUSE_PAIR
**When:** recording a cause.
Pair person and system: record both sides regardless of which framing the user offered first.

### §CLOSE_GUARD
**When:** advancing a stage; at session end.
Ask: *"Anything we haven't touched?"* Advance only on a null answer.

### §FRAME_HOLD
**When:** the user's framing of the same row flips (gain/loss, if/when), or narrows/sharpens its subject.
Restate in the chosen frame and rewrite the row in place — do not split or duplicate. Confirm.

### §EDITOR_AGENT
**When:** entering stage 8.
Spawn a source plan editor scoped to all documents in `<source-plan>`. It owns writes to those documents and works in parallel with the conversation; route ratified changes via `SendMessage`. Terse user imperatives ("send a follow-up edit") forward to it without re-eliciting.

### §COMMIT
**When:** any fact, score, cause, protection, or action is ratified; or the user asks to keep the work.
Update the relevant `<artifacts>` file directly. Never write to `<source-plan>` here — that only happens in stage 8.

### §REMEDIATE
**When:** in stage 8, addressing each ratified failure mode.
Walk the worksheet one row at a time — never batched. Per row: (1) header it by ID and one-line problem; (2) diagnose by citing the offending location in `<source-plan>` (section, quoted text) and the intent that makes it wrong; (3) propose remediation via §ASK; (4) on ratification, SendMessage the source plan editor from §EDITOR_AGENT with the row ID, problem, and fix including locations so the editor can place the edit without rereading context; (5) on the editor's done-signal, acknowledge in one line and move to the next row. On user objection, do not edit — invoke §FRAME_HOLD, then re-enter at step 3.

### §FINAL_PASS
**When:** session end, or before any commit handoff for a given document.
Re-read the document for cross-row contradictions, terminology drift, and dangling references; reconcile via the source plan editor from §EDITOR_AGENT. Then ask whether to commit it in its host repo, and if so instruct the editor to do it.

## Reference sections

<stages consult-when="deciding what to do next in the main flow">
1. Scope — what plan, what boundary, what counts as success, and what kind of inquiry this is (e.g., surface-area only vs. implementation). Spend real time here. If later stages produce items that expand the subject's surface area beyond the scoped inquiry, treat it as a signal that scoping was thin — pause and re-scope. Assume unlimited implementation resources; coordination overhead is in scope, schedule and budget are not.
2. Viewpoints — whose interests are at stake.
3. Trouble — what could go wrong.
4. Causes — why each goes wrong.
5. Protections — what already guards against it.
6. Scoring — how bad, how likely, with confidence.
7. Actions — prioritized response and how each will be verified.
8. Revise (optional) — translate ratified findings into edits on `<source-plan>`. Enter only if the user opts in. Spawn the source plan editor per §EDITOR_AGENT, then walk rows via §REMEDIATE; run §FINAL_PASS before any commit handoff.
</stages>

<categories consult-when="running §CATEGORY_SWEEP">
Reputation · rules and compliance · technical · instructions and skill · coordination and dependencies · reversibility · second-order and knock-on.
</categories>

<artifacts consult-when="running §COMMIT, or the user asks what exists">
- `worksheet.md` — rows: what-could-go-wrong, effects, causes, protections, scoring with confidence, actions.
- `actions.md` — prioritized actions with owner and trigger.
- `assumptions.md` — guesses, what would change them, what was deferred. Log small or hand-picked reference classes here.
</artifacts>

<source-plan consult-when="referring to the artifact under review, or routing edits in stage 8">
The external planning document or set of documents being analyzed; exists before the session. Treated as read-only outside stage 8.
</source-plan>

<language consult-when="writing anything the user will see, including merged subagent output">
Avoid method names, stage names, subroutine names, scoring jargon, acronyms. Use the user's words for their plan and stakeholders. Plain over precise when they conflict.
</language>
