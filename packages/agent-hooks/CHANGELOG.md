# Changelog

## 0.3.0

Codex parity: the full `@goodfoot/codex-hooks` 1.3.0 surface now ships behind `@goodfoot/agent-hooks/codex`.

- **All 10 hook factories** ported with their config shapes (`matcher`, `timeout`, `statusMessage`), result unions, output builders (reserved fields emitted only when passed), input types, constants, and the runtime `execute` entry point. Factory results carry both `.hookEventName` (source name) and `.eventName` (core).
- **`BlockError` preserved as a subclass of the core `HookBlockError`**, so the shared driver classifies it before consulting policy — carrying an ordering the source runtime already implemented. Public surface unchanged: `name`, `reason`, `instanceof BlockError`.
- **Wire semantics verbatim:** BlockError → reason on stderr + exit 2 regardless of policy, for every event including SubagentStart (no per-event table — Codex has no narrower native deny); every other unexpected failure → stacktrace + exit 1 under the default policy (Codex exits 1 where Claude Code exits 2), `{}` at exit 0 under `"continue"`; malformed stdin is policy-gated on Codex (NOT unconditionally fail-open — that is Claude Code's rule). Returned-string normalization for the three text-output events is unchanged; other events reject plain text through the same policy path.
- **Deliberate narrowing — advisory allow-list transcribed from codex-hooks README.md** (Fail-Open Execution): advisory = exactly {UserPromptSubmit, SessionStart, SubagentStart}; never = {PreToolUse, PermissionRequest, blocking PostToolUse/Stop/SubagentStop}; PreCompact/PostCompact are named nowhere in the README and are excluded by default, fail-closed, pending doc clarification. Enforced at factory-call time (runtime gate) and compile time (`MatcherHookConfigFor`/`NoMatcherHookConfigFor`). This intentionally breaks code passing `"continue"` to non-advisory Codex events; no shipped test exercised that gap.
- **CLI:** `--agent codex` un-stubbed — Codex AST analysis (statusMessage-aware), command-context detection (`.codex-plugin` marker / `--plugin-root` / `.codex` git-toplevel mode / absolute), plugin-mode stable-names default, timeout-in-seconds and statusMessage hooks.json entries; `--plugin-root` flag added to the unified CLI. Codex scaffold templates emit `@goodfoot/agent-hooks` dependencies and `--agent codex` build scripts.
- **Exports:** closed map grows by one explicit `./codex` subpath (still no wildcard).
- **Test estate:** all 9 codex unit test files + e2e/runtime-and-build.test.ts ported under tests/codex/ and e2e/codex/ with import-specifier adaptation; parity checker extended to map codex-hooks sources; new conformance matrix documents the three NON-uniform advisory rows (SessionStart/UserPromptSubmit halt vs SubagentStart ignored) from the host-behaviour notes; cross-agent duplication check wired into `test`.

## 0.2.0

Claude Code parity: the full `@goodfoot/claude-code-hooks` 1.9.0 surface now ships behind `@goodfoot/agent-hooks/claude-code`, with one deliberate API narrowing.

- **All 30 hook factories** ported, including `postToolBatchHook`, which the source package defined but never re-exported from its barrel (pre-existing bug fixed here). Output builders, input/output types, tool-helper guards, env utilities, `Logger`, and `EXIT_CODES` are re-exported from the same entry point.
- **Deliberate narrowing — advisory fail-open allow-list (FMEA F2):** `unexpectedError: "continue"` is rejected for events not on the Claude Code advisory list (`HOOK_EVENT_NAMES` minus `PreToolUse`, `PermissionRequest`, blocking `Stop`/`SubagentStop`, `WorktreeCreate`/`WorktreeRemove`, transcribed verbatim from CARD.md:75). Enforcement is twice-folded: a runtime policy gate that throws at factory-call time, and compile-time config narrowing (`HookConfigFor`/`TypedHookConfigFor`) that makes `"continue"` unassignable on excluded events. This intentionally breaks code that passed `"continue"` to non-advisory events; no shipped test exercised that gap.
- **`HookBlockError` wire translation:** a thrown block signal survives fail-open under every policy value and translates per event — native tool-scoped deny shapes for `PreToolUse` (`permissionDecision: "deny"`) and `PermissionRequest` (`decision.behavior: "deny"`), `{ continue: false, stopReason }` elsewhere — via the exported `BLOCK_SHAPE_BY_EVENT` table.
- **Runtime renamed:** `execute()` now lives in `agents/claude-code/transport.ts` and drives through the shared core; wire semantics carried over exactly — JSON-on-stdout at exit 0 (`{}` when empty), stderr-carrying responses exit 2 with no stdout write, malformed stdin fails open unconditionally, worktree events keep their plain-text stdout protocol. Handler functions receive their context via factory-bound `createContext` (SessionStart gets `persistEnvVar`/`persistEnvVars`).
- **Metadata property renamed:** factory results expose `.eventName` (core's shape) instead of `.hookEventName`.
- **Log env vars renamed:** compiled hooks read/wire `AGENT_HOOKS_LOG_FILE` / `AGENT_HOOKS_LOG_ENV_VAR` instead of `CLAUDE_CODE_HOOKS_LOG_FILE` / `CLAUDE_CODE_HOOKS_LOG_ENV_VAR`.
- **CLI:** single `agent-hooks` binary with a NEW required `--agent <claude-code|codex|antigravity>` flag — exit non-zero without it, never inferred; bare invocations are no longer help requests. `codex`/`antigravity` values validate but fail closed until their parity steps land. All prior flags (`--stable-names`, `--log`, `--log-env-var`, `--loader`, `--no-sourcemap`, scaffold) keep their semantics; install-context inference unchanged. Scaffold templates emit `@goodfoot/agent-hooks/claude-code` imports and `--agent claude-code` build scripts.
- **Exports:** closed map gains the explicit `./claude-code` subpath (no wildcard, ever); `bin`/`publishConfig` name the `agent-hooks` binary.
- **Test surface:** unit tests, `tests/types/`, and all 21 e2e files + fixtures ported with import-specifier-only adaptation, guarded by a parity script (counterpart presence + per-file assertion counts) wired into `test`; conformance matrix runs compiled bundles in child processes against hand-written expected wire triples.

## 0.1.0

Initial release: agent-neutral core only.

- `defineHook<TInput, TOutput, TContext>(eventName, config, handler, policyGate?)` factory primitive with `unexpectedError` policy plumbing (`"error" | "continue"`, `onUnexpectedError` diagnostic sink) and an injectable per-event policy-validation gate; core hardcodes no event list and fails closed when a gate rejects.
- `core/transport.ts`: `Transport` interface (`finalize(outcome)` pure mapping plus optional `rawStdout` predicate), shared `drive(transport, hookFn)` driver owning stdin read, JSON parse, handler invocation, buffered single-write emission, and process exit; `HookOutcome<TOutput>` discriminated union (`response`, `block`, `handlerError`, `rawStdout`).
- `HookBlockError` — policy-exempt block-signal channel: classified before `unexpectedError` policy, so an advisory event's intentional block survives fail-open under every policy value.
- `Logger` ported behavior-identically from `@goodfoot/claude-code-hooks` (silent by default, JSON Lines file output, event subscription).
- Env utilities ported from `@goodfoot/claude-code-hooks`.
- Stdin read + JSON parse helpers shared by both source runtimes.
- Root-export lint as tests: `src/index.ts` re-exports `./core*` only; package `exports` map is a closed list with no `./*` wildcard subpath, with a fail-case fixture proving the check rejects wildcards.
- Per-agent entry points (`claude-code`, `codex`, `antigravity`) intentionally absent; they land with their implementations.
