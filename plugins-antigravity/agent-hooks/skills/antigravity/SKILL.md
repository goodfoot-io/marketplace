---
name: antigravity
description: Load this skill immediately after a user mentions Antigravity hooks
  or the Antigravity surface of @goodfoot/agent-hooks. Covers the current
  in-repo implementation and its unpublished limits.
---

# Antigravity hooks

Use the Antigravity surface only for repository development, review, and conformance work in `packages/agent-hooks/src/agents/antigravity`.

## Current release boundary

Antigravity is not a consumable `@goodfoot/agent-hooks` target yet:

- `@goodfoot/agent-hooks/antigravity` is not in the package `exports` map.
- The build CLI recognizes `--agent antigravity` but rejects it as unimplemented.
- Scaffolding and installation are not supported.
- No authoritative Antigravity protocol document or runnable non-interactive host CLI is pinned in this repository.

Do not suggest imports from `@goodfoot/agent-hooks/antigravity`, an Antigravity build command, or production use. Do not infer additional wire fields or behavior from the Claude Code or Codex implementations. When asked to enable the public target, treat that as implementation work requiring the export map, CLI/compiler path, host contract, and end-to-end coverage—not as a documentation-only change.

## Implemented surface

The in-repo module exposes five typed factories and their matching output builders:

| Event | Factory | Builder | Event fields |
| --- | --- | --- | --- |
| `PreToolUse` | `preToolUseHook` | `preToolUseOutput` | `tool_name`, `tool_input` |
| `PostToolUse` | `postToolUseHook` | `postToolUseOutput` | `tool_name`, `tool_input`, `tool_response` |
| `PreInvocation` | `preInvocationHook` | `preInvocationOutput` | `prompt` |
| `PostInvocation` | `postInvocationHook` | `postInvocationOutput` | `response` |
| `Stop` | `stopHook` | `stopOutput` | `last_assistant_message` |

Every input also has `cwd`, `hook_event_name`, and `session_id`. `matcher` is accepted only by `PreToolUse` and `PostToolUse`; every factory accepts `timeout`, `unexpectedError`, and `onUnexpectedError` in its common configuration shape.

Output builders omit fields whose values are `undefined`. Their supported options are:

- `preToolUseOutput`: `decision`, `reason`, `additionalContext`, `updatedInput`, `systemMessage`.
- `postToolUseOutput`: `decision`, `reason`, `additionalContext`, `systemMessage`; decision is limited to `allow | deny`.
- `preInvocationOutput`: `decision`, `reason`, `additionalContext`, `systemMessage`; decision is limited to `allow | deny | ask`.
- `postInvocationOutput`: `additionalContext`, `systemMessage`.
- `stopOutput`: `stop`, `reason`, `systemMessage`.

The full pre-tool decision vocabulary is `allow | deny | ask | force_ask | deny_unless_prior_grant`. Treat the meanings documented in source as provisional until an authoritative host contract is available.

## Wire and failure invariants

Antigravity has no exit-code signaling channel. Every transport outcome exits `0`:

- A normal result writes the builder's `stdout` object as JSON; `null` or `undefined` writes `{}`.
- `AntigravityBlockError` writes `{ "decision": "deny", "reason": ... }` to stdout, merging any attached fields.
- An unexpected failure writes a diagnostic stack trace to stderr and `{}` to stdout.

Do not replace payload decisions with nonzero exit codes. Keep `outputs.ts`, `transport.ts`, and the conformance test's wire-fundamentals assertions aligned whenever this invariant changes.

Although the common config includes `unexpectedError`, all five events currently reject `unexpectedError: "continue"` at both the type and runtime policy gates. The advisory allow-list is deliberately empty until a future host contract identifies an event that is safe to fail open. `AntigravityBlockError` remains a block even if that policy is expanded later because the shared driver classifies block errors before applying unexpected-error policy.

## Repository verification

Use direct relative imports from `src/agents/antigravity/index.js` only in repository tests. After changing this surface, run the Antigravity unit and conformance tests, then the package typecheck:

```bash
yarn workspace @goodfoot/agent-hooks vitest run \
  tests/agents/antigravity \
  tests/conformance/antigravity.test.ts
yarn workspace @goodfoot/agent-hooks typecheck
```

Keep claims in this skill grounded in the implementation and conformance matrix. Replace the provisional boundaries only when the repository gains an authoritative contract and runnable host validation.
