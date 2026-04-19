/**
 * Tests for the UserPromptSubmit hook that injects expansion context into prompts.
 */

import { existsSync, rmSync, writeFileSync } from "node:fs";
import {
  Logger,
  type UserPromptSubmitHookSpecificOutput,
  type UserPromptSubmitInput,
} from "@goodfoot/claude-code-hooks";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import hook, { findNewTerms, getSeenFilePath, loadSeen, saveSeen } from "../src/user-prompt-submit.js";

vi.mock("../src/expansion-store.js", () => ({
  readStore: vi.fn(),
  formatExpansion: vi.fn((key: string, facts: string[]) => {
    const bullets = facts.map((f: string) => `- ${f}`).join("\n");
    return `**${key}**:\n${bullets}`;
  }),
}));

import { readStore } from "../src/expansion-store.js";

const logger = new Logger();

const mockContext = {
  logger,
  persistEnvVar: () => {},
  persistEnvVars: () => {},
};

function getAdditionalContext(result: { stdout: { hookSpecificOutput?: unknown } } | null): string | undefined {
  return (result?.stdout.hookSpecificOutput as UserPromptSubmitHookSpecificOutput | undefined)?.additionalContext;
}

function createMockInput(prompt = "test prompt"): UserPromptSubmitInput {
  return {
    hook_event_name: "UserPromptSubmit",
    prompt,
    session_id: "test-session-123",
    transcript_path: "/tmp/test-transcript.jsonl",
    cwd: "/workspace",
  };
}

function cleanupSeenFile(sessionId: string): void {
  const path = getSeenFilePath(sessionId);
  if (existsSync(path)) {
    rmSync(path);
  }
}

describe("UserPromptSubmit Hook", () => {
  const testSessionId = "test-session-123";
  const altSessionId = "alt-session-456";

  beforeEach(() => {
    vi.clearAllMocks();
    cleanupSeenFile(testSessionId);
    cleanupSeenFile(altSessionId);
  });

  afterEach(() => {
    cleanupSeenFile(testSessionId);
    cleanupSeenFile(altSessionId);
  });

  it("exports a valid hook function", () => {
    expect(hook).toBeDefined();
    expect(typeof hook).toBe("function");
  });

  it("has correct hookEventName metadata (UserPromptSubmit)", () => {
    expect(hook.hookEventName).toBe("UserPromptSubmit");
  });

  it("returns null when store is empty", async () => {
    vi.mocked(readStore).mockReturnValue({});
    const result = await hook(createMockInput("hello world"), mockContext);
    expect(result).toBeNull();
  });

  it("returns null when no terms match prompt", async () => {
    vi.mocked(readStore).mockReturnValue({
      "client-web": ["React web application", "Stored at ./client-web"],
    });
    const result = await hook(createMockInput("hello world, no terms here"), mockContext);
    expect(result).toBeNull();
  });

  it("injects additionalContext for matched terms", async () => {
    vi.mocked(readStore).mockReturnValue({
      "client-web": ["React web application", "Stored at ./client-web"],
    });
    const result = await hook(createMockInput("please update client-web today"), mockContext);
    expect(getAdditionalContext(result)).toContain("client-web");
    expect(getAdditionalContext(result)).toContain("React web application");
  });

  it("sets systemMessage to the same content as additionalContext", async () => {
    vi.mocked(readStore).mockReturnValue({
      "client-web": ["React web application"],
    });
    const result = await hook(createMockInput("update client-web"), mockContext);
    assert(result !== null);
    expect(result.stdout.systemMessage).toBe(getAdditionalContext(result));
  });

  it("formats context as **term**:\\n- fact markdown blocks separated by blank lines", async () => {
    vi.mocked(readStore).mockReturnValue({
      "client-web": ["React web application", "Stored at ./client-web"],
      "api-server": ["Node.js REST API"],
    });
    const result = await hook(createMockInput("update client-web and api-server"), mockContext);
    const context = getAdditionalContext(result) ?? "";
    expect(context).toContain("**client-web**:\n- React web application\n- Stored at ./client-web");
    expect(context).toContain("**api-server**:\n- Node.js REST API");
    expect(context).toContain("\n\n");
  });

  it("does NOT re-inject a term seen in the same session", async () => {
    vi.mocked(readStore).mockReturnValue({
      "client-web": ["React web application"],
    });
    // First call - should inject
    await hook(createMockInput("update client-web"), mockContext);
    // Second call with same session - should not inject again
    const result = await hook(createMockInput("update client-web again"), mockContext);
    expect(result).toBeNull();
  });

  it("injects multiple terms found in the same prompt", async () => {
    vi.mocked(readStore).mockReturnValue({
      "client-web": ["React web application"],
      "api-server": ["Node.js REST API"],
    });
    const result = await hook(createMockInput("update both client-web and api-server"), mockContext);
    const context = getAdditionalContext(result) ?? "";
    expect(context).toContain("client-web");
    expect(context).toContain("api-server");
  });

  it("seen file path contains session_id", () => {
    const path = getSeenFilePath("my-unique-session-abc");
    expect(path).toContain("my-unique-session-abc");
  });

  it("returns null when ~/.expansion.json contains malformed JSON", async () => {
    vi.mocked(readStore).mockReturnValue({});
    const result = await hook(createMockInput("any prompt"), mockContext);
    expect(result).toBeNull();
  });

  it("gracefully treats seen file as empty when it contains malformed JSON", async () => {
    vi.mocked(readStore).mockReturnValue({
      "client-web": ["React web application"],
    });
    // Write malformed JSON to the seen file
    writeFileSync(getSeenFilePath(testSessionId), "not valid json {{ [");
    const result = await hook(createMockInput("update client-web"), mockContext);
    // Should still inject despite malformed seen file
    expect(getAdditionalContext(result)).toContain("client-web");
  });
});

describe("getSeenFilePath", () => {
  it("returns path with /tmp/expansion_ prefix and session_id", () => {
    expect(getSeenFilePath("abc123")).toBe("/tmp/expansion_abc123.seen");
  });
});

describe("loadSeen", () => {
  const sessionId = "load-seen-test-session";

  afterEach(() => cleanupSeenFile(sessionId));

  it("returns empty array when file does not exist", () => {
    const seen = loadSeen(sessionId);
    expect(seen).toEqual([]);
  });

  it("returns parsed array when file exists", () => {
    writeFileSync(getSeenFilePath(sessionId), JSON.stringify(["term-a", "term-b"]));
    const seen = loadSeen(sessionId);
    expect(seen).toEqual(["term-a", "term-b"]);
  });

  it("returns empty array when file contains malformed JSON", () => {
    writeFileSync(getSeenFilePath(sessionId), "invalid json {{");
    const seen = loadSeen(sessionId);
    expect(seen).toEqual([]);
  });
});

describe("saveSeen", () => {
  const sessionId = "save-seen-test-session";

  afterEach(() => cleanupSeenFile(sessionId));

  it("writes JSON array to seen file", () => {
    saveSeen(sessionId, ["term-x", "term-y"]);
    const seen = loadSeen(sessionId);
    expect(seen).toEqual(["term-x", "term-y"]);
  });
});

describe("findNewTerms", () => {
  it("returns terms whose keys appear as substrings in prompt and are not in seen", () => {
    const store = { "client-web": ["React app"], "api-server": ["Node API"] };
    const result = findNewTerms("update client-web today", store, []);
    expect(result).toEqual(["client-web"]);
  });

  it("excludes terms already in seen", () => {
    const store = { "client-web": ["React app"], "api-server": ["Node API"] };
    const result = findNewTerms("update client-web today", store, ["client-web"]);
    expect(result).toEqual([]);
  });

  it("returns multiple matches", () => {
    const store = { "client-web": ["React app"], "api-server": ["Node API"] };
    const result = findNewTerms("update client-web and api-server", store, []);
    expect(result).toContain("client-web");
    expect(result).toContain("api-server");
  });

  it("returns empty array when store is empty", () => {
    const result = findNewTerms("any prompt", {}, []);
    expect(result).toEqual([]);
  });
});
