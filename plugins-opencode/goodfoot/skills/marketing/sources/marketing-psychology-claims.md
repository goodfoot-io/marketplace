---
title: Psychology Claims Audit
summary: Verdicts on the popular psychology claims used in technology marketing — cognitive load, social proof, source credibility, loss aversion, scarcity, defaults, algorithm trust, transparency, and media folklore such as "video always beats text" — with what the evidence actually supports, the action to take instead, and the primary sources for each.
aliases: [Claims Audit, Psychology Claims, Marketing Psychology, Media Claims]
tags: [guide, marketing]
keywords: [social proof, loss aversion, scarcity, defaults, credibility, cognitive load, algorithm aversion, transparency, video, production value, repetition, interactivity, evidence]
---

# Psychology Claims Audit

Part of the [Technology Marketing](./index.md) guide. Consult this page before reaching
for a named "psychology lever" in a message. Each claim below gets a verdict —
what the cumulative evidence actually supports for professional-technology
marketing — and its primary sources.

## Verdict summary

| Claim | Verdict | Use it? |
|---|---|---|
| "Reduce cognitive load" | Strong, but conditional on expertise | Yes — adaptively, never uniformly |
| "Use social proof" | Strong, but context-sensitive | Yes — specific reference groups only |
| "A trusted source wins" | Real early, decays with experience | Top of funnel only |
| "Loss framing is powerful" | Unstable; oversold | Avoid as a primary lever |
| "Scarcity increases demand" | Moderate; poorly transferable | Avoid for professional tools |
| "Defaults are powerful" | Strong for trial, not value | Yes for enrollment; never as value substitute |
| "People don't trust algorithms" | Incomplete as a slogan | Design for calibration instead |
| "Transparency always helps" | Helps comprehension, not always preference | Yes — as governance, not conversion tactic |

## The claims

### "Reduce cognitive load" — strong, but conditional

Cognitive load theory is well supported: working memory is limited, and
extraneous load harms learning (Sweller 1988). But the modern synthesis adds
the **expertise reversal effect**: high-assistance guidance helps
low-prior-knowledge users and *hurts* high-prior-knowledge users, who
experience it as noise (2025 meta-analysis). The rule is not "always
simplify" — it is "match support to expertise and fade it."

- Sweller (1988), *Cognitive Load During Problem Solving: Effects on
  Learning*, Cognitive Science. https://doi.org/10.1207/s15516709cog1202_4
- *A cornerstone of adaptivity — A meta-analysis of the expertise reversal
  effect* (2025).
  https://www.sciencedirect.com/science/article/pii/S0959475225000660
- Sweller, van Merriënboer & Paas (2019), *Cognitive Architecture and
  Instructional Design: 20 Years Later*, Educational Psychology Review.
  https://doi.org/10.1007/s10648-019-09465-5

### "Use social proof" — strong, but context-sensitive

Norm effects are real across contexts, but heavily moderated: influence is
strongest when the reference group is specific or psychologically close, and
descriptive norms can **boomerang** — telling above-average performers that a
behavior is common pulls them toward the mean (Schultz et al. 2007). "Most
teams use X" helps only when the reference group is relevant and
aspirational; pair descriptive norms with an injunctive signal.

- Melnyk, Carrillat & Melnyk (2022), *The Influence of Social Norms on
  Consumer Behavior: A Meta-Analysis*, Journal of Marketing.
  https://journals.sagepub.com/doi/abs/10.1177/00222429211029199
- Schultz, Nolan, Cialdini, Goldstein & Griskevicius (2007), *The
  Constructive, Destructive, and Reconstructive Power of Social Norms*.
  https://doi.org/10.1111/j.1467-9280.2007.01917.x

### "A trusted source wins" — real early, decays with experience

Source credibility affects persuasion (Hovland & Weiss 1951), but the
meta-analytic boundary matters: credibility matters most when the audience
lacks prior attitudes and cannot evaluate the claims themselves, and its
effect decays rapidly. Spend credibility signals at the top of the funnel on
unfamiliar categories; once users have direct experience, performance and
fit dominate.

- Hovland & Weiss (1951), *The Influence of Source Credibility on
  Communication Effectiveness*, Public Opinion Quarterly.
  https://cir.nii.ac.jp/crid/1361137046021732864
- Kumkale, Albarracín & Seignourel (2010), *The Effects of Source Credibility
  in the Presence or Absence of Prior Attitudes*, Journal of Applied Social
  Psychology. https://doi.org/10.1111/j.1559-1816.2010.00620.x

### "Loss framing is powerful" — unstable; oversold

Prospect theory proposed steeper value curves for losses (Kahneman & Tversky
1979), but its own authors documented important boundaries (Novemsky &
Kahneman 2005), and recent re-analysis argues loss aversion is not robust
under many symmetric, unordered conditions. "Don't get left behind" framing
is too unstable to be a default for developer or enterprise messaging — and
it does nothing for comprehension or trust.

- Kahneman & Tversky (1979), *Prospect Theory: An Analysis of Decision under
  Risk*, Econometrica. https://ouci.dntb.gov.ua/en/works/7pGDm3x9/
- Novemsky & Kahneman (2005), *The Boundaries of Loss Aversion*, Journal of
  Marketing Research.
  https://journals.sagepub.com/doi/10.1509/jmkr.42.2.119.62292
- Yechiam & Zeif (2025), *Loss aversion is not robust: A re-meta-analysis*,
  Journal of Economic Psychology — loss-aversion parameter ≈1.07 (not
  significantly above 1.0) under symmetric, unordered conditions.
  https://www.sciencedirect.com/science/article/pii/S0167487025000133

### "Scarcity increases demand" — moderate; poorly transferable

Scarcity has positive average effects (Lynn 1991), but recent meta-analysis
shows the effect depends on the kind of scarcity, product type, and context
(Ladeira et al. 2023). For professional tools it is a poor primary lever:
"limited seats" does nothing for comprehension, task fit, or durable trust —
the things that actually decide adoption.

- Lynn (1991), *Scarcity effects on value: A quantitative review of the
  commodity theory literature*, Psychology & Marketing.
  https://doi.org/10.1002/mar.4220080105
- Ladeira et al. (2023), *A meta-analysis on the effects of product
  scarcity*, Psychology & Marketing.
  https://onlinelibrary.wiley.com/doi/full/10.1002/mar.21816

### "Defaults are powerful" — strong for trial, not for value

Default effects on enrollment are among the largest in behavioral science
(Johnson & Goldstein 2003), and later review confirms them while stressing
defaults are not the only causal factor (Steffel et al. 2019). For products:
defaults, pre-configuration, and opt-out trials genuinely drive first use —
and do nothing for post-adoption value. A default that inflates enrollment
past what the product confirms poisons retention.

- Johnson & Goldstein (2003), *Do Defaults Save Lives?*, Science.
  https://doi.org/10.1126/science.1091721
- Steffel, Williams & Tannenbaum (2019), *Does Changing Defaults Save
  Lives?*. https://journals.sagepub.com/doi/10.1177/237946151900500106

### "People don't trust algorithms" — incomplete as a slogan

Both directions are documented. Users abandon algorithms faster than humans
after seeing them err (Dietvorst et al. 2015) — yet often weight advice
*more* when labeled algorithmic (Logg et al. 2019). Trust in automation is
driven mostly by system attributes, above all performance (Hancock et al.
2011; Schaefer et al. 2016). Implication: do not build messaging to "overcome
algorithm aversion"; design and describe the product for **calibrated
reliance** — visible performance, uncertainty, provenance, cheap override.

- Dietvorst, Simmons & Massey (2015), *Algorithm aversion: People erroneously
  avoid algorithms after seeing them err*, JEP: General.
  https://pubmed.ncbi.nlm.nih.gov/25401381/
- Logg, Minson & Moore (2019), *Algorithm appreciation: People prefer
  algorithmic to human judgment*, OBHDP.
  https://www.sciencedirect.com/science/article/pii/S0749597818303388
- Hancock et al. (2011), *A Meta-Analysis of Factors Affecting Trust in
  Human-Robot Interaction*, Human Factors.
  https://journals.sagepub.com/doi/10.1177/0018720811417254
- Schaefer, Chen, Szalma & Hancock (2016), *A Meta-Analysis of Factors
  Influencing the Development of Trust in Automation*, Human Factors.
  https://journals.sagepub.com/doi/10.1177/0018720816634228

### "Transparency always helps" — comprehension yes, preference not always

Disclosure of sponsorship or persuasive intent improves recognition and
memory but can *reduce* credibility and brand evaluations; activating
persuasion knowledge helps people resist persuasion. Transparency (model
cards, limitations, benchmark caveats) is the right governance choice and
builds institutional trust — but do not expect it to lift immediate
conversion, and do not let that tempt you to drop it.

- *A Meta-Analysis of the Effects of Disclosing Sponsored Content* (2020),
  Journal of Advertising.
  https://www.tandfonline.com/doi/full/10.1080/00913367.2020.1765909
- Boerman, van Reijmersdal & Neijens (2012), *Sponsorship Disclosure: Effects
  of Duration on Persuasion Knowledge and Brand Responses*, Journal of
  Communication.
  https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1460-2466.2012.01677.x

## Media claims

The same audit applied to media-production folklore. Each entry names the
reflex, the action to take instead, and its sources; the per-medium
production rules built on these live in
[Executing in Your Medium](./marketing-medium-execution.md). Several of
these sources extrapolate from instructional research to marketing and are
flagged where so.

### "Video always beats text" → put the argument in the script; use footage to prove it

In controlled comparisons, video's edge over well-written text is
concentrated in *believability* — seeing the thing appear real — not in
persuasion, where the advantage is minimal. Action: never rely on the format
to carry weak claims. Write the task-anchored argument first; spend the
footage demonstrating it. Reserve video for inherently dynamic content, where
modality effects genuinely pay.

- Wittenberg, Tappin, Berinsky & Rand (2021), *The (minimal) persuasive
  advantage of political video over text*, PNAS 118(47).
  https://www.pnas.org/doi/10.1073/pnas.2114388118
- Berney & Bétrancourt (2016), *Does animation enhance learning? A
  meta-analysis*, Computers & Education.
  https://www.sciencedirect.com/science/article/abs/pii/S0360131516301336

### "People don't read" → front-load, don't abbreviate

Eye-tracking shows people *scan* in an F-shaped pattern — first lines and
left edge — rather than refusing to read. Action: put the conclusion in the
first two lines and key terms at the left edge of every block; structure for
scanning. Cutting substance because "nobody reads" is not supported.

- Nielsen Norman Group, *F-Shaped Pattern of Reading on the Web:
  Misunderstood, But Still Relevant (Even on Mobile)*.
  https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/

### "Higher production value = more credibility" → polish the first impression, then fund verifiability

Visual-appeal judgments form in ~50 ms and persist, and "design look" is the
most-cited credibility factor — so the thumbnail, hero, and first frame
deserve real design work, and low-fluency (cluttered, low-contrast) design
measurably depresses believability of adjacent claims. But the halo is
fragile: it does not survive a bad hands-on experience, and once someone
evaluates an actual claim, verifiability and evident expertise weigh as much
as looks. Action: budget polish up to "clean and fluent," then spend the
remainder on provenance, real outputs, and named references.

- Lindgaard, Fernandes, Dudek & Brown (2006), *Attention web designers: You
  have 50 milliseconds to make a good first impression!*, Behaviour &
  Information Technology. https://doi.org/10.1080/01449290500330448
- Reber & Schwarz (1999), *Effects of perceptual fluency on judgments of
  truth*, Consciousness and Cognition.
  https://www.sciencedirect.com/science/article/abs/pii/S1053810099904007
- Tuch, Roth, Hornbæk, Opwis & Bargas-Avila (2012), *Is beautiful really
  usable?*, Computers in Human Behavior.
  https://doi.org/10.1016/j.chb.2012.03.024
- Fogg et al. (2003), *How do users evaluate the credibility of Web sites? A
  study with over 2,500 participants*, Proceedings of DUX 2003.
  https://dl.acm.org/doi/10.1145/997078.997097

### "Repeat the message everywhere" → repeat the claim, vary the execution

Cross-media reinforcement is real: two media beat one at matched spend, and
cross-media repetition beats same-medium repetition at equal frequency. But
identical creative re-skinned across media *hurts* memory, and exposure–liking
follows an inverted U (wear-out). Action: keep the core claim constant, make
each medium's execution visibly different, budget the weaker medium
generously, and cap per-person frequency — vary execution instead of adding
exposures.

- Naik & Raman (2003), *Understanding the Impact of Synergy in Multimedia
  Communications*, Journal of Marketing Research.
  https://doi.org/10.1509/jmkr.40.4.375.19385
- Chang & Thorson (2004), *Television and Web Advertising Synergies*,
  Journal of Advertising 33(2).
- Voorveld & Valkenburg (2015), *The Fit Factor: The Role of Fit Between Ads
  in Understanding Cross-Media Synergy*, Journal of Advertising 44(3).
  https://www.tandfonline.com/doi/abs/10.1080/00913367.2014.977472
- Bornstein (1989), *Exposure and affect: Overview and meta-analysis of
  research, 1968–1987*, Psychological Bulletin 106(2).
- Schmidt & Eisend (2015), *Advertising Repetition: A Meta-Analysis on
  Effective Frequency in Advertising*, Journal of Advertising.
  https://doi.org/10.1080/00913367.2015.1018460

### "Make it interactive" / "demos always beat videos" → make it feel responsive, pause the flow, use the user's material

Interactivity is not a lever by itself: *perceived* responsiveness predicts
outcomes where objective feature count does not, and interaction that fails
to pause playback splits attention and backfires. The strongest case for
demos is attitude durability — hands-on direct experience produces stronger,
more behavior-predictive attitudes than passive exposure — which makes the
demo the right asset for the trust and trial stages. No marketing-specific
head-to-head of demo vs. video exists; measure conversion yourself rather
than asserting it.

- Yang & Shen (2018), *Effects of Web Interactivity: A Meta-Analysis*,
  Communication Research. https://doi.org/10.1177/0093650217700748
- Ploetzner (2022), *The effectiveness of enhanced interaction features in
  educational videos: a meta-analysis*, Interactive Learning Environments.
  https://doi.org/10.1080/10494820.2022.2123002
- Fazio & Zanna (1978), *On the predictive validity of attitudes: The roles
  of direct experience and confidence*, Journal of Personality.
  https://doi.org/10.1111/j.1467-6494.1978.tb00177.x

### Production-rule sources (video, imagery, audio)

The ranked production rules in
[Executing in Your Medium](./marketing-medium-execution.md) rest on the
multimedia-learning literature — an instructional-research base whose
mechanisms (working-memory load, dual coding) transfer to marketing assets,
flagged there as such:

- Cromley & Chen (2025), *A meta-analysis of Richard Mayer's multimedia
  learning research: Searching for boundary conditions of design principles
  across multiple media types*, Educational Research Review 49.
  https://www.sciencedirect.com/science/article/pii/S1747938X25000673
- Sundararajan & Adesope (2020), *Keep it Coherent: A Meta-Analysis of the
  Seductive Details Effect*, Educational Psychology Review.
  https://link.springer.com/article/10.1007/s10648-020-09522-4
- Rey (2012), *A review of research and a meta-analysis of the seductive
  detail effect*, Educational Research Review.
  https://www.sciencedirect.com/science/article/abs/pii/S1747938X12000413
- Ginns (2005), *Meta-analysis of the modality effect*, Learning and
  Instruction 15(4).
- Alpizar, Adesope & Wong (2020), *A meta-analysis of signaling principle in
  multimedia learning environments*, Educational Technology Research and
  Development (d ≈ 0.38).
  https://link.springer.com/article/10.1007/s11423-020-09748-7
- Richter, Scheiter & Eitel (2016), *Signaling text-picture relations in
  multimedia learning: A comprehensive meta-analysis*, Educational Research
  Review 17. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5576760/
- Dinçer (2022), *The voice effect in multimedia instruction revisited: Does
  it still exist?*, Journal of Pedagogical Research 6(3).
  https://www.ijopr.com/article/the-voice-effect-in-multimedia-instruction-revisited-does-it-still-exist-12116
- Defeyter, Russo & McPartlin (2009), *The picture superiority effect in
  recognition memory*, Cognitive Development 24(3).
  https://www.sciencedirect.com/science/article/abs/pii/S0885201409000471
- Reber, Schwarz & Winkielman (2004), *Processing fluency and aesthetic
  pleasure: Is beauty in the perceiver's processing experience?*,
  Personality and Social Psychology Review.
  https://journals.sagepub.com/doi/10.1207/s15327957pspr0804_3

Thin-evidence flags for this section: audio/podcast effectiveness data is
mostly advertiser-funded (Nielsen, Edison Research) rather than
peer-reviewed; the decorative-imagery and voice findings extrapolate from
instructional research; no marketing-specific meta-analysis compares
interactive demos to passive video.

## Supporting adoption-model sources

The stage model and audience claims in [Marketing by Funnel Stage](./marketing-funnel-stages.md) and
[Marketing by Audience Segment](./marketing-audience-segments.md) rest primarily on:

- Davis (1989), *Perceived Usefulness, Perceived Ease of Use, and User
  Acceptance of Information Technology*, MIS Quarterly.
  https://cir.nii.ac.jp/crid/1362544419898410624
- Marikyan, Papagiannidis & Stewart, *Technology acceptance research:
  Meta-analysis*.
  https://journals.sagepub.com/doi/10.1177/01655515231191177
- Bhattacherjee (2001), *Understanding information systems continuance: An
  expectation-confirmation model*, MIS Quarterly.
  https://www.peeref.com/works/73590660
- Goodhue & Thompson (1995), *Task-Technology Fit and Individual
  Performance*, MIS Quarterly.
  https://www.econbiz.de/Record/task-technology-fit-and-individual-performance-goodhue-dale/10006533503
- Webster & Wind (1972), *A General Model for Understanding Organizational
  Buying Behavior*, Journal of Marketing.
  https://journals.sagepub.com/doi/10.1177/002224297203600204
- Kohli (1989), *Determinants of Influence in Organizational Buying: A
  Contingency Approach*, Journal of Marketing.
  https://journals.sagepub.com/doi/10.1177/002224298905300307
- Forsgren et al. (2021), *The SPACE of Developer Productivity*, ACM Queue.
  https://doi.org/10.1145/3454122.3454124
- *The Effects of Generative AI on High-Skilled Work: Evidence from Three
  Field Experiments with Software Developers*, Management Science (~26%
  average uplift, larger for less experienced developers).
  https://pubsonline.informs.org/doi/10.1287/mnsc.2025.00535
- METR (2025), *Measuring the Impact of Early-2025 AI on Experienced
  Open-Source Developer Productivity* (19% slowdown for experienced
  developers on familiar repositories).
  https://www.alphaxiv.org/overview/2507.09089
- *Grounded Copilot: How Programmers Interact with Code-Generating Models*
  (acceleration vs. exploration modes).
  https://cir.nii.ac.jp/crid/1360306914229816192

Three claims from the underlying research synthesis lacked recoverable
citations — UTAUT, the METR 2026 update, and a distinct Melnyk 2021 entry —
and are flagged rather than cited above. (The 2025 loss-aversion
re-meta-analysis, previously in this list, has since been recovered:
Yechiam & Zeif 2025, cited above.)

## See also

- [Technology Marketing](./index.md) — the hub.
- [Marketing Message Checklist](./marketing-message-checklist.md) — these verdicts as red-flag checks.
- [Executing in Your Medium](./marketing-medium-execution.md) — the media
  claims below turned into per-medium production rules.
- [Marketing by Funnel Stage](./marketing-funnel-stages.md) — where each surviving lever belongs in the
  funnel.
