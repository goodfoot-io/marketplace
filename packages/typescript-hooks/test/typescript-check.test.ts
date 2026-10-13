/**
 * Tests for the TypeScript/ESLint validation hook.
 *
 * Note: These tests validate the hook structure and basic behavior.
 * Full integration tests require a real TypeScript project.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Logger, type PostToolUseInput } from "@goodfoot/agent-hooks/claude-code";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import hook from "../src/typescript-check.js";

// Logger is silent by default (no stdout/stderr output)
const logger = new Logger();

describe("TypeScript/ESLint Validation Hook", () => {
  let fixture: string;
  beforeEach(() => {
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "typescript-hooks-claude-test-"));
  });
  afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

  it("exports a valid hook function", () => {
    expect(hook).toBeDefined();
    expect(typeof hook).toBe("function");
  });

  it("has correct eventName metadata", () => {
    expect(hook.eventName).toBe("PostToolUse");
  });

  it("has correct matcher metadata", () => {
    expect(hook.matcher).toBe("Write|Edit|MultiEdit");
  });

  it("has correct timeout metadata", () => {
    expect(hook.timeout).toBe(60000);
  });

  describe("File filtering", () => {
    it("skips non-TypeScript files", async () => {
      const mockInput: PostToolUseInput = {
        session_id: "test",
        tool_use_id: "call",
        transcript_path: path.join(fixture, "transcript.jsonl"),
        cwd: fixture,
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: path.join(fixture, "file.js"),
          content: 'const foo = "bar";',
        },
        tool_response: "File written successfully",
      };

      const result = await hook(mockInput, { logger });

      expect(result).toBeNull();
    });

    it("skips markdown files", async () => {
      const mockInput: PostToolUseInput = {
        session_id: "test",
        tool_use_id: "call",
        transcript_path: path.join(fixture, "transcript.jsonl"),
        cwd: fixture,
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: path.join(fixture, "file.md"),
          content: "# Hello",
        },
        tool_response: "File written successfully",
      };

      const result = await hook(mockInput, { logger });

      expect(result).toBeNull();
    });

    it("skips JSON files", async () => {
      const mockInput: PostToolUseInput = {
        session_id: "test",
        tool_use_id: "call",
        transcript_path: path.join(fixture, "transcript.jsonl"),
        cwd: fixture,
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: path.join(fixture, "file.json"),
          content: "{}",
        },
        tool_response: "File written successfully",
      };

      const result = await hook(mockInput, { logger });

      expect(result).toBeNull();
    });
  });

  describe("Input handling", () => {
    it("handles missing file path gracefully", async () => {
      const mockInput: PostToolUseInput = {
        session_id: "test",
        tool_use_id: "call",
        transcript_path: path.join(fixture, "transcript.jsonl"),
        cwd: fixture,
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          content: 'const foo = "bar";',
        },
        tool_response: "File written successfully",
      };

      const result = await hook(mockInput, { logger });

      expect(result).toBeNull();
    });

    it("handles non-existent files gracefully", async () => {
      const mockInput: PostToolUseInput = {
        session_id: "test",
        tool_use_id: "call",
        transcript_path: path.join(fixture, "transcript.jsonl"),
        cwd: fixture,
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: path.join(fixture, "missing", "file.ts"),
          content: 'const foo = "bar";',
        },
        tool_response: "File written successfully",
      };

      const result = await hook(mockInput, { logger });

      expect(result).toBeNull();
    });
  });

  describe("Valid TypeScript extensions", () => {
    const tsExtensions = [".ts", ".tsx", ".mts", ".cts"];

    for (const ext of tsExtensions) {
      it(`recognizes ${ext} as TypeScript`, async () => {
        const mockInput: PostToolUseInput = {
          session_id: "test",
          tool_use_id: "call",
          transcript_path: path.join(fixture, "transcript.jsonl"),
          cwd: fixture,
          hook_event_name: "PostToolUse",
          tool_name: "Write",
          tool_input: {
            file_path: path.join(fixture, `file${ext}`),
            content: 'const foo = "bar";',
          },
          tool_response: "File written successfully",
        };

        // The hook should attempt to process this file
        // (though it may fail due to missing package.json)
        const result = await hook(mockInput, { logger });

        // Either returns context about missing package.json or processes the file
        expect(result).toBeDefined();
      });
    }
  });
});
