<user-message>
$ARGUMENTS
</user-message>

<input-format>
The `<user-message>` will describe the following inputs:
- [TASKS]: Description of the tasks for agents to perform. (required)
- [AGENT_COUNT]: The number of agents to perform the [TASKS]. (optional, default 3)
- [SUBAGENT_TYPE]: The `subagent_type` to use when invoking the Task tool function. (optional, default "general-purpose")

You should derive the following from the provided inputs:
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
- Must be explicitly stated in `<user-message>` (e.g., "each component should be reviewed by two agents")
- If subdivisions exist and no redundancy specified: [REDUNDANCY_LEVEL] = 1
- If no subdivisions and multiple agents requested: [REDUNDANCY_LEVEL] = [AGENT_COUNT]

**Task Distribution:**
- If items < [AGENT_COUNT]: Adjust [AGENT_COUNT] down to match items
- If items > [AGENT_COUNT]: Distribute evenly, assign remaining items to later agents
- [AGENT_COUNT] is advisory; respect natural subdivisions even if it means fewer/more tasks

If there is an ongoing conversation:
- [TASK_CONTEXT]: Technical details from the conversation using FULL ABSOLUTE PATHS (package versions, metrics, incidents, architecture constraints, file locations, affected paths)

<example>
If the `<user-message>` is "Instruct five "code-review" agents to determine the validity of each item in `example-new-feature-plan.md`", then:
- [TASKS] = Determine the validity of each item in `example-new-feature-plan.md`
- [TASK] = Review Section 2: "Example File Modification" (lines 45-78) in `/workspace/documentation/example-new-feature-plan.md`. Determine whether the proposed database schema changes are technically sound and compatible with the existing authentication system in `/workspace/packages/api/src/auth/session-manager.ts`. Evaluate implementation feasibility, identify potential conflicts with current session management, and assess whether the migration strategy accounts for existing user data.
- [TASK_NAME] = "database-schema-changes-review"
- [AGENT_COUNT] = 5
- [SUBAGENT_TYPE] = "code-review"
- [REDUNDANCY_LEVEL] = 1
- [TASK_CONTEXT] = Recent load testing revealed that the current Passport.js v0.6.0 implementation causes memory leaks when handling OAuth2 refresh token cycles, consuming 2.3GB RAM after 48 hours. The proposed migration to `@auth/core` v0.18.0 requires modifying the PostgreSQL session schema (adding `expires_at` and `refresh_token_hash` columns) which may break the existing `session-cleanup` cron job that runs pg_cron queries. The `packages/api/src/auth/middleware.ts` currently relies on `express-session` v1.17.3 with connect-pg-simple v9.0.0, and preliminary analysis shows the migration may require updating 23 files across the monorepo.

**Note: "each item" triggers subdivision. File investigation reveals 5 items in the plan. [AGENT_COUNT]=5 matches item count. [REDUNDANCY_LEVEL]=1 (no explicit redundancy requested). Total = 5 `Task()` calls.**
</example>

<example>
If the `<user-message>` is "Document each component of `packages/website/server`", then:
- [TASKS] = Document each component of `packages/website/server`
- [TASK] = Create comprehensive documentation for the authentication middleware (`/workspace/packages/website/server/middleware/auth.ts`) and request handler (`/workspace/packages/website/server/handlers/request.ts`). Include: component purpose and responsibilities, exported functions with parameter types and return values, integration points with other server components, usage examples showing typical request flows, error handling patterns, and any security considerations. Reference the type definitions in `/workspace/packages/website/server/types/middleware.ts` for accuracy.
- [TASK_NAME] = "authentication-documentation"
- [AGENT_COUNT] = 3 (default)
- [SUBAGENT_TYPE] = "general-purpose"
- [REDUNDANCY_LEVEL] = 1
- [TASK_CONTEXT] = The backend service currently runs Express.js v4.18.2 with custom middleware chains for rate limiting (using `express-rate-limit` v6.7.0) and CORS (origin validation against DynamoDB whitelist). A recent incident (incident-2024-089) occurred when a new developer incorrectly implemented the `rateLimitByApiKey` middleware, causing 503 errors for 12% of authenticated requests. The JWT validation uses `jsonwebtoken` v9.0.2 with RS256 signing, and tokens are cached in Redis v7.0 with a 15-minute TTL. The onboarding documentation hasn't been updated since the migration from cookie-based sessions to JWT tokens in Q3 2024.

**Note: "each component" triggers subdivision. Directory listing reveals 3 components. [AGENT_COUNT]=3 matches component count. [REDUNDANCY_LEVEL]=1 (no explicit redundancy). Total = 3 `Task()` calls.**
</example>

<example>
If the `<user-message>` is "Instruct two "code-review" agents to determine the validity of `example-new-feature-plan.md`", then:
- [TASKS] = Determine the validity of `example-new-feature-plan.md`
- [TASK] = Comprehensively review the feature plan in `/workspace/documentation/example-new-feature-plan.md` (all 5 sections, lines 1-250). Evaluate: (1) technical feasibility of the proposed authentication refactor including database migrations and API changes, (2) compatibility with existing codebase in `/workspace/packages/api/` and `/workspace/packages/website/`, (3) accuracy of time and resource estimates, (4) completeness of the testing strategy, (5) risk assessment for production deployment. Cross-reference implementation details against current architecture in `/workspace/docs/architecture.md`. Provide specific recommendations on whether to proceed.
- [TASK_NAME] = "feature-plan-review" (will create: "feature-plan-review-1", "feature-plan-review-2")
- [AGENT_COUNT] = 2
- [SUBAGENT_TYPE] = "code-review"
- [REDUNDANCY_LEVEL] = 2 (2 agents perform the same full review)
- [TASK_CONTEXT] = Production metrics from DataDog show authentication endpoints (`/api/v2/auth/login`, `/api/v2/auth/refresh`) hitting p99 latency of 2.8 seconds at 10K concurrent users, with PostgreSQL connection pool exhaustion (max_connections=100) being the primary bottleneck. Recent PagerDuty alerts (3 incidents in the last 2 weeks) trace to the synchronous bcrypt hashing in `packages/api/src/auth/password.ts` blocking the event loop. The feature plan proposes switching to `@node-rs/bcrypt` v1.9.0 (native bindings) and implementing connection pooling with `pg-pool` v3.6.1, but this requires benchmarking against the current `bcrypt` v5.1.1 implementation. The platform team's Q1 2025 roadmap includes a PostgreSQL 15 to 16 upgrade which may conflict with schema migration timing.

**Note: Singular "plan" without subdivision keywords triggers redundancy. No subdivisions exist. [AGENT_COUNT]=2 means [REDUNDANCY_LEVEL]=2. Total = 2 `Task()` calls with identical prompts.**
</example>

<example>
If the `<user-message>` is "Document the components of `packages/website/server`. Each component should be reviewed by two agents.", then:
- [TASKS] = Document the components of `packages/website/server`
- [TASK] = Create comprehensive documentation for the WebSocket connection handler in `/workspace/packages/website/server/handlers/websocket.ts` (approximately 350 lines). Document: the ConnectionManager class (lines 45-180) including connection lifecycle methods, the message routing system (lines 185-250), error handling and reconnection logic (lines 255-320), and integration with the Redis pub/sub system defined in `/workspace/packages/website/server/redis/pubsub.ts`. Include type signatures from `/workspace/packages/website/server/types/websocket.ts`, usage examples for establishing connections and broadcasting messages, and performance considerations for handling 1000+ concurrent connections.
- [TASK_NAME] = "websocket-documentation" (will create: "websocket-documentation-1", "websocket-documentation-2")
- [AGENT_COUNT] = 3 (default)
- [SUBAGENT_TYPE] = "general-purpose"
- [REDUNDANCY_LEVEL] = 2 (2 agents per component)
- [TASK_CONTEXT] = After upgrading Socket.io from v4.5.4 to v4.6.1 in December 2024, WebSocket connections began dropping unexpectedly under load (bug report #1547). Investigation revealed undocumented behavior in the custom Redis adapter (`@socket.io/redis-adapter` v8.2.1) related to pub/sub channel management when scaling beyond 5 server instances. The ConnectionManager class uses a custom reconnection backoff algorithm (exponential with jitter) that wasn't documented, causing confusion when debugging client-side timeout issues. Recent Grafana metrics show connection pool leaks occurring after 72 hours of uptime, with file descriptor counts reaching the ulimit of 65536. The message routing system implements a priority queue backed by Redis Sorted Sets, but the scoring algorithm and queue drainage logic lack any documentation.

**Note: "Each component" triggers subdivision (3 components found). User explicitly states "two agents" sets [REDUNDANCY_LEVEL]=2. [AGENT_COUNT]=3 (default) is overridden by calculation: 3 components × 2 redundancy = 6 total `Task()` calls.**
</example>
</input-format>

<tool-use-template>
// Total Task() calls = (number of distinct tasks) × [REDUNDANCY_LEVEL]
// Example: 3 subdivided tasks with REDUNDANCY_LEVEL=2 requires 6 Task() calls

Task(description="[TASK_NAME]-1",  // Add number suffix when REDUNDANCY_LEVEL > 1
    subagent_type="[SUBAGENT_TYPE]",
    prompt="<task>
    [TASK]
    </task>
    <context>
    [TASK_CONTEXT]
    </context>
    ")

Task(description="[TASK_NAME]-2",
    subagent_type="[SUBAGENT_TYPE]",
    prompt="<task>
    [TASK]
    </task>
    <context>
    [TASK_CONTEXT]
    </context>
    ")
</tool-use-template>

Combine all `Task()` calls into a single message to execute simultaneously. Never launch sequentially.

**CRITICAL: Agents have ZERO context from this conversation. Every [TASK] and [TASK_CONTEXT] MUST use FULL ABSOLUTE PATHS starting with `/workspace/` (e.g., `/workspace/packages/api/src/auth.ts:45`). Include line numbers, complete file paths, directory locations, and all technical context. Relative paths (e.g., `./src/`, `../lib/`) will cause agent failure.**