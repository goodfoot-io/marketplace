---
description: Run tasks in parallel
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

<user-message>
$ARGUMENTS
</user-message>

Use the `Task()` tool to launch subagents.

<input-format>
The `<user-message>` will describe the following inputs:
- [TASKS]: Array of distinct tasks for subagents to perform. Each [TASKS][i] represents one distinct piece of work. (required)
- [SUBAGENT_COUNT]: The number of subagents to perform the [TASKS]. (optional, default 3)
- [SUBAGENT_TYPE]: The `subagent_type` to use when invoking the Task tool function. (optional, default "goodfoot:simple")
- [SUBAGENT_MODEL]: The model to use for the subagents. (optional, auto-detected if not specified)

You should derive the following from the provided inputs:
- [REDUNDANCY_LEVEL]: How many subagents should perform each [TASKS][i] (default 1)
- [SUBAGENT_MODEL]: If not explicitly specified, automatically determine based on task complexity (see `<model-selection>` section)

Then, create [SUBAGENT_COUNT] subagents, where each subagent requires:
- [SUBAGENT_INSTRUCTIONS][j]: Instructions derived from one or more [TASKS][i] items
- [SUBAGENT_CONTEXT][i]: Technical context required to perform [TASKS][i], from your understanding of the situation, structured with semantic XML tags (see `<subagent-context>` section)
- [SUBAGENT_DESCRIPTION][i]: Short semantic name for this subagent

All three arrays have length = [SUBAGENT_COUNT].
</input-format>

<redundancy-level>

## Determining [REDUNDANCY_LEVEL]

1. If explicitly stated in user message (e.g., "two subagents per component"): use that value
2. If subdivisions exist: [REDUNDANCY_LEVEL] = 1
3. Otherwise: [REDUNDANCY_LEVEL] = [SUBAGENT_COUNT]

## Distribution Rules

- When [REDUNDANCY_LEVEL] > 1: Each [TASKS][i] is assigned to [REDUNDANCY_LEVEL] subagents (redundant execution). Typically [SUBAGENT_COUNT] = (number of [TASKS] items × [REDUNDANCY_LEVEL]).
- When [REDUNDANCY_LEVEL] = 1 and (number of [TASKS] items) ≤ [SUBAGENT_COUNT]: Each [TASKS][i] is assigned to one subagent
- When [REDUNDANCY_LEVEL] = 1 and (number of [TASKS] items) > [SUBAGENT_COUNT]: Distribute [TASKS] items evenly across [SUBAGENT_COUNT] subagents (each [SUBAGENT_INSTRUCTIONS][j] encompasses multiple [TASKS] items)
</redundancy-level>

<model-selection>
Determine [SUBAGENT_MODEL]:

1. **If explicitly specified** (e.g., "using haiku", "with sonnet agents"): use that value
2. **If not specified**: default to "haiku"

**Upgrade to "sonnet"** only when tasks require:
- Code analysis, review, or understanding existing implementations
- Technical documentation requiring deep context or system knowledge
- Research involving investigation, comparison, or synthesis
- Planning, design, or strategic decision-making
- Multi-step reasoning or complex problem-solving
- Generating comprehensive reports or structured technical content

**Keep "haiku"** for straightforward execution tasks like file creation, counting, basic text operations, or simple data manipulation.
</model-selection>

<task-subdivision-logic>
## Detecting Subdivisions

**Subdivision signals** (create one [TASKS][i] per distinct item):
- Keywords: "each", "all", "every", "different"
- Plural references: "files", "sections", "plugins"
- Enumerations: "English, Spanish, and French"
- Explicit instructions: "for each section"

**If not explicit:** Investigate (read files, search codebase) to discover items.

## Determining [SUBAGENT_COUNT]

When not explicitly specified:
- **Subdivision detected:** Count = number of items found (e.g., "English, Spanish, French" → 3)
- **Singular task:** Count = 1 (e.g., "create a summary" → 1)
- **Singular + explicit count:** Count = specified, triggers redundancy (e.g., "3 agents create a summary" → 3)
- **Ambiguous:** Count = 3, then investigate

**Priority:** Natural subdivisions override user-specified count. Mixed signals (plural + explicit count) → distribute items across specified count.
</task-subdivision-logic>

<subagent-context>
Subagents have ZERO context from this conversation. Use FULL ABSOLUTE PATHS starting with `/workspace/` in all semantic tags. Relative paths cause subagent failure.

Structure [SUBAGENT_CONTEXT] using semantic XML tags that organize technical details into logical categories. Use kebab-case tag names that clearly describe the content type. Keep content concise while providing complete technical context. See examples for tag usage patterns.
</subagent-context>

<example>
If the `<user-message>` is "Instruct five "code-review" subagents to determine the validity of each item in `example-new-feature-plan.md`", then:
- [TASKS][1] = Determine validity of Section 2 "Database Schema"
- [TASKS][2] = Determine validity of Section 3 "API Changes"
- [TASKS][3] = Determine validity of Section 4 "Testing Strategy"
- [TASKS][4] = Determine validity of Section 5 "Deployment"
- [TASKS][5] = Determine validity of Section 6 "Monitoring"
- [REDUNDANCY_LEVEL] = 1
- [SUBAGENT_COUNT] = 5 (5 tasks × 1 redundancy)
- [SUBAGENT_TYPE] = "code-review"
- [SUBAGENT_MODEL] = "sonnet" (auto-detected: tasks require code analysis and technical evaluation)

Derived from [TASKS][1]:
- [SUBAGENT_INSTRUCTIONS][1] = Review Section 2 "Database Schema" in `/workspace/documentation/example-new-feature-plan.md`. Evaluate technical soundness and compatibility with `/workspace/packages/api/src/auth/session-manager.ts`.
- [SUBAGENT_DESCRIPTION][1] = "database-schema-review"
- [SUBAGENT_CONTEXT][1] =
```
<current-state>
Database schema defined in `/workspace/packages/api/src/db/schema.sql` with columns: id, user_id, token, created_at. Referenced by session cleanup job and validation middleware.
</current-state>

<requirements>
Migration requires adding expires_at and refresh_token_hash columns. Must maintain compatibility with existing cleanup jobs in `/workspace/packages/api/src/auth/session-cleanup.ts`.
</requirements>
```

Derived from [TASKS][2]:
- [SUBAGENT_INSTRUCTIONS][2] = Review Section 3 "API Changes" in `/workspace/documentation/example-new-feature-plan.md`. Assess backward compatibility and versioning strategy.
- [SUBAGENT_DESCRIPTION][2] = "api-changes-review"
- [SUBAGENT_CONTEXT][2] =
```
<current-state>
API endpoints in `/workspace/packages/api/src/routes/auth.ts` use Passport.js v0.6.0: POST /login, POST /refresh, POST /logout.
</current-state>

<migration-impact>
Migration to @auth/core v0.18.0 changes request/response formats. Client SDKs in `/workspace/packages/client-sdk/` require compatibility updates.
</migration-impact>
```

Derived from [TASKS][3]:
- [SUBAGENT_INSTRUCTIONS][3] = Review Section 4 "Testing Strategy" in `/workspace/documentation/example-new-feature-plan.md`. Evaluate test coverage and approach.
- [SUBAGENT_DESCRIPTION][3] = "testing-strategy-review"
- [SUBAGENT_CONTEXT][3] =
```
<current-state>
Test suite in `/workspace/packages/api/tests/auth/` covers login flows. Load tests reveal memory leaks after 48 hours.
</current-state>

<requirements>
Migration requires tests for token refresh cycles, session expiration, and backward compatibility.
</requirements>
```

Derived from [TASKS][4]:
- [SUBAGENT_INSTRUCTIONS][4] = Review Section 5 "Deployment" in `/workspace/documentation/example-new-feature-plan.md`. Assess rollout strategy and risk mitigation.
- [SUBAGENT_DESCRIPTION][4] = "deployment-review"
- [SUBAGENT_CONTEXT][4] =
```
<environment>
Production runs 5 instances behind ALB using Kubernetes v1.28 with rolling updates. Zero-downtime deployment requires blue-green strategy.
</environment>

<constraints>
Database migrations in `/workspace/packages/api/migrations/` must be reversible with session data accessible during rollback.
</constraints>
```

Derived from [TASKS][5]:
- [SUBAGENT_INSTRUCTIONS][5] = Review Section 6 "Monitoring" in `/workspace/documentation/example-new-feature-plan.md`. Evaluate observability and alerting approach.
- [SUBAGENT_DESCRIPTION][5] = "monitoring-review"
- [SUBAGENT_CONTEXT][5] =
```
<current-state>
DataDog APM tracks authentication metrics: login_success_rate, token_refresh_rate, session_duration. Alerts configured for auth_failure_rate > 5%.
</current-state>

<requirements>
Migration requires new metrics: memory usage during token refresh, session table growth, OAuth2 error rates.
</requirements>
```

**Note: "each item" triggers subdivision into 5 [TASKS] items with [REDUNDANCY_LEVEL]=1. Total: 5 Task() calls (5 tasks × 1 agent per task).**
</example>

<example>
If the `<user-message>` is "Instruct two "code-review" subagents to determine the validity of `example-new-feature-plan.md`", then:
- [TASKS][1] = Determine validity of complete feature plan
- [REDUNDANCY_LEVEL] = 2 (2 subagents perform the same task)
- [SUBAGENT_COUNT] = 2 (1 task × 2 agents per task)
- [SUBAGENT_TYPE] = "code-review"
- [SUBAGENT_MODEL] = "sonnet" (auto-detected: task requires technical feasibility analysis and recommendations)

Derived from [TASKS][1] (agent 1):
- [SUBAGENT_INSTRUCTIONS][1] = Review the complete feature plan in `/workspace/documentation/example-new-feature-plan.md`. Evaluate technical feasibility, compatibility with `/workspace/packages/api/` and `/workspace/packages/website/`, and provide recommendations.
- [SUBAGENT_DESCRIPTION][1] = "feature-plan-review-1"
- [SUBAGENT_CONTEXT][1] =
```
<performance-issues>
Authentication endpoints show p99 latency of 2.8s at 10K users. PostgreSQL connection pool exhaustion (max_connections=100) and synchronous bcrypt hashing in `/workspace/packages/api/src/auth/password.ts` are primary bottlenecks. PagerDuty recorded 3 timeout incidents in 2 weeks.
</performance-issues>

<proposed-solution>
Plan proposes bcrypt v5.1.1 → @node-rs/bcrypt v1.9.0 (native bindings) and connection pooling with pg-pool v3.6.1. Changes affect `/workspace/packages/api/src/auth/password.ts`.
</proposed-solution>
```

Derived from [TASKS][1] (agent 2):
- [SUBAGENT_INSTRUCTIONS][2] = Review the complete feature plan in `/workspace/documentation/example-new-feature-plan.md`. Evaluate technical feasibility, compatibility with `/workspace/packages/api/` and `/workspace/packages/website/`, and provide recommendations.
- [SUBAGENT_DESCRIPTION][2] = "feature-plan-review-2"
- [SUBAGENT_CONTEXT][2] =
```
<performance-issues>
Authentication endpoints show p99 latency of 2.8s at 10K users. PostgreSQL connection pool exhaustion (max_connections=100) and synchronous bcrypt hashing in `/workspace/packages/api/src/auth/password.ts` are primary bottlenecks. PagerDuty recorded 3 timeout incidents in 2 weeks.
</performance-issues>

<proposed-solution>
Plan proposes bcrypt v5.1.1 → @node-rs/bcrypt v1.9.0 (native bindings) and connection pooling with pg-pool v3.6.1. Changes affect `/workspace/packages/api/src/auth/password.ts`.
</proposed-solution>
```

**Note: Singular "plan" triggers redundancy - 1 [TASKS] with [REDUNDANCY_LEVEL]=2. Total: 2 Task() calls (1 task × 2 agents per task) with identical instructions and context.**
</example>

<example>
If the `<user-message>` is "Create three text files with simple greetings in different languages: English, Spanish, and French", then:
- [TASKS][1] = Create text file with English greeting
- [TASKS][2] = Create text file with Spanish greeting
- [TASKS][3] = Create text file with French greeting
- [REDUNDANCY_LEVEL] = 1
- [SUBAGENT_COUNT] = 3 (3 tasks × 1 agent per task)
- [SUBAGENT_TYPE] = "general-purpose"
- [SUBAGENT_MODEL] = "haiku" (auto-detected: tasks are simple file creation with short text content)

Derived from [TASKS][1]:
- [SUBAGENT_INSTRUCTIONS][1] = Create a text file at `/workspace/greetings/english.txt` containing a friendly greeting in English (one sentence).
- [SUBAGENT_DESCRIPTION][1] = "create-english-greeting"
- [SUBAGENT_CONTEXT][1] =
```
<task-requirements>
File path: `/workspace/greetings/english.txt`
Content: Single sentence greeting in English
Format: Plain text
</task-requirements>
```

Derived from [TASKS][2]:
- [SUBAGENT_INSTRUCTIONS][2] = Create a text file at `/workspace/greetings/spanish.txt` containing a friendly greeting in Spanish (one sentence).
- [SUBAGENT_DESCRIPTION][2] = "create-spanish-greeting"
- [SUBAGENT_CONTEXT][2] =
```
<task-requirements>
File path: `/workspace/greetings/spanish.txt`
Content: Single sentence greeting in Spanish
Format: Plain text
</task-requirements>
```

Derived from [TASKS][3]:
- [SUBAGENT_INSTRUCTIONS][3] = Create a text file at `/workspace/greetings/french.txt` containing a friendly greeting in French (one sentence).
- [SUBAGENT_DESCRIPTION][3] = "create-french-greeting"
- [SUBAGENT_CONTEXT][3] =
```
<task-requirements>
File path: `/workspace/greetings/french.txt`
Content: Single sentence greeting in French
Format: Plain text
</task-requirements>
```

**Note: Explicit enumeration "English, Spanish, and French" triggers subdivision. Simple file creation tasks auto-select haiku model. Total: 3 Task() calls.**
</example>

Combine all `Task()` calls into a single message to execute simultaneously:

```xml
<!-- For each i from 1 to [SUBAGENT_COUNT]: -->
<invoke name="Task">
<parameter name="description">[SUBAGENT_DESCRIPTION][1]</parameter>
<parameter name="subagent_type">[SUBAGENT_TYPE]</parameter>
<parameter name="model">[SUBAGENT_MODEL]</parameter>
<parameter name="prompt">
[SUBAGENT_CONTEXT][1]
<instructions>
[SUBAGENT_INSTRUCTIONS][1]
</instructions>
</parameter>
</invoke>

<invoke name="Task">
<parameter name="description">[SUBAGENT_DESCRIPTION][2]</parameter>
<parameter name="subagent_type">[SUBAGENT_TYPE]</parameter>
<parameter name="model">[SUBAGENT_MODEL]</parameter>
<parameter name="prompt">
[SUBAGENT_CONTEXT][2]
<instructions>
[SUBAGENT_INSTRUCTIONS][2]
</instructions>
</parameter>
</invoke>

<!-- ... continue for all [SUBAGENT_COUNT] agents -->
```



