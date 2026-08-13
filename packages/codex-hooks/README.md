# @goodfoot/codex-hooks

Build Codex hooks in TypeScript. The package mirrors the canonical Codex hook event surface and emits the wire JSON described in the upstream Codex `hooks/schema/generated/*.json` schemas.

## Quick Start

Install:

```bash
yarn add @goodfoot/codex-hooks
```

Write a hook:

```ts
import { preToolUseHook, preToolUseOutput } from "@goodfoot/codex-hooks";

export default preToolUseHook({ matcher: "Bash" }, (input) => {
  if (input.tool_name !== "Bash") {
    return;
  }
  const toolInput = input.tool_input as { command?: string };
  if (typeof toolInput.command === "string" && toolInput.command.includes("rm -rf")) {
    return preToolUseOutput({
      systemMessage: "Blocked destructive command.",
      permissionDecision: "deny",
      permissionDecisionReason: "Refusing destructive Bash command.",
    });
  }
});
```

Compile hooks and generate `hooks.json`:

```bash
# Local project hooks
codex-hooks -i "src/**/*.ts" -o ".codex/hooks.json"

# Plugin hooks (portable, install-relative commands)
codex-hooks -i "src/**/*.ts" -o "my-plugin/hooks/hooks.json" --plugin-root
```

The CLI picks one of three command-emission modes based on the output path and flags:

| Mode | Trigger | Command form | Filename |
| --- | --- | --- | --- |
| **plugin** | `--plugin-root`, or a `.codex-plugin/` marker found by walking up from the output path | `node "${PLUGIN_ROOT}/hooks/<name>.mjs"` | stable (no hash) |
| **codex-local** | Output path contains a `.codex/` segment | `node "$(git rev-parse --show-toplevel)/.codex/bin/<name>.<hash>.mjs"` | hashed |
| **absolute** | Anything else | `node "/abs/path/to/<name>.<hash>.mjs"` | hashed |

Plugin mode emits hash-free filenames by default so the generated `hooks.json` is byte-stable across rebuilds — this keeps Codex's hook trust hash valid, so users do not have to re-review and re-trust hooks on every plugin update. Use `--stable-names` to force stable names in any mode, or `--no-stable-names` to opt back into hashed filenames.

## Supported Events

All ten Codex hook events are supported:

| Event | Matcher dimension |
| --- | --- |
| `PreToolUse` | `tool_name` |
| `PostToolUse` | `tool_name` |
| `PermissionRequest` | `tool_name` |
| `UserPromptSubmit` | none (matcher parsed but ignored) |
| `SessionStart` | `source` (`startup`/`resume`/`clear`/`compact`) |
| `SubagentStart` | `agent_type` |
| `Stop` | none |
| `SubagentStop` | `agent_type` |
| `PreCompact` | `trigger` (`manual`/`auto`) |
| `PostCompact` | `trigger` (`manual`/`auto`) |

## Tool Input Typing

`tool_name` is `string` (Codex emits any tool name, not just `Bash`) and `tool_input` is `unknown`. Narrow these in your hook with a user-defined type guard:

```ts
function isBashInput(value: unknown): value is { command: string } {
  return typeof value === "object" && value !== null && typeof (value as { command?: unknown }).command === "string";
}
```

## Output Surface

Universal fields on every output: `continue`, `stopReason`, `suppressOutput`, `systemMessage`.

- `PreToolUse`: legacy `decision: "approve" | "block"` with `reason`, or `hookSpecificOutput.{permissionDecision, permissionDecisionReason, additionalContext, updatedInput}`. `permissionDecision` accepts `"allow"`, `"deny"`, or `"ask"`. `updatedInput` is only honored when `permissionDecision: "allow"`.
- `PostToolUse`: `decision: "block"` with `reason`, plus `hookSpecificOutput.{additionalContext, updatedMCPToolOutput}`.
- `PermissionRequest`: `hookSpecificOutput.decision = { behavior: "allow" | "deny", message?, interrupt?, updatedInput?, updatedPermissions? }`. `interrupt`, `updatedInput`, and `updatedPermissions` are reserved and currently fail closed in Codex; the builder only emits them if you pass them.
- `UserPromptSubmit`: `decision: "block"` with `reason`, plus `hookSpecificOutput.additionalContext`.
- `SessionStart`, `SubagentStart`: `hookSpecificOutput.additionalContext`. Returning a plain string is normalized into `additionalContext`.
- `Stop`, `SubagentStop`: `decision: "block"` with required `reason` when blocking.
- `PreCompact`, `PostCompact`: universal fields only.

## Current Codex Runtime Limits

| Limit | Current behavior |
| --- | --- |
| Handler type | `type: "command"` only |
| Async config-side hooks | Parsed but unsupported |
| Matcher support | Honored for everything except `Stop` and `UserPromptSubmit` |
| `PreToolUse.permissionDecision: "ask"` | Reserved (fail-closed in some Codex versions) |
| `PreToolUse.updatedInput` | Honored only when `permissionDecision: "allow"` |
| `PermissionRequest` reserved fields | `interrupt`, `updatedInput`, `updatedPermissions` currently fail closed |
| Windows | Hooks are disabled |

## Runtime Semantics

- Structured hook output writes JSON to stdout and exits `0`.
- Throwing `BlockError` writes the reason to stderr and exits `2`.
- Unhandled exceptions write the stack trace to stderr and exit non-zero.
- Plain-text return values are only accepted for `SessionStart`, `SubagentStart`, and `UserPromptSubmit`, where they are normalized into `additionalContext`.

### Fail-Open Execution (`unexpectedError: "continue"`)

By default, any unexpected runtime failure — malformed stdin, a thrown handler exception, a serialization error, a failed stdout write, or a logger cleanup failure — writes a stack trace to stderr and exits non-zero. Codex then shows a `hook (failed)` banner to the user, even though a handler that only adds optional context to a turn shouldn't be able to interrupt it.

Opt a hook into fail-open behavior by passing `unexpectedError: "continue"` in its config:

```ts
import { userPromptSubmitHook } from "@goodfoot/codex-hooks";

export default userPromptSubmitHook(
  {
    unexpectedError: "continue",
    onUnexpectedError(error, phase) {
      // Best-effort diagnostics. This callback itself can never fail the
      // invocation — thrown errors here are swallowed.
    },
  },
  async (input, { logger }) => {
    // ...
  },
);
```

Under `unexpectedError: "continue"`:

- `BlockError` is unaffected — it always writes its reason to stderr and exits `2`, regardless of policy.
- Every other unexpected failure — in stdin reading, input parsing, handler execution, output serialization, the stdout write, or logger cleanup — is caught, reported to `onUnexpectedError` (if provided) and to the runtime logger, and swallowed.
- If no response was written yet, the runtime emits the event's valid empty output (`{}`, valid for every hook event's schema) and exits `0`.
- The response is always buffered and serialized before the first write, so a failure can never produce output concatenated onto a partially written response.
- `onUnexpectedError` and the runtime logger are both best-effort: if either one throws, that failure is swallowed too — a broken diagnostic sink can never itself fail the invocation.

`unexpectedError` defaults to `"error"` (the behavior above the fold), so existing hooks are unaffected. Only opt in for **advisory enrichment hooks** — ones that add optional context and whose failure should be invisible to the user (e.g. `UserPromptSubmit`, `SessionStart`, `SubagentStart` context nudges). Do not use `"continue"` for hooks that make permission, safety, or policy decisions (`PreToolUse`, `PermissionRequest`, blocking `PostToolUse`/`Stop`/`SubagentStop` checks) — silently swallowing a failure there means the hook's decision was silently skipped.

## Scaffolding

```bash
npx @goodfoot/codex-hooks --scaffold ./my-codex-hooks --hooks SessionStart,PreToolUse -o ./.codex/hooks.json
```

This creates a small starter project with `src/`, `test/`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `biome.json`, and `README.md`.
