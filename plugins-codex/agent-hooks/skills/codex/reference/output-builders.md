<instructions>

This document covers all 10 Codex output builders. Builders are derived from the wire schemas under `third_party/reference/codex/codex-rs/hooks/schema/generated/*.output.schema.json`.

Builder option types are **flat**: callers pass `additionalContext`, `permissionDecision`, `behavior`, etc. directly as top-level options. The builder constructs the wire-level `hookSpecificOutput` envelope internally — you never pass `hookSpecificOutput` yourself.

Every output supports the **universal envelope**:

```typescript
interface UniversalEnvelope {
  continue?: boolean;        // default true
  stopReason?: string;       // surfaced to the user if continue=false
  suppressOutput?: boolean;  // default false — hides hook output from UI
  systemMessage?: string;    // injected into Codex's system context
}
```

The tables below describe **what each builder can do beyond the envelope**.

## 1. preToolUseOutput

Matcher dimension on the hook: `tool_name`.

```typescript
interface PreToolUseOptions {
  // universal envelope
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  // legacy decision (kept for backward compat)
  decision?: 'approve' | 'block';
  reason?: string;
  // canonical hook-specific fields (flat)
  permissionDecision?: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
  additionalContext?: string;
  updatedInput?: unknown;        // only honored when permissionDecision === 'allow'
}
```

**Decision matrix:**

| Goal | Field |
|------|-------|
| Allow | `permissionDecision: 'allow'` |
| Deny  | `permissionDecision: 'deny'` + `permissionDecisionReason` |
| Defer to user | `permissionDecision: 'ask'` (reserved — see Codex limits) |
| Inject context after-the-fact | `additionalContext` |
| Rewrite tool args | `updatedInput` (paired with `permissionDecision: 'allow'`) |
| Legacy hard block | `decision: 'block'`, `reason` |

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/agent-hooks/codex';

export default preToolUseHook({ matcher: 'shell' }, (input, { logger }) => {
  const cmd = isShellInput(input.tool_input) ? input.tool_input.command : '';
  if (cmd.startsWith('curl ')) {
    return preToolUseOutput({
      systemMessage: 'Network requests via curl are blocked.',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Policy: curl is disabled.'
    });
  }
  return preToolUseOutput({});
});

function isShellInput(value: unknown): value is { command: string } {
  return typeof value === 'object' && value !== null && typeof (value as { command?: unknown }).command === 'string';
}
```

## 2. postToolUseOutput

Matcher dimension: `tool_name`.

```typescript
interface PostToolUseOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: 'block';   // PostToolUse can block follow-up turns
  reason?: string;
  additionalContext?: string;
  updatedMCPToolOutput?: unknown;  // rewrite MCP tool output before Codex consumes it
}
```

```typescript
import { postToolUseHook, postToolUseOutput } from '@goodfoot/agent-hooks/codex';

export default postToolUseHook({ matcher: 'shell' }, () => {
  return postToolUseOutput({
    systemMessage: 'Shell command finished.',
    additionalContext: 'Validated by post-tool hook.'
  });
});
```

## 3. permissionRequestOutput

Matcher dimension: `tool_name`. Distinct from `preToolUseOutput` — at the wire level it emits a nested `decision` object, but the builder option type is flat. `behavior` is **required**.

```typescript
interface PermissionRequestOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  behavior: 'allow' | 'deny';     // REQUIRED
  message?: string;               // shown to the user
  interrupt?: boolean;            // reserved — fail-closed in some Codex builds
  updatedInput?: unknown;         // reserved — fail-closed
  updatedPermissions?: unknown;   // reserved — fail-closed
}
```

**Critical:** emit `interrupt`, `updatedInput`, and `updatedPermissions` only when you have confirmed the target Codex build supports them. Stricter builds reject the message entirely when reserved fields are present.

```typescript
import { permissionRequestHook, permissionRequestOutput } from '@goodfoot/agent-hooks/codex';

export default permissionRequestHook({ matcher: 'shell' }, (input, { logger }) => {
  const cmd = isShellInput(input.tool_input) ? input.tool_input.command : '';
  if (cmd.startsWith('echo ')) {
    return permissionRequestOutput({ behavior: 'allow' });
  }
  return permissionRequestOutput({
    behavior: 'deny',
    message: 'Command not auto-approved.'
  });
});

function isShellInput(value: unknown): value is { command: string } {
  return typeof value === 'object' && value !== null && typeof (value as { command?: unknown }).command === 'string';
}
```

## 4. userPromptSubmitOutput

No matcher (the `matcher` field is parsed but ignored).

```typescript
interface UserPromptSubmitOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: 'block';     // block the prompt from reaching the model
  reason?: string;
  additionalContext?: string;
}
```

```typescript
import { userPromptSubmitHook, userPromptSubmitOutput } from '@goodfoot/agent-hooks/codex';

export default userPromptSubmitHook({}, () => {
  return userPromptSubmitOutput({
    additionalContext: JSON.stringify({ projectName: 'acme', version: '3.2.1' })
  });
});
```

## 5. sessionStartOutput

Matcher dimension: `source` ∈ `'startup' | 'resume' | 'clear' | 'compact'`.

```typescript
interface SessionStartOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  additionalContext?: string;
}
```

```typescript
import { sessionStartHook, sessionStartOutput } from '@goodfoot/agent-hooks/codex';

export default sessionStartHook({ matcher: 'startup' }, () => {
  return sessionStartOutput({
    additionalContext: 'Project conventions: strict TypeScript, no `any`.'
  });
});
```

## 6. subagentStartOutput

Matcher dimension: `agent_type`.

```typescript
interface SubagentStartOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  additionalContext?: string;
}
```

```typescript
import { subagentStartHook, subagentStartOutput } from '@goodfoot/agent-hooks/codex';

export default subagentStartHook({ matcher: 'explore' }, () => {
  return subagentStartOutput({
    additionalContext: 'Explore subagent: produce a markdown summary before stopping.'
  });
});
```

## 7. stopOutput

No matcher.

```typescript
interface StopOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: 'block';   // required to actually block stop
  reason?: string;      // REQUIRED when decision === 'block'
}
```

```typescript
import { stopHook, stopOutput } from '@goodfoot/agent-hooks/codex';

export default stopHook({}, () => {
  const ready = false;
  if (!ready) {
    return stopOutput({
      decision: 'block',
      reason: 'Pending operations must complete first.',
      systemMessage: 'Stop blocked.'
    });
  }
  return stopOutput({});
});
```

## 8. subagentStopOutput

Matcher dimension: `agent_type`.

```typescript
interface SubagentStopOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: 'block';
  reason?: string;      // REQUIRED when decision === 'block'
}
```

```typescript
import { subagentStopHook, subagentStopOutput } from '@goodfoot/agent-hooks/codex';

export default subagentStopHook({ matcher: 'explore' }, (input) => {
  if (input.last_assistant_message === null) {
    return subagentStopOutput({
      decision: 'block',
      reason: 'Subagent produced no final message.'
    });
  }
  return subagentStopOutput({});
});
```

## 9. preCompactOutput

Matcher dimension: `trigger` ∈ `'manual' | 'auto'`. **Universal envelope only** — no `hookSpecificOutput`.

```typescript
interface PreCompactOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}
```

```typescript
import { preCompactHook, preCompactOutput } from '@goodfoot/agent-hooks/codex';

export default preCompactHook({ matcher: 'auto' }, () => {
  return preCompactOutput({
    systemMessage: 'Preserve: project uses strict TypeScript and Yarn 4.'
  });
});
```

## 10. postCompactOutput

Matcher dimension: `trigger` ∈ `'manual' | 'auto'`. **Universal envelope only.**

```typescript
interface PostCompactOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}
```

```typescript
import { postCompactHook, postCompactOutput } from '@goodfoot/agent-hooks/codex';

export default postCompactHook({}, () => {
  return postCompactOutput({
    systemMessage: 'Compaction complete.'
  });
});
```

## All 10 Hook Types Reference

| Event | Factory | Builder | Matcher Dimension |
|-------|---------|---------|--------------------|
| PreToolUse | `preToolUseHook` | `preToolUseOutput` | `tool_name` |
| PostToolUse | `postToolUseHook` | `postToolUseOutput` | `tool_name` |
| PermissionRequest | `permissionRequestHook` | `permissionRequestOutput` | `tool_name` |
| UserPromptSubmit | `userPromptSubmitHook` | `userPromptSubmitOutput` | none (matcher parsed but ignored) |
| SessionStart | `sessionStartHook` | `sessionStartOutput` | `source` |
| SubagentStart | `subagentStartHook` | `subagentStartOutput` | `agent_type` |
| Stop | `stopHook` | `stopOutput` | none |
| SubagentStop | `subagentStopHook` | `subagentStopOutput` | `agent_type` |
| PreCompact | `preCompactHook` | `preCompactOutput` | `trigger` |
| PostCompact | `postCompactHook` | `postCompactOutput` | `trigger` |

## Decision Field Cheat Sheet

| Goal | Hook | Use |
|------|------|-----|
| Allow a tool | PreToolUse | `permissionDecision: 'allow'` |
| Deny a tool | PreToolUse | `permissionDecision: 'deny'` + reason |
| Defer to user (reserved) | PreToolUse | `permissionDecision: 'ask'` |
| Allow a permission request | PermissionRequest | `behavior: 'allow'` |
| Deny a permission request | PermissionRequest | `behavior: 'deny'` (+ `message?`) |
| Block follow-up after PostToolUse | PostToolUse | `decision: 'block'` + `reason` |
| Block prompt submission | UserPromptSubmit | `decision: 'block'` + `reason` |
| Block stop | Stop / SubagentStop | `decision: 'block'` + `reason` (required) |
| Inject context | SessionStart / SubagentStart / UserPromptSubmit / Pre+PostToolUse | `additionalContext` |

## Important Behaviors

- `updatedInput` on `preToolUseOutput` is only honored when `permissionDecision: 'allow'`.
- `interrupt`, `updatedInput`, and `updatedPermissions` on `permissionRequestOutput` are reserved fields. Emit only when you have validated the target Codex build supports them.
- `PreCompact` and `PostCompact` have no `hookSpecificOutput` — schema constraint, not omission.
- Codex disables hooks on Windows. Manifests are still parsed but commands never run.
- Async config-side hooks (entries declared as async in configuration) are parsed but not currently executed.

</instructions>
