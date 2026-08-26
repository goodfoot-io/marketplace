# Changelog

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
