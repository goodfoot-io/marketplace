# Changelog

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
