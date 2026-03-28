/**
 * Unit tests for hook factory functions.
 *
 * Tests:
 * - All 13 hook factories return properly typed functions
 * - HookFunction has correct metadata (hook_event_name, matcher, timeout)
 * - Handler receives correct context (logger)
 */

import type {
  ConfigChangeHookInput,
  CwdChangedHookInput,
  ElicitationHookInput,
  ElicitationResultHookInput,
  FileChangedHookInput,
  InstructionsLoadedHookInput,
  NotificationHookInput,
  PostToolUseFailureHookInput,
  PostToolUseHookInput,
  PreCompactHookInput,
  PreToolUseHookInput,
  SessionStartHookInput,
  StopHookInput,
  SubagentStartHookInput,
  SubagentStopHookInput,
  UserPromptSubmitHookInput,
  WorktreeCreateHookInput,
  WorktreeRemoveHookInput,
} from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HookContext, SessionStartContext } from "../src/hooks.js";
import {
  configChangeHook,
  cwdChangedHook,
  elicitationHook,
  elicitationResultHook,
  fileChangedHook,
  instructionsLoadedHook,
  notificationHook,
  permissionRequestHook,
  postToolUseFailureHook,
  postToolUseHook,
  preCompactHook,
  preToolUseHook,
  sessionEndHook,
  sessionStartHook,
  stopHook,
  subagentStartHook,
  subagentStopHook,
  userPromptSubmitHook,
  worktreeCreateHook,
  worktreeRemoveHook,
} from "../src/hooks.js";
import { Logger } from "../src/logger.js";
import {
  configChangeOutput,
  cwdChangedOutput,
  elicitationOutput,
  elicitationResultOutput,
  fileChangedOutput,
  instructionsLoadedOutput,
  notificationOutput,
  permissionRequestOutput,
  postToolUseFailureOutput,
  postToolUseOutput,
  preCompactOutput,
  preToolUseOutput,
  sessionEndOutput,
  sessionStartOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  userPromptSubmitOutput,
  worktreeCreateOutput,
  worktreeRemoveOutput,
} from "../src/outputs.js";
import type { PermissionRequestInput, SessionEndInput } from "../src/types.js";

// Helper to create minimal valid inputs for each hook type
function createPreToolUseHookInput(): PreToolUseHookInput {
  return {
    hook_event_name: "PreToolUse",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    tool_name: "Bash",
    tool_input: { command: "ls" },
    tool_use_id: "tu_123",
  };
}

function createPostToolUseHookInput(): PostToolUseHookInput {
  return {
    hook_event_name: "PostToolUse",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    tool_name: "Bash",
    tool_input: { command: "ls" },
    tool_use_id: "tu_123",
    tool_response: "file1.txt\nfile2.txt",
  };
}

function createPostToolUseFailureHookInput(): PostToolUseFailureHookInput {
  return {
    hook_event_name: "PostToolUseFailure",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    tool_name: "Bash",
    tool_input: { command: "invalid" },
    tool_use_id: "tu_123",
    error: "Command not found",
    is_interrupt: false,
  };
}

function createNotificationHookInput(): NotificationHookInput {
  return {
    hook_event_name: "Notification",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    message: "Task completed",
    notification_type: "info",
  };
}

function createUserPromptSubmitHookInput(): UserPromptSubmitHookInput {
  return {
    hook_event_name: "UserPromptSubmit",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    prompt: "Help me with this code",
  };
}

function createSessionStartHookInput(): SessionStartHookInput {
  return {
    hook_event_name: "SessionStart",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    source: "startup",
  };
}

function createSessionEndInput(): SessionEndInput {
  return {
    hook_event_name: "SessionEnd",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    reason: "other",
  };
}

function createStopHookInput(): StopHookInput {
  return {
    hook_event_name: "Stop",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    stop_hook_active: true,
  };
}

function createSubagentStartHookInput(): SubagentStartHookInput {
  return {
    hook_event_name: "SubagentStart",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    agent_id: "agent_123",
    agent_type: "explore",
  };
}

function createSubagentStopHookInput(): SubagentStopHookInput {
  return {
    hook_event_name: "SubagentStop",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    stop_hook_active: false,
    agent_id: "agent_123",
    agent_type: "explore",
    agent_transcript_path: "/path/to/agent/transcript",
  };
}

function createPreCompactHookInput(): PreCompactHookInput {
  return {
    hook_event_name: "PreCompact",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    trigger: "auto",
    custom_instructions: null,
  };
}

function createPermissionRequestInput(): PermissionRequestInput {
  return {
    hook_event_name: "PermissionRequest",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
    tool_name: "Bash",
    tool_input: { command: "rm -rf /" },
    tool_use_id: "tool_use_123",
  };
}

function createElicitationHookInput(): ElicitationHookInput {
  return {
    hook_event_name: "Elicitation",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    mcp_server_name: "test-server",
    message: "Please provide your username",
  };
}

function createElicitationResultHookInput(): ElicitationResultHookInput {
  return {
    hook_event_name: "ElicitationResult",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    mcp_server_name: "test-server",
    action: "accept",
  };
}

function createConfigChangeHookInput(): ConfigChangeHookInput {
  return {
    hook_event_name: "ConfigChange",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    source: "user_settings",
  };
}

function createInstructionsLoadedHookInput(): InstructionsLoadedHookInput {
  return {
    hook_event_name: "InstructionsLoaded",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    file_path: "/workspace/CLAUDE.md",
    memory_type: "Project",
    load_reason: "session_start",
  };
}

function createWorktreeCreateHookInput(): WorktreeCreateHookInput {
  return {
    hook_event_name: "WorktreeCreate",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    name: "feature-branch",
  };
}

function createWorktreeRemoveHookInput(): WorktreeRemoveHookInput {
  return {
    hook_event_name: "WorktreeRemove",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    worktree_path: "/workspace/.worktrees/feature-branch",
  };
}

function createCwdChangedHookInput(): CwdChangedHookInput {
  return {
    hook_event_name: "CwdChanged",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/new/workspace",
    old_cwd: "/old/workspace",
    new_cwd: "/new/workspace",
  };
}

function createFileChangedHookInput(): FileChangedHookInput {
  return {
    hook_event_name: "FileChanged",
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    file_path: "/workspace/src/index.ts",
    event: "change",
  };
}

describe("Hook Factory Functions", () => {
  let testLogger: Logger;

  beforeEach(() => {
    testLogger = new Logger();
  });

  afterEach(() => {
    testLogger.close();
  });

  describe("preToolUseHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = preToolUseHook({}, () => preToolUseOutput({}));

      expect(hook.hookEventName).toBe("PreToolUse");
    });

    it("attaches matcher from config", () => {
      const hook = preToolUseHook({ matcher: "Bash" }, () => preToolUseOutput({}));

      expect(hook.matcher).toBe("Bash");
    });

    it("attaches timeout from config", () => {
      const hook = preToolUseHook({ timeout: 5000 }, () => preToolUseOutput({}));

      expect(hook.timeout).toBe(5000);
    });

    it("attaches both matcher and timeout", () => {
      const hook = preToolUseHook({ matcher: "Read|Write", timeout: 10000 }, () => preToolUseOutput({}));

      expect(hook.matcher).toBe("Read|Write");
      expect(hook.timeout).toBe(10000);
    });

    it("handler receives typed input", async () => {
      let receivedInput: PreToolUseHookInput | undefined;

      const hook = preToolUseHook({}, (input) => {
        receivedInput = input;
        return preToolUseOutput({});
      });

      const input = createPreToolUseHookInput();
      await hook(input, { logger: testLogger });

      expect(receivedInput).toBeDefined();
      expect(receivedInput?.tool_name).toBe("Bash");
      expect(receivedInput?.hook_event_name).toBe("PreToolUse");
    });

    it("handler receives logger in context", async () => {
      let receivedContext: HookContext | undefined;

      const hook = preToolUseHook({}, (_input, context) => {
        receivedContext = context;
        return preToolUseOutput({});
      });

      await hook(createPreToolUseHookInput(), { logger: testLogger });

      expect(receivedContext).toBeDefined();
      expect(receivedContext?.logger).toBe(testLogger);
    });

    it("returns handler output", async () => {
      const hook = preToolUseHook({}, () =>
        preToolUseOutput({
          hookSpecificOutput: { permissionDecision: "deny", permissionDecisionReason: "Blocked" },
        }),
      );

      const result = await hook(createPreToolUseHookInput(), { logger: testLogger });

      expect(result.stdout.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
      if (result.stdout.hookSpecificOutput?.hookEventName === "PreToolUse") {
        expect(result.stdout.hookSpecificOutput.permissionDecision).toBe("deny");
        expect(result.stdout.hookSpecificOutput.permissionDecisionReason).toBe("Blocked");
      }
    });
  });

  describe("postToolUseHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = postToolUseHook({}, () => postToolUseOutput({}));
      expect(hook.hookEventName).toBe("PostToolUse");
    });

    it("handler receives PostToolUseHookInput with tool_response", async () => {
      let receivedInput: PostToolUseHookInput | undefined;

      const hook = postToolUseHook({}, (input) => {
        receivedInput = input;
        return postToolUseOutput({});
      });

      await hook(createPostToolUseHookInput(), { logger: testLogger });

      expect(receivedInput?.tool_response).toBe("file1.txt\nfile2.txt");
    });
  });

  describe("postToolUseFailureHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = postToolUseFailureHook({}, () => postToolUseFailureOutput({}));
      expect(hook.hookEventName).toBe("PostToolUseFailure");
    });

    it("handler receives error and is_interrupt fields", async () => {
      let receivedInput: PostToolUseFailureHookInput | undefined;

      const hook = postToolUseFailureHook({}, (input) => {
        receivedInput = input;
        return postToolUseFailureOutput({});
      });

      await hook(createPostToolUseFailureHookInput(), { logger: testLogger });

      expect(receivedInput?.error).toBe("Command not found");
      expect(receivedInput?.is_interrupt).toBe(false);
    });
  });

  describe("notificationHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = notificationHook({}, () => notificationOutput({}));
      expect(hook.hookEventName).toBe("Notification");
    });

    it("handler receives notification fields", async () => {
      let receivedInput: NotificationHookInput | undefined;

      const hook = notificationHook({}, (input) => {
        receivedInput = input;
        return notificationOutput({});
      });

      await hook(createNotificationHookInput(), { logger: testLogger });

      expect(receivedInput?.message).toBe("Task completed");
      expect(receivedInput?.notification_type).toBe("info");
    });
  });

  describe("userPromptSubmitHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = userPromptSubmitHook({}, () => userPromptSubmitOutput({}));
      expect(hook.hookEventName).toBe("UserPromptSubmit");
    });

    it("handler receives prompt field", async () => {
      let receivedInput: UserPromptSubmitHookInput | undefined;

      const hook = userPromptSubmitHook({}, (input) => {
        receivedInput = input;
        return userPromptSubmitOutput({});
      });

      await hook(createUserPromptSubmitHookInput(), { logger: testLogger });

      expect(receivedInput?.prompt).toBe("Help me with this code");
    });
  });

  describe("sessionStartHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = sessionStartHook({}, () => sessionStartOutput({}));
      expect(hook.hookEventName).toBe("SessionStart");
    });

    it("supports matcher for source field", () => {
      const hook = sessionStartHook({ matcher: "startup" }, () => sessionStartOutput({}));
      expect(hook.matcher).toBe("startup");
    });

    it("handler receives source field", async () => {
      let receivedInput: SessionStartHookInput | undefined;

      const hook = sessionStartHook({}, (input) => {
        receivedInput = input;
        return sessionStartOutput({});
      });

      const sessionStartContext: SessionStartContext = {
        logger: testLogger,
        persistEnvVar: () => {},
        persistEnvVars: () => {},
      };
      await hook(createSessionStartHookInput(), sessionStartContext);

      expect(receivedInput?.source).toBe("startup");
    });
  });

  describe("sessionEndHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = sessionEndHook({}, () => sessionEndOutput({}));
      expect(hook.hookEventName).toBe("SessionEnd");
    });

    it("handler receives reason field", async () => {
      let receivedInput: SessionEndInput | undefined;

      const hook = sessionEndHook({}, (input) => {
        receivedInput = input;
        return sessionEndOutput({});
      });

      await hook(createSessionEndInput(), { logger: testLogger });

      expect(receivedInput?.reason).toBe("other");
    });
  });

  describe("stopHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = stopHook({}, () => stopOutput({}));
      expect(hook.hookEventName).toBe("Stop");
    });

    it("handler receives stop_hook_active field", async () => {
      let receivedInput: StopHookInput | undefined;

      const hook = stopHook({}, (input) => {
        receivedInput = input;
        return stopOutput({});
      });

      await hook(createStopHookInput(), { logger: testLogger });

      expect(receivedInput?.stop_hook_active).toBe(true);
    });

    it("returns correct output for block decision", async () => {
      const hook = stopHook({}, () => stopOutput({ decision: "block", reason: "Pending changes" }));

      const result = await hook(createStopHookInput(), { logger: testLogger });

      expect(result.stdout.decision).toBe("block");
      expect(result.stdout.reason).toBe("Pending changes");
    });
  });

  describe("subagentStartHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = subagentStartHook({}, () => subagentStartOutput({}));
      expect(hook.hookEventName).toBe("SubagentStart");
    });

    it("supports matcher for agent_type", () => {
      const hook = subagentStartHook({ matcher: "explore" }, () => subagentStartOutput({}));
      expect(hook.matcher).toBe("explore");
    });

    it("handler receives agent fields", async () => {
      let receivedInput: SubagentStartHookInput | undefined;

      const hook = subagentStartHook({}, (input) => {
        receivedInput = input;
        return subagentStartOutput({});
      });

      await hook(createSubagentStartHookInput(), { logger: testLogger });

      expect(receivedInput?.agent_id).toBe("agent_123");
      expect(receivedInput?.agent_type).toBe("explore");
    });
  });

  describe("subagentStopHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = subagentStopHook({}, () => subagentStopOutput({}));
      expect(hook.hookEventName).toBe("SubagentStop");
    });

    it("handler receives transcript path", async () => {
      let receivedInput: SubagentStopHookInput | undefined;

      const hook = subagentStopHook({}, (input) => {
        receivedInput = input;
        return subagentStopOutput({});
      });

      await hook(createSubagentStopHookInput(), { logger: testLogger });

      expect(receivedInput?.agent_transcript_path).toBe("/path/to/agent/transcript");
    });
  });

  describe("preCompactHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = preCompactHook({}, () => preCompactOutput({}));
      expect(hook.hookEventName).toBe("PreCompact");
    });

    it("supports matcher for trigger", () => {
      const hook = preCompactHook({ matcher: "manual" }, () => preCompactOutput({}));
      expect(hook.matcher).toBe("manual");
    });

    it("handler receives trigger and custom_instructions", async () => {
      let receivedInput: PreCompactHookInput | undefined;

      const hook = preCompactHook({}, (input) => {
        receivedInput = input;
        return preCompactOutput({});
      });

      await hook(createPreCompactHookInput(), { logger: testLogger });

      expect(receivedInput?.trigger).toBe("auto");
      expect(receivedInput?.custom_instructions).toBeNull();
    });
  });

  describe("permissionRequestHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = permissionRequestHook({}, () => permissionRequestOutput({}));
      expect(hook.hookEventName).toBe("PermissionRequest");
    });

    it("supports matcher for tool_name", () => {
      const hook = permissionRequestHook({ matcher: "Bash" }, () => permissionRequestOutput({}));
      expect(hook.matcher).toBe("Bash");
    });

    it("handler receives permission request fields", async () => {
      let receivedInput: PermissionRequestInput | undefined;

      const hook = permissionRequestHook({}, (input) => {
        receivedInput = input;
        return permissionRequestOutput({});
      });

      await hook(createPermissionRequestInput(), { logger: testLogger });

      expect(receivedInput?.tool_name).toBe("Bash");
      expect(receivedInput?.tool_input).toEqual({ command: "rm -rf /" });
    });
  });

  describe("All factories share common behavior", () => {
    describe("preToolUseHook common behavior", () => {
      it("returns a callable async function", async () => {
        const hook = preToolUseHook({}, () => preToolUseOutput({}));
        expect(typeof hook).toBe("function");
        const result = hook(createPreToolUseHookInput(), { logger: testLogger });
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toHaveProperty("stdout");
      });

      it("has undefined matcher when not provided", () => {
        const hook = preToolUseHook({}, () => preToolUseOutput({}));
        expect(hook.matcher).toBeUndefined();
      });

      it("has undefined timeout when not provided", () => {
        const hook = preToolUseHook({}, () => preToolUseOutput({}));
        expect(hook.timeout).toBeUndefined();
      });

      it("supports async handlers", async () => {
        let executed = false;
        const hook = preToolUseHook({}, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          executed = true;
          return preToolUseOutput({});
        });
        await hook(createPreToolUseHookInput(), { logger: testLogger });
        expect(executed).toBe(true);
      });

      it("supports sync handlers returning PreToolUseOutput", async () => {
        const output = preToolUseOutput({ continue: true });
        const hook = preToolUseHook({}, () => output);
        const result = await hook(createPreToolUseHookInput(), { logger: testLogger });
        expect(result).toBe(output);
      });
    });

    describe("sessionStartHook common behavior", () => {
      it("returns a callable async function", async () => {
        const hook = sessionStartHook({}, () => sessionStartOutput({}));
        expect(typeof hook).toBe("function");
        const sessionStartContext: SessionStartContext = {
          logger: testLogger,
          persistEnvVar: () => {},
          persistEnvVars: () => {},
        };
        const result = hook(createSessionStartHookInput(), sessionStartContext);
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toHaveProperty("stdout");
      });

      it("has undefined matcher when not provided", () => {
        const hook = sessionStartHook({}, () => sessionStartOutput({}));
        expect(hook.matcher).toBeUndefined();
      });

      it("has undefined timeout when not provided", () => {
        const hook = sessionStartHook({}, () => sessionStartOutput({}));
        expect(hook.timeout).toBeUndefined();
      });
    });

    describe("stopHook common behavior", () => {
      it("returns a callable async function", async () => {
        const hook = stopHook({}, () => stopOutput({}));
        expect(typeof hook).toBe("function");
        const result = hook(createStopHookInput(), { logger: testLogger });
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toHaveProperty("stdout");
      });
    });

    describe("permissionRequestHook common behavior", () => {
      it("returns a callable async function", async () => {
        const hook = permissionRequestHook({}, () => permissionRequestOutput({}));
        expect(typeof hook).toBe("function");
        const result = hook(createPermissionRequestInput(), { logger: testLogger });
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toHaveProperty("stdout");
      });
    });
  });

  describe("elicitationHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = elicitationHook({}, () => elicitationOutput({}));
      expect(hook.hookEventName).toBe("Elicitation");
    });

    it("handler receives mcp_server_name and message fields", async () => {
      let receivedInput: ElicitationHookInput | undefined;
      const hook = elicitationHook({}, (input) => {
        receivedInput = input;
        return elicitationOutput({});
      });
      await hook(createElicitationHookInput(), { logger: testLogger });
      expect(receivedInput?.mcp_server_name).toBe("test-server");
      expect(receivedInput?.message).toBe("Please provide your username");
    });

    it("returns hookSpecificOutput with action", async () => {
      const hook = elicitationHook({}, () =>
        elicitationOutput({ hookSpecificOutput: { action: "accept", content: { username: "alice" } } }),
      );
      const result = await hook(createElicitationHookInput(), { logger: testLogger });
      expect(result.stdout.hookSpecificOutput?.hookEventName).toBe("Elicitation");
    });
  });

  describe("elicitationResultHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = elicitationResultHook({}, () => elicitationResultOutput({}));
      expect(hook.hookEventName).toBe("ElicitationResult");
    });

    it("handler receives action field", async () => {
      let receivedInput: ElicitationResultHookInput | undefined;
      const hook = elicitationResultHook({}, (input) => {
        receivedInput = input;
        return elicitationResultOutput({});
      });
      await hook(createElicitationResultHookInput(), { logger: testLogger });
      expect(receivedInput?.action).toBe("accept");
    });
  });

  describe("configChangeHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = configChangeHook({}, () => configChangeOutput({}));
      expect(hook.hookEventName).toBe("ConfigChange");
    });

    it("supports matcher for source field", () => {
      const hook = configChangeHook({ matcher: "user_settings" }, () => configChangeOutput({}));
      expect(hook.matcher).toBe("user_settings");
    });

    it("handler receives source field", async () => {
      let receivedInput: ConfigChangeHookInput | undefined;
      const hook = configChangeHook({}, (input) => {
        receivedInput = input;
        return configChangeOutput({});
      });
      await hook(createConfigChangeHookInput(), { logger: testLogger });
      expect(receivedInput?.source).toBe("user_settings");
    });
  });

  describe("instructionsLoadedHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = instructionsLoadedHook({}, () => instructionsLoadedOutput({}));
      expect(hook.hookEventName).toBe("InstructionsLoaded");
    });

    it("handler receives file_path and memory_type fields", async () => {
      let receivedInput: InstructionsLoadedHookInput | undefined;
      const hook = instructionsLoadedHook({}, (input) => {
        receivedInput = input;
        return instructionsLoadedOutput({});
      });
      await hook(createInstructionsLoadedHookInput(), { logger: testLogger });
      expect(receivedInput?.file_path).toBe("/workspace/CLAUDE.md");
      expect(receivedInput?.memory_type).toBe("Project");
      expect(receivedInput?.load_reason).toBe("session_start");
    });
  });

  describe("worktreeCreateHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = worktreeCreateHook({}, () => worktreeCreateOutput({}));
      expect(hook.hookEventName).toBe("WorktreeCreate");
    });

    it("handler receives name field", async () => {
      let receivedInput: WorktreeCreateHookInput | undefined;
      const hook = worktreeCreateHook({}, (input) => {
        receivedInput = input;
        return worktreeCreateOutput({});
      });
      await hook(createWorktreeCreateHookInput(), { logger: testLogger });
      expect(receivedInput?.name).toBe("feature-branch");
    });
  });

  describe("worktreeRemoveHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = worktreeRemoveHook({}, () => worktreeRemoveOutput({}));
      expect(hook.hookEventName).toBe("WorktreeRemove");
    });

    it("handler receives worktree_path field", async () => {
      let receivedInput: WorktreeRemoveHookInput | undefined;
      const hook = worktreeRemoveHook({}, (input) => {
        receivedInput = input;
        return worktreeRemoveOutput({});
      });
      await hook(createWorktreeRemoveHookInput(), { logger: testLogger });
      expect(receivedInput?.worktree_path).toBe("/workspace/.worktrees/feature-branch");
    });
  });

  describe("cwdChangedHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = cwdChangedHook({}, () => cwdChangedOutput({}));
      expect(hook.hookEventName).toBe("CwdChanged");
    });

    it("handler receives old_cwd and new_cwd fields", async () => {
      let receivedInput: CwdChangedHookInput | undefined;
      const hook = cwdChangedHook({}, (input) => {
        receivedInput = input;
        return cwdChangedOutput({});
      });
      await hook(createCwdChangedHookInput(), { logger: testLogger });
      expect(receivedInput?.old_cwd).toBe("/old/workspace");
      expect(receivedInput?.new_cwd).toBe("/new/workspace");
    });
  });

  describe("fileChangedHook", () => {
    it("returns a HookFunction with correct hookEventName", () => {
      const hook = fileChangedHook({}, () => fileChangedOutput({}));
      expect(hook.hookEventName).toBe("FileChanged");
    });

    it("handler receives file_path and event fields", async () => {
      let receivedInput: FileChangedHookInput | undefined;
      const hook = fileChangedHook({}, (input) => {
        receivedInput = input;
        return fileChangedOutput({});
      });
      await hook(createFileChangedHookInput(), { logger: testLogger });
      expect(receivedInput?.file_path).toBe("/workspace/src/index.ts");
      expect(receivedInput?.event).toBe("change");
    });
  });
});
