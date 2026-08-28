/**
 * Conformance matrix for the Antigravity entry point.
 *
 * The oracle is `src/agents/antigravity/CONTRACT.md`, which pins the host's
 * own hook reference verbatim. Every payload piped in below is in the shape
 * that document specifies — camelCase keys, no event-name field — and every
 * expected reply is the shape it specifies for that event.
 *
 * The one invariant every case enforces: exit code is always 0. Antigravity
 * has no exit-code channel, so every signal — success, block, or unexpected
 * failure — is expressed only in stdout and stderr.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let workDir: string;

beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-antigravity-conformance-"));
});

afterAll(() => {
  if (workDir !== undefined) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

const ANTIGRAVITY_SURFACE = path.resolve(__dirname, "..", "..", "src", "agents", "antigravity");

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

async function runHookBundle(hookSource: string, stdinJson: string | null): Promise<RunResult> {
  const caseDir = fs.mkdtempSync(path.join(workDir, "case-"));
  const hookPath = path.join(caseDir, "hook.ts");
  const bundlePath = path.join(caseDir, "bundle.mjs");
  fs.writeFileSync(hookPath, hookSource);

  await build({
    stdin: {
      contents: [
        `import hook from './hook.ts';`,
        `import { execute } from '${ANTIGRAVITY_SURFACE}/transport.js';`,
        ``,
        `execute(hook);`,
        ``,
      ].join("\n"),
      resolveDir: caseDir,
      sourcefile: "entry.ts",
      loader: "ts",
    },
    format: "esm",
    platform: "node",
    target: "node20",
    bundle: true,
    write: true,
    outfile: bundlePath,
    external: ["node:*"],
  });

  const result = spawnSync(process.execPath, [bundlePath], {
    input: stdinJson === null ? undefined : stdinJson,
    encoding: "utf-8",
    timeout: 30000,
  });
  return { status: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/**
 * Builds a payload in the host's own shape. The common fields are exactly the
 * five `CONTRACT.md` lists, and no event-name field is included — the host
 * does not send one.
 */
function antigravityPayload(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    conversationId: "ec33ebf9-0cba-4100-8142-c61503f6c587",
    workspacePaths: [process.cwd()],
    transcriptPath: `${process.cwd()}/.gemini/antigravity/transcript.jsonl`,
    artifactDirectoryPath: `${process.cwd()}/.gemini/antigravity/artifacts`,
    modelName: "auto",
    ...extra,
  });
}

const TOOL_CALL = { toolCall: { name: "run_command", args: { CommandLine: "npm test" } }, stepIdx: 19 };

describe("PreToolUse", () => {
  it("decision + reason pass through as JSON on stdout at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook, preToolUseOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default preToolUseHook({ matcher: "run_command" }, () =>
        preToolUseOutput({ decision: "force_ask", reason: "needs confirmation" }),
      );
      `,
      antigravityPayload(TOOL_CALL),
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({ decision: "force_ask", reason: "needs confirmation" });
  });

  it("AntigravityBlockError maps to a deny decision on stdout at exit 0 — NOT a nonzero exit", async () => {
    const result = await runHookBundle(
      `
      import { AntigravityBlockError, preToolUseHook } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default preToolUseHook({ matcher: "run_command" }, () => {
        throw new AntigravityBlockError("blocked by policy");
      });
      `,
      antigravityPayload(TOOL_CALL),
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({ decision: "deny", reason: "blocked by policy" });
  });

  it("reserved fields are ABSENT from the emitted JSON when omitted, never defaulted", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook, preToolUseOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default preToolUseHook({}, () => preToolUseOutput({ decision: "allow" }));
      `,
      antigravityPayload(TOOL_CALL),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ decision: "allow" });
    expect(result.stdout.includes("reason")).toBe(false);
    expect(result.stdout.includes("permissionOverrides")).toBe(false);
    expect(result.stdout.includes("overwrite")).toBe(false);
  });

  it("permissionOverrides and overwrite reach stdout verbatim", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook, preToolUseOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default preToolUseHook({ matcher: "run_command" }, (input) =>
        preToolUseOutput({
          decision: "ask",
          reason: "Requires confirmation for test execution.",
          permissionOverrides: ["command(npm test)"],
          overwrite: { CommandLine: input.toolCall.args.CommandLine + " --run" },
        }),
      );
      `,
      antigravityPayload(TOOL_CALL),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      decision: "ask",
      reason: "Requires confirmation for test execution.",
      permissionOverrides: ["command(npm test)"],
      overwrite: { CommandLine: "npm test --run" },
    });
  });
});

describe("PostToolUse", () => {
  it("empty response serializes as {} at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { postToolUseHook } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default postToolUseHook({}, () => undefined);
      `,
      antigravityPayload({ stepIdx: 5 }),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
    expect(result.stderr).toBe("");
  });

  it("an unexpected handler throw under the default policy: stacktrace on stderr, {} on stdout, exit 0 (NOT nonzero)", async () => {
    const result = await runHookBundle(
      `
      import { postToolUseHook } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default postToolUseHook({}, () => {
        throw new Error("ANTIGRAVITY_HANDLER_EXPLOSION");
      });
      `,
      antigravityPayload({ stepIdx: 5, error: "exit status 1" }),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
    expect(result.stderr).toContain("ANTIGRAVITY_HANDLER_EXPLOSION");
  });
});

describe("PreInvocation / PostInvocation (flat events, matcher ignored)", () => {
  it("PreInvocation injects an ephemeral message at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { preInvocationHook, preInvocationOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default preInvocationHook({}, (input) =>
        preInvocationOutput({ injectSteps: [{ ephemeralMessage: "invocation " + input.invocationNum }] }),
      );
      `,
      antigravityPayload({ invocationNum: 3, initialNumSteps: 10 }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ injectSteps: [{ ephemeralMessage: "invocation 3" }] });
  });

  it("PostInvocation terminationBehavior passes through at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { postInvocationHook, postInvocationOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default postInvocationHook({}, () =>
        postInvocationOutput({ injectSteps: [], terminationBehavior: "force_continue" }),
      );
      `,
      antigravityPayload({ invocationNum: 3, initialNumSteps: 10 }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ injectSteps: [], terminationBehavior: "force_continue" });
  });
});

describe("Stop", () => {
  it('decision "continue" blocks the stop and is expressed only in the payload, exit 0', async () => {
    const result = await runHookBundle(
      `
      import { stopHook, stopOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default stopHook({}, (input) =>
        input.fullyIdle ? stopOutput({}) : stopOutput({ decision: "continue", reason: "Tests are still running." }),
      );
      `,
      antigravityPayload({ executionNum: 1, terminationReason: "model_stop", error: "", fullyIdle: false }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ decision: "continue", reason: "Tests are still running." });
  });

  it("AntigravityBlockError on Stop still serializes as a deny decision — the transport has one block translation, not a per-event table", async () => {
    const result = await runHookBundle(
      `
      import { AntigravityBlockError, stopHook } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default stopHook({}, () => {
        throw new AntigravityBlockError("cannot stop here");
      });
      `,
      antigravityPayload({ executionNum: 1, terminationReason: "error", error: "boom", fullyIdle: true }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ decision: "deny", reason: "cannot stop here" });
  });
});

describe("Wire fundamentals: exit code is always 0, regardless of failure phase", () => {
  it("malformed stdin under the default policy still exits 0 — the empty response plus a stderr diagnostic", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default preToolUseHook({}, () => undefined);
      `,
      "{not json",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
