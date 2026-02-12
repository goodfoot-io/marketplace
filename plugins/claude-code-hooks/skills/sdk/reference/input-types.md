<instructions>

This document describes the typed tool input structures available in `@goodfoot/claude-code-hooks`.

## Common Hook Input Fields

Every hook input includes these base fields:

```typescript
interface BaseHookInput {
  session_id: string;        // Unique session identifier
  transcript_path: string;   // Path to conversation transcript
  cwd: string;               // Current working directory
  permission_mode?: string;  // 'default' | 'acceptEdits' | 'bypassPermissions' | etc.
}
```

### Hook-Specific Input Fields

| Hook Type | Additional Fields |
|-----------|-------------------|
| PreToolUse | `tool_name`, `tool_input`, `tool_use_id` |
| PostToolUse | `tool_name`, `tool_input`, `tool_response`, `tool_use_id` |
| PostToolUseFailure | `tool_name`, `tool_input`, `tool_use_id`, `error`, `is_interrupt?` |
| SessionStart | `source` ('startup' \| 'resume' \| 'clear' \| 'compact') |
| SessionEnd | `reason` ('clear' \| 'logout' \| 'prompt_input_exit' \| 'other') |
| Stop | `stop_hook_active` |
| SubagentStart | `agent_id`, `agent_type` |
| SubagentStop | `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path` |
| UserPromptSubmit | `prompt` |
| Notification | `message`, `title?`, `notification_type` |
| PreCompact | `trigger` ('manual' \| 'auto'), `custom_instructions` |
| PermissionRequest | `tool_name`, `tool_input`, `tool_use_id`, `permission_suggestions?` |

## Tool Input Overview

The `tool_input` field in `PreToolUseInput`, `PostToolUseInput`, `PostToolUseFailureInput`, and `PermissionRequestInput` is typed as `unknown` by default. This package provides:

1. **Type definitions** for well-known tool inputs
2. **Type guards** for safe type narrowing
3. **Helper functions** for common patterns
4. **Typed factory overloads** for automatic typing with single-tool matchers

## Tool Input Interfaces

Types are sourced from `@anthropic-ai/claude-agent-sdk` and re-exported for convenience.

### File Operation Tools

#### FileWriteInput (Write)

```typescript
interface FileWriteInput {
  file_path: string;  // Absolute path to the file
  content: string;    // Content to write
}
```

#### FileEditInput (Edit)

```typescript
interface FileEditInput {
  file_path: string;      // Absolute path to the file
  old_string: string;     // Text to search for
  new_string: string;     // Replacement text
  replace_all?: boolean;  // If true, replace all occurrences
}
```

#### MultiEditToolInput (MultiEdit)

```typescript
interface MultiEditEntry {
  old_string: string;
  new_string: string;
}

interface MultiEditToolInput {
  file_path: string;        // Absolute path to the file
  edits: MultiEditEntry[];  // Array of edit operations
}
```

#### FileReadInput (Read)

```typescript
interface FileReadInput {
  file_path: string;  // Absolute path to the file
  offset?: number;    // Line offset to start from
  limit?: number;     // Max lines to read
}
```

#### NotebookEditInput (NotebookEdit)

```typescript
interface NotebookEditInput {
  notebook_path: string;  // Path to the Jupyter notebook
  cell_number?: number;   // Cell to edit (0-indexed)
  new_source?: string;    // New cell source code
  cell_type?: string;     // 'code' or 'markdown'
}
```

### Command Tools

#### BashInput (Bash)

```typescript
interface BashInput {
  command: string;       // Command to execute
  timeout?: number;      // Timeout in milliseconds
  description?: string;  // Description of the command
}
```

#### KillShellInput (KillShell)

```typescript
interface KillShellInput {
  shell_id: string;  // ID of the background shell to kill
}
```

### Search Tools

#### GlobInput (Glob)

```typescript
interface GlobInput {
  pattern: string;  // Glob pattern (e.g., "**/*.ts")
  path?: string;    // Directory to search in
}
```

#### GrepInput (Grep)

```typescript
interface GrepInput {
  pattern: string;  // Regex pattern
  path?: string;    // Directory to search in
  glob?: string;    // File pattern filter
}
```

### Agent & Task Tools

#### AgentInput (Task)

```typescript
interface AgentInput {
  prompt: string;           // Task prompt for the subagent
  subagent_type: string;    // Type of subagent to spawn
  description?: string;     // Short description of the task
  run_in_background?: boolean;
}
```

#### TaskOutputInput (TaskOutput)

```typescript
interface TaskOutputInput {
  task_id: string;    // ID of the task to get output from
  block?: boolean;    // Whether to wait for completion
  timeout?: number;   // Max wait time in ms
}
```

#### ExitPlanModeInput (ExitPlanMode)

```typescript
interface ExitPlanModeInput {
  allowedPrompts?: Array<{
    tool: string;
    prompt: string;
  }>;
}
```

#### TodoWriteInput (TodoWrite)

```typescript
interface TodoWriteInput {
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;
  }>;
}
```

### Web Tools

#### WebFetchInput (WebFetch)

```typescript
interface WebFetchInput {
  url: string;     // URL to fetch
  prompt: string;  // Prompt to process the fetched content
}
```

#### WebSearchInput (WebSearch)

```typescript
interface WebSearchInput {
  query: string;              // Search query
  allowed_domains?: string[]; // Only include these domains
  blocked_domains?: string[]; // Exclude these domains
}
```

### User Interaction Tools

#### AskUserQuestionInput (AskUserQuestion)

```typescript
interface AskUserQuestionInput {
  questions: Array<{
    question: string;
    header: string;
    options: Array<{
      label: string;
      description: string;
    }>;
    multiSelect?: boolean;
  }>;
}
```

## Type Guards

Use type guards to safely narrow the type of `tool_input`:

### File Operation Type Guards

```typescript
import {
  preToolUseHook,
  preToolUseOutput,
  isWriteTool,
  isEditTool,
  isMultiEditTool,
  isFileModifyingTool,
  isReadTool,
  isNotebookEditTool
} from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Write|Edit|MultiEdit' }, (input, { logger }) => {
  if (isWriteTool(input)) {
    // input.tool_input is typed as WriteToolInput
    logger.info('Write operation', {
      file: input.tool_input.file_path,
      contentLength: input.tool_input.content.length
    });
  } else if (isEditTool(input)) {
    // input.tool_input is typed as EditToolInput
    logger.info('Edit operation', {
      old: input.tool_input.old_string,
      new: input.tool_input.new_string
    });
  } else if (isMultiEditTool(input)) {
    // input.tool_input is typed as MultiEditToolInput
    for (const edit of input.tool_input.edits) {
      logger.debug('MultiEdit entry', { old: edit.old_string, new: edit.new_string });
    }
  }

  return preToolUseOutput({});
});
```

### isFileModifyingTool

Matches Write, Edit, or MultiEdit:

```typescript
if (isFileModifyingTool(input)) {
  // input.tool_name is 'Write' | 'Edit' | 'MultiEdit'
  // Use getFilePath() for the file path
  const filePath = getFilePath(input);
}
```

### Command & Search Type Guards

```typescript
import {
  isBashTool,
  isGlobTool,
  isGrepTool,
  isKillShellTool
} from '@goodfoot/claude-code-hooks';

if (isBashTool(input)) {
  // input.tool_input.command is typed as string
  console.log(input.tool_input.command);
}

if (isKillShellTool(input)) {
  // input.tool_input.shell_id is typed as string
  console.log(input.tool_input.shell_id);
}
```

### Agent & Task Type Guards

```typescript
import {
  isTaskTool,
  isTaskOutputTool,
  isExitPlanModeTool,
  isTodoWriteTool
} from '@goodfoot/claude-code-hooks';

if (isTaskTool(input)) {
  // input.tool_input has typed fields:
  console.log(input.tool_input.prompt);
  console.log(input.tool_input.subagent_type);
}

if (isTodoWriteTool(input)) {
  // input.tool_input.todos is typed as an array
  console.log(input.tool_input.todos);
}
```

### Web & User Interaction Type Guards

```typescript
import {
  isWebFetchTool,
  isWebSearchTool,
  isAskUserQuestionTool
} from '@goodfoot/claude-code-hooks';

if (isWebFetchTool(input)) {
  console.log(input.tool_input.url);
  console.log(input.tool_input.prompt);
}

if (isWebSearchTool(input)) {
  console.log(input.tool_input.query);
}

if (isAskUserQuestionTool(input)) {
  console.log(input.tool_input.questions);
}
```

### MCP & Config Type Guards

```typescript
import {
  isMcpTool,
  isListMcpResourcesTool,
  isReadMcpResourceTool,
  isConfigTool
} from '@goodfoot/claude-code-hooks';

if (isMcpTool(input)) {
  // input.tool_input is typed as McpInput
}

if (isListMcpResourcesTool(input)) {
  console.log(input.tool_input.server);
}

if (isReadMcpResourceTool(input)) {
  console.log(input.tool_input.server);
  console.log(input.tool_input.uri);
}

if (isConfigTool(input)) {
  console.log(input.tool_input.setting);
  console.log(input.tool_input.value);
}
```

### Notebook Type Guards

```typescript
import { isNotebookEditTool } from '@goodfoot/claude-code-hooks';

if (isNotebookEditTool(input)) {
  console.log(input.tool_input.notebook_path);
  console.log(input.tool_input.new_source);
}
```

## Helper Functions

### getFilePath

Extracts file path from any tool that has one:

```typescript
import { getFilePath } from '@goodfoot/claude-code-hooks';

const filePath = getFilePath(input);  // Returns string | null
if (filePath && isTsFile(filePath)) {
  // Handle TypeScript file
}
```

### isJsTsFile / isTsFile

Check file extensions:

```typescript
import { isJsTsFile, isTsFile } from '@goodfoot/claude-code-hooks';

isJsTsFile('file.ts');   // true - matches .js, .jsx, .ts, .tsx, .mjs, .mts, .cjs, .cts
isTsFile('file.ts');     // true - matches .ts, .tsx, .mts, .cts only
isTsFile('file.js');     // false
```

### checkContentForPattern

Check if a pattern exists in Write/Edit/MultiEdit content:

```typescript
import { checkContentForPattern } from '@goodfoot/claude-code-hooks';

const result = checkContentForPattern(input, /console\.log/g);
if (result?.isAddition) {
  // Pattern is being added (not already present in old content)
  return preToolUseOutput({
    systemMessage: 'Code quality: console.log detected and blocked.',
    hookSpecificOutput: {
      permissionDecision: 'deny',
      permissionDecisionReason: `Cannot add: ${result.matches.join(', ')}`
    }
  });
}
```

Returns:

```typescript
interface PatternCheckResult {
  found: boolean;       // Pattern found in any content
  isAddition: boolean;  // Pattern is new (not in old content)
  matches: string[];    // All unique matches
  details?: Array<{     // Per-edit details for MultiEdit
    index: number;
    found: boolean;
    isAddition: boolean;
    matches: string[];
  }>;
}
```

### Checking Multiple Patterns

For hooks that need to check many patterns (e.g., blocking various bypass comments), iterate and collect violations:

```typescript
import {
  preToolUseHook, preToolUseOutput,
  getFilePath, isJsTsFile, checkContentForPattern
} from '@goodfoot/claude-code-hooks';

const BYPASS_PATTERNS = [
  { pattern: /\/\/\s*eslint-disable/g, name: 'ESLint disable' },
  { pattern: /\/\/\s*@ts-ignore/g, name: 'TypeScript @ts-ignore' },
  { pattern: /\/\/\s*@ts-expect-error/g, name: 'TypeScript @ts-expect-error' },
  { pattern: /\bas\s+any\b/g, name: 'as any cast' },
] as const;

export default preToolUseHook({ matcher: 'Write|Edit|MultiEdit' }, (input, { logger }) => {
  const filePath = getFilePath(input);
  if (!filePath || !isJsTsFile(filePath)) return preToolUseOutput({});

  const violations: string[] = [];
  for (const { pattern, name } of BYPASS_PATTERNS) {
    const result = checkContentForPattern(input, pattern);
    if (result?.isAddition) {
      violations.push(name);
      logger.warn('Bypass pattern detected', { pattern: name });
    }
  }

  if (violations.length > 0) {
    return preToolUseOutput({
      systemMessage: `Code quality: ${violations.length} bypass pattern(s) detected.`,
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: `Cannot add: ${violations.join(', ')}`
      }
    });
  }

  return preToolUseOutput({
    systemMessage: 'File passed code quality checks.'
  });
});
```

### forEachContent

Iterate over content in Write/Edit/MultiEdit:

```typescript
import { forEachContent } from '@goodfoot/claude-code-hooks';

// Check all content for sensitive data
const hasSensitive = !forEachContent(input, ({ newContent, oldContent, isWrite }) => {
  if (/password|secret|api.?key/i.test(newContent)) {
    return false;  // Stop iteration - found sensitive data
  }
  return true;  // Continue
});
```

## Typed Factory Overloads

When using a single known tool name as the matcher, `tool_input` is automatically typed:

```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

// tool_input is automatically typed as WriteToolInput!
export default preToolUseHook({ matcher: 'Write' }, (input) => {
  // Full autocomplete and type checking:
  const { file_path, content } = input.tool_input;

  if (file_path.endsWith('.env')) {
    return preToolUseOutput({
      systemMessage: 'Security: .env files are protected.',
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Cannot write to .env files'
      }
    });
  }

  return preToolUseOutput({
    systemMessage: 'File write approved.'
  });
});
```

Supported tools for automatic typing:
- `Write` — FileWriteInput
- `Edit` — FileEditInput
- `MultiEdit` — MultiEditToolInput
- `Read` — FileReadInput
- `Bash` — BashInput
- `Glob` — GlobInput
- `Grep` — GrepInput
- `Task` — AgentInput
- `TaskOutput` — TaskOutputInput
- `ExitPlanMode` — ExitPlanModeInput
- `KillShell` — KillShellInput
- `NotebookEdit` — NotebookEditInput
- `TodoWrite` — TodoWriteInput
- `WebFetch` — WebFetchInput
- `WebSearch` — WebSearchInput
- `AskUserQuestion` — AskUserQuestionInput
- `ListMcpResources` — ListMcpResourcesInput
- `Mcp` — McpInput
- `ReadMcpResource` — ReadMcpResourceInput
- `Config` — ConfigInput

**Note**: Multi-tool matchers like `'Write|Edit'` or regex patterns like `'.*'` use the non-typed overload where `tool_input` remains `unknown`. Use type guards in those cases.

### Choosing Between Typed Overloads and Type Guards

| Scenario | Use | Reason |
|----------|-----|--------|
| Single tool: `{ matcher: 'Bash' }` | Typed overload | `tool_input` is automatically typed as `BashToolInput` |
| Single tool: `{ matcher: 'Write' }` | Typed overload | `tool_input` is automatically typed as `WriteToolInput` |
| Multi-tool: `{ matcher: 'Write\|Edit\|MultiEdit' }` | Type guards | `tool_input` is `unknown`, use `isWriteTool()`, `isEditTool()` |
| Regex: `{ matcher: '.*' }` | Type guards | Matches all tools, must inspect at runtime |
| Need tool-specific logic | Type guards | Different behavior per tool type |

**Rule of thumb**: If your matcher is a single known tool name, use the typed overload for automatic type inference. Otherwise, use type guards to narrow the type at runtime.

## Union Types

```typescript
// All file-modifying tools
type FileModifyingToolInput = FileWriteInput | FileEditInput | MultiEditToolInput;
type FileModifyingToolName = 'Write' | 'Edit' | 'MultiEdit';

// All known tools
type KnownToolName =
  | 'Write' | 'Edit' | 'MultiEdit' | 'Read' | 'NotebookEdit'  // File operations
  | 'Bash' | 'KillShell'                                        // Commands
  | 'Glob' | 'Grep'                                             // Search
  | 'Task' | 'TaskOutput' | 'ExitPlanMode' | 'TodoWrite'       // Agents & tasks
  | 'WebFetch' | 'WebSearch'                                    // Web
  | 'AskUserQuestion'                                           // User interaction
  | 'ListMcpResources' | 'Mcp' | 'ReadMcpResource'             // MCP
  | 'Config';                                                   // Config

// Type mapping (use with TypedPreToolUseHookInput, TypedPostToolUseHookInput, etc.)
interface ToolInputMap {
  Write: FileWriteInput;
  Edit: FileEditInput;
  MultiEdit: MultiEditToolInput;
  Read: FileReadInput;
  Bash: BashInput;
  Glob: GlobInput;
  Grep: GrepInput;
  Task: AgentInput;
  TaskOutput: TaskOutputInput;
  ExitPlanMode: ExitPlanModeInput;
  KillShell: KillShellInput;
  NotebookEdit: NotebookEditInput;
  TodoWrite: TodoWriteInput;
  WebFetch: WebFetchInput;
  WebSearch: WebSearchInput;
  AskUserQuestion: AskUserQuestionInput;
  ListMcpResources: ListMcpResourcesInput;
  Mcp: McpInput;
  ReadMcpResource: ReadMcpResourceInput;
  Config: ConfigInput;
}
```

## SDK Type Re-exports

The package re-exports all tool input types from `@anthropic-ai/claude-agent-sdk/sdk-tools.js`:

```typescript
// These types are available directly from @goodfoot/claude-code-hooks
export type * from "@anthropic-ai/claude-agent-sdk/sdk-tools.js";
```

This provides access to the authoritative type definitions for all Claude Code tool inputs.

</instructions>
