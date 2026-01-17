/**
 * Unit tests for tool-helpers module.
 *
 * Tests:
 * - Type guards for all tool types
 * - File path extraction utilities
 * - Content pattern checking
 * - forEachContent iteration
 */

import { describe, expect, it } from "vitest";
import {
  // Content inspection
  checkContentForPattern,
  forEachContent,
  // File path utilities
  getFilePath,
  isBashTool,
  isEditTool,
  isFileModifyingTool,
  isGlobTool,
  isGrepTool,
  isJsTsFile,
  isMultiEditTool,
  isReadTool,
  isTsFile,
  // Type guards
  isWriteTool,
} from "../src/tool-helpers.js";
import type { PostToolUseInput, PreToolUseInput } from "../src/types.js";

// Helper to create minimal valid inputs
function createBaseInput(): Omit<PreToolUseInput, "hook_event_name" | "tool_name" | "tool_input" | "tool_use_id"> {
  return {
    session_id: "test-session",
    transcript_path: "/path/to/transcript",
    cwd: "/workspace",
    permission_mode: "default",
  };
}

function createWriteInput(content = "const x = 1;"): PreToolUseInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_input: { file_path: "/workspace/src/index.ts", content },
    tool_use_id: "tu_123",
  };
}

function createEditInput(oldString = "const x = 1;", newString = "const x = 2;"): PreToolUseInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Edit",
    tool_input: { file_path: "/workspace/src/index.ts", old_string: oldString, new_string: newString },
    tool_use_id: "tu_123",
  };
}

function createMultiEditInput(edits = [{ old_string: "const x = 1;", new_string: "const x = 2;" }]): PreToolUseInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "MultiEdit",
    tool_input: { file_path: "/workspace/src/index.ts", edits },
    tool_use_id: "tu_123",
  };
}

function createReadInput(): PreToolUseInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Read",
    tool_input: { file_path: "/workspace/src/index.ts", offset: 0, limit: 100 },
    tool_use_id: "tu_123",
  };
}

function createBashInput(): PreToolUseInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "npm install", timeout: 60000 },
    tool_use_id: "tu_123",
  };
}

function createGlobInput(): PreToolUseInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Glob",
    tool_input: { pattern: "**/*.ts", path: "/workspace" },
    tool_use_id: "tu_123",
  };
}

function createGrepInput(): PreToolUseInput {
  return {
    ...createBaseInput(),
    hook_event_name: "PreToolUse",
    tool_name: "Grep",
    tool_input: { pattern: "function\\s+\\w+", glob: "*.ts" },
    tool_use_id: "tu_123",
  };
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

  describe("type guards work with PostToolUseInput", () => {
    it("works with PostToolUseInput", () => {
      const input: PostToolUseInput = {
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
      const input: PreToolUseInput = {
        ...createBaseInput(),
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: { file_path: 123, content: "test" }, // Invalid type
        tool_use_id: "tu_123",
      };
      expect(getFilePath(input)).toBeNull();
    });

    it("returns null if tool_input is null", () => {
      const input: PreToolUseInput = {
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
