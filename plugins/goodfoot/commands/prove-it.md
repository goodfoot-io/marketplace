<user-message>
$ARGUMENTS
</user-message>

<input-format>
The user message provides optional guidance on the response format or style.

You should infer the following from the conversation context:
- [TASKS]: Description of the tasks for agents to perform, typically involving critical evaluation of a previously presented plan or work. Inferred from recent discussion, code changes, or work being done. Default: "Critically evaluate the presented plan or work. Aim for collaborative improvement—this may mean small adjustments if that's all that's necessary, but remain open to larger ideas or complete rewrites if they better serve the goals. Other agents are performing the same evaluation. The coordinator will synthesize your input, and the user makes final decisions."
- [AGENT_COUNT]: The number of agents to perform the [TASKS], inferred from the complexity and scope of work or explicitly specified by the user (default: 3)
- [SUBAGENT_TYPE]: The `subagent_type` to use when invoking the Task tool function, inferred from the type of work being done (optional, default "general-purpose")

You should derive the following from the inferred inputs:
- [TASK]: A task for an agent to perform derived from [TASKS]. MUST include all necessary context with FULL ABSOLUTE PATHS (e.g., `/workspace/packages/api/src/file.ts`, never relative paths like `./src/file.ts`). Agents have no knowledge of this conversation or working directory.
- [TASK_NAME]: A short semantic name for the task (i.e. "review-auth-component"). When [REDUNDANCY_LEVEL] > 1, append numbers: "task-name-1", "task-name-2", etc.
- [REDUNDANCY_LEVEL]: How many agents should perform each [TASK] (default 1)

**Task Subdivision Logic:**
- Subdivision triggers: "each", "all", "every", plural references ("files", "components"), or explicit subdivision instructions
- Singular references ("file", "plan") without subdivision keywords → redundancy (multiple agents on same task)
- Natural subdivisions take priority over [AGENT_COUNT]
- Investigate as needed: read files, use Task tool with "codebase-analysis" subagent, run tests, search codebase to discover items
- Total `Task()` invocations = (number of distinct [TASK]s × [REDUNDANCY_LEVEL])

**REDUNDANCY_LEVEL Derivation:**
- Must be explicitly stated in user message (e.g., "each component should be reviewed by two agents")
- If subdivisions exist and no redundancy specified: [REDUNDANCY_LEVEL] = 1
- If no subdivisions and multiple agents requested: [REDUNDANCY_LEVEL] = [AGENT_COUNT]

**Task Distribution:**
- If items < [AGENT_COUNT]: Adjust [AGENT_COUNT] down to match items
- If items > [AGENT_COUNT]: Distribute evenly, assign remaining items to later agents
- [AGENT_COUNT] is advisory; respect natural subdivisions even if it means fewer/more tasks

From the conversation context, derive:
- [TASK_CONTEXT]: Technical details from the conversation using FULL ABSOLUTE PATHS (package versions, metrics, incidents, architecture constraints, file locations, affected paths, recent changes, plans presented)

<example>
After discussing performance issues, you developed a 5-phase implementation plan for migrating authentication from Passport.js to @auth/core, documented in `/workspace/docs/auth-migration-plan.md`. The plan covers: Phase 1 (OAuth2 provider updates), Phase 2 (session schema migration), Phase 3 (middleware replacement), Phase 4 (token refresh logic), and Phase 5 (rollback strategy). The user message is "Validate this approach", then:
- [TASKS] = Critically evaluate each phase of the authentication migration plan for technical feasibility and risk (inferred from plan structure)
- [TASK] = Evaluate Phase 2: "Session Schema Migration" (lines 45-78) in `/workspace/docs/auth-migration-plan.md`. Assess whether the proposed PostgreSQL schema changes (adding `expires_at` and `refresh_token_hash` columns) are compatible with the existing session manager in `/workspace/packages/api/src/auth/session-manager.ts`. Evaluate migration strategy for preserving existing user sessions, potential breaking changes to the session cleanup cron job in `/workspace/db/cron/session-cleanup.sql`, and data integrity risks during the migration window.
- [TASK_NAME] = "phase-2-schema-migration"
- [AGENT_COUNT] = 5 (inferred from 5 distinct phases discovered when reading the plan)
- [SUBAGENT_TYPE] = "code-review" (inferred from technical plan evaluation context)
- [REDUNDANCY_LEVEL] = 1
- [TASK_CONTEXT] = Load testing revealed the current Passport.js v0.6.0 implementation causes memory leaks during OAuth2 refresh token cycles (2.3GB RAM after 48 hours). Migration targets @auth/core v0.18.0 with PostgreSQL session schema changes. Current stack uses express-session v1.17.3 with connect-pg-simple v9.0.0 in `/workspace/packages/api/src/auth/middleware.ts`. Preliminary analysis shows 23 files across the monorepo require updates. The pg_cron session cleanup job may break with schema changes, risking session accumulation in production.

**Note: Reading `/workspace/docs/auth-migration-plan.md` reveals 5 distinct phases. Natural subdivision: 5 phases → 5 tasks. [AGENT_COUNT]=5 inferred from phase count. [REDUNDANCY_LEVEL]=1 (no redundancy requested). Total = 5 `Task()` calls.**
</example>

<example>
Following incident-2024-089 (rate limiting middleware causing 503 errors), you created documentation drafts for three middleware components in `/workspace/packages/website/server/middleware/`: authentication (`auth.ts`), rate limiting (`rate-limit.ts`), and CORS validation (`cors.ts`). The drafts were saved in `/workspace/docs/drafts/`. The user message is "Review the middleware docs", then:
- [TASKS] = Critically evaluate each middleware documentation draft for completeness and technical accuracy (inferred from documentation review context)
- [TASK] = Review the authentication middleware documentation at `/workspace/docs/drafts/auth-middleware.md` for `/workspace/packages/website/server/middleware/auth.ts`. Evaluate: completeness of function documentation (`validateJWT`, `refreshToken`, `handleAuthError`), accuracy against actual implementation, clarity of JWT token flow explanations, proper documentation of Redis caching integration with `/workspace/packages/website/server/cache/redis.ts`, inclusion of error handling patterns, and whether security considerations are adequately covered. Verify type references to `/workspace/packages/website/server/types/middleware.ts` are correct.
- [TASK_NAME] = "auth-middleware-doc-review"
- [AGENT_COUNT] = 3 (inferred from 3 draft files discovered)
- [SUBAGENT_TYPE] = "general-purpose"
- [REDUNDANCY_LEVEL] = 1
- [TASK_CONTEXT] = Incident-2024-089 occurred when a new developer incorrectly implemented `rateLimitByApiKey` middleware, causing 503 errors for 12% of authenticated requests. The backend runs Express.js v4.18.2 with express-rate-limit v6.7.0 and CORS validation against DynamoDB whitelist. JWT validation uses jsonwebtoken v9.0.2 with RS256 signing, tokens cached in Redis v7.0 with 15-minute TTL. Onboarding documentation hasn't been updated since Q3 2024 migration from cookie-based sessions to JWT, contributing to the incident. The new drafts aim to prevent similar issues by providing clear implementation guidance.

**Note: Checking `/workspace/docs/drafts/` reveals 3 middleware documentation files. Natural subdivision: 3 drafts → 3 evaluation tasks. [AGENT_COUNT]=3 inferred from draft count. [REDUNDANCY_LEVEL]=1. Total = 3 `Task()` calls.**
</example>

<example>
After analyzing production performance issues (p99 latency 2.8s at 10K users, 3 PagerDuty alerts in 2 weeks), you developed a comprehensive optimization plan covering password hashing replacement, connection pooling, and caching strategies, documented in `/workspace/docs/performance-optimization-rfc.md` (6 sections, 340 lines). The user message is "Evaluate this comprehensively", then:
- [TASKS] = Comprehensively evaluate the performance optimization RFC for technical soundness and feasibility (inferred from holistic evaluation request)
- [TASK] = Review the entire performance optimization RFC in `/workspace/docs/performance-optimization-rfc.md` (all 6 sections, lines 1-340). Evaluate: (1) technical feasibility of replacing synchronous bcrypt (v5.1.1) with @node-rs/bcrypt (v1.9.0) in `/workspace/packages/api/src/auth/password.ts`, (2) proposed connection pooling with pg-pool v3.6.1 to address PostgreSQL max_connections=100 exhaustion, (3) caching strategy impacts on auth endpoints `/api/v2/auth/login` and `/api/v2/auth/refresh`, (4) accuracy of performance benchmarks and estimates, (5) compatibility with platform team's Q1 2025 PostgreSQL 15→16 upgrade, (6) risk assessment for production rollout. Cross-reference against current architecture in `/workspace/packages/api/`.
- [TASK_NAME] = "performance-rfc-review" (will create: "performance-rfc-review-1", "performance-rfc-review-2", "performance-rfc-review-3")
- [AGENT_COUNT] = 3 (default, no explicit count specified)
- [SUBAGENT_TYPE] = "code-review" (inferred from technical RFC evaluation)
- [REDUNDANCY_LEVEL] = 3 (no subdivision, multiple agents → redundancy)
- [TASK_CONTEXT] = DataDog metrics show authentication endpoints hitting p99 latency of 2.8 seconds at 10K concurrent users. PostgreSQL connection pool exhaustion (max_connections=100) is the primary bottleneck. Recent PagerDuty alerts (3 incidents in 2 weeks) trace to synchronous bcrypt hashing in `/workspace/packages/api/src/auth/password.ts` blocking the Node.js event loop. Current implementation uses bcrypt v5.1.1. The RFC proposes native bindings with @node-rs/bcrypt v1.9.0 and pg-pool v3.6.1 for connection pooling. Platform team's Q1 2025 PostgreSQL upgrade may conflict with migration timing.

**Note: "Comprehensively" signals holistic evaluation (no subdivision). No agent count specified, using default [AGENT_COUNT]=3. No natural subdivisions exist, so [REDUNDANCY_LEVEL]=3. Total = 3 `Task()` calls with identical prompts.**
</example>

<example>
After upgrading Socket.io from v4.5.4 to v4.6.1 (which caused bug #1547 - connection drops under load), you created documentation drafts for three affected server components: WebSocket handler (`/workspace/packages/website/server/handlers/websocket.ts`), Redis adapter (`/workspace/packages/website/server/redis/adapter.ts`), and connection manager (`/workspace/packages/website/server/managers/connection.ts`). The drafts are at `/workspace/docs/drafts/websocket-*.md`. The user message is "Validate each component's documentation thoroughly", then:
- [TASKS] = Thoroughly validate each WebSocket component documentation draft for completeness and accuracy (inferred from validation request)
- [TASK] = Validate the WebSocket handler documentation at `/workspace/docs/drafts/websocket-handler.md` for `/workspace/packages/website/server/handlers/websocket.ts` (350 lines). Assess: (1) completeness of ConnectionManager class documentation (lines 45-180) including connection lifecycle methods, (2) accuracy of message routing system explanation (lines 185-250), (3) clarity of error handling and reconnection logic documentation (lines 255-320), (4) proper coverage of Redis pub/sub integration with `/workspace/packages/website/server/redis/pubsub.ts`, (5) whether undocumented behaviors (exponential backoff algorithm, priority queue scoring) are now properly explained, (6) inclusion of type signatures from `/workspace/packages/website/server/types/websocket.ts` and performance considerations for 1000+ concurrent connections.
- [TASK_NAME] = "websocket-handler-validation" (will create: "websocket-handler-validation-1", "websocket-handler-validation-2")
- [AGENT_COUNT] = 6 (calculated: 3 components discovered × 2 for thoroughness)
- [SUBAGENT_TYPE] = "general-purpose"
- [REDUNDANCY_LEVEL] = 2 (inferred from "thoroughly" suggesting multiple reviewers per component)
- [TASK_CONTEXT] = Socket.io upgrade from v4.5.4 to v4.6.1 introduced connection drops under load (bug #1547). Investigation revealed undocumented behavior in custom Redis adapter (@socket.io/redis-adapter v8.2.1) with pub/sub channel management when scaling beyond 5 server instances. ConnectionManager's custom exponential backoff with jitter reconnection algorithm wasn't documented, causing client timeout debugging confusion. Grafana metrics show connection pool leaks after 72 hours (file descriptors reaching ulimit 65536). Message routing uses Redis Sorted Sets priority queue, but scoring algorithm and drainage logic were undocumented, contributing to the issues.

**Note: "each component" triggers subdivision. Reading `/workspace/docs/drafts/` discovers 3 WebSocket documentation files. "Thoroughly" suggests multiple reviewers, inferring [REDUNDANCY_LEVEL]=2. Total agents: 3 components × 2 = 6 `Task()` calls.**
</example>
</input-format>

Total Task() calls = (number of distinct tasks) × [REDUNDANCY_LEVEL]
Example: 3 subdivided tasks with REDUNDANCY_LEVEL=2 requires 6 Task() calls

```xml
<invoke name="Task">
<parameter name="description">[TASK_NAME]-1</parameter>
<parameter name="subagent_type">[SUBAGENT_TYPE]</parameter>
<parameter name="prompt"><task>
[TASK]
</task>
<context>
[TASK_CONTEXT]
</context>

<instructions>
Critically evaluate this work. Think intensely about the problem and aim for collaborative improvement. If small adjustments suffice, propose them; if larger ideas or rewrites better serve the goals, don't hesitate to suggest them. Remember: other agents are performing parallel evaluations, and I will synthesize all input before making final decisions.
</instructions></parameter>
</invoke>
```

```xml
<invoke name="Task">
<parameter name="description">[TASK_NAME]-2</parameter>
<parameter name="subagent_type">[SUBAGENT_TYPE]</parameter>
<parameter name="prompt"><task>
[TASK]
</task>
<context>
[TASK_CONTEXT]
</context>

<instructions>
Critically evaluate this work. Think intensely about the problem and aim for collaborative improvement. If small adjustments suffice, propose them; if larger ideas or rewrites better serve the goals, don't hesitate to suggest them. Remember: other agents are performing parallel evaluations, and I will synthesize all input before making final decisions.
</instructions></parameter>
</invoke>
```

Combine all `Task()` calls into a single message to execute simultaneously. Never launch sequentially.

**CRITICAL: Agents have ZERO context from this conversation. Every [TASK] and [TASK_CONTEXT] MUST use FULL ABSOLUTE PATHS starting with `/workspace/` (e.g., `/workspace/packages/api/src/auth.ts:45`). Include line numbers, complete file paths, directory locations, and all technical context. Relative paths (e.g., `./src/`, `../lib/`) will cause agent failure.**
