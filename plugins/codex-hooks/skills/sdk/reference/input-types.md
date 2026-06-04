<instructions>

This document describes the typed hook inputs in `@goodfoot/codex-hooks`. Shapes are derived from the wire schemas under `third_party/reference/codex/codex-rs/hooks/schema/generated/*.input.schema.json`. When the docs and the schemas disagree, the schemas win.

## Common Hook Input Fields

Every hook input includes these base fields:

```typescript
interface BaseHookInput {
  cwd: string;                       // Working directory at the time of dispatch
  hook_event_name: HookEventName;    // Discriminator (PascalCase event name)
  model: string;                     // Model id Codex was running with
  session_id: string;                // Unique session identifier
  transcript_path: string | null;    // Path to conversation transcript (null if not yet persisted)
}
```

Most events also include:
- `permission_mode: PermissionMode` — `'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'`
- `turn_id: string` — identifies the current turn
- `agent_id?: string`, `agent_type?: string` — present when the event was dispatched from inside a subagent

## Per-Event Input Fields

### PreToolUse

Matcher dimension: `tool_name`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `tool_name` | `string` | yes | Tool identifier (Codex tool name) |
| `tool_input` | `unknown` | yes | Tool-defined payload — narrow with a type guard |
| `tool_use_id` | `string` | yes | Stable ID for this specific tool invocation |
| `permission_mode` | `PermissionMode` | yes | |
| `turn_id` | `string` | yes | |
| `agent_id` | `string` | no | Set when invoked from a subagent |
| `agent_type` | `string` | no | Set when invoked from a subagent |

### PostToolUse

Matcher dimension: `tool_name`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `tool_name` | `string` | yes | |
| `tool_input` | `unknown` | yes | |
| `tool_response` | `unknown` | yes | Tool-defined response payload |
| `tool_use_id` | `string` | yes | |
| `permission_mode` | `PermissionMode` | yes | |
| `turn_id` | `string` | yes | |
| `agent_id` | `string` | no | |
| `agent_type` | `string` | no | |

### PermissionRequest

Matcher dimension: `tool_name`. Note: no `tool_use_id`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `tool_name` | `string` | yes | |
| `tool_input` | `unknown` | yes | |
| `permission_mode` | `PermissionMode` | yes | |
| `turn_id` | `string` | yes | |
| `agent_id` | `string` | no | |
| `agent_type` | `string` | no | |

### UserPromptSubmit

No matcher dimension (the `matcher` field is parsed but ignored).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `prompt` | `string` | yes | User-submitted text |
| `permission_mode` | `PermissionMode` | yes | |
| `turn_id` | `string` | yes | |
| `agent_id` | `string` | no | |
| `agent_type` | `string` | no | |

### SessionStart

Matcher dimension: `source` ∈ `'startup' | 'resume' | 'clear' | 'compact'`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `source` | `SessionStartSource` | yes | `'compact'` is Codex-specific (fires when a session is rehydrated after compaction) |
| `permission_mode` | `PermissionMode` | yes | |

### SubagentStart

Matcher dimension: `agent_type`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `agent_id` | `string` | yes | |
| `agent_type` | `string` | yes | |
| `permission_mode` | `PermissionMode` | yes | |
| `turn_id` | `string` | yes | |

### Stop

No matcher dimension.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `stop_hook_active` | `boolean` | yes | `true` when this hook was already invoked in the current stop cycle (use to avoid loops) |
| `last_assistant_message` | `string \| null` | yes | Final assistant turn text, if any |
| `permission_mode` | `PermissionMode` | yes | |
| `turn_id` | `string` | yes | |

### SubagentStop

Matcher dimension: `agent_type`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `agent_id` | `string` | yes | |
| `agent_type` | `string` | yes | |
| `agent_transcript_path` | `string \| null` | yes | Path to the subagent transcript |
| `stop_hook_active` | `boolean` | yes | |
| `last_assistant_message` | `string \| null` | yes | |
| `permission_mode` | `PermissionMode` | yes | |
| `turn_id` | `string` | yes | |

### PreCompact

Matcher dimension: `trigger` ∈ `'manual' | 'auto'`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `trigger` | `PreCompactTrigger` | yes | |
| `turn_id` | `string` | yes | |
| `agent_id` | `string` | no | |
| `agent_type` | `string` | no | |

### PostCompact

Matcher dimension: `trigger` ∈ `'manual' | 'auto'`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `trigger` | `PreCompactTrigger` | yes | |
| `turn_id` | `string` | yes | |
| `agent_id` | `string` | no | |
| `agent_type` | `string` | no | |

## The Discriminated Union

```typescript
type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | PermissionRequestInput
  | UserPromptSubmitInput
  | SessionStartInput
  | SubagentStartInput
  | StopInput
  | SubagentStopInput
  | PreCompactInput
  | PostCompactInput;
```

`hook_event_name` is the discriminant. Each factory narrows the union to its own variant — you do not need to switch on it inside a hook body.

## Narrowing `tool_input`

`tool_input` is intentionally typed as `unknown` on `PreToolUseInput`, `PostToolUseInput`, and `PermissionRequestInput`. Codex tools are defined by the host; the SDK does not ship per-tool schemas. Narrow with user-defined type guards:

```typescript
interface ShellToolInput {
  command: string;
  cwd?: string;
  timeout_ms?: number;
}

function isShellInput(value: unknown): value is ShellToolInput {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.command === 'string';
}

export default preToolUseHook({ matcher: 'shell' }, (input) => {
  if (!isShellInput(input.tool_input)) {
    return preToolUseOutput({});
  }
  // input.tool_input is ShellToolInput here
  const command = input.tool_input.command;
  // ...
});
```

### Schema-validated narrowing

For stricter inputs, validate with Zod or another schema validator and treat parse failure as a pass-through:

```typescript
import { z } from 'zod';

const shellSchema = z.object({
  command: z.string(),
  cwd: z.string().optional(),
  timeout_ms: z.number().int().nonnegative().optional()
});

export default preToolUseHook({ matcher: 'shell' }, (input) => {
  const parsed = shellSchema.safeParse(input.tool_input);
  if (!parsed.success) return preToolUseOutput({});
  const { command } = parsed.data;
  // ...
});
```

### Why no built-in tool helpers?

`@goodfoot/claude-code-hooks` ships `isBashTool`, `isWriteTool`, `getFilePath`, etc., because Claude Code's tool set is fixed and known to the SDK. Codex tools (shell, MCP-provided tools, host extensions) are open-ended, so `@goodfoot/codex-hooks` deliberately does not ship per-tool predicates. Define them locally in your hook code or in a shared module.

## Re-exported Types

```typescript
import type {
  BaseHookInput,
  HookEventName,
  HookInput,
  PreToolUseInput,
  PostToolUseInput,
  PermissionRequestInput,
  UserPromptSubmitInput,
  SessionStartInput,
  SubagentStartInput,
  StopInput,
  SubagentStopInput,
  PreCompactInput,
  PostCompactInput,
  PermissionMode,
  SessionStartSource,
  PreCompactTrigger,
  MatcherHookConfig,
  NoMatcherHookConfig
} from '@goodfoot/codex-hooks';
```

</instructions>
