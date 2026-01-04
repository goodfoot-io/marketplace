/**
 * Type definitions for well-known Claude Code tool inputs.
 *
 * These types define the structure of `toolInput` for common Claude Code tools.
 * Use them with type guards from `tool-helpers.ts` for safe type narrowing,
 * or with typed hook factory overloads for automatic typing.
 * @example
 * ```typescript
 * import { isWriteTool, getFilePath } from '@goodfoot/claude-code-hooks';
 *
 * preToolUseHook({ matcher: 'Write|Edit|MultiEdit' }, (input) => {
 *   if (isWriteTool(input)) {
 *     // input.tool_input is now typed as WriteToolInput
 *     console.log(input.tool_input.file_path);
 *   }
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks
 * @module
 */
/**
 * Input structure for the Write tool.
 *
 * The Write tool creates or overwrites files with the specified content.
 * @example
 * ```typescript
 * // Example tool input
 * {
 *   file_path: '/workspace/src/index.ts',
 *   content: 'export const hello = "world";'
 * }
 * ```
 */
export interface WriteToolInput {
    /** Absolute path to the file to write. */
    file_path: string;
    /** The content to write to the file. */
    content: string;
}
/**
 * Input structure for the Edit tool.
 *
 * The Edit tool performs search-and-replace operations on files.
 * @example
 * ```typescript
 * // Example tool input
 * {
 *   file_path: '/workspace/src/index.ts',
 *   old_string: 'const x = 1;',
 *   new_string: 'const x = 2;',
 *   replace_all: false
 * }
 * ```
 */
export interface EditToolInput {
    /** Absolute path to the file to edit. */
    file_path: string;
    /** The text to search for (must be unique in the file unless replace_all is true). */
    old_string: string;
    /** The text to replace old_string with. */
    new_string: string;
    /** If true, replace all occurrences. If false, old_string must be unique. */
    replace_all?: boolean;
}
/**
 * A single edit entry within a MultiEdit operation.
 */
export interface MultiEditEntry {
    /** The text to search for. */
    old_string: string;
    /** The text to replace old_string with. */
    new_string: string;
}
/**
 * Input structure for the MultiEdit tool.
 *
 * The MultiEdit tool performs multiple search-and-replace operations on a single file.
 * All edits are applied atomically.
 * @example
 * ```typescript
 * // Example tool input
 * {
 *   file_path: '/workspace/src/index.ts',
 *   edits: [
 *     { old_string: 'const x = 1;', new_string: 'const x = 2;' },
 *     { old_string: 'const y = 1;', new_string: 'const y = 2;' }
 *   ]
 * }
 * ```
 */
export interface MultiEditToolInput {
    /** Absolute path to the file to edit. */
    file_path: string;
    /** Array of edit operations to apply. */
    edits: MultiEditEntry[];
}
/**
 * Input structure for the Read tool.
 *
 * The Read tool reads file contents, optionally with offset and limit.
 * @example
 * ```typescript
 * // Example tool input
 * {
 *   file_path: '/workspace/src/index.ts',
 *   offset: 0,
 *   limit: 100
 * }
 * ```
 */
export interface ReadToolInput {
    /** Absolute path to the file to read. */
    file_path: string;
    /** Line offset to start reading from. */
    offset?: number;
    /** Maximum number of lines to read. */
    limit?: number;
}
/**
 * Input structure for the Bash tool.
 *
 * The Bash tool executes shell commands.
 * @example
 * ```typescript
 * // Example tool input
 * {
 *   command: 'npm install',
 *   timeout: 60000,
 *   description: 'Install dependencies'
 * }
 * ```
 */
export interface BashToolInput {
    /** The command to execute. */
    command: string;
    /** Optional timeout in milliseconds. */
    timeout?: number;
    /** Optional description of what the command does. */
    description?: string;
}
/**
 * Input structure for the Glob tool.
 *
 * The Glob tool finds files matching a glob pattern.
 * @example
 * ```typescript
 * // Example tool input
 * {
 *   pattern: '**\/*.ts',
 *   path: '/workspace/src'
 * }
 * ```
 */
export interface GlobToolInput {
    /** Glob pattern to match files against. */
    pattern: string;
    /** Directory to search in (defaults to cwd). */
    path?: string;
}
/**
 * Input structure for the Grep tool.
 *
 * The Grep tool searches file contents using regex patterns.
 * @example
 * ```typescript
 * // Example tool input
 * {
 *   pattern: 'function\\s+\\w+',
 *   path: '/workspace/src',
 *   glob: '*.ts'
 * }
 * ```
 */
export interface GrepToolInput {
    /** Regular expression pattern to search for. */
    pattern: string;
    /** Directory to search in (defaults to cwd). */
    path?: string;
    /** Glob pattern to filter files. */
    glob?: string;
}
/**
 * Union of all file-modifying tool inputs.
 *
 * Use this type when you need to handle Write, Edit, or MultiEdit generically.
 */
export type FileModifyingToolInput = WriteToolInput | EditToolInput | MultiEditToolInput;
/**
 * Tool names for file-modifying tools.
 *
 * Use this type when you need to reference the tool name in type guards.
 */
export type FileModifyingToolName = 'Write' | 'Edit' | 'MultiEdit';
/**
 * Union of all known tool inputs.
 *
 * This includes all tool inputs that have well-defined type structures.
 */
export type KnownToolInput = WriteToolInput | EditToolInput | MultiEditToolInput | ReadToolInput | BashToolInput | GlobToolInput | GrepToolInput;
/**
 * Tool names for all known tools with typed inputs.
 */
export type KnownToolName = 'Write' | 'Edit' | 'MultiEdit' | 'Read' | 'Bash' | 'Glob' | 'Grep';
/**
 * Type mapping from tool name to tool input type.
 *
 * Used by typed factory overloads to provide automatic typing.
 * @example
 * ```typescript
 * type WriteInput = ToolInputMap['Write']; // WriteToolInput
 * ```
 */
export interface ToolInputMap {
    Write: WriteToolInput;
    Edit: EditToolInput;
    MultiEdit: MultiEditToolInput;
    Read: ReadToolInput;
    Bash: BashToolInput;
    Glob: GlobToolInput;
    Grep: GrepToolInput;
}
