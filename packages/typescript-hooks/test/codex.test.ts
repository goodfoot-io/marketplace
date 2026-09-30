import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Logger, type PostToolUseInput, type PreToolUseInput } from "@goodfoot/agent-hooks/codex";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import preHook from "../src/codex/eslint-typescript-bypass.js";
import postHook from "../src/codex/typescript-check.js";
import { parseCodexPatch } from "../src/shared/codex-patch.js";

vi.mock("node:child_process", () => ({ execSync: vi.fn(() => ""), execFileSync: vi.fn(() => "") }));
const logger = new Logger();
function preInput(command: string, cwd = "/project"): PreToolUseInput {
  return {
    cwd,
    hook_event_name: "PreToolUse",
    model: "fixture",
    permission_mode: "default",
    session_id: "fixture",
    transcript_path: null,
    turn_id: "turn",
    tool_use_id: "call",
    tool_name: "apply_patch",
    tool_input: { command },
  };
}
function patch(body: string): string {
  return `*** Begin Patch\n${body}\n*** End Patch`;
}
async function decision(body: string) {
  const result = await preHook(preInput(patch(body)), { logger });
  return result && typeof result === "object" && "stdout" in result ? (result.stdout.hookSpecificOutput ?? {}) : {};
}

describe("Codex bypass prevention", () => {
  it.each([
    "// eslint-disable-next-line rule",
    "/* eslint-disable */",
    "// @ts-ignore",
    "// @ts-expect-error",
    "// @ts-nocheck",
    "const a = value as any;",
    "// biome-ignore lint/rule",
    "// biome-ignore-all lint/rule",
    "// biome-ignore-start lint/rule",
    "// biome-ignore-end lint/rule",
    "/* biome-ignore lint/rule */",
  ])("denies added bypass %s", async (content) => {
    expect(await decision(`*** Add File: src/test.ts\n+${content}`)).toMatchObject({ permissionDecision: "deny" });
  });
  it("permits clean files without pre-approving tool permissions", async () => {
    expect(await decision("*** Add File: test.ts\n+const a: number = 1;")).not.toHaveProperty("permissionDecision");
  });
  it("ignores non-code files and deleted files", async () => {
    expect(await decision("*** Add File: notes.md\n+// @ts-ignore\n*** Delete File: old.ts")).not.toHaveProperty(
      "permissionDecision",
    );
  });
  it("permits removal and retained bypasses", async () => {
    expect(await decision("*** Update File: a.ts\n@@\n-// @ts-ignore\n+const a = 1;")).not.toHaveProperty(
      "permissionDecision",
    );
    expect(
      await decision("*** Update File: a.ts\n@@\n // @ts-ignore\n-const a = 1;\n+const a = 2;"),
    ).not.toHaveProperty("permissionDecision");
  });
  it("denies a bypass in a later file or hunk", async () => {
    expect(
      await decision("*** Update File: a.ts\n@@\n // @ts-ignore\n-const a = 1;\n+const a = 2;\n@@\n+// @ts-ignore"),
    ).toMatchObject({ permissionDecision: "deny" });
    expect(await decision("*** Add File: a.md\n+ok\n*** Add File: b.tsx\n+// @ts-ignore")).toMatchObject({
      permissionDecision: "deny",
    });
  });
  it("denies another occurrence of a retained bypass in the same hunk", async () => {
    expect(
      await decision("*** Update File: a.ts\n@@\n // @ts-ignore\n const a = 1;\n+// @ts-ignore\n+const b = 2;"),
    ).toMatchObject({ permissionDecision: "deny" });
  });
  it("checks rename destinations and multiline casts", async () => {
    expect(await decision("*** Update File: a.txt\n*** Move to: b.mts\n@@\n+const a = value as\n+any;")).toMatchObject({
      permissionDecision: "deny",
    });
  });
});

describe("Codex patch extraction", () => {
  it("resolves paths with spaces and CRLF, including moves and deletes", () => {
    const edits = parseCodexPatch(
      {
        command: patch(
          "*** Add File: space name.ts\n+ok\n*** Update File: a.ts\n*** Move to: b.ts\n@@\n-x\n+y\n*** End of File\n*** Delete File: c.ts",
        ).replace(/\n/g, "\r\n"),
      },
      "/project",
    );
    expect(edits.map((e) => [e.filePath, e.deleted])).toEqual([
      ["/project/space name.ts", false],
      ["/project/b.ts", false],
      ["/project/c.ts", true],
    ]);
    expect(edits[1].chunks).toEqual([{ oldContent: "x", newContent: "y" }]);
  });
  it.each([null, {}, { command: "invalid" }, { command: patch("unrecognized") }])(
    "rejects malformed input %j",
    (input) => {
      expect(() => parseCodexPatch(input, "/project")).toThrow();
    },
  );
});

describe("Codex validation", () => {
  let cwd: string;
  beforeEach(() => {
    vi.mocked(execSync).mockReset().mockReturnValue("");
    vi.mocked(execFileSync).mockReset().mockReturnValue("");
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "typescript-hooks-test-"));
    fs.writeFileSync(path.join(cwd, "package.json"), "{}");
    fs.writeFileSync(path.join(cwd, "tsconfig.json"), "{}");
    fs.writeFileSync(path.join(cwd, "a.ts"), "const a: number = 1;");
    fs.writeFileSync(path.join(cwd, "b.ts"), "const b: number = 2;");
  });
  afterEach(() => fs.rmSync(cwd, { recursive: true, force: true }));
  async function run(body: string) {
    const input: PostToolUseInput = {
      ...preInput(patch(body), cwd),
      hook_event_name: "PostToolUse",
      tool_response: { success: true },
    };
    return postHook(input, { logger });
  }
  it("checks every edited TS file, running tsc once per package", async () => {
    expect(await run("*** Update File: a.ts\n@@\n+x\n*** Update File: b.ts\n@@\n+y")).toBeUndefined();
    const commands = vi.mocked(execSync).mock.calls.map((call) => String(call[0]));
    expect(commands.filter((cmd) => cmd.startsWith("npx tsc"))).toHaveLength(1);
    expect(vi.mocked(execFileSync).mock.calls.filter((call) => call[0] === "yarn")).toHaveLength(2);
  });
  it("reports compiler diagnostics and swallowed errors in Codex's envelope", async () => {
    fs.writeFileSync(path.join(cwd, "b.ts"), "try { work(); } catch {}\n");
    vi.mocked(execSync).mockImplementation((command) => {
      if (String(command).startsWith("npx tsc"))
        throw { stdout: "a.ts(1,7): error TS2322: Type string is not assignable to number." };
      return "";
    });
    const result = await run("*** Update File: a.ts\n@@\n+x\n*** Update File: b.ts\n@@\n+y");
    expect(result).toMatchObject({
      stdout: {
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: expect.stringContaining("TS2322") },
      },
    });
    expect(JSON.stringify(result)).toContain("empty-catch");
  });
  it("skips deletions, missing files, and non-TS files", async () => {
    expect(
      await run("*** Delete File: a.ts\n*** Add File: missing.ts\n+x\n*** Add File: notes.md\n+ok"),
    ).toBeUndefined();
    expect(execSync).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });
  it("checks packages independently", async () => {
    fs.mkdirSync(path.join(cwd, "nested"));
    for (const name of ["package.json", "tsconfig.json"]) fs.writeFileSync(path.join(cwd, "nested", name), "{}");
    fs.writeFileSync(path.join(cwd, "nested", "c.ts"), "const c = 3;");
    await run("*** Update File: a.ts\n@@\n+x\n*** Update File: nested/c.ts\n@@\n+y");
    expect(vi.mocked(execSync).mock.calls.filter((call) => String(call[0]).startsWith("npx tsc"))).toHaveLength(2);
  });
});
