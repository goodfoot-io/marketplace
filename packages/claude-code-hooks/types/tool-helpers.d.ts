/**
 * Type guards and helper functions for Claude Code tool inputs.
 *
 * Provides safe type narrowing for tool inputs and utility functions
 * for common patterns like file path extraction and content inspection.
 * @example
 * ```typescript
 * import {
 *   preToolUseHook,
 *   preToolUseOutput,
 *   isWriteTool,
 *   getFilePath,
 *   isTsFile,
 *   checkContentForPattern
 * } from '@goodfoot/claude-code-hooks';
 *
 * export default preToolUseHook({ matcher: 'Write|Edit|MultiEdit' }, (input) => {
 *   const filePath = getFilePath(input);
 *   if (!filePath || !isTsFile(filePath)) return preToolUseOutput({});
 *
 *   const result = checkContentForPattern(input, /@ts-expect-error/g);
 *   if (result?.isAddition) {
 *     return preToolUseOutput({
 *       hookSpecificOutput: {
 *         permissionDecision: 'deny',
 *         permissionDecisionReason: `Cannot add: ${result.matches.join(', ')}`
 *       }
 *     });
 *   }
 *
 *   return preToolUseOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks
 * @module
 */
import type { AgentInput, AskUserQuestionInput, BashInput, ExitPlanModeInput, FileEditInput, FileModifyingToolInput, FileModifyingToolName, FileReadInput, FileWriteInput, GlobInput, GrepInput, KillShellInput, MultiEditToolInput, NotebookEditInput, PermissionRequestInput, PostToolUseFailureInput, PostToolUseInput, PreToolUseInput, TaskOutputInput, TodoWriteInput, WebFetchInput, WebSearchInput } from "./types.js";
/**
 * Union of all hook input types that include tool_input.
 */
export type ToolUseInput = PreToolUseInput | PostToolUseInput | PostToolUseFailureInput | PermissionRequestInput;
/**
 * Type guard for Write tool inputs.
 *
 * Narrows the input type to include a typed WriteToolInput.
 * @param input - The hook input to check
 * @returns True if the input is for a Write tool
 * @example
 * ```typescript
 * if (isWriteTool(input)) {
 *   // input.tool_input is now typed as WriteToolInput
 *   console.log(input.tool_input.file_path);
 *   console.log(input.tool_input.content);
 * }
 * ```
 */
export declare function isWriteTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "Write";
    tool_input: FileWriteInput;
};
/**
 * Type guard for Edit tool inputs.
 *
 * Narrows the input type to include a typed EditToolInput.
 * @param input - The hook input to check
 * @returns True if the input is for an Edit tool
 * @example
 * ```typescript
 * if (isEditTool(input)) {
 *   console.log(input.tool_input.old_string);
 *   console.log(input.tool_input.new_string);
 * }
 * ```
 */
export declare function isEditTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "Edit";
    tool_input: FileEditInput;
};
/**
 * Type guard for MultiEdit tool inputs.
 *
 * Narrows the input type to include a typed MultiEditToolInput.
 * @param input - The hook input to check
 * @returns True if the input is for a MultiEdit tool
 * @example
 * ```typescript
 * if (isMultiEditTool(input)) {
 *   for (const edit of input.tool_input.edits) {
 *     console.log(`${edit.old_string} -> ${edit.new_string}`);
 *   }
 * }
 * ```
 */
export declare function isMultiEditTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "MultiEdit";
    tool_input: MultiEditToolInput;
};
/**
 * Type guard for any file-modifying tool (Write, Edit, or MultiEdit).
 *
 * Use this when you need to handle all file modifications generically.
 * @param input - The hook input to check
 * @returns True if the input is for a Write, Edit, or MultiEdit tool
 * @example
 * ```typescript
 * if (isFileModifyingTool(input)) {
 *   const filePath = getFilePath(input); // Works for all three types
 * }
 * ```
 */
export declare function isFileModifyingTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: FileModifyingToolName;
    tool_input: FileModifyingToolInput;
};
/**
 * Type guard for Read tool inputs.
 *
 * Narrows the input type to include a typed ReadToolInput.
 * @param input - The hook input to check
 * @returns True if the input is for a Read tool
 * @example
 * ```typescript
 * if (isReadTool(input)) {
 *   console.log(input.tool_input.file_path);
 *   console.log(input.tool_input.offset);
 * }
 * ```
 */
export declare function isReadTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "Read";
    tool_input: FileReadInput;
};
/**
 * Type guard for Bash tool inputs.
 *
 * Narrows the input type to include a typed BashToolInput.
 * @param input - The hook input to check
 * @returns True if the input is for a Bash tool
 * @example
 * ```typescript
 * if (isBashTool(input)) {
 *   console.log(input.tool_input.command);
 *   console.log(input.tool_input.timeout);
 * }
 * ```
 */
export declare function isBashTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "Bash";
    tool_input: BashInput;
};
/**
 * Type guard for Glob tool inputs.
 *
 * Narrows the input type to include a typed GlobToolInput.
 * @param input - The hook input to check
 * @returns True if the input is for a Glob tool
 * @example
 * ```typescript
 * if (isGlobTool(input)) {
 *   console.log(input.tool_input.pattern);
 *   console.log(input.tool_input.path);
 * }
 * ```
 */
export declare function isGlobTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "Glob";
    tool_input: GlobInput;
};
/**
 * Type guard for Grep tool inputs.
 *
 * Narrows the input type to include a typed GrepToolInput.
 * @param input - The hook input to check
 * @returns True if the input is for a Grep tool
 * @example
 * ```typescript
 * if (isGrepTool(input)) {
 *   console.log(input.tool_input.pattern);
 *   console.log(input.tool_input.glob);
 * }
 * ```
 */
export declare function isGrepTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "Grep";
    tool_input: GrepInput;
};
/**
 * Type guard for Task tool inputs.
 *
 * Narrows the input type to include a typed AgentInput.
 * @param input - The hook input to check
 * @returns True if the input is for a Task tool
 * @example
 * ```typescript
 * if (isTaskTool(input)) {
 *   console.log(input.tool_input.prompt);
 *   console.log(input.tool_input.subagent_type);
 * }
 * ```
 */
export declare function isTaskTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "Task";
    tool_input: AgentInput;
};
/**
 * Type guard for TaskOutput tool inputs.
 *
 * Narrows the input type to include a typed TaskOutputInput.
 * @param input - The hook input to check
 * @returns True if the input is for a TaskOutput tool
 * @example
 * ```typescript
 * if (isTaskOutputTool(input)) {
 *   console.log(input.tool_input.task_id);
 * }
 * ```
 */
export declare function isTaskOutputTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "TaskOutput";
    tool_input: TaskOutputInput;
};
/**
 * Type guard for ExitPlanMode tool inputs.
 *
 * Narrows the input type to include a typed ExitPlanModeInput.
 * @param input - The hook input to check
 * @returns True if the input is for an ExitPlanMode tool
 * @example
 * ```typescript
 * if (isExitPlanModeTool(input)) {
 *   console.log(input.tool_input.allowedPrompts);
 * }
 * ```
 */
export declare function isExitPlanModeTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "ExitPlanMode";
    tool_input: ExitPlanModeInput;
};
/**
 * Type guard for KillShell tool inputs.
 *
 * Narrows the input type to include a typed KillShellInput.
 * @param input - The hook input to check
 * @returns True if the input is for a KillShell tool
 * @example
 * ```typescript
 * if (isKillShellTool(input)) {
 *   console.log(input.tool_input.shell_id);
 * }
 * ```
 */
export declare function isKillShellTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "KillShell";
    tool_input: KillShellInput;
};
/**
 * Type guard for NotebookEdit tool inputs.
 *
 * Narrows the input type to include a typed NotebookEditInput.
 * @param input - The hook input to check
 * @returns True if the input is for a NotebookEdit tool
 * @example
 * ```typescript
 * if (isNotebookEditTool(input)) {
 *   console.log(input.tool_input.notebook_path);
 *   console.log(input.tool_input.new_source);
 * }
 * ```
 */
export declare function isNotebookEditTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "NotebookEdit";
    tool_input: NotebookEditInput;
};
/**
 * Type guard for TodoWrite tool inputs.
 *
 * Narrows the input type to include a typed TodoWriteInput.
 * @param input - The hook input to check
 * @returns True if the input is for a TodoWrite tool
 * @example
 * ```typescript
 * if (isTodoWriteTool(input)) {
 *   console.log(input.tool_input.todos);
 * }
 * ```
 */
export declare function isTodoWriteTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "TodoWrite";
    tool_input: TodoWriteInput;
};
/**
 * Type guard for WebFetch tool inputs.
 *
 * Narrows the input type to include a typed WebFetchInput.
 * @param input - The hook input to check
 * @returns True if the input is for a WebFetch tool
 * @example
 * ```typescript
 * if (isWebFetchTool(input)) {
 *   console.log(input.tool_input.url);
 *   console.log(input.tool_input.prompt);
 * }
 * ```
 */
export declare function isWebFetchTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "WebFetch";
    tool_input: WebFetchInput;
};
/**
 * Type guard for WebSearch tool inputs.
 *
 * Narrows the input type to include a typed WebSearchInput.
 * @param input - The hook input to check
 * @returns True if the input is for a WebSearch tool
 * @example
 * ```typescript
 * if (isWebSearchTool(input)) {
 *   console.log(input.tool_input.query);
 * }
 * ```
 */
export declare function isWebSearchTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "WebSearch";
    tool_input: WebSearchInput;
};
/**
 * Type guard for AskUserQuestion tool inputs.
 *
 * Narrows the input type to include a typed AskUserQuestionInput.
 * @param input - The hook input to check
 * @returns True if the input is for an AskUserQuestion tool
 * @example
 * ```typescript
 * if (isAskUserQuestionTool(input)) {
 *   console.log(input.tool_input.questions);
 * }
 * ```
 */
export declare function isAskUserQuestionTool<T extends ToolUseInput>(input: T): input is T & {
    tool_name: "AskUserQuestion";
    tool_input: AskUserQuestionInput;
};
/**
 * Extracts the file path from a tool input.
 *
 * Works with Write, Edit, MultiEdit, and Read tools.
 * Returns null for other tools or if file_path is missing.
 * @param input - The hook input to extract from
 * @returns The file path, or null if not applicable
 * @example
 * ```typescript
 * const filePath = getFilePath(input);
 * if (filePath && isTsFile(filePath)) {
 *   // Handle TypeScript file
 * }
 * ```
 */
export declare function getFilePath(input: ToolUseInput): string | null;
/**
 * Checks if a file path is a JavaScript or TypeScript file.
 *
 * Matches .js, .jsx, .ts, .tsx, .mjs, .mts, .cjs, .cts extensions.
 * @param filePath - The file path to check
 * @returns True if the file is JavaScript or TypeScript
 * @example
 * ```typescript
 * if (isJsTsFile(filePath)) {
 *   // Check for TypeScript-specific patterns
 * }
 * ```
 */
export declare function isJsTsFile(filePath: string): boolean;
/**
 * Checks if a file path is a TypeScript file.
 *
 * Matches .ts, .tsx, .mts, .cts extensions.
 * @param filePath - The file path to check
 * @returns True if the file is TypeScript
 * @example
 * ```typescript
 * if (isTsFile(filePath)) {
 *   // Enforce TypeScript-specific rules
 * }
 * ```
 */
export declare function isTsFile(filePath: string): boolean;
/**
 * Result of checking content for a pattern.
 */
export interface PatternCheckResult {
    /** True if the pattern was found in any content. */
    found: boolean;
    /** True if the pattern is being added (not present in old content, present in new). */
    isAddition: boolean;
    /** All matches found across all content (deduplicated). */
    matches: string[];
    /** Per-edit details for MultiEdit operations. */
    details?: Array<{
        /** Index of the edit (for MultiEdit) or 0 for Write/Edit. */
        index: number;
        /** True if found in this edit. */
        found: boolean;
        /** True if this edit adds the pattern. */
        isAddition: boolean;
        /** Matches in this edit. */
        matches: string[];
    }>;
}
/**
 * Checks if a pattern exists in the content being written or edited.
 *
 * For Write: checks the content being written
 * For Edit: checks new_string (and old_string to detect additions)
 * For MultiEdit: checks all edits and aggregates results
 * @param input - The PreToolUse hook input
 * @param pattern - The regex pattern to search for (global flag will be used)
 * @returns Result object, or null if not a file-modifying tool
 * @example
 * ```typescript
 * // Block @ts-expect-error being added
 * const result = checkContentForPattern(input, /@ts-expect-error/g);
 * if (result?.isAddition) {
 *   return preToolUseOutput({
 *     hookSpecificOutput: {
 *       permissionDecision: 'deny',
 *       permissionDecisionReason: `Cannot add: ${result.matches.join(', ')}`
 *     }
 *   });
 * }
 * ```
 */
export declare function checkContentForPattern(input: PreToolUseInput, pattern: RegExp): PatternCheckResult | null;
/**
 * Context passed to the forEachContent callback.
 */
export interface ContentContext {
    /** The new content being written or replacing old content. */
    newContent: string;
    /** The old content being replaced (null for Write). */
    oldContent: string | null;
    /** Index of the edit (0 for Write/Edit, index for MultiEdit). */
    index: number;
    /** True if this is a Write operation (not Edit/MultiEdit). */
    isWrite: boolean;
}
/**
 * Iterates over content in Write/Edit/MultiEdit operations.
 *
 * Provides a unified way to inspect content regardless of operation type.
 * Return false from the callback to stop iteration early.
 * @param input - The PreToolUse hook input
 * @param callback - Function called for each content piece, return false to stop
 * @returns True if all callbacks returned true, false if stopped early or not applicable
 * @example
 * ```typescript
 * // Check all content for sensitive data
 * const hasSensitive = !forEachContent(input, ({ newContent }) => {
 *   if (/password|secret|api.?key/i.test(newContent)) {
 *     return false; // Stop - found sensitive data
 *   }
 *   return true; // Continue
 * });
 * ```
 */
export declare function forEachContent(input: PreToolUseInput, callback: (ctx: ContentContext) => boolean): boolean;
