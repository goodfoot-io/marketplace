# Tool Input Types

> [Back to SKILL.md](../SKILL.md) | [Output Builders](output-builders.md) | [Logging](logging.md)

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

### File Operation Tools

#### WriteToolInput
```typescript
interface WriteToolInput {
  file_path: string;  // Absolute path to the file
  content: string;    // Content to write
}
```

#### EditToolInput
```typescript
interface EditToolInput {
  file_path: string;      // Absolute path to the file
  old_string: string;     // Text to search for
  new_string: string;     // Replacement text
  replace_all?: boolean;  // If true, replace all occurrences
}
```

#### MultiEditToolInput
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

#### ReadToolInput
```typescript
interface ReadToolInput {
  file_path: string;  // Absolute path to the file
  offset?: number;    // Line offset to start from
  limit?: number;     // Max lines to read
}
```

### Command Tools

#### BashToolInput
```typescript
interface BashToolInput {
  command: string;       // Command to execute
  timeout?: number;      // Timeout in milliseconds
  description?: string;  // Description of the command
}
```

### Search Tools

#### GlobToolInput
```typescript
interface GlobToolInput {
  pattern: string;  // Glob pattern (e.g., "**/*.ts")
  path?: string;    // Directory to search in
}
```

#### GrepToolInput
```typescript
interface GrepToolInput {
  pattern: string;  // Regex pattern
  path?: string;    // Directory to search in
  glob?: string;    // File pattern filter
}
```

## Type Guards

Use type guards to safely narrow the type of `tool_input`:

```typescript
import {
  preToolUseHook,
  preToolUseOutput,
  isWriteTool,
  isEditTool,
  isMultiEditTool,
  isFileModifyingTool,
  isReadTool,
  isBashTool,
  isGlobTool,
  isGrepTool
} from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Write|Edit|MultiEdit' }, (input) => {
  if (isWriteTool(input)) {
    // input.tool_input is typed as WriteToolInput
    console.log(input.tool_input.file_path);
    console.log(input.tool_input.content);
  } else if (isEditTool(input)) {
    // input.tool_input is typed as EditToolInput
    console.log(input.tool_input.old_string);
    console.log(input.tool_input.new_string);
  } else if (isMultiEditTool(input)) {
    // input.tool_input is typed as MultiEditToolInput
    for (const edit of input.tool_input.edits) {
      console.log(edit.old_string, '->', edit.new_string);
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
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Cannot write to .env files'
      }
    });
  }

  return preToolUseOutput({});
});
```

Supported tools for automatic typing:
- `Write` - WriteToolInput
- `Edit` - EditToolInput
- `MultiEdit` - MultiEditToolInput
- `Read` - ReadToolInput
- `Bash` - BashToolInput
- `Glob` - GlobToolInput
- `Grep` - GrepToolInput

**Note**: Multi-tool matchers like `'Write|Edit'` or regex patterns like `'.*'` use the non-typed overload where `tool_input` remains `unknown`. Use type guards in those cases.

## Union Types

```typescript
// All file-modifying tools
type FileModifyingToolInput = WriteToolInput | EditToolInput | MultiEditToolInput;
type FileModifyingToolName = 'Write' | 'Edit' | 'MultiEdit';

// All known tools
type KnownToolInput = WriteToolInput | EditToolInput | MultiEditToolInput
  | ReadToolInput | BashToolInput | GlobToolInput | GrepToolInput;
type KnownToolName = 'Write' | 'Edit' | 'MultiEdit' | 'Read' | 'Bash' | 'Glob' | 'Grep';

// Type mapping
interface ToolInputMap {
  Write: WriteToolInput;
  Edit: EditToolInput;
  MultiEdit: MultiEditToolInput;
  Read: ReadToolInput;
  Bash: BashToolInput;
  Glob: GlobToolInput;
  Grep: GrepToolInput;
}
```

</instructions>
