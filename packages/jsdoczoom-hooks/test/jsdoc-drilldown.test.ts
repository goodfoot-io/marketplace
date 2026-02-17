import { resolve } from "node:path";
import type { SyncHookJSONOutput } from "@goodfoot/claude-code-hooks";
import { Logger, type PostToolUseInput } from "@goodfoot/claude-code-hooks";
import type { DrilldownResult } from "jsdoczoom";
import { describe, expect, it } from "vitest";
import hook, { extractTsFilePaths, formatDrilldownResult } from "../src/jsdoc-drilldown.js";

const logger = new Logger();

/** Fixture directory from the jsdoczoom package (has annotated .ts files). */
const fixturesDir = resolve(import.meta.dirname, "../../jsdoczoom/test/fixtures/leaf-files");

/** Narrow hookSpecificOutput to PostToolUse and extract additionalContext. */
function getAdditionalContext(stdout: SyncHookJSONOutput): string | undefined {
  if (stdout.hookSpecificOutput?.hookEventName === "PostToolUse") {
    return stdout.hookSpecificOutput.additionalContext;
  }
  return undefined;
}

function makeInput(overrides: Partial<PostToolUseInput> = {}): PostToolUseInput {
  return {
    session_id: "test",
    hook_event_name: "PostToolUse",
    tool_name: "Glob",
    tool_input: {},
    tool_response: {},
    tool_use_id: "use-1",
    cwd: "/workspace",
    transcript_path: "/tmp/transcript.jsonl",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Hook metadata
// ---------------------------------------------------------------------------
describe("hook metadata", () => {
  it("has correct hookEventName", () => {
    expect(hook.hookEventName).toBe("PostToolUse");
  });

  it("matches Grep and Glob tools", () => {
    expect(hook.matcher).toBe("Grep|Glob");
  });
});

// ---------------------------------------------------------------------------
// extractTsFilePaths
// ---------------------------------------------------------------------------
describe("extractTsFilePaths", () => {
  it("returns empty array for null/undefined input", () => {
    expect(extractTsFilePaths(null, "/workspace")).toEqual([]);
    expect(extractTsFilePaths(undefined, "/workspace")).toEqual([]);
  });

  it("returns empty array for non-object input", () => {
    expect(extractTsFilePaths("string", "/workspace")).toEqual([]);
    expect(extractTsFilePaths(42, "/workspace")).toEqual([]);
  });

  it("extracts absolute paths from filenames array", () => {
    const resp = { filenames: ["/src/foo.ts", "/src/bar.tsx"] };
    const result = extractTsFilePaths(resp, "/workspace");
    expect(result).toEqual(["/src/foo.ts", "/src/bar.tsx"]);
  });

  it("resolves relative paths using cwd", () => {
    const resp = { filenames: ["src/foo.ts"] };
    const result = extractTsFilePaths(resp, "/workspace");
    expect(result).toEqual(["/workspace/src/foo.ts"]);
  });

  it("filters out non-TypeScript files", () => {
    const resp = { filenames: ["/a.ts", "/b.js", "/c.json", "/d.tsx"] };
    const result = extractTsFilePaths(resp, "/workspace");
    expect(result).toEqual(["/a.ts", "/d.tsx"]);
  });

  it("deduplicates paths", () => {
    const resp = { filenames: ["/src/foo.ts", "/src/foo.ts"] };
    const result = extractTsFilePaths(resp, "/workspace");
    expect(result).toEqual(["/src/foo.ts"]);
  });

  it("skips non-string filenames entries", () => {
    const resp = { filenames: ["/src/foo.ts", 42, null, "/src/bar.ts"] };
    const result = extractTsFilePaths(resp, "/workspace");
    expect(result).toEqual(["/src/foo.ts", "/src/bar.ts"]);
  });

  it("extracts paths from Grep content mode", () => {
    const content = ["/src/foo.ts:10:const x = 1;", "/src/bar.tsx:20:export default App;"].join("\n");
    const resp = { content };
    const result = extractTsFilePaths(resp, "/workspace");
    expect(result).toEqual(["/src/foo.ts", "/src/bar.tsx"]);
  });

  it("resolves relative paths in Grep content mode", () => {
    const resp = { content: "src/foo.ts:10:const x = 1;" };
    const result = extractTsFilePaths(resp, "/workspace");
    expect(result).toEqual(["/workspace/src/foo.ts"]);
  });

  it("filters non-TypeScript from Grep content mode", () => {
    const content = ["/src/foo.ts:1:x", "/src/bar.js:2:y", "/src/baz.json:3:z"].join("\n");
    const result = extractTsFilePaths({ content }, "/workspace");
    expect(result).toEqual(["/src/foo.ts"]);
  });

  it("skips blank lines and lines without colon in content", () => {
    const content = ["", "   ", "noColonHere", "/src/foo.ts:1:x"].join("\n");
    const result = extractTsFilePaths({ content }, "/workspace");
    expect(result).toEqual(["/src/foo.ts"]);
  });

  it("deduplicates across filenames and content", () => {
    const resp = {
      filenames: ["/src/foo.ts"],
      content: "/src/foo.ts:1:x",
    };
    const result = extractTsFilePaths(resp, "/workspace");
    expect(result).toEqual(["/src/foo.ts"]);
  });
});

// ---------------------------------------------------------------------------
// formatDrilldownResult
// ---------------------------------------------------------------------------
describe("formatDrilldownResult", () => {
  it("returns empty string for empty items", () => {
    expect(formatDrilldownResult({ items: [], truncated: false })).toBe("");
  });

  it("produces JSON matching DrilldownResult structure", () => {
    const result: DrilldownResult = {
      items: [{ next_id: "src/foo.ts@2", text: "Summary line" }],
      truncated: false,
    };
    const output = formatDrilldownResult(result);
    const [jsonLine] = output.split("\n");
    expect(JSON.parse(jsonLine)).toEqual(result);
  });

  it("appends npx instruction on second line", () => {
    const result: DrilldownResult = {
      items: [{ next_id: "src/foo.ts@2", text: "Summary" }],
      truncated: false,
    };
    const output = formatDrilldownResult(result);
    const lines = output.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("Run `npx jsdoczoom [next_id]` for more details on the file.");
  });

  it("preserves terminal id items", () => {
    const result: DrilldownResult = {
      items: [{ id: "src/foo.ts@4", text: "full file content" }],
      truncated: false,
    };
    const output = formatDrilldownResult(result);
    const parsed = JSON.parse(output.split("\n")[0]);
    expect(parsed.items[0]).toEqual({ id: "src/foo.ts@4", text: "full file content" });
  });

  it("preserves truncated flag", () => {
    const result: DrilldownResult = {
      items: [{ next_id: "a.ts@2", text: "x" }],
      truncated: true,
    };
    const parsed = JSON.parse(formatDrilldownResult(result).split("\n")[0]);
    expect(parsed.truncated).toBe(true);
  });

  it("preserves error items", () => {
    const result: DrilldownResult = {
      items: [{ id: "bad.ts", error: { code: "PARSE_ERROR", message: "fail" } }],
      truncated: false,
    };
    const parsed = JSON.parse(formatDrilldownResult(result).split("\n")[0]);
    expect(parsed.items[0].error.code).toBe("PARSE_ERROR");
  });
});

// ---------------------------------------------------------------------------
// Hook integration
// ---------------------------------------------------------------------------
describe("hook integration", () => {
  it("returns empty output when no TypeScript files found", async () => {
    const input = makeInput({
      tool_response: { filenames: ["/a.js", "/b.json"] },
    });
    const result = await hook(input, { logger });
    expect(result.stdout.hookSpecificOutput).toBeUndefined();
  });

  it("returns empty output for empty filenames", async () => {
    const input = makeInput({ tool_response: { filenames: [] } });
    const result = await hook(input, { logger });
    expect(result.stdout.hookSpecificOutput).toBeUndefined();
  });

  it("returns drilldown context for real TypeScript files", async () => {
    const tsFile = resolve(fixturesDir, "one-summary.ts");
    const input = makeInput({
      tool_response: { filenames: [tsFile] },
      cwd: fixturesDir,
    });

    const result = await hook(input, { logger });
    const ctx = getAdditionalContext(result.stdout);
    expect(ctx).toBeDefined();

    const lines = (ctx as string).split("\n");
    const parsed = JSON.parse(lines[0]) as DrilldownResult;
    expect(parsed.items).toHaveLength(1);

    const item = parsed.items[0];
    expect("next_id" in item).toBe(true);
    if ("next_id" in item) {
      expect(item.next_id).toBe("one-summary.ts@2");
      expect(item.text).toBe("Single summary line");
    }

    expect(lines[1]).toBe("Run `npx jsdoczoom [next_id]` for more details on the file.");
  });

  it("sets systemMessage identical to additionalContext", async () => {
    const tsFile = resolve(fixturesDir, "one-summary.ts");
    const input = makeInput({
      tool_response: { filenames: [tsFile] },
      cwd: fixturesDir,
    });
    const result = await hook(input, { logger });
    expect(result.stdout.systemMessage).toBe(getAdditionalContext(result.stdout));
  });

  it("handles multiple files with alphabetical ordering", async () => {
    const files = [resolve(fixturesDir, "two-summaries.ts"), resolve(fixturesDir, "one-summary.ts")];
    const input = makeInput({
      tool_response: { filenames: files },
      cwd: fixturesDir,
    });

    const result = await hook(input, { logger });
    const parsed = JSON.parse((getAdditionalContext(result.stdout) as string).split("\n")[0]) as DrilldownResult;

    expect(parsed.items).toHaveLength(2);
    const ids = parsed.items.map((item) => ("next_id" in item ? item.next_id : item.id));
    expect(ids).toEqual([...ids].sort());
  });
});
