# Antigravity hooks

Import from `@goodfoot/agent-hooks/antigravity`. Build with `--agent antigravity -i <glob> -o <pluginRoot>/hooks.json`.

`packages/agent-hooks/src/agents/antigravity/CONTRACT.md` pins the host's own hook reference, extracted from the `agy` binary. It is the only oracle. Never infer an Antigravity field or behavior from Claude Code or Codex — the payloads share nothing.

## Events

| Event | Factory | Builder | Input fields | Output |
| --- | --- | --- | --- | --- |
| `PreToolUse` | `preToolUseHook` | `preToolUseOutput` | `toolCall{name,args}`, `stepIdx` | `decision`, `reason`, `permissionOverrides`, `overwrite` |
| `PostToolUse` | `postToolUseHook` | `postToolUseOutput` | `stepIdx`, `error?` | `{}` — no reply channel |
| `PreInvocation` | `preInvocationHook` | `preInvocationOutput` | `invocationNum`, `initialNumSteps` | `injectSteps` |
| `PostInvocation` | `postInvocationHook` | `postInvocationOutput` | same as `PreInvocation` | `injectSteps`, `terminationBehavior` |
| `Stop` | `stopHook` | `stopOutput` | `executionNum`, `terminationReason`, `error?`, `fullyIdle` | `decision`, `reason` |

Every input also carries `conversationId`, `workspacePaths` (array, sometimes empty), `transcriptPath`, `artifactDirectoryPath`, `modelName`.

All keys are camelCase (protojson). **No payload carries its own event name** — a handler knows its event only from its factory.

`matcher` is accepted only by `PreToolUse` and `PostToolUse`; the host ignores one on the other three. Every factory takes `timeout` (milliseconds; the manifest converts to seconds), `unexpectedError`, and `onUnexpectedError`.

`PreToolUse` decisions: `allow | deny | ask | force_ask`. `ask` respects the "Always Allow" cache; `force_ask` ignores it. `overwrite` is a shallow top-level merge into the tool's args.

`Stop` decisions: `continue` blocks the stop; anything else lets the agent stop. `terminationBehavior`: `force_continue | terminate | ""`.

`injectSteps` entries are one of `{ephemeralMessage}`, `{userMessage}`, `{toolCall}`.

Builders omit `undefined` fields.

## Manifest shape

`hooks.json` sits at the **plugin root**, not in a `hooks/` subdirectory. Top-level keys are hook **names**, not events; the host merges same-named entries across plugins.

```json
{ "lint-checker": { "PostToolUse": [ { "matcher": "run_command", "hooks": [ { "type": "command", "command": "node \"./bin/lint.mjs\"", "timeout": 10 } ] } ] } }
```

`PreToolUse` and `PostToolUse` wrap handlers in a `{ matcher, hooks }` group. The other three are flat lists of handler objects. `enabled: false` at the hook level disables all its handlers.

The host runs each command through `sh -c` with the working directory set to the manifest's directory, so generated commands are manifest-relative and survive install unchanged. Matcher `"*"` or `""` matches all tools; tool names are the step type lowercased minus the `CORTEX_STEP_TYPE_` prefix.

## Wire invariants

Antigravity has no exit-code channel. Every outcome exits `0`:

- Normal result: the builder's `stdout` object as JSON; `null`/`undefined` writes `{}`.
- `AntigravityBlockError`: `{ "decision": "deny", "reason": ... }` plus attached fields. The host acts on this for `PreToolUse` only.
- Unexpected failure: stack trace to stderr, `{}` to stdout.

Never replace a payload decision with a nonzero exit code. Keep `outputs.ts`, `transport.ts`, and the conformance test aligned when this changes.

All five events reject `unexpectedError: "continue"` at the type and runtime gates; the advisory allow-list is empty because the host reference names no event safe to fail open. `AntigravityBlockError` survives any future widening — the shared driver classifies block errors before applying policy.

## Verification

```bash
yarn workspace @goodfoot/agent-hooks vitest run \
  tests/agents/antigravity \
  tests/conformance/antigravity.test.ts
yarn workspace @goodfoot/agent-hooks typecheck
```

Re-verify `CONTRACT.md` against the binary when `agy` changes minor version, and record the version with the result.
