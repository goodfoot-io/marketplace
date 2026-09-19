---
name: parallel
description: Fan a set of tasks out to multiple subagents as a single parallel
  batch. Use when the user says "run these in parallel", "fan this out", "split
  this across agents", or names several independent pieces of work to be done at
  once.
---

<user-request>
$ARGUMENTS
</user-request>

<instructions>

## 1. Derive the Inputs

Take [REQUEST] from the user's message — the `<user-request>` block above on Claude Code, otherwise the message that invoked this skill — or from the conversation when the message is thin. Read from [REQUEST]:

- [TASKS] — distinct pieces of work for subagents to perform. Each [TASKS][i] is one piece. Required.
- [SUBAGENT_COUNT] — how many subagents to run. Optional; derive it in Step 4.
- [SUBAGENT_TYPE] — the subagent type to dispatch. Optional; default `general-purpose`.
- [SUBAGENT_TIER] — the model or effort tier for the subagents. Optional; derive it in Step 3.

Then derive, for each subagent j:

- [SUBAGENT_INSTRUCTIONS][j] — instructions drawn from one or more [TASKS][i].
- [SUBAGENT_CONTEXT][j] — the technical context that subagent needs, built in Step 5.
- [SUBAGENT_DESCRIPTION][j] — a short semantic name.

All three have length [SUBAGENT_COUNT].

## 2. Determine the Redundancy Level

Set [REDUNDANCY_LEVEL] — how many subagents perform each [TASKS][i]:

- **Stated in the request** ("two subagents per component"): use that value.
- **Subdivisions exist**: [REDUNDANCY_LEVEL] = 1.
- **No subdivisions, no statement**: [REDUNDANCY_LEVEL] = [SUBAGENT_COUNT].

Distribute accordingly:

- **[REDUNDANCY_LEVEL] > 1**: assign each [TASKS][i] to that many subagents, so [SUBAGENT_COUNT] = (number of [TASKS] items × [REDUNDANCY_LEVEL]).
- **[REDUNDANCY_LEVEL] = 1, items ≤ [SUBAGENT_COUNT]**: assign each [TASKS][i] to one subagent.
- **[REDUNDANCY_LEVEL] = 1, items > [SUBAGENT_COUNT]**: distribute the items evenly, so each [SUBAGENT_INSTRUCTIONS][j] covers several [TASKS][i].

## 3. Select the Model or Effort Tier

Determine [SUBAGENT_TIER]:

- **Stated in the request** ("using haiku", "with sonnet agents"): use that value.
- **Not stated**: default to the fast tier.

Assign the capable tier only for work that involves:

- Code analysis, review, or understanding an existing implementation.
- Technical documentation needing deep context or system knowledge.
- Research involving investigation, comparison, or synthesis.
- Planning, design, or strategic decision-making.
- Multi-step reasoning or complex problem-solving.
- Comprehensive reports or structured technical content.

Keep the fast tier for straightforward execution: file creation, counting, basic text operations, simple data manipulation.

On Claude Code these tiers are the `haiku` and `sonnet` models.

## 4. Determine the Subagent Count

When the request does not state [SUBAGENT_COUNT]:

- **Subdivision detected**: the number of items found ("English, Spanish, and French" → 3).
- **Singular task**: 1 ("create a summary" → 1).
- **Singular task with an explicit count**: the stated count, which triggers redundancy ("3 agents create a summary" → 3).
- **Ambiguous**: 3, then investigate.

Subdivision signals — create one [TASKS][i] per distinct item:

- **Keywords**: "each", "all", "every", "different".
- **Plural references**: files, sections, plugins.
- **Enumerations**: "English, Spanish, and French".
- **Explicit instruction**: "for each section".

When no signal is explicit, investigate — read files, search the codebase — to discover the items. Natural subdivisions take priority over a user-specified count; mixed signals (plural plus an explicit count) distribute the items across that count.

## 5. Build Each Subagent's Context

Subagents start with zero context from this conversation. Build [SUBAGENT_CONTEXT][j] from semantic XML tags with kebab-case names that describe what each block holds, and use FULL ABSOLUTE PATHS starting from the repository root in every tag — relative paths cause subagent failure. Keep the content concise while making the context complete.

## 6. Dispatch

Spawn `General-purpose` subagents in parallel

Give each subagent [SUBAGENT_DESCRIPTION][j] as its name, [SUBAGENT_CONTEXT][j] as context, and [SUBAGENT_INSTRUCTIONS][j] as its instructions. Replace `general-purpose` with [SUBAGENT_TYPE] when the request names a different type.

Send every dispatch in a SINGLE message so they run simultaneously. Never launch them sequentially.

## 7. Worked Examples

### Subdivided task

"Instruct five `code-review` subagents to determine the validity of each item in `example-new-feature-plan.md`":

- [TASKS][1..5] — determine the validity of Sections 2 through 6 respectively.
- [REDUNDANCY_LEVEL] = 1; [SUBAGENT_COUNT] = 5; [SUBAGENT_TYPE] = `code-review`; [SUBAGENT_TIER] = capable, because the work is code analysis and technical evaluation.

From [TASKS][1]:

- [SUBAGENT_INSTRUCTIONS][1] = Review Section 2 "Database Schema" in `/workspace/documentation/example-new-feature-plan.md`. Evaluate technical soundness and compatibility with `/workspace/packages/api/src/auth/session-manager.ts`.
- [SUBAGENT_DESCRIPTION][1] = `database-schema-review`
- [SUBAGENT_CONTEXT][1] =

```
<current-state>
Database schema defined in `/workspace/packages/api/src/db/schema.sql` with columns: id, user_id, token, created_at. Referenced by session cleanup job and validation middleware.
</current-state>

<requirements>
Migration requires adding expires_at and refresh_token_hash columns. Must maintain compatibility with existing cleanup jobs in `/workspace/packages/api/src/auth/session-cleanup.ts`.
</requirements>
```

From [TASKS][2]:

- [SUBAGENT_INSTRUCTIONS][2] = Review Section 3 "API Changes" in `/workspace/documentation/example-new-feature-plan.md`. Assess backward compatibility and versioning strategy.
- [SUBAGENT_DESCRIPTION][2] = `api-changes-review`
- [SUBAGENT_CONTEXT][2] =

```
<current-state>
API endpoints in `/workspace/packages/api/src/routes/auth.ts` use Passport.js v0.6.0: POST /login, POST /refresh, POST /logout.
</current-state>

<migration-impact>
Migration to @auth/core v0.18.0 changes request/response formats. Client SDKs in `/workspace/packages/client-sdk/` require compatibility updates.
</migration-impact>
```

"Each item" triggers subdivision into five [TASKS] with [REDUNDANCY_LEVEL] = 1 — five dispatches in total.

### Redundant task

"Instruct two `code-review` subagents to determine the validity of `example-new-feature-plan.md`":

- [TASKS][1] — determine the validity of the complete feature plan.
- [REDUNDANCY_LEVEL] = 2; [SUBAGENT_COUNT] = 2; [SUBAGENT_TYPE] = `code-review`; [SUBAGENT_TIER] = capable.

Both subagents receive identical, complete [SUBAGENT_INSTRUCTIONS][1] — reviewing `/workspace/documentation/example-new-feature-plan.md` against `/workspace/packages/api/` and `/workspace/packages/website/` — and identical [SUBAGENT_CONTEXT][1]:

```
<performance-issues>
Authentication endpoints show p99 latency of 2.8s at 10K users. PostgreSQL connection pool exhaustion (max_connections=100) and synchronous bcrypt hashing in `/workspace/packages/api/src/auth/password.ts` are primary bottlenecks. PagerDuty recorded 3 timeout incidents in 2 weeks.
</performance-issues>

<proposed-solution>
Plan proposes bcrypt v5.1.1 → @node-rs/bcrypt v1.9.0 (native bindings) and connection pooling with pg-pool v3.6.1. Changes affect `/workspace/packages/api/src/auth/password.ts`.
</proposed-solution>
```

The singular "plan" triggers redundancy: one [TASKS] item, [REDUNDANCY_LEVEL] = 2, two dispatches with deliberately identical payloads.

### Enumerated task

"Create three text files with simple greetings in different languages: English, Spanish, and French":

- [TASKS][1..3] — create the English, Spanish, and French greeting files.
- [REDUNDANCY_LEVEL] = 1; [SUBAGENT_COUNT] = 3; [SUBAGENT_TYPE] = `general-purpose`; [SUBAGENT_TIER] = fast, because this is simple file creation.

From [TASKS][1]:

- [SUBAGENT_INSTRUCTIONS][1] = Create a text file at `/workspace/greetings/english.txt` containing a friendly greeting in English (one sentence).
- [SUBAGENT_DESCRIPTION][1] = `create-english-greeting`
- [SUBAGENT_CONTEXT][1] =

```
<task-requirements>
File path: `/workspace/greetings/english.txt`
Content: Single sentence greeting in English
Format: Plain text
</task-requirements>
```

The explicit enumeration "English, Spanish, and French" triggers subdivision into three dispatches.

</instructions>
