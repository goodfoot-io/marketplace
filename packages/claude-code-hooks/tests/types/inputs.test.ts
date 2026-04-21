/**
 * Type inference tests for HookInput types.
 *
 * These tests verify TypeScript correctly enforces type constraints at compile time.
 * The tests verify compile-time behavior through type assertions and type narrowing.
 * @module
 */

import { describe, expect, it } from "vitest";
import type {
  HookInput,
  NotificationInput,
  PermissionDeniedInput,
  PermissionRequestInput,
  PostToolUseFailureInput,
  PostToolUseInput,
  PreCompactInput,
  PreToolUseInput,
  SessionEndInput,
  SessionStartInput,
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  UserPromptSubmitInput,
} from "../../src/types.js";

describe("HookInput discriminated union", () => {
  describe("type narrowing", () => {
    it("narrows correctly on hook_event_name", () => {
      const handleHook = (input: HookInput): string => {
        switch (input.hook_event_name) {
          case "PreToolUse":
            // TypeScript should know input.tool_name exists
            return input.tool_name;
          case "PostToolUse":
            // TypeScript should know input.tool_response exists
            return String(input.tool_response);
          case "SessionStart":
            // TypeScript should know input.source exists
            return input.source;
          case "Stop":
            // TypeScript should know input.stop_hook_active exists
            return String(input.stop_hook_active);
          case "PostToolUseFailure":
            return input.error;
          case "Notification":
            return input.message;
          case "UserPromptExpansion":
            return input.command_name;
          case "UserPromptSubmit":
            return input.prompt;
          case "SessionEnd":
            return input.reason;
          case "SubagentStart":
            return input.agent_id;
          case "SubagentStop":
            return input.agent_transcript_path;
          case "PreCompact":
            return input.trigger;
          case "PermissionRequest":
            return input.tool_name;
          case "Setup":
            return input.trigger;
          case "TeammateIdle":
            return input.teammate_name;
          case "TaskCreated":
            return input.task_id;
          case "TaskCompleted":
            return input.task_id;
          case "Elicitation":
            return input.mcp_server_name;
          case "ElicitationResult":
            return input.mcp_server_name;
          case "ConfigChange":
            return input.source;
          case "InstructionsLoaded":
            return input.file_path;
          case "WorktreeCreate":
            return input.name;
          case "WorktreeRemove":
            return input.worktree_path;
          case "StopFailure":
            return input.error;
          case "PostCompact":
            return input.compact_summary;
          case "CwdChanged":
            return input.new_cwd;
          case "FileChanged":
            return input.file_path;
          case "PermissionDenied":
            return input.tool_name;
          default: {
            // Exhaustiveness check
            const _exhaustive: never = input;
            return _exhaustive;
          }
        }
      };

      // Just verify the function is callable
      expect(handleHook).toBeDefined();
    });

    it("provides correct fields after narrowing to PreToolUse", () => {
      const handlePreToolUse = (input: HookInput): void => {
        if (input.hook_event_name === "PreToolUse") {
          // All these should be valid
          const _toolName: string = input.tool_name;
          const _toolInput: unknown = input.tool_input;
          const _toolUseId: string = input.tool_use_id;
          const _sessionId: string = input.session_id;

          expect(_toolName).toBeDefined();
          expect(_toolInput).toBeDefined();
          expect(_toolUseId).toBeDefined();
          expect(_sessionId).toBeDefined();
        }
      };

      expect(handlePreToolUse).toBeDefined();
    });

    it("provides correct fields after narrowing to SessionStart", () => {
      const handleSessionStart = (input: HookInput): void => {
        if (input.hook_event_name === "SessionStart") {
          // source should be one of the specific values
          const _source: "startup" | "resume" | "clear" | "compact" = input.source;
          const _sessionId: string = input.session_id;

          expect(_source).toBeDefined();
          expect(_sessionId).toBeDefined();
        }
      };

      expect(handleSessionStart).toBeDefined();
    });
  });

  describe("individual input type fields", () => {
    it("PreToolUseInput has all required fields", () => {
      const input: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        session_id: "sess-123",
        transcript_path: "/path/to/transcript",
        cwd: "/workspace",
        tool_name: "Bash",
        tool_input: { command: "ls -la" },
        tool_use_id: "tool-456",
      };

      expect(input.hook_event_name).toBe("PreToolUse");
      expect(input.tool_name).toBe("Bash");
      expect(input.tool_input).toEqual({ command: "ls -la" });
    });

    it("PostToolUseInput has tool_response field", () => {
      const input: PostToolUseInput = {
        hook_event_name: "PostToolUse",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        tool_name: "Read",
        tool_input: { file_path: "/test.txt" },
        tool_response: "file contents",
        tool_use_id: "tool-789",
      };

      expect(input.tool_response).toBe("file contents");
    });

    it("PostToolUseFailureInput has error and optional is_interrupt", () => {
      const input: PostToolUseFailureInput = {
        hook_event_name: "PostToolUseFailure",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        tool_name: "Bash",
        tool_input: { command: "bad-cmd" },
        tool_use_id: "tool-999",
        error: "Command failed",
        is_interrupt: true,
      };

      expect(input.error).toBe("Command failed");
      expect(input.is_interrupt).toBe(true);
    });

    it("NotificationInput has message and optional title", () => {
      const input: NotificationInput = {
        hook_event_name: "Notification",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        message: "Task completed",
        title: "Success",
        notification_type: "info",
      };

      expect(input.message).toBe("Task completed");
      expect(input.title).toBe("Success");
    });

    it("UserPromptSubmitInput has prompt field", () => {
      const input: UserPromptSubmitInput = {
        hook_event_name: "UserPromptSubmit",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        prompt: "Write a function",
      };

      expect(input.prompt).toBe("Write a function");
    });

    it("SessionStartInput has source field with specific values", () => {
      const inputs: SessionStartInput[] = [
        {
          hook_event_name: "SessionStart",
          session_id: "sess-1",
          transcript_path: "/path",
          cwd: "/workspace",
          source: "startup",
        },
        {
          hook_event_name: "SessionStart",
          session_id: "sess-2",
          transcript_path: "/path",
          cwd: "/workspace",
          source: "resume",
        },
        {
          hook_event_name: "SessionStart",
          session_id: "sess-3",
          transcript_path: "/path",
          cwd: "/workspace",
          source: "clear",
        },
        {
          hook_event_name: "SessionStart",
          session_id: "sess-4",
          transcript_path: "/path",
          cwd: "/workspace",
          source: "compact",
        },
      ];

      expect(inputs.map((i) => i.source)).toEqual(["startup", "resume", "clear", "compact"]);
    });

    it("SessionEndInput has reason field", () => {
      const input: SessionEndInput = {
        hook_event_name: "SessionEnd",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        reason: "other",
      };

      expect(input.reason).toBe("other");
    });

    it("StopInput has stop_hook_active field", () => {
      const input: StopInput = {
        hook_event_name: "Stop",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        stop_hook_active: true,
      };

      expect(input.stop_hook_active).toBe(true);
    });

    it("SubagentStartInput has agent_id and agent_type", () => {
      const input: SubagentStartInput = {
        hook_event_name: "SubagentStart",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        agent_id: "agent-001",
        agent_type: "explore",
      };

      expect(input.agent_id).toBe("agent-001");
      expect(input.agent_type).toBe("explore");
    });

    it("SubagentStopInput has agent_transcript_path", () => {
      const input: SubagentStopInput = {
        hook_event_name: "SubagentStop",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        stop_hook_active: false,
        agent_id: "agent-001",
        agent_type: "explore",
        agent_transcript_path: "/path/to/agent/transcript",
      };

      expect(input.agent_transcript_path).toBe("/path/to/agent/transcript");
    });

    it("PreCompactInput has trigger and custom_instructions", () => {
      const input: PreCompactInput = {
        hook_event_name: "PreCompact",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        trigger: "manual",
        custom_instructions: "Custom instructions here",
      };

      expect(input.trigger).toBe("manual");
      expect(input.custom_instructions).toBe("Custom instructions here");
    });

    it("PermissionDeniedInput has tool_name, tool_input, tool_use_id, and reason", () => {
      const input: PermissionDeniedInput = {
        hook_event_name: "PermissionDenied",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        tool_name: "Bash",
        tool_input: { command: "rm file.txt" },
        tool_use_id: "tool-1",
        reason: "User denied the request",
      };

      expect(input.tool_name).toBe("Bash");
      expect(input.reason).toBe("User denied the request");
      expect(input.tool_use_id).toBe("tool-1");
    });

    it("PermissionRequestInput has tool_name and permission_suggestions", () => {
      const input: PermissionRequestInput = {
        hook_event_name: "PermissionRequest",
        session_id: "sess-123",
        transcript_path: "/path",
        cwd: "/workspace",
        tool_name: "Bash",
        tool_input: { command: "rm file.txt" },
        tool_use_id: "tool-1",
        permission_suggestions: [],
      };

      expect(input.tool_name).toBe("Bash");
      expect(input.permission_suggestions).toEqual([]);
    });
  });

  describe("BaseHookInput fields", () => {
    it("all inputs have base fields", () => {
      const inputs: HookInput[] = [
        {
          hook_event_name: "PreToolUse",
          session_id: "sess-1",
          transcript_path: "/path1",
          cwd: "/cwd1",
          tool_name: "Bash",
          tool_input: {},
          tool_use_id: "tool-1",
        },
        {
          hook_event_name: "SessionStart",
          session_id: "sess-2",
          transcript_path: "/path2",
          cwd: "/cwd2",
          source: "startup",
        },
      ];

      for (const input of inputs) {
        // All inputs should have these base fields
        expect(input.session_id).toBeDefined();
        expect(input.transcript_path).toBeDefined();
        expect(input.cwd).toBeDefined();
      }
    });

    it("permission_mode is optional on all inputs", () => {
      const inputWithMode: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        session_id: "test",
        transcript_path: "/path",
        cwd: "/cwd",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "tool-1",
        permission_mode: "bypassPermissions",
      };

      const inputWithoutMode: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        session_id: "test",
        transcript_path: "/path",
        cwd: "/cwd",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "tool-1",
      };

      expect(inputWithMode.permission_mode).toBe("bypassPermissions");
      expect(inputWithoutMode.permission_mode).toBeUndefined();
    });
  });

  describe("type assignability", () => {
    it("specific input types are assignable to HookInput", () => {
      const preToolUse: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        session_id: "test",
        transcript_path: "/path",
        cwd: "/cwd",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "tool-1",
      };

      const sessionStart: SessionStartInput = {
        hook_event_name: "SessionStart",
        session_id: "test",
        transcript_path: "/path",
        cwd: "/cwd",
        source: "startup",
      };

      // Both should be assignable to HookInput
      const inputs: HookInput[] = [preToolUse, sessionStart];
      expect(inputs.length).toBe(2);
    });

    it("HookInput union includes all hook types", () => {
      // Create an array with one of each type to verify they all work
      const allInputs: HookInput[] = [
        {
          hook_event_name: "PreToolUse",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          tool_name: "T",
          tool_input: {},
          tool_use_id: "id",
        },
        {
          hook_event_name: "PostToolUse",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          tool_name: "T",
          tool_input: {},
          tool_response: {},
          tool_use_id: "id",
        },
        {
          hook_event_name: "PostToolUseFailure",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          tool_name: "T",
          tool_input: {},
          tool_use_id: "id",
          error: "err",
        },
        {
          hook_event_name: "Notification",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          message: "m",
          notification_type: "info",
        },
        {
          hook_event_name: "UserPromptSubmit",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          prompt: "p",
        },
        {
          hook_event_name: "SessionStart",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          source: "startup",
        },
        {
          hook_event_name: "SessionEnd",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          reason: "other",
        },
        {
          hook_event_name: "Stop",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          stop_hook_active: false,
        },
        {
          hook_event_name: "SubagentStart",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          agent_id: "a",
          agent_type: "t",
        },
        {
          hook_event_name: "SubagentStop",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          stop_hook_active: false,
          agent_id: "a",
          agent_type: "t",
          agent_transcript_path: "/atp",
        },
        {
          hook_event_name: "PreCompact",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          trigger: "manual",
          custom_instructions: null,
        },
        {
          hook_event_name: "PermissionRequest",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          tool_name: "T",
          tool_input: {},
          tool_use_id: "t",
        },
        {
          hook_event_name: "PermissionDenied",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          tool_name: "T",
          tool_input: {},
          tool_use_id: "t",
          reason: "User denied",
        },
        {
          hook_event_name: "Setup",
          session_id: "s",
          transcript_path: "/p",
          cwd: "/c",
          trigger: "init",
        },
      ];

      expect(allInputs.length).toBe(14);
    });
  });
});
