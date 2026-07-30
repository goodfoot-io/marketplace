---
title: Marketing by Funnel Stage
summary: Stage-by-stage guidance for marketing messages across the adoption ladder — attention, comprehension, evaluation, trust, trial, adoption, and retention — with the dominant psychological mechanism, message moves, and anti-patterns for each stage.
aliases: [Funnel Stages, Adoption Ladder, Marketing Funnel]
tags: [guide, marketing]
keywords: [attention, comprehension, evaluation, trust, trial, adoption, retention, funnel, continuance]
---

# Marketing by Funnel Stage

Part of the [Technology Marketing](./index.md) guide. Use this page when
creating a message for a specific position in the funnel — a landing page
targets attention and evaluation; docs, demos, and explainer videos target
comprehension; onboarding targets trial; renewal and expansion messaging
targets retention. Each stage below states the mechanism that dominates it,
what the message should do, and what backfires. The moves apply in any
medium; for production rules within a chosen medium, see
[Executing in Your Medium](./marketing-medium-execution.md).

Different mechanisms dominate different stages, so first decide which stage
the message serves. A message that is excellent for one stage is often
actively harmful at another.

## Attention — relevance beats novelty

**Mechanism.** People notice what maps to their current task, stack, or pain.
Creative or novel framing helps only when it is *also* appropriate to the
category; generic "revolutionary AI-powered" framing underperforms specific
relevance. Source credibility (recognizable maintainers, standards, peer
firms) matters most here — precisely because the reader cannot yet evaluate
substantive claims — and its effect decays quickly once they can.

**Message moves.**

- Name the task and context, not the technology: "cut review time on large
  pull requests" beats "AI-powered code intelligence."
- Lead with the reader's stack or workflow so relevance is instant.
- Deploy credibility signals (logos, named experts, standards compliance)
  here, at the top of the funnel — they are wasted on experienced users.

**Anti-patterns.** Novelty claims with no task anchor; credibility badges as
a substitute for substance further down the funnel.

## Comprehension — adapt to the reader's expertise

**Mechanism.** Users must form a workable mental model before they can value
the product. Support that helps novices (worked examples, templates, guided
prompts) actively hurts experts — the *expertise reversal effect* — who
experience it as noise and friction. Animated or dynamic demos help when the
task itself is dynamic and attention needs directing; static artifacts
(annotated examples, diffs, reference docs) often serve experts and dense
material better.

**Message moves.**

- Split paths early: "new to X?" versus "migrating from Y?" — do not force
  one narrative on both.
- For novices: one worked example that goes from zero to a completed real
  task.
- For experts: the mental model in one paragraph, then reference material.
  Cut the hand-holding.
- Show the failure modes, not just the happy path — an accurate mental model
  includes when the tool is wrong.

**Anti-patterns.** One-size-fits-all onboarding; flashy demo videos where a
static annotated example would carry more information; hiding limitations
(it breaks the mental model later, at higher cost).

## Evaluation — usefulness against the reader's status quo

**Mechanism.** Perceived usefulness dominates perceived ease of use, and both
are judged against the reader's *current workflow*, not against your
competitors. Task-technology fit is the operative frame: the same tool can be
genuinely valuable for boilerplate and API discovery yet harmful for
high-context work — and readers know their own tasks.

**Message moves.**

- Frame value as a delta from the reader's present workflow: what they stop
  doing, what gets shorter, what disappears.
- Be specific about where the tool fits and where it does not; scoped claims
  are more credible and pre-empt the disconfirmation that kills retention.
- Prefer "measure it on your own workflow" invitations to borrowed benchmark
  numbers — uplift figures are context-dependent and readers' contexts vary
  enormously.

**Anti-patterns.** Feature lists with no task mapping; universal productivity
percentages; comparing only against rival products when the real competitor
is the reader's current habit.

## Trust — performance, transparency, reversibility

**Mechanism.** Trust in automation is driven mostly by attributes of the
system — above all observed performance — not by user traits or reassuring
language. Reliance is not one-way biased: users over-trust algorithmic advice
in some settings and abandon algorithms faster than humans after a visible
error in others. Calibration is the goal: the reader should rely on the tool
exactly as much as its accuracy warrants.

**Message moves.**

- Show performance rather than asserting trustworthiness: real outputs, error
  rates, provenance.
- Make reversal cheap and say so: undo, override, diff-before-apply. "Easy to
  override when wrong" is a trust claim that survives contact with errors.
- Surface uncertainty honestly — calibrated trust outlasts inflated trust,
  because the first visible error does not detonate it.

**Anti-patterns.** "Trustworthy AI" as a slogan; hiding error behavior;
optimizing for maximum reliance rather than appropriate reliance.

## Trial — lower the cost of the first real use

**Mechanism.** Trial is won by low setup cost, reversibility, and an
immediate win on the user's own material. Defaults are genuinely powerful for
enrollment — but they buy trial, not value. Proactive prompts work at
workflow boundaries, not mid-task.

**Message moves.**

- Collapse time-to-first-success on the reader's own project, and make that
  the headline of trial messaging: "first result in your repo in five
  minutes."
- State reversibility and sandboxing explicitly — the perceived risk of
  trying is a larger barrier than enthusiasm is a driver.
- Time calls-to-action at natural boundaries (new project, new sprint, new
  hire), not as interruptions.

**Anti-patterns.** Trial flows that demand configuration before showing
value; demo-data first-runs that postpone the "works on *my* stuff" moment;
dark-pattern defaults that inflate enrollment and poison later trust.

## Adoption and retention — confirm the expectations you set

**Mechanism.** Continuance depends on satisfaction and *expectation
confirmation* — whether real use, including verification, compliance,
waiting, and coordination costs, delivers what pre-adoption messaging
promised.
This is where every earlier overpromise comes due. Perceived and measured
productivity can diverge; total workflow burden decides.

**Message moves.**

- Create earlier-stage messages with retention in mind: promise only what
  typical real use confirms.
- Retention messaging should surface value already received ("what changed in
  your workflow this quarter"), not re-run acquisition messaging.
- Acknowledge and address the supervision cost — review, verification,
  integration — because users experience it whether or not you mention it.

**Anti-patterns.** Renewal pitches recycling launch superlatives; celebrating
first-draft speed while ignoring end-to-end completion; measuring retention
messaging by the same metrics as acquisition messaging.

## See also

- [Technology Marketing](./index.md) — the hub and the core model.
- [Marketing by Audience Segment](./marketing-audience-segments.md) — the same stages differ sharply by
  audience; check both axes before producing.
- [Executing in Your Medium](./marketing-medium-execution.md) — production
  rules for the chosen medium, and cross-media reinforcement.
- [Marketing Message Checklist](./marketing-message-checklist.md) — this page compressed into
  pre-production checks.
- [Psychology Claims Audit](./marketing-psychology-claims.md) — sources and verdicts behind the mechanisms
  cited here.
