# Comprehension

Mechanism: users must form a workable mental model before valuing the product. Expertise reversal: support that helps novices (worked examples, templates, guided prompts) actively hurts experts, who experience it as noise.

Do:
- Split paths early: "new to X?" vs "migrating from Y?" — never one narrative for both.
- Novices: one worked example, zero to a completed real task.
- Experts: the mental model in one paragraph, then reference material. Cut hand-holding.
- Show failure modes, not just the happy path — an accurate mental model includes when the tool is wrong.
- Prefer static annotated artifacts (screenshots, diffs, reference docs) for experts and dense material; dynamic demos only where the content itself is dynamic.

Don't:
- One-size-fits-all onboarding.
- Flashy demo video where a static annotated example carries more information.
- Hide limitations — the mental model breaks later at higher cost.

Example:
- ✗ One quickstart for everyone: "Acme is a next-generation semantic engine. Read the architecture overview to begin."
- ✓ "New to Acme? Point it at a failing test; it proposes a diff, you approve. Coming from X? Your x.yaml maps one-to-one — table below. (It won't help with cross-repo refactors — see Limits.)"
