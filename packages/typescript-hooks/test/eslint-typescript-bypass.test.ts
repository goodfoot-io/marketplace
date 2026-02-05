/**
 * Tests for the ESLint/TypeScript/Biome bypass prevention hook.
 */

import { Logger, type PreToolUseInput } from "@goodfoot/claude-code-hooks";
import { describe, expect, it } from "vitest";
import hook from "../src/eslint-typescript-bypass.js";

// Logger is silent by default (no stdout/stderr output)
const logger = new Logger();

// Build pattern strings dynamically to avoid self-matching
const ESLINT = "eslint";
const DISABLE = "disable";
const TS = "ts";
const IGNORE = "ignore";
const NOCHECK = "nocheck";
const AS = "as";
const ANY = "any";
const BIOME = "biome";

describe("ESLint/TypeScript/Biome Bypass Prevention Hook", () => {
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

  describe("Write operations", () => {
    it("allows TypeScript file without bypass patterns", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.ts",
          content: 'const foo: string = "bar";',
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });

    it(`denies file with ${ESLINT}-${DISABLE} comment`, async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.ts",
          content: `// ${ESLINT}-${DISABLE}-next-line\nconst foo = "bar";`,
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it(`denies file with @${TS}-${IGNORE} comment`, async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.ts",
          content: `// @${TS}-${IGNORE}\nconst foo: string = 123;`,
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it(`denies file with @${TS}-${NOCHECK} comment`, async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.ts",
          content: `// @${TS}-${NOCHECK}\nconst foo = "bar";`,
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it(`denies file with '${AS} ${ANY}' cast`, async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.ts",
          content: `const foo = something ${AS} ${ANY};`,
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it(`denies file with ${BIOME}-${IGNORE} comment`, async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.ts",
          content: `// ${BIOME}-${IGNORE} lint/suspicious\nconst foo = "bar";`,
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });
  });

  describe("Edit operations", () => {
    it("allows edit that does not add bypass patterns", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/test/file.ts",
          old_string: 'const foo = "old";',
          new_string: 'const foo = "new";',
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });

    it("allows edit that removes a bypass pattern", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/test/file.ts",
          old_string: `// @${TS}-${IGNORE}\nconst foo = "bar";`,
          new_string: 'const foo: string = "bar";',
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });

    it("denies edit that adds a bypass pattern", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/test/file.ts",
          old_string: "const foo: string = 123;",
          new_string: `// @${TS}-${IGNORE}\nconst foo: string = 123;`,
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("deny");
    });

    it("allows edit that keeps existing bypass pattern", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "/test/file.ts",
          old_string: `// @${TS}-${IGNORE}\nconst foo = "old";`,
          new_string: `// @${TS}-${IGNORE}\nconst foo = "new";`,
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });
  });

  describe("Non-JS/TS files", () => {
    it("allows bypass patterns in markdown files", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.md",
          content: `# Example\n\`\`\`ts\n// @${TS}-${IGNORE}\nconst foo = "bar";\n\`\`\``,
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });

    it("allows bypass patterns in JSON files", async () => {
      const mockInput: PreToolUseInput = {
        session_id: "test",
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test/file.json",
          content: `{"comment": "// @${TS}-${IGNORE}"}`,
        },
      };

      const result = await hook(mockInput, { logger });

      expect(result.stdout.hookSpecificOutput?.permissionDecision).toBe("allow");
    });
  });
});
