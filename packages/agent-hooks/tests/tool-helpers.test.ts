/**
 * Unit tests for tool-helpers module.
 *
 * Tests:
 * - Type guards for all tool types
 * - File path extraction utilities
 * - Content pattern checking
 * - forEachContent iteration
 */

import type { PostToolUseHookInput, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import {
  // Content inspection
  checkContentForPattern,
  forEachContent,
  // File path utilities
  getFilePath,
  isBashTool,
  isConfigTool,
  isCronCreateTool,
  isCronDeleteTool,
  isCronListTool,
  isEditTool,
  isEnterPlanModeTool,
  isEnterWorktreeTool,
  isExitWorktreeTool,
  isFileModifyingTool,
  isGlobTool,
  isGrepTool,
  isJsTsFile,
  isListMcpResourcesTool,
  isMcpTool,
  isMonitorTool,
  isMultiEditTool,
  isPushNotificationTool,
  isReadMcpResourceTool,
  isReadTool,
  isRemoteTriggerTool,
  isReplTool,
  isScheduleWakeupTool,
  isTaskCreateTool,
  isTaskGetTool,
  isTaskListTool,
  isTaskUpdateTool,
  isTsFile,
  isWorkflowTool,
  // Type guards
  isWriteTool,
} from "../src/agents/claude-code/tool-helpers.js";

// Helper to create minimal valid inputs
function createBaseInput(): Omit<PreToolUseHookInput, "hook_event_name" | "tool_name" | "tool_input" | "tool_use_id"> {
  return {
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
  };
}

function createWriteInput(content = "const x = 1;"): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_input: { file_path: "/workspace/src/index.ts", content },
    tool_use_id: "tu_123",
  };
}

function createEditInput(oldString = "const x = 1;", newString = "const x = 2;"): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Edit",
    tool_input: { file_path: "/workspace/src/index.ts", old_string: oldString, new_string: newString },
    tool_use_id: "tu_123",
  };
}

function createMultiEditInput(
  edits = [{ old_string: "const x = 1;", new_string: "const x = 2;" }],
): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "MultiEdit",
    tool_input: { file_path: "/workspace/src/index.ts", edits },
    tool_use_id: "tu_123",
  };
}

function createReadInput(): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Read",
    tool_input: { file_path: "/workspace/src/index.ts", offset: 0, limit: 100 },
    tool_use_id: "tu_123",
  };
}

function createBashInput(): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "npm install", timeout: 60000 },
    tool_use_id: "tu_123",
  };
}

function createGlobInput(): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Glob",
    tool_input: { pattern: "**/*.ts", path: "/workspace" },
    tool_use_id: "tu_123",
  };
}

function createGrepInput(): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Grep",
    tool_input: { pattern: "function\\s+\\w+", glob: "*.ts" },
    tool_use_id: "tu_123",
  };
}

function createListMcpResourcesInput(): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "ListMcpResources",
    tool_input: { server: "my-mcp-server" },
    tool_use_id: "tu_123",
  };
}

function createMcpInput(): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Mcp",
    tool_input: { some_property: "value" },
    tool_use_id: "tu_123",
  };
}

function createReadMcpResourceInput(): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "ReadMcpResource",
    tool_input: { server: "my-mcp-server", uri: "resource://example" },
    tool_use_id: "tu_123",
  };
}

function createConfigInput(): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Config",
    tool_input: { setting: "theme", value: "dark" },
    tool_use_id: "tu_123",
  };
}

function createToolInput(toolName: string, toolInput: unknown): PreToolUseHookInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: "tu_123",
  };
}

function createTaskCreateInput(): PreToolUseHookInput {
  return createToolInput("TaskCreate", { subject: "Fix bug", description: "Investigate the crash" });
}

function createTaskGetInput(): PreToolUseHookInput {
  return createToolInput("TaskGet", { taskId: "task_123" });
}

function createTaskListInput(): PreToolUseHookInput {
  return createToolInput("TaskList", {});
}

function createTaskUpdateInput(): PreToolUseHookInput {
  return createToolInput("TaskUpdate", { taskId: "task_123", status: "completed" });
}

function createCronCreateInput(): PreToolUseHookInput {
  return createToolInput("CronCreate", { cron: "*/5 * * * *", prompt: "Check the deploy" });
}

function createCronDeleteInput(): PreToolUseHookInput {
  return createToolInput("CronDelete", { id: "cron_123" });
}

function createCronListInput(): PreToolUseHookInput {
  return createToolInput("CronList", {});
}

function createScheduleWakeupInput(): PreToolUseHookInput {
  return createToolInput("ScheduleWakeup", { delaySeconds: 120, reason: "poll CI", prompt: "/loop" });
}

function createMonitorInput(): PreToolUseHookInput {
  return createToolInput("Monitor", {
    description: "watch log",
    timeout_ms: 300000,
    persistent: false,
    command: "tail -f log",
  });
}

function createRemoteTriggerInput(): PreToolUseHookInput {
  return createToolInput("RemoteTrigger", { action: "list" });
}

function createPushNotificationInput(): PreToolUseHookInput {
  return createToolInput("PushNotification", { message: "Build finished", status: "proactive" });
}

function createEnterPlanModeInput(): PreToolUseHookInput {
  return createToolInput("EnterPlanMode", {});
}

function createEnterWorktreeInput(): PreToolUseHookInput {
  return createToolInput("EnterWorktree", { name: "feature/x" });
}

function createExitWorktreeInput(): PreToolUseHookInput {
  return createToolInput("ExitWorktree", { action: "keep" });
}

function createReplInput(): PreToolUseHookInput {
  return createToolInput("REPL", { code: "await Promise.resolve(1)" });
}

function createWorkflowInput(): PreToolUseHookInput {
  return createToolInput("Workflow", { name: "ci-check" });
}

describe("Type Guards", () => {
  describe("isWriteTool", () => {
    it("returns true for Write tool", () => {
      const input = createWriteInput();
      expect(isWriteTool(input)).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isWriteTool(createEditInput())).toBe(false);
      expect(isWriteTool(createBashInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createWriteInput();
      if (isWriteTool(input)) {
        // TypeScript should allow these accesses
        expect(input.tool_input.file_path).toBe("/workspace/src/index.ts");
        expect(input.tool_input.content).toBe("const x = 1;");
      }
    });
  });

  describe("isEditTool", () => {
    it("returns true for Edit tool", () => {
      const input = createEditInput();
      expect(isEditTool(input)).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isEditTool(createWriteInput())).toBe(false);
      expect(isEditTool(createMultiEditInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createEditInput();
      if (isEditTool(input)) {
        expect(input.tool_input.old_string).toBe("const x = 1;");
        expect(input.tool_input.new_string).toBe("const x = 2;");
      }
    });
  });

  describe("isMultiEditTool", () => {
    it("returns true for MultiEdit tool", () => {
      const input = createMultiEditInput();
      expect(isMultiEditTool(input)).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isMultiEditTool(createWriteInput())).toBe(false);
      expect(isMultiEditTool(createEditInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createMultiEditInput();
      if (isMultiEditTool(input)) {
        expect(input.tool_input.edits).toHaveLength(1);
        expect(input.tool_input.edits[0].old_string).toBe("const x = 1;");
      }
    });
  });

  describe("isFileModifyingTool", () => {
    it("returns true for Write, Edit, and MultiEdit", () => {
      expect(isFileModifyingTool(createWriteInput())).toBe(true);
      expect(isFileModifyingTool(createEditInput())).toBe(true);
      expect(isFileModifyingTool(createMultiEditInput())).toBe(true);
    });

    it("returns false for non-file-modifying tools", () => {
      expect(isFileModifyingTool(createReadInput())).toBe(false);
      expect(isFileModifyingTool(createBashInput())).toBe(false);
    });
  });

  describe("isReadTool", () => {
    it("returns true for Read tool", () => {
      expect(isReadTool(createReadInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isReadTool(createWriteInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createReadInput();
      if (isReadTool(input)) {
        expect(input.tool_input.file_path).toBe("/workspace/src/index.ts");
        expect(input.tool_input.offset).toBe(0);
      }
    });
  });

  describe("isBashTool", () => {
    it("returns true for Bash tool", () => {
      expect(isBashTool(createBashInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isBashTool(createWriteInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createBashInput();
      if (isBashTool(input)) {
        expect(input.tool_input.command).toBe("npm install");
        expect(input.tool_input.timeout).toBe(60000);
      }
    });
  });

  describe("isGlobTool", () => {
    it("returns true for Glob tool", () => {
      expect(isGlobTool(createGlobInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isGlobTool(createGrepInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createGlobInput();
      if (isGlobTool(input)) {
        expect(input.tool_input.pattern).toBe("**/*.ts");
      }
    });
  });

  describe("isGrepTool", () => {
    it("returns true for Grep tool", () => {
      expect(isGrepTool(createGrepInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isGrepTool(createGlobInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createGrepInput();
      if (isGrepTool(input)) {
        expect(input.tool_input.pattern).toBe("function\\s+\\w+");
      }
    });
  });

  describe("type guards work with PostToolUseHookInput", () => {
    it("works with PostToolUseHookInput", () => {
      const input: PostToolUseHookInput = {
        ...createBaseInput(),
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: { file_path: "/test.ts", content: "test" },
        tool_use_id: "tu_123",
        tool_response: "File written successfully",
      };
      expect(isWriteTool(input)).toBe(true);
    });
  });

  describe("isListMcpResourcesTool", () => {
    it("returns true for ListMcpResources tool", () => {
      expect(isListMcpResourcesTool(createListMcpResourcesInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isListMcpResourcesTool(createBashInput())).toBe(false);
      expect(isListMcpResourcesTool(createMcpInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createListMcpResourcesInput();
      if (isListMcpResourcesTool(input)) {
        expect(input.tool_input.server).toBe("my-mcp-server");
      }
    });
  });

  describe("isMcpTool", () => {
    it("returns true for Mcp tool", () => {
      expect(isMcpTool(createMcpInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isMcpTool(createBashInput())).toBe(false);
      expect(isMcpTool(createListMcpResourcesInput())).toBe(false);
    });
  });

  describe("isReadMcpResourceTool", () => {
    it("returns true for ReadMcpResource tool", () => {
      expect(isReadMcpResourceTool(createReadMcpResourceInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isReadMcpResourceTool(createBashInput())).toBe(false);
      expect(isReadMcpResourceTool(createListMcpResourcesInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createReadMcpResourceInput();
      if (isReadMcpResourceTool(input)) {
        expect(input.tool_input.server).toBe("my-mcp-server");
        expect(input.tool_input.uri).toBe("resource://example");
      }
    });
  });

  describe("isConfigTool", () => {
    it("returns true for Config tool", () => {
      expect(isConfigTool(createConfigInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isConfigTool(createBashInput())).toBe(false);
      expect(isConfigTool(createWriteInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createConfigInput();
      if (isConfigTool(input)) {
        expect(input.tool_input.setting).toBe("theme");
        expect(input.tool_input.value).toBe("dark");
      }
    });
  });

  describe("isTaskCreateTool", () => {
    it("returns true for TaskCreate tool", () => {
      expect(isTaskCreateTool(createTaskCreateInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isTaskCreateTool(createBashInput())).toBe(false);
      expect(isTaskCreateTool(createTaskGetInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createTaskCreateInput();
      if (isTaskCreateTool(input)) {
        expect(input.tool_input.subject).toBe("Fix bug");
        expect(input.tool_input.description).toBe("Investigate the crash");
      }
    });
  });

  describe("isTaskGetTool", () => {
    it("returns true for TaskGet tool", () => {
      expect(isTaskGetTool(createTaskGetInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isTaskGetTool(createTaskCreateInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createTaskGetInput();
      if (isTaskGetTool(input)) {
        expect(input.tool_input.taskId).toBe("task_123");
      }
    });
  });

  describe("isTaskListTool", () => {
    it("returns true for TaskList tool", () => {
      expect(isTaskListTool(createTaskListInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isTaskListTool(createTaskGetInput())).toBe(false);
    });
  });

  describe("isTaskUpdateTool", () => {
    it("returns true for TaskUpdate tool", () => {
      expect(isTaskUpdateTool(createTaskUpdateInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isTaskUpdateTool(createTaskCreateInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createTaskUpdateInput();
      if (isTaskUpdateTool(input)) {
        expect(input.tool_input.taskId).toBe("task_123");
        expect(input.tool_input.status).toBe("completed");
      }
    });
  });

  describe("isCronCreateTool", () => {
    it("returns true for CronCreate tool", () => {
      expect(isCronCreateTool(createCronCreateInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isCronCreateTool(createCronDeleteInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createCronCreateInput();
      if (isCronCreateTool(input)) {
        expect(input.tool_input.cron).toBe("*/5 * * * *");
        expect(input.tool_input.prompt).toBe("Check the deploy");
      }
    });
  });

  describe("isCronDeleteTool", () => {
    it("returns true for CronDelete tool", () => {
      expect(isCronDeleteTool(createCronDeleteInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isCronDeleteTool(createCronListInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createCronDeleteInput();
      if (isCronDeleteTool(input)) {
        expect(input.tool_input.id).toBe("cron_123");
      }
    });
  });

  describe("isCronListTool", () => {
    it("returns true for CronList tool", () => {
      expect(isCronListTool(createCronListInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isCronListTool(createCronCreateInput())).toBe(false);
    });
  });

  describe("isScheduleWakeupTool", () => {
    it("returns true for ScheduleWakeup tool", () => {
      expect(isScheduleWakeupTool(createScheduleWakeupInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isScheduleWakeupTool(createMonitorInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createScheduleWakeupInput();
      if (isScheduleWakeupTool(input)) {
        expect(input.tool_input.delaySeconds).toBe(120);
        expect(input.tool_input.reason).toBe("poll CI");
      }
    });
  });

  describe("isMonitorTool", () => {
    it("returns true for Monitor tool", () => {
      expect(isMonitorTool(createMonitorInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isMonitorTool(createScheduleWakeupInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createMonitorInput();
      if (isMonitorTool(input)) {
        expect(input.tool_input.command).toBe("tail -f log");
        expect(input.tool_input.persistent).toBe(false);
      }
    });
  });

  describe("isRemoteTriggerTool", () => {
    it("returns true for RemoteTrigger tool", () => {
      expect(isRemoteTriggerTool(createRemoteTriggerInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isRemoteTriggerTool(createMonitorInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createRemoteTriggerInput();
      if (isRemoteTriggerTool(input)) {
        expect(input.tool_input.action).toBe("list");
      }
    });
  });

  describe("isPushNotificationTool", () => {
    it("returns true for PushNotification tool", () => {
      expect(isPushNotificationTool(createPushNotificationInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isPushNotificationTool(createMonitorInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createPushNotificationInput();
      if (isPushNotificationTool(input)) {
        expect(input.tool_input.message).toBe("Build finished");
        expect(input.tool_input.status).toBe("proactive");
      }
    });
  });

  describe("isEnterPlanModeTool", () => {
    it("returns true for EnterPlanMode tool", () => {
      expect(isEnterPlanModeTool(createEnterPlanModeInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isEnterPlanModeTool(createEnterWorktreeInput())).toBe(false);
    });
  });

  describe("isEnterWorktreeTool", () => {
    it("returns true for EnterWorktree tool", () => {
      expect(isEnterWorktreeTool(createEnterWorktreeInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isEnterWorktreeTool(createExitWorktreeInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createEnterWorktreeInput();
      if (isEnterWorktreeTool(input)) {
        expect(input.tool_input.name).toBe("feature/x");
      }
    });
  });

  describe("isExitWorktreeTool", () => {
    it("returns true for ExitWorktree tool", () => {
      expect(isExitWorktreeTool(createExitWorktreeInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isExitWorktreeTool(createEnterWorktreeInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createExitWorktreeInput();
      if (isExitWorktreeTool(input)) {
        expect(input.tool_input.action).toBe("keep");
      }
    });
  });

  describe("isReplTool", () => {
    it("returns true for REPL tool", () => {
      expect(isReplTool(createReplInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isReplTool(createWorkflowInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createReplInput();
      if (isReplTool(input)) {
        expect(input.tool_input.code).toBe("await Promise.resolve(1)");
      }
    });
  });

  describe("isWorkflowTool", () => {
    it("returns true for Workflow tool", () => {
      expect(isWorkflowTool(createWorkflowInput())).toBe(true);
    });

    it("returns false for other tools", () => {
      expect(isWorkflowTool(createReplInput())).toBe(false);
    });

    it("narrows type correctly", () => {
      const input = createWorkflowInput();
      if (isWorkflowTool(input)) {
        expect(input.tool_input.name).toBe("ci-check");
      }
    });
  });
});

describe("File Path Utilities", () => {
  describe("getFilePath", () => {
    it("returns file path from Write tool", () => {
      expect(getFilePath(createWriteInput())).toBe("/workspace/src/index.ts");
    });

    it("returns file path from Edit tool", () => {
      expect(getFilePath(createEditInput())).toBe("/workspace/src/index.ts");
    });

    it("returns file path from MultiEdit tool", () => {
      expect(getFilePath(createMultiEditInput())).toBe("/workspace/src/index.ts");
    });

    it("returns file path from Read tool", () => {
      expect(getFilePath(createReadInput())).toBe("/workspace/src/index.ts");
    });

    it("returns null for Bash tool", () => {
      expect(getFilePath(createBashInput())).toBeNull();
    });

    it("returns null for Glob tool", () => {
      expect(getFilePath(createGlobInput())).toBeNull();
    });

    it("returns null if file_path is not a string", () => {
      const input: PreToolUseHookInput = {
        ...createBaseInput(),
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: { file_path: 123, content: "test" }, // Invalid type
        tool_use_id: "tu_123",
      };
      expect(getFilePath(input)).toBeNull();
    });

    it("returns null if tool_input is null", () => {
      const input: PreToolUseHookInput = {
        ...createBaseInput(),
        hook_event_name: "PreToolUse",
        tool_name: "CustomTool",
        tool_input: null,
        tool_use_id: "tu_123",
      };
      expect(getFilePath(input)).toBeNull();
    });
  });

  describe("isJsTsFile", () => {
    it("returns true for JavaScript files", () => {
      expect(isJsTsFile("file.js")).toBe(true);
      expect(isJsTsFile("file.jsx")).toBe(true);
      expect(isJsTsFile("file.mjs")).toBe(true);
      expect(isJsTsFile("file.cjs")).toBe(true);
    });

    it("returns true for TypeScript files", () => {
      expect(isJsTsFile("file.ts")).toBe(true);
      expect(isJsTsFile("file.tsx")).toBe(true);
      expect(isJsTsFile("file.mts")).toBe(true);
      expect(isJsTsFile("file.cts")).toBe(true);
    });

    it("returns false for other files", () => {
      expect(isJsTsFile("file.py")).toBe(false);
      expect(isJsTsFile("file.json")).toBe(false);
      expect(isJsTsFile("file.md")).toBe(false);
    });
  });

  describe("isTsFile", () => {
    it("returns true for TypeScript files", () => {
      expect(isTsFile("file.ts")).toBe(true);
      expect(isTsFile("file.tsx")).toBe(true);
      expect(isTsFile("file.mts")).toBe(true);
      expect(isTsFile("file.cts")).toBe(true);
    });

    it("returns false for JavaScript files", () => {
      expect(isTsFile("file.js")).toBe(false);
      expect(isTsFile("file.jsx")).toBe(false);
      expect(isTsFile("file.mjs")).toBe(false);
    });

    it("returns false for other files", () => {
      expect(isTsFile("file.py")).toBe(false);
      expect(isTsFile("file.json")).toBe(false);
    });
  });
});

describe("Content Inspection", () => {
  // Use TODO and FIXME patterns instead of ts-ignore to avoid hook interference
  const testPattern = /TODO|FIXME/g;

  describe("checkContentForPattern", () => {
    describe("with Write tool", () => {
      it("finds pattern in content", () => {
        const input = createWriteInput("// TODO: implement this\nconst x = 1;");
        const result = checkContentForPattern(input, testPattern);
        expect(result).not.toBeNull();
        expect(result?.found).toBe(true);
        expect(result?.isAddition).toBe(true);
        expect(result?.matches).toContain("TODO");
      });

      it("returns not found when pattern is absent", () => {
        const input = createWriteInput("const x = 1;");
        const result = checkContentForPattern(input, testPattern);
        expect(result).not.toBeNull();
        expect(result?.found).toBe(false);
        expect(result?.isAddition).toBe(false);
        expect(result?.matches).toHaveLength(0);
      });

      it("deduplicates matches", () => {
        const input = createWriteInput("TODO TODO TODO");
        const result = checkContentForPattern(input, testPattern);
        expect(result?.matches).toEqual(["TODO"]);
      });
    });

    describe("with Edit tool", () => {
      it("detects pattern being added", () => {
        const input = createEditInput("const x = 1;", "// TODO: fix this\nconst x = 1;");
        const result = checkContentForPattern(input, testPattern);
        expect(result?.found).toBe(true);
        expect(result?.isAddition).toBe(true);
      });

      it("detects pattern not being added when already present", () => {
        const input = createEditInput("// TODO: fix\nconst x = 1;", "// TODO: fix\nconst x = 2;");
        const result = checkContentForPattern(input, testPattern);
        expect(result?.found).toBe(true);
        expect(result?.isAddition).toBe(false); // Not an addition, just preserved
      });

      it("detects pattern being removed", () => {
        const input = createEditInput("// TODO: fix\nconst x = 1;", "const x = 1;");
        const result = checkContentForPattern(input, testPattern);
        expect(result?.found).toBe(false);
        expect(result?.isAddition).toBe(false);
      });
    });

    describe("with MultiEdit tool", () => {
      it("aggregates results from multiple edits", () => {
        const input = createMultiEditInput([
          { old_string: "const x = 1;", new_string: "// TODO: fix\nconst x = 1;" },
          { old_string: "const y = 1;", new_string: "// FIXME: broken\nconst y = 1;" },
        ]);
        const result = checkContentForPattern(input, testPattern);
        expect(result?.found).toBe(true);
        expect(result?.isAddition).toBe(true);
        expect(result?.matches).toContain("TODO");
        expect(result?.matches).toContain("FIXME");
      });

      it("provides per-edit details", () => {
        const input = createMultiEditInput([
          { old_string: "const x = 1;", new_string: "// TODO: fix\nconst x = 1;" },
          { old_string: "const y = 1;", new_string: "const y = 2;" },
        ]);
        const result = checkContentForPattern(input, testPattern);
        expect(result?.details).toHaveLength(2);
        expect(result?.details?.[0].found).toBe(true);
        expect(result?.details?.[0].isAddition).toBe(true);
        expect(result?.details?.[1].found).toBe(false);
        expect(result?.details?.[1].isAddition).toBe(false);
      });
    });

    it("returns null for non-file-modifying tools", () => {
      const result = checkContentForPattern(createBashInput(), testPattern);
      expect(result).toBeNull();
    });

    it("works with non-global regex (adds global flag)", () => {
      const input = createWriteInput("TODO TODO");
      const result = checkContentForPattern(input, /TODO/); // No global flag
      expect(result?.matches).toEqual(["TODO"]);
    });
  });

  describe("forEachContent", () => {
    describe("with Write tool", () => {
      it("calls callback with write content", () => {
        const input = createWriteInput("const x = 1;");
        const contexts: Array<{ newContent: string; oldContent: string | null }> = [];

        forEachContent(input, (ctx) => {
          contexts.push({ newContent: ctx.newContent, oldContent: ctx.oldContent });
          return true;
        });

        expect(contexts).toHaveLength(1);
        expect(contexts[0].newContent).toBe("const x = 1;");
        expect(contexts[0].oldContent).toBeNull();
      });

      it("sets isWrite to true", () => {
        const input = createWriteInput();
        let isWrite = false;
        forEachContent(input, (ctx) => {
          isWrite = ctx.isWrite;
          return true;
        });
        expect(isWrite).toBe(true);
      });
    });

    describe("with Edit tool", () => {
      it("calls callback with edit content", () => {
        const input = createEditInput("old", "new");
        const contexts: Array<{ newContent: string; oldContent: string | null }> = [];

        forEachContent(input, (ctx) => {
          contexts.push({ newContent: ctx.newContent, oldContent: ctx.oldContent });
          return true;
        });

        expect(contexts).toHaveLength(1);
        expect(contexts[0].newContent).toBe("new");
        expect(contexts[0].oldContent).toBe("old");
      });

      it("sets isWrite to false", () => {
        const input = createEditInput();
        let isWrite = true;
        forEachContent(input, (ctx) => {
          isWrite = ctx.isWrite;
          return true;
        });
        expect(isWrite).toBe(false);
      });
    });

    describe("with MultiEdit tool", () => {
      it("calls callback for each edit", () => {
        const input = createMultiEditInput([
          { old_string: "old1", new_string: "new1" },
          { old_string: "old2", new_string: "new2" },
        ]);
        const indices: number[] = [];

        forEachContent(input, (ctx) => {
          indices.push(ctx.index);
          return true;
        });

        expect(indices).toEqual([0, 1]);
      });

      it("stops early when callback returns false", () => {
        const input = createMultiEditInput([
          { old_string: "old1", new_string: "new1" },
          { old_string: "old2", new_string: "new2" },
          { old_string: "old3", new_string: "new3" },
        ]);
        const indices: number[] = [];

        const result = forEachContent(input, (ctx) => {
          indices.push(ctx.index);
          return ctx.index < 1; // Stop after index 1
        });

        expect(result).toBe(false);
        expect(indices).toEqual([0, 1]);
      });
    });

    it("returns false for non-file-modifying tools", () => {
      const result = forEachContent(createBashInput(), () => true);
      expect(result).toBe(false);
    });

    it("returns true when all callbacks return true", () => {
      const input = createWriteInput();
      const result = forEachContent(input, () => true);
      expect(result).toBe(true);
    });

    it("returns false when callback returns false", () => {
      const input = createWriteInput();
      const result = forEachContent(input, () => false);
      expect(result).toBe(false);
    });
  });
});
