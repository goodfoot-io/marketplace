/**
 * Tests for the Jest mock prevention hook.
 */

import { Logger, type PreToolUseInput } from "@goodfoot/claude-code-hooks";
import { describe, expect, it } from "vitest";
import hook from "../src/jest-mock-prevention.js";

// Logger is silent by default (no stdout/stderr output)
const logger = new Logger();

describe("Jest Mock Prevention Hook", () => {
  it("exports a valid hook function", () => {
    expect(hook).toBeDefined();
    expect(typeof hook).toBe("function");
  });

  it("has correct hookEventName metadata", () => {
    expect(hook.hookEventName).toBe("PreToolUse");
  });

  it("has correct matcher metadata", () => {
    expect(hook.matcher).toBe("Write|Edit|MultiEdit");
  });

  it("has correct timeout metadata", () => {
    expect(hook.timeout).toBe(10000);
  });

  describe("Test file detection", () => {
    it("allows non-test files with mock patterns", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/utils.ts",
          content: "const mock = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });

    it("checks .test.ts files", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: "const mock = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it("checks .spec.ts files", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.spec.ts",
          content: "const mock = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it("checks __tests__ directory files", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/src/__tests__/utils.ts",
          content: "const mock = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it("checks tests/ directory files", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/project/tests/integration.ts",
          content: "const mock = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });
  });

  describe("Write operations", () => {
    it("allows test file without mock patterns", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: `
import { getTestSql } from '@productivity-bot/test-utilities/sql';

describe('Feature', () => {
  it('works with real database', async () => {
    const { sql } = await getTestSql();
    expect(sql).toBeDefined();
  });
});
`,
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });

    it("denies file with jest.fn()", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: "const mockFn = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result.stdout.hookSpecificOutput?.permissionDecisionReason).toContain("jest.fn()");
    });

    it("denies file with jest.mock()", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: 'jest.mock("./module");',
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result.stdout.hookSpecificOutput?.permissionDecisionReason).toContain("jest.mock()");
    });

    it("denies file with jest.spyOn()", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: 'jest.spyOn(object, "method");',
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result.stdout.hookSpecificOutput?.permissionDecisionReason).toContain("jest.spyOn()");
    });

    it("denies file with mockReturnValue", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: "mockFn.mockReturnValue(42);",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result.stdout.hookSpecificOutput?.permissionDecisionReason).toContain("mockReturnValue");
    });

    it("denies file with toHaveBeenCalled()", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: "expect(mockFn).toHaveBeenCalled();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result.stdout.hookSpecificOutput?.permissionDecisionReason).toContain("toHaveBeenCalled");
    });

    it("denies file with toHaveBeenCalledWith()", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: 'expect(mockFn).toHaveBeenCalledWith("arg");',
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it("denies file with jest.Mock type", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: "const fn: jest.Mock<string> = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it("denies file with Jest import", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: 'import { fn, mocked } from "@jest/globals";',
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(result.stdout.hookSpecificOutput?.permissionDecisionReason).toContain("Import of Jest mock utilities");
    });
  });

  describe("Edit operations", () => {
    it("allows edit that does not add mock patterns", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/test/file.test.ts",
          old_string: 'expect(result).toBe("old");',
          new_string: 'expect(result).toBe("new");',
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });

    it("allows edit that removes a mock pattern", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/test/file.test.ts",
          old_string: "const mockFn = jest.fn();",
          new_string: "const realFn = createRealImplementation();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });

    it("denies edit that adds a mock pattern", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/test/file.test.ts",
          old_string: "const fn = realFunction;",
          new_string: "const fn = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it("allows edit that keeps existing mock pattern", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/test/file.test.ts",
          old_string: 'const mockFn = jest.fn();\nmockFn("old");',
          new_string: 'const mockFn = jest.fn();\nmockFn("new");',
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });
  });

  describe("MultiEdit operations", () => {
    it("allows multi-edit without mock patterns", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "MultiEdit",
        tool_input: {
          file_path: "/test/file.test.ts",
          edits: [
            { old_string: "const a = 1;", new_string: "const a = 2;" },
            { old_string: "const b = 1;", new_string: "const b = 2;" },
          ],
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });

    it("denies multi-edit that adds mock pattern", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "MultiEdit",
        tool_input: {
          file_path: "/test/file.test.ts",
          edits: [
            { old_string: "const a = 1;", new_string: "const a = 2;" },
            { old_string: "const fn = real;", new_string: "const fn = jest.fn();" },
          ],
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });
  });

  describe("Guidance message", () => {
    it("includes integration testing alternatives", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: "const mock = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      const reason = result.stdout.hookSpecificOutput?.permissionDecisionReason;

      expect(reason).toContain("getTestSql");
      expect(reason).toContain("temp directories");
      expect(reason).toContain("WebSocketServer");
      expect(reason).toContain("dependency injection");
      expect(reason).toContain("jestTeardownQueue");
    });

    it("includes system message for denial", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: "const mock = jest.fn();",
        },
      };

      const result = await hook(mockInput, { logger });
      expect(result.stdout.systemMessage).toContain("Integration testing enforced");
    });
  });

  describe("Multiple violations", () => {
    it("reports all violations found", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.test.ts",
          content: `
jest.mock("./module");
const mockFn = jest.fn();
jest.spyOn(object, "method");
expect(mockFn).toHaveBeenCalled();
`,
        },
      };

      const result = await hook(mockInput, { logger });
      const reason = result.stdout.hookSpecificOutput?.permissionDecisionReason;

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
      expect(reason).toContain("jest.mock()");
      expect(reason).toContain("jest.fn()");
      expect(reason).toContain("jest.spyOn()");
      expect(reason).toContain("toHaveBeenCalled");
    });
  });
});
