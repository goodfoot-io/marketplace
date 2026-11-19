/** Subprocess checks exercise the same standalone ESM bundles shipped to Cursor. */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compileCursorHook } from "../../../src/agents/cursor/cli-support.js";

const SURFACE = path.resolve(__dirname, "../../../src/agents/cursor");
let root: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-runtime-"));
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

async function run(source: string, input = "{}") {
  const directory = fs.mkdtempSync(path.join(root, "case-"));
  const hook = path.join(directory, "hook.ts");
  fs.writeFileSync(hook, `import * as cursor from ${JSON.stringify(`${SURFACE}/index.js`)};\n${source}`);
  const { content } = await compileCursorHook(hook, {});
  const bundle = path.join(directory, "hook.mjs");
  fs.writeFileSync(bundle, content);
  return spawnSync(process.execPath, [bundle], { input, encoding: "utf8", timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
}

describe("Cursor runtime conformance", () => {
  it.each([
    [
      "sessionStart",
      '{ env: { MODE: "test" }, additionalContext: input.session_id }',
      { session_id: "session-1" },
      { env: { MODE: "test" }, additional_context: "session-1" },
    ],
    [
      "postToolUse",
      "{ additionalContext: input.tool_output, updatedMcpToolOutput: { ok: true } }",
      { tool_output: '{"result":"ok"}' },
      { additional_context: '{"result":"ok"}', updated_mcp_tool_output: { ok: true } },
    ],
    [
      "preToolUse",
      '{ permission: "deny", userMessage: "no", updatedInput: { command: "true" } }',
      {},
      { permission: "deny", user_message: "no", updated_input: { command: "true" } },
    ],
    ["beforeSubmitPrompt", '{ continue: false, userMessage: "no" }', {}, { continue: false, user_message: "no" }],
    ["stop", '{ followupMessage: "finish" }', {}, { followup_message: "finish" }],
    ["subagentStop", '{ followupMessage: "finish" }', {}, { followup_message: "finish" }],
  ])("serializes %s to its native stdout shape", async (event, options, payload, expected) => {
    const result = await run(
      `export default cursor.${event}Hook({}, input => cursor.${event}Output(${options}));`,
      JSON.stringify(payload),
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual(expected);
    expect(result.stdout).not.toContain('"_type"');
    expect(result.stdout).not.toContain('"hookSpecificOutput"');
  });

  it.each([
    "sessionStart",
    "preToolUse",
    "postToolUse",
    "beforeSubmitPrompt",
    "stop",
    "subagentStop",
  ])("supplies a valid empty response for %s", async (event) => {
    const result = await run(`export default cursor.${event}Hook({}, () => undefined);`);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      event === "preToolUse" ? { permission: "allow" } : event === "beforeSubmitPrompt" ? { continue: true } : {},
    );
  });

  it.each(["preToolUse", "beforeSubmitPrompt"])("preserves an intentional %s block", async (event) => {
    const result = await run(
      `export default cursor.${event}Hook({}, () => { throw new cursor.CursorBlockError("policy"); });`,
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      event === "preToolUse"
        ? { permission: "deny", user_message: "policy", agent_message: "policy" }
        : { continue: false, user_message: "policy" },
    );
  });

  it.each([
    "sessionStart",
    "postToolUse",
  ])("allows %s to opt into advisory fail-open without swallowing intentional blocks", async (event) => {
    const crash = await run(
      `export default cursor.${event}Hook({ unexpectedError: "continue" }, () => { throw new Error("broken"); });`,
    );
    expect(crash.status).toBe(0);
    expect(crash.stdout).toBe("{}");
    const block = await run(
      `export default cursor.${event}Hook({ unexpectedError: "continue" }, () => { throw new cursor.CursorBlockError("block survives"); });`,
    );
    expect(block.status).toBe(2);
    expect(block.stderr).toContain("block survives");
  });

  it("exits nonzero on permission handler errors without emitting an accidental allow", async () => {
    const result = await run(
      'export default cursor.preToolUseHook({}, () => { throw new Error("permission check failed"); });',
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("permission check failed");
  });
  it("surfaces malformed stdin by default", async () => {
    const result = await run("export default cursor.preToolUseHook({}, () => undefined);", "not-json");
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.length).toBeGreaterThan(0);
  });
  it("rejects cross-event outputs even from untyped JavaScript", async () => {
    const result = await run(
      'export default cursor.preToolUseHook({}, () => cursor.stopOutput({ followupMessage: "wrong" }));',
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("received an output for stop");
  });
  it("classifies serialization errors through the existing error policy", async () => {
    const body = "() => { const env = {}; env.circular = env; return cursor.sessionStartOutput({ env }); }";
    const strict = await run(`export default cursor.sessionStartHook({}, ${body});`);
    expect(strict.status).not.toBe(0);
    expect(strict.stdout).toBe("");
    const advisory = await run(`export default cursor.sessionStartHook({ unexpectedError: "continue" }, ${body});`);
    expect(advisory.status).toBe(0);
    // Core finalizes once: serialization failures do not retry stdout.
    expect(advisory.stdout).toBe("");
  });
  it("drains large context replies instead of truncating piped stdout", async () => {
    const result = await run(
      'export default cursor.sessionStartHook({}, () => cursor.sessionStartOutput({ additionalContext: "x".repeat(300000) }));',
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).additional_context.length).toBe(300000);
  });
});
