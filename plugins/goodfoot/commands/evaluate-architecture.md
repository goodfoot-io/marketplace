---
description: Evaluate architecture by comparing user-facing promises against technical implementation
argument-hint: <focus-area> <user-docs> <technical-docs>
disable-model-invocation: true
---

<user-message>
$ARGUMENTS
</user-message>

<placeholder-variables>

Extract from the `<user-message>`:

[FOCUS_AREA] — Feature, capability, or domain to evaluate
[USER_PERSPECTIVE] — User-facing documents: docs, READMEs, guides, marketing
[SYSTEM_PERSPECTIVE] — Technical documents: source code, architecture docs, API specs
[ALICE_REPORT_FILE] — Output path for Alice's user journey (default: reports/alice-user-journey-YYYYMMDD-HHMMSS.md)
[BOB_REPORT_FILE] — Output path for Bob's implementation trace (default: reports/bob-implementation-trace-YYYYMMDD-HHMMSS.md)

</placeholder-variables>

<instructions>

# Objective

Find **implementation gaps** where user documentation promises capabilities that the code doesn't fully support. Prioritize gaps that require code changes over documentation-only fixes.

# Phase 1: User Journey

Invoke `Alice` to describe what users expect based on [USER_PERSPECTIVE].

```xml
<invoke name="Task">
<parameter name="subagent_type">goodfoot:Alice</parameter>
<parameter name="prompt">
Describe the user journey for [FOCUS_AREA] using: [USER_PERSPECTIVE]
Write to [ALICE_REPORT_FILE].
</parameter>
</invoke>
```

# Phase 2: Implementation Trace

Invoke `Bob` to trace Alice's journey through [SYSTEM_PERSPECTIVE], marking gaps.

```xml
<invoke name="Task">
<parameter name="subagent_type">goodfoot:Bob</parameter>
<parameter name="prompt">
Trace @[ALICE_REPORT_FILE] through: [SYSTEM_PERSPECTIVE]

Classify each gap:
- **Implementation gap**: Code doesn't support documented capability (PRIORITY)
- **Documentation gap**: Docs don't match what code does

Write to [BOB_REPORT_FILE].
</parameter>
</invoke>
```

# Phase 3: Address Gaps

Review [BOB_REPORT_FILE]. For each **implementation gap**, make the code change. Update documentation only after implementation is complete.

</instructions>
