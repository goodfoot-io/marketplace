# Plan: Typed Tool Inputs for @goodfoot/claude-code-hooks

## Problem Statement

The `toolInput` field in `PreToolUseInput` and `PostToolUseInput` is typed as `unknown`, forcing hook authors to manually cast to expected interfaces and handle Write/Edit/MultiEdit differences with repetitive boilerplate. This leads to:

1. Duplicated interface definitions across hook implementations
2. Runtime errors from incorrect casts
3. No IDE autocompletion for tool-specific fields
4. Complex conditional logic to handle different tool types

## Goals

- [ ] Export well-known tool input types from the package
- [ ] Provide type guard functions for safe type narrowing
- [ ] Add helper functions for common patterns (file path extraction, content checking)
- [ ] Enable typed `toolInput` when matcher specifies a single known tool
- [ ] Maintain backwards compatibility with existing hooks

## Scope

### Include

- Type definitions for core tools: Write, Edit, MultiEdit, Read, Bash, Glob, Grep
- Type guards: `isWriteTool()`, `isEditTool()`, `isMultiEditTool()`, `isBashTool()`, `isReadTool()`, `isFileModifyingTool()`
- Utility functions: `getFilePath()`, `isJsTsFile()`, `isTsFile()`
- Content inspection: `checkContentForPattern()`, `forEachContent()`
- Typed factory overloads for single-tool matchers
- Unit tests for all new functionality
- Documentation updates to skill files

### Exclude

- MCP tool input types (too varied, user-defined)
- Task tool input types (complex nested structure)
- Breaking changes to existing APIs
- Runtime validation of tool inputs

## Technical Approach

### Phase 1: Tool Input Type Definitions

Create `packages/claude-code-hooks/src/tool-inputs.ts`:

```typescript
// File operation tools
export interface WriteToolInput {
  file_path: string;
  content: string;
}

export interface EditToolInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface MultiEditEntry {
  old_string: string;
  new_string: string;
}

export interface MultiEditToolInput {
  file_path: string;
  edits: MultiEditEntry[];
}

export interface ReadToolInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

// Command tools
export interface BashToolInput {
  command: string;
  timeout?: number;
  description?: string;
}

// Search tools
export interface GlobToolInput {
  pattern: string;
  path?: string;
}

export interface GrepToolInput {
  pattern: string;
  path?: string;
  glob?: string;
}

// Union types
export type FileModifyingToolInput = WriteToolInput | EditToolInput | MultiEditToolInput;
export type FileModifyingToolName = 'Write' | 'Edit' | 'MultiEdit';
```

**Deliverables:**
- `src/tool-inputs.ts` with all type definitions
- Exports added to `src/index.ts`
- JSDoc documentation for each interface

### Phase 2: Type Guards and Helpers

Create `packages/claude-code-hooks/src/tool-helpers.ts`:

**Type Guards:**
```typescript
export function isWriteTool<T extends PreToolUseInput | PostToolUseInput>(
  input: T
): input is T & { toolName: 'Write'; toolInput: WriteToolInput }

export function isEditTool<T extends PreToolUseInput | PostToolUseInput>(
  input: T
): input is T & { toolName: 'Edit'; toolInput: EditToolInput }

export function isMultiEditTool<T extends PreToolUseInput | PostToolUseInput>(
  input: T
): input is T & { toolName: 'MultiEdit'; toolInput: MultiEditToolInput }

export function isFileModifyingTool<T extends PreToolUseInput | PostToolUseInput>(
  input: T
): input is T & { toolName: FileModifyingToolName; toolInput: FileModifyingToolInput }

export function isBashTool<T extends PreToolUseInput | PostToolUseInput>(
  input: T
): input is T & { toolName: 'Bash'; toolInput: BashToolInput }

export function isReadTool<T extends PreToolUseInput | PostToolUseInput>(
  input: T
): input is T & { toolName: 'Read'; toolInput: ReadToolInput }
```

**Utility Functions:**
```typescript
export function getFilePath(input: PreToolUseInput | PostToolUseInput): string | null
export function isJsTsFile(filePath: string): boolean
export function isTsFile(filePath: string): boolean
```

**Content Inspection:**
```typescript
export interface PatternCheckResult {
  found: boolean;
  isAddition: boolean;
  matches: string[];
  details?: Array<{ index: number; found: boolean; isAddition: boolean; matches: string[] }>;
}

export function checkContentForPattern(
  input: PreToolUseInput,
  pattern: RegExp
): PatternCheckResult | null

export function forEachContent(
  input: PreToolUseInput,
  callback: (ctx: {
    newContent: string;
    oldContent: string | null;
    index: number;
    isWrite: boolean;
  }) => boolean
): boolean
```

**Deliverables:**
- `src/tool-helpers.ts` with all functions
- Exports added to `src/index.ts`
- Unit tests in `tests/tool-helpers.test.ts`

### Phase 3: Typed Factory Overloads

Enhance `packages/claude-code-hooks/src/hooks.ts`:

```typescript
// Type mapping
interface ToolInputMap {
  Write: WriteToolInput;
  Edit: EditToolInput;
  MultiEdit: MultiEditToolInput;
  Bash: BashToolInput;
  Read: ReadToolInput;
  Glob: GlobToolInput;
  Grep: GrepToolInput;
}

type KnownToolName = keyof ToolInputMap;

type TypedPreToolUseInput<T extends KnownToolName> =
  Omit<PreToolUseInput, 'toolName' | 'toolInput'> & {
    toolName: T;
    toolInput: ToolInputMap[T];
  };

// Overloaded factory
export function preToolUseHook<T extends KnownToolName>(
  config: { matcher: T; timeout?: number },
  handler: HookHandler<TypedPreToolUseInput<T>, PreToolUseOutput>
): HookFunction<TypedPreToolUseInput<T>, PreToolUseOutput>;

export function preToolUseHook(
  config: HookConfig,
  handler: HookHandler<PreToolUseInput, PreToolUseOutput>
): HookFunction<PreToolUseInput, PreToolUseOutput>;
```

Apply same pattern to:
- `postToolUseHook`
- `postToolUseFailureHook`
- `permissionRequestHook`

**Deliverables:**
- Updated `src/hooks.ts` with overloads
- Type tests in `tests/types/typed-hooks.test.ts`
- No changes to runtime behavior (pure type-level enhancement)

### Phase 4: Documentation Updates

Update skill files in `plugins/claude-code-hooks/skills/claude-code-hooks/`:

**SKILL.md:**
- Add "Output Capabilities by Hook Type" table
- Update Section 2 example to show type guard usage
- Remove embedded bash health check (Section 5)

**reference/output-builders.md:**
- Add "Goal: Inspect Write/Edit/MultiEdit Content" section with `checkContentForPattern` example
- Add "Goal: Signal Errors Without Blocking (PostToolUse)" section
- Expand "Common Options" documentation

**NEW: reference/input-types.md:**
- Document all tool input structures
- Show type guard usage examples
- Reference `checkContentForPattern` for content inspection

**reference/porting.md:**
- Add Vitest testing examples
- Add `execSync` patterns for external commands
- Update "Testing Your Port" section

**Deliverables:**
- Updated skill files
- New `reference/input-types.md`

## File Structure

```
packages/claude-code-hooks/
├── src/
│   ├── index.ts              # Add exports for new modules
│   ├── tool-inputs.ts        # NEW: Type definitions
│   ├── tool-helpers.ts       # NEW: Type guards and utilities
│   ├── hooks.ts              # MODIFY: Add typed overloads
│   └── ...
├── tests/
│   ├── tool-helpers.test.ts  # NEW: Unit tests
│   └── types/
│       └── typed-hooks.test.ts  # NEW: Type-level tests
└── ...

plugins/claude-code-hooks/skills/claude-code-hooks/
├── SKILL.md                  # MODIFY
└── reference/
    ├── output-builders.md    # MODIFY
    ├── input-types.md        # NEW
    ├── porting.md            # MODIFY
    └── ...
```

## Validation Commands

```bash
# Type check
cd packages/claude-code-hooks && yarn typecheck

# Unit tests
cd packages/claude-code-hooks && yarn test

# Lint
cd packages/claude-code-hooks && yarn lint

# Build (verify exports work)
cd packages/claude-code-hooks && yarn build
```

## Usage Examples

### Before (Current API)
```typescript
export default preToolUseHook({ matcher: 'Write|Edit|MultiEdit' }, (input) => {
  const filePath = (input.toolInput as { file_path?: string })?.file_path;
  if (!filePath) return preToolUseOutput({});

  if (input.toolName === 'Write') {
    const content = (input.toolInput as { content: string }).content;
    if (/@ts-ignore/.test(content)) {
      return preToolUseOutput({
        hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: '...' }
      });
    }
  } else if (input.toolName === 'Edit') {
    // ... more manual casting and conditionals
  }
  // ... 30+ more lines
});
```

### After (With Helpers)
```typescript
import {
  preToolUseHook,
  preToolUseOutput,
  getFilePath,
  isTsFile,
  checkContentForPattern
} from '@goodfoot/claude-code-hooks';

export default preToolUseHook({ matcher: 'Write|Edit|MultiEdit' }, (input) => {
  const filePath = getFilePath(input);
  if (!filePath || !isTsFile(filePath)) return preToolUseOutput({});

  const result = checkContentForPattern(input, /@ts-ignore/g);
  if (result?.isAddition) {
    return preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: `Cannot add: ${result.matches.join(', ')}`
      }
    });
  }

  return preToolUseOutput({});
});
```

### After (With Typed Factory - Single Tool)
```typescript
import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

// toolInput is automatically typed as WriteToolInput!
export default preToolUseHook({ matcher: 'Write' }, (input) => {
  const { file_path, content } = input.toolInput; // Full autocomplete!

  if (file_path.endsWith('.ts') && /@ts-ignore/.test(content)) {
    return preToolUseOutput({
      hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: '...' }
    });
  }

  return preToolUseOutput({});
});
```

## Risks & Mitigations

- **Risk**: Type definitions may not match actual Claude Code tool inputs
  **Mitigation**: Derive types from `@anthropic-ai/claude-code` source when possible; mark interfaces with version notes

- **Risk**: Typed factory overloads may confuse TypeScript in edge cases
  **Mitigation**: Provide clear documentation; fallback overload handles all non-exact matches

- **Risk**: `checkContentForPattern` regex handling may have edge cases
  **Mitigation**: Comprehensive unit tests; document that global flag is auto-added

## Implementation Order

1. **Phase 1** (tool-inputs.ts) - Can be done independently, immediate value
2. **Phase 2** (tool-helpers.ts) - Depends on Phase 1, highest user value
3. **Phase 3** (typed overloads) - Depends on Phase 1, best DX but more complex
4. **Phase 4** (documentation) - Can start after Phase 2, should complete with Phase 3

Phases 1-2 provide 80% of the value with minimal complexity. Phase 3 is polish.
