---
description: Evaluate architecture by comparing user-facing promises against technical implementation
argument-hint: <focus-area> <user-docs> <technical-docs>
---

<user-message>
$ARGUMENTS
</user-message>

<placeholder-variables>

Extract from the `<user-message>`:

[FOCUS_AREA] — Feature, capability, or domain to evaluate (e.g., "user authentication", "checkout flow", "notification system"); if unspecified, select a high-impact user journey or core technical component
[USER_PERSPECTIVE] — User-facing documents describing external behavior: PRDs, marketing pages, READMEs, onboarding guides, feature announcements, app store descriptions
[SYSTEM_PERSPECTIVE] — Technical documents describing internal implementation: source code files, architecture docs, API specifications, database schemas, technical design documents
[ALICE_REPORT_FILE] — Output path for Alice's user journey narrative (markdown file on local filesystem)
[BOB_REPORT_FILE] — Output path for Bob's technical trace with gap analysis (markdown file on local filesystem)

</placeholder-variables>

<instructions>

# Phase 1

Briefly review both [USER_PERSPECTIVE] and [SYSTEM_PERSPECTIVE] to orient yourself on [FOCUS_AREA].

# Phase 2

Invoke an `Alice` subagent to describe the user journey for [FOCUS_AREA]. Provide her with [USER_PERSPECTIVE] and ask her to write the journey narrative to [ALICE_REPORT_FILE].

```xml
<invoke name="Task">
<parameter name="description">Describe [FOCUS_AREA] user journey</parameter>
<parameter name="subagent_type">Alice</parameter>
<parameter name="prompt">
Describe the user journey for [FOCUS_AREA] using only these documents: [USER_PERSPECTIVE]

Write your narrative to [ALICE_REPORT_FILE].
</parameter>
</invoke>
```

# Phase 3

Invoke a `Bob` subagent to trace Alice's journey through the implementation. Provide him with [ALICE_REPORT_FILE], [SYSTEM_PERSPECTIVE], and [FOCUS_AREA]. Ask him to write the technical trace to [BOB_REPORT_FILE].

```xml
<invoke name="Task">
<parameter name="description">Trace [FOCUS_AREA] implementation</parameter>
<parameter name="subagent_type">Bob</parameter>
<parameter name="prompt">
Trace the user journey in @[ALICE_REPORT_FILE] through these documents: [SYSTEM_PERSPECTIVE]

Mark gaps with <gap> tags. Write your trace to [BOB_REPORT_FILE].
</parameter>
</invoke>
```

# Phase 4

Review [BOB_REPORT_FILE] and recommend changes to [SYSTEM_PERSPECTIVE] to address the gaps identified.

</instructions>