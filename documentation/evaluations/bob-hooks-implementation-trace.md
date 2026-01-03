# Claude Code Hooks Implementation Trace

This document traces Alice's user journey through the `@goodfoot/claude-code-hooks` library implementation. For each hook type and feature described in the documentation, I identify where support exists in the source code, note API differences, and flag gaps where the library does not match what the documentation promises or where library features go beyond documentation.

---

## 1. Overview: The Hooks Configuration Experience

Alice describes three settings file locations where hooks are configured:
- `~/.claude/settings.json` for user-wide settings
- `.claude/settings.json` for project-specific settings
- `.claude/settings.local.json` for local project settings

These are Claude Code configuration files, not part of this library. The library provides a **TypeScript-first authoring experience** that compiles hooks into the format Claude Code expects.

### Library Approach vs. Documentation

The library provides an alternative workflow: instead of hand-writing JSON in settings files, developers:

1. Write TypeScript hooks using factory functions (`preToolUseHook`, `sessionStartHook`, etc.)
2. Use the CLI tool to compile hooks into standalone `.mjs` executables
3. The CLI generates a `hooks.json` file with the correct structure

The CLI is documented in `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/cli/index.ts`. It parses hook files at lines 299-409 using TypeScript AST analysis to extract metadata (hook type, matcher, timeout), then generates the hooks.json structure at lines 624-658.

The generated hooks.json format at line 99-109:

```typescript
interface HooksJson {
  hooks: Partial<Record<HookEventName, MatcherEntry[]>>;
  __generated: {
    files: string[];
    timestamp: string;
  };
}
```

<gap>The documentation describes the interactive `/hooks` slash command for managing hooks in Claude Code. This is a Claude Code feature, not something the library implements. The library provides no equivalent interactive configuration interface.</gap>

---

## 2. PreToolUse Hook Implementation

### Configuration in the Library

Alice describes JSON configuration:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/validator.py",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

The library equivalent is in `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:319-324`:

```typescript
export function preToolUseHook(
  config: HookConfig,
  handler: HookHandler<PreToolUseInput, PreToolUseOutput>
): HookFunction<PreToolUseInput, PreToolUseOutput> {
  return createHookFunction('PreToolUse', config, handler);
}
```

The `HookConfig` interface at lines 98-147 supports:

```typescript
export interface HookConfig {
  matcher?: string;  // Matches against toolName
  timeout?: number;  // Timeout in milliseconds
}
```

<gap>Alice documents the timeout default as 60 seconds. The library's `HookConfig` interface defines timeout as optional with no default specified. The actual default timeout depends on the runtime, which is not documented in the library. The `timeout` property is in milliseconds in the library but seconds in the configuration JSON.</gap>

### Input Structure

Alice describes the input structure with snake_case fields. The library provides camelCase types at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:103-124`:

```typescript
export interface PreToolUseInput extends BaseHookInput {
  hookEventName: 'PreToolUse';
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
}
```

The runtime at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/runtime.ts:107-127` handles snake_case to camelCase transformation automatically:

```typescript
export function snakeToCamelCase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  // ... transforms all keys recursively
}
```

This matches Alice's documented input structure. The `session_id` becomes `sessionId`, `tool_name` becomes `toolName`, etc.

### Output Structure

Alice describes two output mechanisms: exit codes and JSON output.

**Exit Code Method:**

The library defines exit codes at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:26-33`:

```typescript
export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  BLOCK: 2
} as const;
```

This matches Alice's documentation:
- Exit code 0: Hook succeeds
- Exit code 2: Hook blocks the tool call
- Other exit codes: Non-blocking error

**JSON Output Method:**

The `preToolUseOutput` builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:620-670` supports:

```typescript
export type PreToolUseOptions = BaseOptions &
  (
    | { allow: true; deny?: never; ask?: never; updatedInput?: Record<string, unknown>; }
    | { deny: string; allow?: never; ask?: never; updatedInput?: never; }
    | { ask: string; allow?: never; deny?: never; updatedInput?: never; }
    | { allow?: never; deny?: never; ask?: never; updatedInput?: Record<string, unknown>; }
  );
```

This maps to Alice's documented JSON format:
- `permissionDecision: "allow"` -> `{ allow: true }`
- `permissionDecision: "deny"` -> `{ deny: "reason" }`
- `permissionDecision: "ask"` -> `{ ask: "reason" }`
- `updatedInput` -> `{ allow: true, updatedInput: {...} }`

The runtime at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/runtime.ts:329-340` converts the library's format to Claude Code's expected `hookSpecificOutput` format:

```typescript
if (hookEventName === 'PreToolUse' && 'decision' in stdout && stdout.decision !== undefined) {
  hookSpecific.permissionDecision = stdout.decision;
  if ('reason' in stdout && stdout.reason !== undefined) {
    hookSpecific.permissionDecisionReason = stdout.reason;
  }
  // ...
}
```

### Fixture Example

The e2e fixture at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/e2e/fixtures/deny-bash-hook.ts` demonstrates usage:

```typescript
export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const command = (input.toolInput as { command?: string }).command ?? '';
  logger.info('Denying Bash command', { command });

  return preToolUseOutput({
    deny: 'Bash commands are blocked by test hook'
  });
});
```

---

## 3. PermissionRequest Hook Implementation

Alice describes PermissionRequest hooks running when Claude Code is about to show a permission dialog.

### Configuration Support

The factory is at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:823-828`:

```typescript
export function permissionRequestHook(
  config: HookConfig,
  handler: HookHandler<PermissionRequestInput, PermissionRequestOutput>
): HookFunction<PermissionRequestInput, PermissionRequestOutput> {
  return createHookFunction('PermissionRequest', config, handler);
}
```

### Input Structure

The input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:535-554`:

```typescript
export interface PermissionRequestInput extends BaseHookInput {
  hookEventName: 'PermissionRequest';
  toolName: string;
  toolInput: unknown;
  permissionSuggestions?: PermissionUpdate[];
}
```

<gap>Alice's documentation states the input structure is "similar to PreToolUse" but does not mention the `permissionSuggestions` field. The library exposes this field which contains suggested permission updates for "always allow" functionality. This is an undocumented input field.</gap>

### Output Structure

The output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:1382-1414` and `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:1446-1491`:

```typescript
export type PermissionRequestOptions = BaseOptions &
  (
    | {
        allow: true;
        updatedInput?: Record<string, unknown>;
        updatedPermissions?: PermissionUpdate[];
        deny?: never;
        interrupt?: never;
      }
    | {
        deny: true;
        message?: string;
        interrupt?: boolean;
        allow?: never;
        updatedInput?: never;
        updatedPermissions?: never;
      }
    | {
        allow?: never;
        deny?: never;
        // Fall through to normal permission prompt
      }
  );
```

Alice documents:
- `"behavior": "allow"` with optional `updatedInput` -> `{ allow: true, updatedInput?: {...} }`
- `"behavior": "deny"` with optional `message` and `interrupt` -> `{ deny: true, message?: "...", interrupt?: true }`

The library matches this and adds `updatedPermissions?: PermissionUpdate[]` for allow decisions.

<gap>The library supports `updatedPermissions` on allow decisions, which allows hooks to suggest future permission grants. This is not documented in Alice's report.</gap>

### Fixture Example

At `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/e2e/fixtures/permission-auto-allow-hook.ts`:

```typescript
export default permissionRequestHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const command = input.toolInput as { command?: string };

  if (command.command?.startsWith('echo ')) {
    logger.info('Auto-allowing echo command', { command: command.command });
    return permissionRequestOutput({
      allow: true,
      systemMessage: 'E2E_PERMISSION: Echo command auto-approved.'
    });
  }

  return permissionRequestOutput({});
});
```

---

## 4. PostToolUse Hook Implementation

Alice describes PostToolUse hooks running after a tool completes successfully.

### Configuration Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:358-363`:

```typescript
export function postToolUseHook(
  config: HookConfig,
  handler: HookHandler<PostToolUseInput, PostToolUseOutput>
): HookFunction<PostToolUseInput, PostToolUseOutput> {
  return createHookFunction('PostToolUse', config, handler);
}
```

### Input Structure

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:147-172`:

```typescript
export interface PostToolUseInput extends BaseHookInput {
  hookEventName: 'PostToolUse';
  toolName: string;
  toolInput: unknown;
  toolResponse: unknown;
  toolUseId: string;
}
```

This matches Alice's documented structure including `tool_response`.

### Output Structure

The output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:679-691`:

```typescript
export interface PostToolUseOptions extends BaseOptions {
  additionalContext?: string;
  updatedMCPToolOutput?: unknown;
}
```

Alice documents:
- `additionalContext` for adding context to Claude
- `decision: "block"` with `reason`

The library supports:
- `additionalContext` (matches)
- `block` option in `BaseOptions` (matches the block behavior)
- `updatedMCPToolOutput` for modifying MCP tool responses

<gap>The library supports `updatedMCPToolOutput` to modify MCP tool output before it's shown to Claude. This is not documented in Alice's report.</gap>

---

## 5. PostToolUseFailure Hook Implementation

Alice does not document this hook type, but the library fully supports it.

### Library Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:399-404`:

```typescript
export function postToolUseFailureHook(
  config: HookConfig,
  handler: HookHandler<PostToolUseFailureInput, PostToolUseFailureOutput>
): HookFunction<PostToolUseFailureInput, PostToolUseFailureOutput> {
  return createHookFunction('PostToolUseFailure', config, handler);
}
```

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:195-223`:

```typescript
export interface PostToolUseFailureInput extends BaseHookInput {
  hookEventName: 'PostToolUseFailure';
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
  error: string;
  isInterrupt?: boolean;
}
```

<gap>PostToolUseFailure is a valid hook type supported by the library but is not documented in Alice's user journey. This hook fires when tool execution fails, allowing hooks to respond to failures with additional context.</gap>

---

## 6. UserPromptSubmit Hook Implementation

### Configuration Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:480-485`:

```typescript
export function userPromptSubmitHook(
  config: HookConfig,
  handler: HookHandler<UserPromptSubmitInput, UserPromptSubmitOutput>
): HookFunction<UserPromptSubmitInput, UserPromptSubmitOutput> {
  return createHookFunction('UserPromptSubmit', config, handler);
}
```

Alice notes this hook does not use matchers. The library accepts `HookConfig` but the documentation at line 459 confirms: "No matcher support - fires on all prompt submissions."

### Input Structure

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:284-292`:

```typescript
export interface UserPromptSubmitInput extends BaseHookInput {
  hookEventName: 'UserPromptSubmit';
  prompt: string;
}
```

This matches Alice's documented structure.

### Output Structure

Output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:825-831`:

```typescript
export interface UserPromptSubmitOptions extends BaseOptions {
  additionalContext?: string;
}
```

Alice documents:
- Plain text stdout adds context
- JSON with `decision: "block"` and `reason` blocks the prompt

The library supports:
- `additionalContext` for injecting context
- `block` option in `BaseOptions` for blocking with a reason

This matches the documented behavior.

---

## 7. Notification Hook Implementation

### Configuration Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:440-445`:

```typescript
export function notificationHook(
  config: HookConfig,
  handler: HookHandler<NotificationInput, NotificationOutput>
): HookFunction<NotificationInput, NotificationOutput> {
  return createHookFunction('Notification', config, handler);
}
```

Alice documents notification types:
- `permission_prompt`
- `idle_prompt`
- `auth_success`
- `elicitation_dialog`

The matcher matches against `notificationType` according to the JSDoc at line 417.

### Input Structure

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:244-262`:

```typescript
export interface NotificationInput extends BaseHookInput {
  hookEventName: 'Notification';
  message: string;
  title?: string;
  notificationType: string;
}
```

This matches Alice's documented structure.

### Output Structure

Output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:1249`:

```typescript
export type NotificationOptions = BaseOptions;
```

Alice states Notification hooks are "fire-and-forget." The library's output only includes base options with no hook-specific fields. This matches the documented behavior.

---

## 8. Stop Hook Implementation

### Configuration Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:633-638`:

```typescript
export function stopHook(
  config: HookConfig,
  handler: HookHandler<StopInput, StopOutput>
): HookFunction<StopInput, StopOutput> {
  return createHookFunction('Stop', config, handler);
}
```

The JSDoc at line 603 confirms: "No matcher support - fires on all stop events."

### Input Structure

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:387-396`:

```typescript
export interface StopInput extends BaseHookInput {
  hookEventName: 'Stop';
  stopHookActive: boolean;
}
```

Alice documents `stop_hook_active` as a field to prevent infinite loops. The library provides this as `stopHookActive` (camelCase).

### Output Structure

Output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:1028-1041`:

```typescript
export interface StopOptions extends BaseOptions {
  decision?: 'approve' | 'block';
  reason?: string;
}
```

Alice documents:
- Exit code 2 blocks stopping, stderr shown to Claude
- JSON `decision: "block"` with `reason`

The library supports:
- `decision: 'approve' | 'block'`
- `reason` for explanation

The `stopOutput` function at line 1101 defaults decision to `'approve'` when not provided:

```typescript
decision: options.decision ?? 'approve',
```

### Prompt-Based Hooks

<gap>Alice describes `type: "prompt"` hooks that use an LLM (Haiku) to evaluate stop decisions. The library only supports `type: "command"` hooks. Prompt-based hooks are a Claude Code feature not implemented in this library. If a developer wants LLM-based evaluation, they must implement it themselves within a command hook.</gap>

---

## 9. SubagentStop Hook Implementation

### Configuration Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:713-718`:

```typescript
export function subagentStopHook(
  config: HookConfig,
  handler: HookHandler<SubagentStopInput, SubagentStopOutput>
): HookFunction<SubagentStopInput, SubagentStopOutput> {
  return createHookFunction('SubagentStop', config, handler);
}
```

### Input Structure

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:453-471`:

```typescript
export interface SubagentStopInput extends BaseHookInput {
  hookEventName: 'SubagentStop';
  stopHookActive: boolean;
  agentId: string;
  agentTranscriptPath: string;
}
```

<gap>Alice documents `transcriptPath` as `agentTranscriptPath` pointing to the subagent's transcript. The library uses `agentTranscriptPath` which matches. However, the input type does not include `agentType` which Alice mentions as a matcher target. The SubagentStopInput has no `agentType` field to match against.</gap>

### Output Structure

Output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:1184`:

```typescript
export type SubagentStopOptions = BaseOptions;
```

Alice documents same behavior as Stop hooks with `decision: "block"`. However, the library's `SubagentStopOptions` only includes `BaseOptions` without `decision` and `reason` fields.

<gap>The SubagentStop output type does not include `decision` and `reason` fields like Stop does. According to Alice, SubagentStop should support blocking with a reason just like Stop, but the library only provides `BaseOptions` (which includes `block` for error-style blocking, not decision-based blocking).</gap>

---

## 10. SubagentStart Hook Implementation

This is documented in Alice's report under SubagentStop but separately supported.

### Configuration Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:674-679`:

```typescript
export function subagentStartHook(
  config: HookConfig,
  handler: HookHandler<SubagentStartInput, SubagentStartOutput>
): HookFunction<SubagentStartInput, SubagentStartOutput> {
  return createHookFunction('SubagentStart', config, handler);
}
```

### Input Structure

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:418-432`:

```typescript
export interface SubagentStartInput extends BaseHookInput {
  hookEventName: 'SubagentStart';
  agentId: string;
  agentType: string;
}
```

Matcher matches against `agentType` per the JSDoc at line 406.

### Output Structure

Output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:1114-1120`:

```typescript
export interface SubagentStartOptions extends BaseOptions {
  additionalContext?: string;
}
```

<gap>Alice does not document SubagentStart as a separate hook type. The library fully supports SubagentStart for injecting context when subagents start. This is an undocumented hook type in Alice's journey.</gap>

---

## 11. PreCompact Hook Implementation

### Configuration Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:762-767`:

```typescript
export function preCompactHook(
  config: HookConfig,
  handler: HookHandler<PreCompactInput, PreCompactOutput>
): HookFunction<PreCompactInput, PreCompactOutput> {
  return createHookFunction('PreCompact', config, handler);
}
```

Matcher matches against `trigger` ('manual', 'auto') per JSDoc at line 732.

### Input Structure

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:492-509`:

```typescript
export interface PreCompactInput extends BaseHookInput {
  hookEventName: 'PreCompact';
  trigger: PreCompactTrigger;
  customInstructions: string | null;
}
```

Where `PreCompactTrigger = 'manual' | 'auto'` at line 35.

This matches Alice's documented structure.

### Output Structure

Output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:1314`:

```typescript
export type PreCompactOptions = BaseOptions;
```

Alice documents PreCompact cannot block compaction. The library's output only has `BaseOptions` which is appropriate. The `systemMessage` from base options can inject context.

---

## 12. SessionStart Hook Implementation

### Configuration Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:543-548`:

```typescript
export function sessionStartHook(
  config: HookConfig,
  handler: HookHandler<SessionStartInput, SessionStartOutput>
): HookFunction<SessionStartInput, SessionStartOutput> {
  return createHookFunction('SessionStart', config, handler);
}
```

Matcher matches against `source` per JSDoc at line 500.

### Input Structure

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:317-330`:

```typescript
export interface SessionStartInput extends BaseHookInput {
  hookEventName: 'SessionStart';
  source: SessionStartSource;
}
```

Where `SessionStartSource = 'startup' | 'resume' | 'clear' | 'compact'` at line 27.

This matches Alice's documented matchers.

### Output Structure

Output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:892-898`:

```typescript
export interface SessionStartOptions extends BaseOptions {
  additionalContext?: string;
}
```

Alice documents:
- stdout adds context
- JSON `hookSpecificOutput.additionalContext`
- `CLAUDE_ENV_FILE` for persisting environment variables

The library supports `additionalContext`. However:

<gap>Alice documents the `CLAUDE_ENV_FILE` environment variable for persisting environment variables in SessionStart hooks. This is a Claude Code runtime feature. The library does not provide any utilities or documentation for this capability. Developers must access `process.env.CLAUDE_ENV_FILE` directly and write shell-compatible export statements themselves.</gap>

### Fixture Example

At `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/e2e/fixtures/session-start-matcher-hook.ts`:

```typescript
export default sessionStartHook({ matcher: 'startup' }, async (input, { logger }) => {
  logger.info('SessionStart matcher hook triggered', { source: input.source });

  return sessionStartOutput({
    additionalContext: 'E2E_STARTUP_MATCHER: This only appears on fresh startups.'
  });
});
```

---

## 13. SessionEnd Hook Implementation

### Configuration Support

Factory at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/hooks.ts:584-589`:

```typescript
export function sessionEndHook(
  config: HookConfig,
  handler: HookHandler<SessionEndInput, SessionEndOutput>
): HookFunction<SessionEndInput, SessionEndOutput> {
  return createHookFunction('SessionEnd', config, handler);
}
```

### Input Structure

Input type at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/types/inputs.ts:351-360`:

```typescript
export interface SessionEndInput extends BaseHookInput {
  hookEventName: 'SessionEnd';
  reason: string;
}
```

Alice documents reason values:
- `clear`
- `logout`
- `prompt_input_exit`
- `other`

The library's `reason` is typed as `string` which accommodates any value.

### Output Structure

Output builder at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:966`:

```typescript
export type SessionEndOptions = BaseOptions;
```

Alice states SessionEnd cannot block termination. The library's output only has `BaseOptions` which is appropriate for cleanup-only hooks.

---

## 14. Common JSON Fields

Alice describes common JSON fields available to all hooks:

```json
{
  "continue": true,
  "stopReason": "Message when continue is false",
  "suppressOutput": false,
  "systemMessage": "Warning message for user"
}
```

These are defined in `BaseOptions` at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/outputs.ts:253-285`:

```typescript
export interface BaseOptions {
  block?: string;
  error?: string;
  continue?: boolean;
  suppressOutput?: boolean;
  systemMessage?: string;
}
```

And in `SyncHookJSONOutput` at lines 95-116:

```typescript
export interface SyncHookJSONOutput {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: 'approve' | 'block';
  systemMessage?: string;
  reason?: string;
  hookSpecificOutput?: HookSpecificOutput;
}
```

The library maps `block` option to `stopReason` in the runtime at line 294:

```typescript
if (stdout.block !== undefined) {
  result.stopReason = stdout.block;
}
```

---

## 15. Hook Execution Details

Alice describes execution behaviors:

1. **Timeout**: 60-second default, configurable per command
2. **Parallelization**: All matching hooks run in parallel
3. **Deduplication**: Multiple identical hook commands are deduplicated
4. **Environment Variables**:
   - `CLAUDE_PROJECT_DIR`: Absolute path to project root
   - `CLAUDE_ENV_FILE`: For SessionStart hooks only
   - `CLAUDE_CODE_REMOTE`: Remote vs local environment

<gap>The library does not document or provide utilities for the environment variables that Claude Code sets when running hooks. Developers must access these through `process.env` directly. The library's hook context only provides `logger`, not environment information.</gap>

<gap>Parallelization and deduplication are Claude Code runtime behaviors, not library features. The library compiles individual hooks; Claude Code manages their parallel execution.</gap>

---

## 16. Debugging Hooks

Alice describes debugging capabilities:

1. `/hooks` command to verify registration
2. JSON syntax validation
3. Manual testing in terminal
4. `claude --debug` for detailed logs

<gap>The library provides a Logger system but does not integrate with Claude Code's debug mode. Debug logging goes to a file specified by `CLAUDE_CODE_HOOKS_LOG_FILE` environment variable (mentioned in README at line 172), not to Claude's debug output. The library's telemetry features require explicit environment variable configuration.</gap>

---

## 17. Security Considerations

Alice warns about:
- Validating and sanitizing inputs
- Quoting shell variables
- Blocking path traversal
- Using absolute paths
- Avoiding sensitive files

The library provides no security utilities or validation helpers. The `toolInput` field is typed as `unknown`, requiring developers to cast and validate manually.

---

## 18. Additional Library Features Not in Documentation

### CLI Build Tool

The library provides a CLI at `/workspace/.worktrees/claude-hooks-package/packages/claude-code-hooks/src/cli/index.ts` that Alice does not document. Features:

1. TypeScript AST analysis to extract hook metadata (lines 299-409)
2. esbuild compilation to standalone ESM modules (lines 444-514)
3. Content hashing for cache busting (lines 521-525)
4. hooks.json generation (lines 624-658)

Usage:
```bash
claude-code-hooks -i "hooks/**/*.ts" -o "./dist/hooks.json"
```

### Logger System

The library exports a `Logger` class with:
- Structured logging
- File output via `CLAUDE_CODE_HOOKS_LOG_FILE`
- Event subscription
- OpenTelemetry integration

### OpenTelemetry Integration

The library supports telemetry via environment variables:
- `CLAUDE_CODE_HOOKS_ENABLE_TELEMETRY`
- `OTEL_METRICS_EXPORTER`
- `OTEL_LOGS_EXPORTER`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

### Runtime Key Transformation

The runtime automatically transforms snake_case input to camelCase and camelCase output back to snake_case. This is transparent to hook authors.

---

## Gaps Summary

1. **PostToolUseFailure not documented**: The library supports a 12th hook type, `PostToolUseFailure`, that fires when tool execution fails. Alice's documentation covers 10 hook types but omits this one.

2. **SubagentStart not documented**: Alice documents SubagentStop but not SubagentStart. The library supports both.

3. **Prompt-based hooks not supported**: Alice describes `type: "prompt"` hooks using an LLM for decisions. The library only supports `type: "command"` hooks. LLM-based evaluation must be implemented within command hooks.

4. **SubagentStop lacks decision/reason fields**: Unlike Stop hooks, the SubagentStopOptions only includes BaseOptions without explicit decision and reason fields for blocking.

5. **SubagentStop lacks agentType in input**: The matcher documentation suggests matching against agentType, but SubagentStopInput does not include this field.

6. **CLAUDE_ENV_FILE utilities missing**: The library provides no helpers for the CLAUDE_ENV_FILE mechanism documented for SessionStart hooks.

7. **Environment variable documentation gap**: The library does not document or provide utilities for accessing Claude Code's environment variables (CLAUDE_PROJECT_DIR, CLAUDE_CODE_REMOTE).

8. **Timeout unit mismatch**: The library uses milliseconds for timeout in HookConfig, while Alice's JSON examples use seconds.

9. **updatedMCPToolOutput undocumented**: PostToolUse hooks support modifying MCP tool output, which is not in Alice's documentation.

10. **updatedPermissions undocumented**: PermissionRequest allow decisions can include permission updates for future auto-approval, not documented by Alice.

11. **permissionSuggestions input field undocumented**: PermissionRequestInput includes suggested permissions not mentioned in Alice's documentation.

12. **Interactive /hooks command**: Alice mentions the `/hooks` slash command for interactive management. This is a Claude Code feature, not replicated by the library.
