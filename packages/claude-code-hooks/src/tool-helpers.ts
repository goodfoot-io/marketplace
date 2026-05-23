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

import type {
  AgentInput,
  AskUserQuestionInput,
  BashInput,
  ConfigInput,
  CronCreateInput,
  CronDeleteInput,
  CronListInput,
  EnterPlanModeInput,
  EnterWorktreeInput,
  ExitPlanModeInput,
  ExitWorktreeInput,
  FileEditInput,
  FileModifyingToolInput,
  FileModifyingToolName,
  FileReadInput,
  FileWriteInput,
  GlobInput,
  GrepInput,
  KillShellInput,
  ListMcpResourcesInput,
  McpInput,
  MonitorInput,
  MultiEditToolInput,
  NotebookEditInput,
  PermissionRequestInput,
  PushNotificationInput,
  REPLInput,
  ReadMcpResourceInput,
  RemoteTriggerInput,
  ScheduleWakeupInput,
  SDKPostToolUseFailureHookInput,
  SDKPostToolUseHookInput,
  SDKPreToolUseHookInput,
  TaskCreateInput,
  TaskGetInput,
  TaskListInput,
  TaskOutputInput,
  TaskUpdateInput,
  TodoWriteInput,
  WebFetchInput,
  WebSearchInput,
  WorkflowInput,
} from "./types.js";

// ============================================================================
// Tool Use Input Types (union for type guards)
// ============================================================================

/**
 * Union of all hook input types that include tool_input.
 */
export type ToolUseInput =
  | SDKPreToolUseHookInput
  | SDKPostToolUseHookInput
  | SDKPostToolUseFailureHookInput
  | PermissionRequestInput;

// ============================================================================
// Type Guards
// ============================================================================

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
export function isWriteTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Write"; tool_input: FileWriteInput } {
  return input.tool_name === "Write";
}

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
export function isEditTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Edit"; tool_input: FileEditInput } {
  return input.tool_name === "Edit";
}

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
export function isMultiEditTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "MultiEdit"; tool_input: MultiEditToolInput } {
  return input.tool_name === "MultiEdit";
}

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
export function isFileModifyingTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: FileModifyingToolName; tool_input: FileModifyingToolInput } {
  return input.tool_name === "Write" || input.tool_name === "Edit" || input.tool_name === "MultiEdit";
}

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
export function isReadTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Read"; tool_input: FileReadInput } {
  return input.tool_name === "Read";
}

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
export function isBashTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Bash"; tool_input: BashInput } {
  return input.tool_name === "Bash";
}

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
export function isGlobTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Glob"; tool_input: GlobInput } {
  return input.tool_name === "Glob";
}

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
export function isGrepTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Grep"; tool_input: GrepInput } {
  return input.tool_name === "Grep";
}

/**
 * Type guard for Agent tool inputs.
 *
 * Narrows the input type to include a typed AgentInput.
 * @param input - The hook input to check
 * @returns True if the input is for an Agent tool
 * @example
 * ```typescript
 * if (isTaskTool(input)) {
 *   console.log(input.tool_input.prompt);
 *   console.log(input.tool_input.subagent_type);
 * }
 * ```
 */
export function isTaskTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Agent"; tool_input: AgentInput } {
  return input.tool_name === "Agent";
}

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
export function isTaskOutputTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "TaskOutput"; tool_input: TaskOutputInput } {
  return input.tool_name === "TaskOutput";
}

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
export function isExitPlanModeTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "ExitPlanMode"; tool_input: ExitPlanModeInput } {
  return input.tool_name === "ExitPlanMode";
}

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
export function isKillShellTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "KillShell"; tool_input: KillShellInput } {
  return input.tool_name === "KillShell";
}

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
export function isNotebookEditTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "NotebookEdit"; tool_input: NotebookEditInput } {
  return input.tool_name === "NotebookEdit";
}

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
export function isTodoWriteTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "TodoWrite"; tool_input: TodoWriteInput } {
  return input.tool_name === "TodoWrite";
}

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
export function isWebFetchTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "WebFetch"; tool_input: WebFetchInput } {
  return input.tool_name === "WebFetch";
}

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
export function isWebSearchTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "WebSearch"; tool_input: WebSearchInput } {
  return input.tool_name === "WebSearch";
}

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
export function isAskUserQuestionTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "AskUserQuestion"; tool_input: AskUserQuestionInput } {
  return input.tool_name === "AskUserQuestion";
}

/**
 * Type guard for ListMcpResources tool inputs.
 *
 * Narrows the input type to include a typed ListMcpResourcesInput.
 * @param input - The hook input to check
 * @returns True if the input is for a ListMcpResources tool
 * @example
 * ```typescript
 * if (isListMcpResourcesTool(input)) {
 *   console.log(input.tool_input.server);
 * }
 * ```
 */
export function isListMcpResourcesTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "ListMcpResources"; tool_input: ListMcpResourcesInput } {
  return input.tool_name === "ListMcpResources";
}

/**
 * Type guard for Mcp tool inputs.
 *
 * Narrows the input type to include a typed McpInput.
 * @param input - The hook input to check
 * @returns True if the input is for an Mcp tool
 * @example
 * ```typescript
 * if (isMcpTool(input)) {
 *   // input.tool_input is now typed as McpInput
 * }
 * ```
 */
export function isMcpTool<T extends ToolUseInput>(input: T): input is T & { tool_name: "Mcp"; tool_input: McpInput } {
  return input.tool_name === "Mcp";
}

/**
 * Type guard for ReadMcpResource tool inputs.
 *
 * Narrows the input type to include a typed ReadMcpResourceInput.
 * @param input - The hook input to check
 * @returns True if the input is for a ReadMcpResource tool
 * @example
 * ```typescript
 * if (isReadMcpResourceTool(input)) {
 *   console.log(input.tool_input.server);
 *   console.log(input.tool_input.uri);
 * }
 * ```
 */
export function isReadMcpResourceTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "ReadMcpResource"; tool_input: ReadMcpResourceInput } {
  return input.tool_name === "ReadMcpResource";
}

/**
 * Type guard for Config tool inputs.
 *
 * Narrows the input type to include a typed ConfigInput.
 * @param input - The hook input to check
 * @returns True if the input is for a Config tool
 * @example
 * ```typescript
 * if (isConfigTool(input)) {
 *   console.log(input.tool_input.setting);
 *   console.log(input.tool_input.value);
 * }
 * ```
 */
export function isConfigTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Config"; tool_input: ConfigInput } {
  return input.tool_name === "Config";
}

/**
 * Type guard for TaskCreate tool inputs.
 *
 * Narrows the input type to include a typed TaskCreateInput.
 * @param input - The hook input to check
 * @returns True if the input is for a TaskCreate tool
 * @example
 * ```typescript
 * if (isTaskCreateTool(input)) {
 *   console.log(input.tool_input.subject);
 * }
 * ```
 */
export function isTaskCreateTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "TaskCreate"; tool_input: TaskCreateInput } {
  return input.tool_name === "TaskCreate";
}

/**
 * Type guard for TaskGet tool inputs.
 *
 * Narrows the input type to include a typed TaskGetInput.
 * @param input - The hook input to check
 * @returns True if the input is for a TaskGet tool
 * @example
 * ```typescript
 * if (isTaskGetTool(input)) {
 *   console.log(input.tool_input.taskId);
 * }
 * ```
 */
export function isTaskGetTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "TaskGet"; tool_input: TaskGetInput } {
  return input.tool_name === "TaskGet";
}

/**
 * Type guard for TaskList tool inputs.
 *
 * Narrows the input type to include a typed TaskListInput.
 * @param input - The hook input to check
 * @returns True if the input is for a TaskList tool
 * @example
 * ```typescript
 * if (isTaskListTool(input)) {
 *   // input.tool_input is now typed as TaskListInput
 * }
 * ```
 */
export function isTaskListTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "TaskList"; tool_input: TaskListInput } {
  return input.tool_name === "TaskList";
}

/**
 * Type guard for TaskUpdate tool inputs.
 *
 * Narrows the input type to include a typed TaskUpdateInput.
 * @param input - The hook input to check
 * @returns True if the input is for a TaskUpdate tool
 * @example
 * ```typescript
 * if (isTaskUpdateTool(input)) {
 *   console.log(input.tool_input.taskId, input.tool_input.status);
 * }
 * ```
 */
export function isTaskUpdateTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "TaskUpdate"; tool_input: TaskUpdateInput } {
  return input.tool_name === "TaskUpdate";
}

/**
 * Type guard for CronCreate tool inputs.
 *
 * Narrows the input type to include a typed CronCreateInput.
 * @param input - The hook input to check
 * @returns True if the input is for a CronCreate tool
 * @example
 * ```typescript
 * if (isCronCreateTool(input)) {
 *   console.log(input.tool_input.cron, input.tool_input.prompt);
 * }
 * ```
 */
export function isCronCreateTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "CronCreate"; tool_input: CronCreateInput } {
  return input.tool_name === "CronCreate";
}

/**
 * Type guard for CronDelete tool inputs.
 *
 * Narrows the input type to include a typed CronDeleteInput.
 * @param input - The hook input to check
 * @returns True if the input is for a CronDelete tool
 * @example
 * ```typescript
 * if (isCronDeleteTool(input)) {
 *   console.log(input.tool_input.id);
 * }
 * ```
 */
export function isCronDeleteTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "CronDelete"; tool_input: CronDeleteInput } {
  return input.tool_name === "CronDelete";
}

/**
 * Type guard for CronList tool inputs.
 *
 * Narrows the input type to include a typed CronListInput.
 * @param input - The hook input to check
 * @returns True if the input is for a CronList tool
 * @example
 * ```typescript
 * if (isCronListTool(input)) {
 *   // input.tool_input is now typed as CronListInput
 * }
 * ```
 */
export function isCronListTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "CronList"; tool_input: CronListInput } {
  return input.tool_name === "CronList";
}

/**
 * Type guard for ScheduleWakeup tool inputs.
 *
 * Narrows the input type to include a typed ScheduleWakeupInput.
 * @param input - The hook input to check
 * @returns True if the input is for a ScheduleWakeup tool
 * @example
 * ```typescript
 * if (isScheduleWakeupTool(input)) {
 *   console.log(input.tool_input.delaySeconds);
 * }
 * ```
 */
export function isScheduleWakeupTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "ScheduleWakeup"; tool_input: ScheduleWakeupInput } {
  return input.tool_name === "ScheduleWakeup";
}

/**
 * Type guard for Monitor tool inputs.
 *
 * Narrows the input type to include a typed MonitorInput.
 * @param input - The hook input to check
 * @returns True if the input is for a Monitor tool
 * @example
 * ```typescript
 * if (isMonitorTool(input)) {
 *   console.log(input.tool_input.command);
 * }
 * ```
 */
export function isMonitorTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Monitor"; tool_input: MonitorInput } {
  return input.tool_name === "Monitor";
}

/**
 * Type guard for RemoteTrigger tool inputs.
 *
 * Narrows the input type to include a typed RemoteTriggerInput.
 * @param input - The hook input to check
 * @returns True if the input is for a RemoteTrigger tool
 * @example
 * ```typescript
 * if (isRemoteTriggerTool(input)) {
 *   console.log(input.tool_input.action);
 * }
 * ```
 */
export function isRemoteTriggerTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "RemoteTrigger"; tool_input: RemoteTriggerInput } {
  return input.tool_name === "RemoteTrigger";
}

/**
 * Type guard for PushNotification tool inputs.
 *
 * Narrows the input type to include a typed PushNotificationInput.
 * @param input - The hook input to check
 * @returns True if the input is for a PushNotification tool
 * @example
 * ```typescript
 * if (isPushNotificationTool(input)) {
 *   console.log(input.tool_input.message);
 * }
 * ```
 */
export function isPushNotificationTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "PushNotification"; tool_input: PushNotificationInput } {
  return input.tool_name === "PushNotification";
}

/**
 * Type guard for EnterPlanMode tool inputs.
 *
 * Narrows the input type to include a typed EnterPlanModeInput.
 * @param input - The hook input to check
 * @returns True if the input is for an EnterPlanMode tool
 * @example
 * ```typescript
 * if (isEnterPlanModeTool(input)) {
 *   // input.tool_input is now typed as EnterPlanModeInput
 * }
 * ```
 */
export function isEnterPlanModeTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "EnterPlanMode"; tool_input: EnterPlanModeInput } {
  return input.tool_name === "EnterPlanMode";
}

/**
 * Type guard for EnterWorktree tool inputs.
 *
 * Narrows the input type to include a typed EnterWorktreeInput.
 * @param input - The hook input to check
 * @returns True if the input is for an EnterWorktree tool
 * @example
 * ```typescript
 * if (isEnterWorktreeTool(input)) {
 *   console.log(input.tool_input.name);
 * }
 * ```
 */
export function isEnterWorktreeTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "EnterWorktree"; tool_input: EnterWorktreeInput } {
  return input.tool_name === "EnterWorktree";
}

/**
 * Type guard for ExitWorktree tool inputs.
 *
 * Narrows the input type to include a typed ExitWorktreeInput.
 * @param input - The hook input to check
 * @returns True if the input is for an ExitWorktree tool
 * @example
 * ```typescript
 * if (isExitWorktreeTool(input)) {
 *   console.log(input.tool_input.action);
 * }
 * ```
 */
export function isExitWorktreeTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "ExitWorktree"; tool_input: ExitWorktreeInput } {
  return input.tool_name === "ExitWorktree";
}

/**
 * Type guard for REPL tool inputs.
 *
 * Narrows the input type to include a typed REPLInput.
 * @param input - The hook input to check
 * @returns True if the input is for a REPL tool
 * @example
 * ```typescript
 * if (isReplTool(input)) {
 *   console.log(input.tool_input.code);
 * }
 * ```
 */
export function isReplTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "REPL"; tool_input: REPLInput } {
  return input.tool_name === "REPL";
}

/**
 * Type guard for Workflow tool inputs.
 *
 * Narrows the input type to include a typed WorkflowInput.
 * @param input - The hook input to check
 * @returns True if the input is for a Workflow tool
 * @example
 * ```typescript
 * if (isWorkflowTool(input)) {
 *   console.log(input.tool_input.name);
 * }
 * ```
 */
export function isWorkflowTool<T extends ToolUseInput>(
  input: T,
): input is T & { tool_name: "Workflow"; tool_input: WorkflowInput } {
  return input.tool_name === "Workflow";
}

// ============================================================================
// File Path Utilities
// ============================================================================

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
export function getFilePath(input: ToolUseInput): string | null {
  const toolInput = input.tool_input as { file_path?: string } | null | undefined;
  if (toolInput && typeof toolInput === "object" && "file_path" in toolInput) {
    const filePath = toolInput.file_path;
    return typeof filePath === "string" ? filePath : null;
  }
  return null;
}

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
export function isJsTsFile(filePath: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}

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
export function isTsFile(filePath: string): boolean {
  return /\.[cm]?tsx?$/.test(filePath);
}

// ============================================================================
// Content Inspection
// ============================================================================

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
export function checkContentForPattern(input: SDKPreToolUseHookInput, pattern: RegExp): PatternCheckResult | null {
  // Ensure pattern has global flag for matchAll
  const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);

  if (isWriteTool(input)) {
    const matches = [...input.tool_input.content.matchAll(globalPattern)].map((m) => m[0]);
    const uniqueMatches = [...new Set(matches)];
    return {
      found: uniqueMatches.length > 0,
      isAddition: uniqueMatches.length > 0, // For Write, any match is an addition
      matches: uniqueMatches,
    };
  }

  if (isEditTool(input)) {
    const newMatches = [...input.tool_input.new_string.matchAll(globalPattern)].map((m) => m[0]);
    const oldMatches = [...input.tool_input.old_string.matchAll(globalPattern)].map((m) => m[0]);
    const uniqueNewMatches = [...new Set(newMatches)];
    const uniqueOldMatches = new Set(oldMatches);

    // Addition = found in new but not in old
    const additions = uniqueNewMatches.filter((m) => !uniqueOldMatches.has(m));

    return {
      found: uniqueNewMatches.length > 0,
      isAddition: additions.length > 0,
      matches: uniqueNewMatches,
    };
  }

  if (isMultiEditTool(input)) {
    const details: PatternCheckResult["details"] = [];
    const allMatches = new Set<string>();
    let anyFound = false;
    let anyAddition = false;

    for (let i = 0; i < input.tool_input.edits.length; i++) {
      const edit = input.tool_input.edits[i];
      const newMatches = [...edit.new_string.matchAll(globalPattern)].map((m) => m[0]);
      const oldMatches = [...edit.old_string.matchAll(globalPattern)].map((m) => m[0]);
      const uniqueNewMatches = [...new Set(newMatches)];
      const uniqueOldMatches = new Set(oldMatches);

      const additions = uniqueNewMatches.filter((m) => !uniqueOldMatches.has(m));
      const found = uniqueNewMatches.length > 0;
      const isAddition = additions.length > 0;

      if (found) anyFound = true;
      if (isAddition) anyAddition = true;
      for (const m of uniqueNewMatches) {
        allMatches.add(m);
      }

      details.push({
        index: i,
        found,
        isAddition,
        matches: uniqueNewMatches,
      });
    }

    return {
      found: anyFound,
      isAddition: anyAddition,
      matches: [...allMatches],
      details,
    };
  }

  return null;
}

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
export function forEachContent(input: SDKPreToolUseHookInput, callback: (ctx: ContentContext) => boolean): boolean {
  if (isWriteTool(input)) {
    return callback({
      newContent: input.tool_input.content,
      oldContent: null,
      index: 0,
      isWrite: true,
    });
  }

  if (isEditTool(input)) {
    return callback({
      newContent: input.tool_input.new_string,
      oldContent: input.tool_input.old_string,
      index: 0,
      isWrite: false,
    });
  }

  if (isMultiEditTool(input)) {
    for (let i = 0; i < input.tool_input.edits.length; i++) {
      const edit = input.tool_input.edits[i];
      const shouldContinue = callback({
        newContent: edit.new_string,
        oldContent: edit.old_string,
        index: i,
        isWrite: false,
      });
      if (!shouldContinue) return false;
    }
    return true;
  }

  return false;
}
