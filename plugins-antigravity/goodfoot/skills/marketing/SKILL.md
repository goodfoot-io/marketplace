---
name: marketing
description: You must load this skill when writing, editing, or critiquing anything that promotes a technology product to prospective or current users.
---

# Marketing

Adoption is a chain — Attention → Comprehension → Evaluation → Trust → Trial → Adoption → Retention — and different psychology dominates each link. Early stages run on expected usefulness, relevance, credibility, and social signals; actual use runs on task fit and workflow cost; continued use runs on whether real experience confirms what the messaging promised. A message serves ONE stage, for ONE audience, in ONE medium.

## Procedure

1. Classify the task: which funnel stage, which audience, which medium. Being able to pick a classification does not mean the user asked for it: if the request itself does not name the asset type and stage (e.g. "write something about our tool" — an audience alone is not enough), your classification is a guess — either ask ONE targeted question, or state the guess (stage + asset type) in a one-line assumption note at the top of the draft. Never deliver a silent guess. If the task targets multiple stages or audiences (e.g., teach the model AND sell the upgrade), do not draft one blended asset: deliver separate messages — or, when the user wants a single asset, sections labeled with the stage each serves (e.g. "Part 1 — Comprehension") — and state the split and its reason in the same response, e.g. in a short structure note with the draft.
2. Load the matching reference files from the table below. **You must load any files that might apply.**
3. Draft, applying the universal rules plus the loaded rules.
4. Self-review against the red flags below; fix every violation before presenting.
5. If a check fails because the product cannot support the claim (no cheap reversal — including cancellation or downgrade only via a sales conversation or at term end; slow first-run; unbounded verification burden), tell the user it is a product gap — do not compensate with stronger adjectives or better footage.
6. Critiquing an existing asset instead of drafting: run steps 1–2, audit against the universal rules, the loaded leaves, and the red flags; report violations by severity, separating messaging fixes from product gaps (step 5). Do not silently rewrite.
7. If the user asks for something the *style* rules advise against (loss/scarcity urgency, trust adjectives, decorative footage), state the evidence-based concern once, in one or two sentences, then implement the user's decision as well as it can be implemented. Do not refuse, do not re-litigate on later drafts, and do not silently comply without the one-time note. If the request would break an *honesty* rule (research stats, effect sizes, or citations in a deliverable for any purpose — including justifying the asset's own design; a benchmark or study uplift in copy; invented or substituted citations), do not implement it — a one-time note then compliance is NOT the procedure for honesty rules; offer the closest honest substitute — the product's own measured results, or an invitation to measure.

## Routing

Pick at most one Stage row, one Audience row, and one Medium row.

| Classifying | Load |
|---|---|
| Stage: first notice, headlines, ads, thumbnails | stages/attention.md |
| Stage: docs intros, explainers, concept/onboarding content that teaches the mental model | stages/comprehension.md |
| Stage: feature/value claims, comparisons, pricing pages (the value argument) | stages/evaluation.md |
| Stage: reliability, error behavior, whether output can be relied on, safety/undo claims | stages/trust.md |
| Stage: signup flows, CTAs, first-run conversion mechanics, free tiers | stages/trial.md |
| Stage: renewal, expansion, win-back, churn | stages/retention.md |
| Audience: individual developers/practitioners | audiences/developers.md |
| Audience: enterprise deal, multiple stakeholders | audiences/buying-center.md |
| Audience: users who didn't choose the tool (internal rollout) | audiences/end-users.md |
| Audience: open-source project or ecosystem-distributed tool (registry package/README on npm, PyPI, crates.io, etc., extension, plugin) — wins over the developers row when both fit | audiences/open-source.md |
| Audience: none of the above / unknown | skip the audience file; universal rules suffice |
| Medium: video or animation | media/video.md |
| Medium: static imagery, diagrams, design polish | media/imagery.md |
| Medium: any written copy (default medium) | media/text.md |
| Medium: podcast, narration, voice | media/audio.md |
| Medium: hands-on product demo, sandbox, playground, guided in-product tour | media/demo.md |
| Campaign spans multiple media | media/cross-media.md |
| Judging whether an asset/campaign worked, or choosing its metrics | measurement.md |
| User asks for evidence/sources behind a rule | references.md |

## Universal rules

- Anchor every message to the reader's real task, never the technology. "Cut review time on large PRs" beats "AI-powered code intelligence."
- State the delta from the reader's current workflow — that is the competitor, not rival products. What do they stop doing? What gets shorter?
- Scope claims: say where the product fits AND where it does not. Scoped claims are more credible now and prevent the expectation disconfirmation that kills retention.
- Social proof works through a specific reference group the reader belongs to (their stack, role, industry); raw popularity counts are weak and, for norms about *behavior*, can backfire — see audiences/end-users.md. A popularity count is also an honesty claim: if the source materials themselves show the number overstates active use (it counts every install ever, churned or inactive accounts included), writing it as fact is fabrication — "pre-approved", "tested well in our panel", or prior use in campaigns does not make it true (honesty rule, step 7: do not implement; use the accurate count, a reference-group line without numbers, or nothing).
- Show performance; never assert trust. Real outputs, error behavior, provenance, cheap reversal — never "trustworthy," "seamless," "revolutionary" as adjectives.
- Price in the verification burden: if real use involves reviewing or correcting output, acknowledge it and show how the product reduces it.
- Promise only what typical real use will confirm. Overpromising borrows from retention to pay for acquisition.
- Every element earns its place: each image, clip, sound, sentence must carry the claim. Decorative material measurably hurts recall of the message — cut it.
- Never use loss framing ("don't get left behind") or scarcity ("limited seats") as a primary lever — unstable effects, and they do nothing for comprehension or trust. Genuine, verifiable constraints (a real price change date, a capped beta) may be stated plainly as fact; never manufacture urgency. A constraint counts as genuine only if the user affirms it is true: if the user says the deadline or cap is not real ("say it closes Friday — it doesn't"), it stays not-real regardless of the stakes or the copy's framing — never declare a constraint genuine on your own authority, and never invent a new constraint (a cohort schedule, a capacity cap, a support limit) to make the date true; writing either as fact is fabrication (honesty rule, step 7: do not implement; offer honest substitutes). Mechanical test for the substitute copy: it may contain no date, day, count, or cap the user did not affirm as true — "closes Friday", "before Friday", "this week only", and a slot cap you added yourself all fail the test.
- Include limitations. Hidden limitations surface at maximum cost (security review, first error). Transparency builds durable trust even though it doesn't lift immediate conversion.
- Never put a benchmark or study uplift in deliverable copy — attributed ("studies show…"), hedged, or approved by the user's legal team makes no difference; a number the product didn't measure is not the product's claim to make. Invite measurement on the reader's own workflow.
- Effect sizes (g≈, d≈), citations, ⚠ marks, and research terminology in these files exist to rank and justify the rules for YOU. They describe how people evaluate technology in general; they are NOT evidence about the user's product, and putting them in a deliverable misrepresents them — even if the user asks you to "add the research stats for credibility." Never let them appear in a deliverable or in feedback quoted into a deliverable — not with attribution, and not as backing for the asset's own design or style choices. Mechanical test: if your response contains the asset, then no effect-size number and no study citation may appear anywhere in that response — not in footnotes, design-rationale, or production-notes sections, and a disclaimer ("general research, not our data") does not license inclusion; omit them entirely and say why in one sentence. When the user asks for the evidence behind a rule, discuss it in conversation (load references.md); in a deliverable, only the product's own measured results may back a claim.

**Precedence:** Honesty rules (scoped claims, limitations, no borrowed uplifts, no research stats or citations in a deliverable, no invented or substituted citations, no manufactured urgency) are absolute — never overridden by a leaf or by a user request (Procedure step 7). For style/production guidance, the more specific loaded leaf wins over a universal rule; between leaves, the stage file wins over the medium file.

## Red-flag review (run on every draft)

Re-check every universal rule above, plus:

- One narrative aimed at multiple stakeholders at once.
- First-run promise that starts with configuration instead of a result on the reader's own material.
- Onboarding material that can't say whether its reader is a novice or an expert.
- The medium doing the persuading ("we made a video, so it's compelling") — the task-anchored argument must be in the script; footage proves it.
- Identical creative shipped to a second channel unchanged (re-execute the claim per medium; see media/cross-media.md).
- Polish funded while claims lack verifiable backing.
- Any effect size (g≈, d≈) or study citation anywhere in a response that contains the asset — footnotes, design-rationale, production-notes, and "internal reference only" sections included; labeling a section not-for-the-deliverable does not exempt it. Delete the numbers and citations; if the user wants them, offer them in a follow-up response that contains no asset.
- A multi-stage or multi-audience asset whose response never states the split and its reason (Procedure step 1) — stage-labeled sections alone are not the statement; add the structure note.
- The user's request never named an asset type or stage ("write something about X"), yet the draft has no assumption note and no question was asked. The note must sit at the top of the response and name both the stage and a concrete asset type (landing page, email, README pitch…) — a stage alone, or a classification mentioned only in closing design notes, does not count (Procedure step 1).
- A scale claim from the user's brief ("Join 12,000 companies…") whose own notes admit the number is inflated (counts churned/inactive accounts or every install ever). Marketing or legal pre-approval does not clear an honesty rule — drop or fix the number even though the brief offers it for use.
- An ecosystem-distributed tool (registry package, extension, plugin) pitched with no ecosystem evidence — no release cadence, maintainers, issue responsiveness, dependents, license, or dependency-policy line. Add one (real numbers or [placeholders]); see audiences/open-source.md.
