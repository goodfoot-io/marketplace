---
name: prove-it
description: Launch several subagents to critically evaluate a plan or piece of
  work, then synthesize their findings. Use when the user says "prove it", "poke
  holes in this", "get other opinions", or presents a plan that warrants
  adversarial review before committing to it.
---

<instructions>

## 1. Derive the Inputs

Take [REQUEST] from the user's message — the `<user-request>` block above on Claude Code, otherwise the message that invoked this skill. It carries optional guidance on response format or style. Infer from the conversation:

- [TASKS] — what the subagents should do. Typically the critical evaluation of a plan or piece of work presented recently. Default: "Critically evaluate the presented plan or work. Aim for collaborative improvement — small adjustments if that is all that is needed, but remain open to larger ideas or complete rewrites if they better serve the goals. Other subagents are performing the same evaluation. The coordinator will synthesize your input, and the user makes final decisions."
- [AGENT_COUNT] — how many subagents to run, inferred from the complexity and scope of the work or stated by the user. Default 3.
- [SUBAGENT_TYPE] — the subagent type to dispatch, inferred from the kind of work. Optional; default `general-purpose`.

Then derive:

- [TASK] — one subagent's task, drawn from [TASKS]. Give it every necessary detail with FULL ABSOLUTE PATHS (e.g. `/workspace/packages/api/src/file.ts`, never `./src/file.ts`). Subagents know nothing of this conversation or the working directory.
- [TASK_NAME] — a short semantic name such as `review-auth-component`. When [REDUNDANCY_LEVEL] > 1, append numbers: `task-name-1`, `task-name-2`, and so on.
- [REDUNDANCY_LEVEL] — how many subagents perform each [TASK]. Default 1.
- [TASK_CONTEXT] — the technical details the subagents need, drawn from the conversation with FULL ABSOLUTE PATHS: package versions, metrics, incidents, architecture constraints, file locations, affected paths, recent changes, and the plan as presented.

## 2. Subdivide the Work

- **Subdivision triggers**: "each", "all", "every", plural references (files, components), or an explicit instruction to subdivide.
- **Singular reference without a trigger** ("file", "plan"): redundancy — several subagents on the same task.
- **Natural subdivisions outrank** [AGENT_COUNT].
- **Investigate as needed** to discover the items: read files, dispatch a `codebase-analysis` subagent, run tests, search the codebase.

Total dispatches = (number of distinct [TASK] items × [REDUNDANCY_LEVEL]).

## 3. Distribute the Work

Derive [REDUNDANCY_LEVEL]:

- **Stated by the user** ("each component should be reviewed by two agents"): use that value.
- **Subdivisions exist, no redundancy stated**: [REDUNDANCY_LEVEL] = 1.
- **No subdivisions, several agents requested**: [REDUNDANCY_LEVEL] = [AGENT_COUNT].

Then distribute:

- **Items < [AGENT_COUNT]**: lower [AGENT_COUNT] to match the item count.
- **Items > [AGENT_COUNT]**: distribute evenly, assigning the remainder to the later subagents.
- [AGENT_COUNT] is advisory — respect natural subdivisions even when that changes the final number.

## 4. Dispatch

Spawn `general-purpose` sub-agents in parallel (`spawn_agent` with `agent_type: general-purpose`)

Give each subagent [TASK_NAME] as its name, [TASK] as the work, and [TASK_CONTEXT] as context, and close with this instruction:

"Critically evaluate this work. Think intensely about the problem and aim for collaborative improvement. If small adjustments suffice, propose them; if larger ideas or rewrites better serve the goals, do not hesitate to suggest them. Other subagents are performing parallel evaluations, and I will synthesize all input before making final decisions."

Replace `general-purpose` with [SUBAGENT_TYPE] when the work calls for a different type. Send every dispatch in a SINGLE message so they run simultaneously — never launch sequentially.

**Every [TASK] and [TASK_CONTEXT] must use full absolute paths** starting from the repository root, carrying line numbers, complete file paths, and directory locations. Write a location like this:

```
/workspace/packages/api/src/auth.ts:45
```

Relative paths such as `./src/` or `../lib/` cause subagent failure.

## 5. Worked Examples

### Subdivided by document structure

After developing a 5-phase authentication migration plan in `/workspace/docs/auth-migration-plan.md`, the user says "Validate this approach":

- [TASKS] — critically evaluate each phase for technical feasibility and risk, inferred from the plan's structure.
- [TASK] — evaluate Phase 2, "Session Schema Migration" (lines 45-78), in `/workspace/docs/auth-migration-plan.md`. Assess whether the proposed PostgreSQL schema changes (adding `expires_at` and `refresh_token_hash` columns) are compatible with the existing session manager in `/workspace/packages/api/src/auth/session-manager.ts`. Evaluate the migration strategy for preserving existing user sessions, potential breaking changes to the session cleanup cron job in `/workspace/db/cron/session-cleanup.sql`, and data integrity risks during the migration window.
- [TASK_NAME] = `phase-2-schema-migration`; [AGENT_COUNT] = 5; [SUBAGENT_TYPE] = `code-review`; [REDUNDANCY_LEVEL] = 1.
- [TASK_CONTEXT] — load testing showed the current Passport.js v0.6.0 implementation leaking memory during OAuth2 refresh token cycles (2.3GB RAM after 48 hours). Migration targets @auth/core v0.18.0 with PostgreSQL session schema changes. The current stack uses express-session v1.17.3 with connect-pg-simple v9.0.0 in `/workspace/packages/api/src/auth/middleware.ts`. Preliminary analysis shows 23 files across the monorepo require updates. The pg_cron session cleanup job may break with the schema changes, risking session accumulation in production.

Reading the plan reveals five distinct phases, so five tasks and five dispatches.

### Subdivided by discovered files

After preparing middleware documentation drafts in `/workspace/docs/drafts/`, the user says "Review the middleware docs":

- [TASKS] — critically evaluate each draft for completeness and technical accuracy.
- [TASK] — review the authentication middleware documentation at `/workspace/docs/drafts/auth-middleware.md` for `/workspace/packages/website/server/middleware/auth.ts`. Evaluate the completeness of the function documentation (`validateJWT`, `refreshToken`, `handleAuthError`), its accuracy against the implementation, the clarity of the JWT token flow explanation, the coverage of Redis caching integration with `/workspace/packages/website/server/cache/redis.ts`, the error handling patterns, and whether the security considerations are adequate. Verify the type references to `/workspace/packages/website/server/types/middleware.ts`.
- [TASK_NAME] = `auth-middleware-doc-review`; [AGENT_COUNT] = 3, from the three drafts found; [SUBAGENT_TYPE] = `general-purpose`; [REDUNDANCY_LEVEL] = 1.
- [TASK_CONTEXT] — incident-2024-089 occurred when a new developer implemented `rateLimitByApiKey` incorrectly, causing 503 errors for 12% of authenticated requests. The backend runs Express.js v4.18.2 with express-rate-limit v6.7.0 and CORS validation against a DynamoDB whitelist. JWT validation uses jsonwebtoken v9.0.2 with RS256 signing, with tokens cached in Redis v7.0 for 15 minutes. Onboarding documentation has not been updated since the Q3 2024 migration from cookie-based sessions to JWT, which contributed to the incident.

### Redundant, holistic evaluation

After analyzing production performance issues, the user says "Evaluate this comprehensively" about a 340-line performance RFC:

- [TASKS] — comprehensively evaluate the RFC for technical soundness and feasibility.
- [TASK] — review the entire RFC in `/workspace/docs/performance-optimization-rfc.md` (all 6 sections, lines 1-340). Evaluate the feasibility of replacing synchronous bcrypt v5.1.1 with @node-rs/bcrypt v1.9.0 in `/workspace/packages/api/src/auth/password.ts`; the proposed connection pooling with pg-pool v3.6.1 against PostgreSQL max_connections=100 exhaustion; the caching strategy's impact on `/api/v2/auth/login` and `/api/v2/auth/refresh`; the accuracy of the performance benchmarks; compatibility with the platform team's Q1 2025 PostgreSQL 15→16 upgrade; and the production rollout risk. Cross-reference against `/workspace/packages/api/`.
- [TASK_NAME] = `performance-rfc-review`, producing `performance-rfc-review-1` through `-3`; [AGENT_COUNT] = 3 by default; [SUBAGENT_TYPE] = `code-review`; [REDUNDANCY_LEVEL] = 3, because nothing subdivides and several agents were requested.

"Comprehensively" signals a holistic evaluation, so all three dispatches carry deliberately identical prompts.

### Subdivided with redundancy

After a Socket.io upgrade introduced connection drops, the user says "Validate each component's documentation thoroughly" about three WebSocket drafts:

- [TASKS] — thoroughly validate each draft for completeness and accuracy.
- [TASK_NAME] = `websocket-handler-validation`, producing `websocket-handler-validation-1` and `-2`; [AGENT_COUNT] = 6 (3 components × 2 reviewers); [SUBAGENT_TYPE] = `general-purpose`; [REDUNDANCY_LEVEL] = 2, inferred from "thoroughly" implying several reviewers per component.
- [TASK_CONTEXT] — the Socket.io upgrade from v4.5.4 to v4.6.1 introduced connection drops under load (bug #1547). Investigation revealed undocumented behavior in the custom Redis adapter (@socket.io/redis-adapter v8.2.1) with pub/sub channel management when scaling past five server instances. The ConnectionManager's exponential backoff with jitter was undocumented, causing client timeout debugging confusion. Grafana shows connection pool leaks after 72 hours, with file descriptors reaching ulimit 65536. Message routing uses a Redis Sorted Sets priority queue whose scoring and drainage logic were undocumented.

"Each component" triggers subdivision and "thoroughly" implies redundancy, so three components × two reviewers gives six dispatches.

</instructions>
