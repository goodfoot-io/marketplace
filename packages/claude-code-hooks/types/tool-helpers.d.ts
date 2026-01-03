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
 *   const result = checkContentForPattern(input, /@ts-ignore/g);
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
import type { PreToolUseInput, PostToolUseInput, PostToolUseFailureInput, PermissionRequestInput } from './inputs.js';
import type { WriteToolInput, EditToolInput, MultiEditToolInput, ReadToolInput, BashToolInput, GlobToolInput, GrepToolInput, FileModifyingToolInput, FileModifyingToolName } from './tool-inputs.js';
/**
 * Union of all hook input types that include toolInput.
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
 *   // input.toolInput is now typed as WriteToolInput
 *   console.log(input.toolInput.file_path);
 *   console.log(input.toolInput.content);
 * }
 * ```
 */
export declare function isWriteTool<T extends ToolUseInput>(input: T): input is T & {
    toolName: 'Write';
    toolInput: WriteToolInput;
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
 *   console.log(input.toolInput.old_string);
 *   console.log(input.toolInput.new_string);
 * }
 * ```
 */
export declare function isEditTool<T extends ToolUseInput>(input: T): input is T & {
    toolName: 'Edit';
    toolInput: EditToolInput;
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
 *   for (const edit of input.toolInput.edits) {
 *     console.log(`${edit.old_string} -> ${edit.new_string}`);
 *   }
 * }
 * ```
 */
export declare function isMultiEditTool<T extends ToolUseInput>(input: T): input is T & {
    toolName: 'MultiEdit';
    toolInput: MultiEditToolInput;
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
    toolName: FileModifyingToolName;
    toolInput: FileModifyingToolInput;
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
 *   console.log(input.toolInput.file_path);
 *   console.log(input.toolInput.offset);
 * }
 * ```
 */
export declare function isReadTool<T extends ToolUseInput>(input: T): input is T & {
    toolName: 'Read';
    toolInput: ReadToolInput;
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
 *   console.log(input.toolInput.command);
 *   console.log(input.toolInput.timeout);
 * }
 * ```
 */
export declare function isBashTool<T extends ToolUseInput>(input: T): input is T & {
    toolName: 'Bash';
    toolInput: BashToolInput;
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
 *   console.log(input.toolInput.pattern);
 *   console.log(input.toolInput.path);
 * }
 * ```
 */
export declare function isGlobTool<T extends ToolUseInput>(input: T): input is T & {
    toolName: 'Glob';
    toolInput: GlobToolInput;
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
 *   console.log(input.toolInput.pattern);
 *   console.log(input.toolInput.glob);
 * }
 * ```
 */
export declare function isGrepTool<T extends ToolUseInput>(input: T): input is T & {
    toolName: 'Grep';
    toolInput: GrepToolInput;
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
 * // Block @ts-ignore being added
 * const result = checkContentForPattern(input, /@ts-ignore/g);
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
