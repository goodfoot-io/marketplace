# Reviewing Types Against Claude Code Implementation

This document describes how to verify that the `@goodfoot/claude-code-hooks` package types match the actual Claude Code implementation.

## Overview

The type definitions in this package must precisely match what Claude Code actually sends to hooks. There are three sources of truth, in order of authority:

1. **`@anthropic-ai/claude-code` CLI** (`node_modules/@anthropic-ai/claude-code/cli.js`) - The actual runtime implementation
2. **`@anthropic-ai/claude-agent-sdk` types** (`node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.d.ts`) - TypeScript declarations
3. **Claude Code documentation** (https://code.claude.com/docs/en/hooks) - User-facing docs

The CLI is the ultimate source of truth since it's what actually runs.

## Step 1: Read SDK Types

Start by examining the SDK type declarations:

```bash
# Find the SDK types file
ls node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/

# Read the types
cat node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.d.ts
```

Key types to examine:

- `BaseHookInput` - Common fields for all hook inputs
- `*HookInput` types (e.g., `PreToolUseHookInput`, `SubagentStopHookInput`)
- `SyncHookJSONOutput` - The output format
- `HookInput` union type - All possible input types

## Step 2: Compare Against Our Implementation

Compare each hook input type in `src/types/inputs.ts` against the SDK:

```typescript
// SDK uses snake_case
type PreToolUseHookInput = BaseHookInput & {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
};

// Our implementation uses camelCase (transform snake_case to camelCase)
export interface PreToolUseInput extends BaseHookInput {
  hookEventName: 'PreToolUse';
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
}
```

Check that each field in the SDK type has a corresponding camelCase field in our type.

## Step 3: Verify Against CLI Source (Ultimate Truth)

When the SDK types and our implementation disagree, or when you need to confirm exact behavior, check the CLI source:

```bash
# Find where hooks are constructed in the CLI
grep -o "hook_event_name.*PreToolUse\|hook_event_name.*SubagentStop" \
  node_modules/@anthropic-ai/claude-code/cli.js | head -20

# Find specific hook input construction
grep -o "SubagentStop.*agent_id\|agent_type.*SubagentStop" \
  node_modules/@anthropic-ai/claude-code/cli.js | head -10
```

### Example: Finding SubagentStop Fields

```bash
grep -o "SubagentStop.*stop_hook_active\|agent_id.*agent_transcript" \
  node_modules/@anthropic-ai/claude-code/cli.js
```

Output reveals the actual fields:

```
SubagentStop",stop_hook_active:G,agent_id:Z,agent_transcript_path:DWA(Z)
```

This tells us SubagentStop has:

- `stop_hook_active` (boolean)
- `agent_id` (string)
- `agent_transcript_path` (string)

### Example: Finding PermissionRequest Fields

Look at the hook description in the CLI:

```bash
grep -o "PermissionRequest.*tool_use_id\|PermissionRequest.*description" \
  node_modules/@anthropic-ai/claude-code/cli.js
```

The description text confirms the fields:

```
PermissionRequest:{summary:"...",description:"Input to command is JSON with tool_name, tool_input, and tool_use_id...
```

## Step 4: Verify Output Types

For output types, check `SyncHookJSONOutput` in the SDK:

```typescript
// SDK output type
type SyncHookJSONOutput = {
    continue?: boolean;
    suppressOutput?: boolean;
    stopReason?: string;
    decision?: 'approve' | 'block';
    systemMessage?: string;
    reason?: string;
    hookSpecificOutput?: { ... };
};
```

Ensure our `SyncHookJSONOutput` interface in `outputs.ts` matches exactly.

## Common Discrepancies

### 1. Missing Fields

The SDK types might be incomplete. If the CLI sends a field that's not in the SDK types, add it to our types.

Example: `PermissionRequest` in the SDK didn't have `tool_use_id`, but the CLI description confirmed it's sent.

### 2. Extra Fields

Our types might have fields the CLI doesn't actually send. Remove them.

Example: `SubagentStopInput` had `agentType` but the CLI only sends `agent_id` and `agent_transcript_path`.

### 3. Casing Mismatches

Remember to convert snake_case to camelCase:

- `tool_name` → `toolName`
- `hook_event_name` → `hookEventName`
- `agent_transcript_path` → `agentTranscriptPath`

## Verification Checklist

For each hook type, verify:

- [ ] All SDK fields have corresponding camelCase fields
- [ ] No extra fields not in SDK/CLI
- [ ] Field types match (string, boolean, unknown, etc.)
- [ ] Optional fields are marked with `?`
- [ ] JSDoc comments are accurate

## Running Type Tests

After making changes, run the type tests:

```bash
cd packages/claude-code-hooks
yarn test tests/types
```

All tests should pass after corrections.

## Updating Documentation

After fixing types, update the skill documentation:

- `plugins/claude-code-hooks/skills/claude-code-hooks/reference/output-builders.md`
- `plugins/claude-code-hooks/skills/claude-code-hooks/SKILL.md`

Ensure the documented input types match the actual implementation.

## Quick Reference Commands

```bash
# View all hook event types
grep "HOOK_EVENTS" node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.d.ts

# View base hook input
grep -A10 "BaseHookInput" node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.d.ts

# View specific hook input (replace HookName)
grep -A10 "HookNameHookInput" node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.d.ts

# Search CLI for hook construction
grep -o "hook_event_name.*HookName" node_modules/@anthropic-ai/claude-code/cli.js

# View output type
grep -A20 "SyncHookJSONOutput" node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.d.ts
```
