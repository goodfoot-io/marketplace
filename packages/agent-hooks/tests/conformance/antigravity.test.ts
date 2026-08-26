/**
 * Conformance matrix for the Antigravity entry point (plan step 5, item-6
 * descope).
 *
 * Claude Code's and Codex's matrices assert against an external oracle — a
 * README, or the real host CLI's own e2e suite. Antigravity has neither this
 * release (Step 0 concluded the real CLI cannot run non-interactively here
 * and CI has nothing to provision it — `notes/antigravity-cli-availability.md`
 * in the card repo). This matrix's oracle is therefore the mechanism itself:
 * `core/`'s `drive()` plus `AntigravityBlockError`, exercised through a real
 * compiled hook bundle and a real child process, exactly as the other two
 * agents' matrices exercise their transports — the only difference is what
 * the expected wire shape is checked against (the transport's own documented
 * contract in `transport.ts`, not a third-party doc).
 *
 * The one invariant every case in this file enforces: exit code is always 0.
 * Antigravity has no exit-code channel — every signal, success or block or
 * unexpected failure, is expressed only in stdout/stderr.
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

function antigravityPayload(eventName: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    hook_event_name: eventName,
    session_id: "conformance-session",
    cwd: process.cwd(),
    ...extra,
  });
}

describe("PreToolUse", () => {
  it("decision + reason pass through as JSON on stdout at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook, preToolUseOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default preToolUseHook({ matcher: "Bash" }, () =>
        preToolUseOutput({ decision: "force_ask", reason: "needs confirmation" }),
      );
      `,
      antigravityPayload("PreToolUse", { tool_name: "Bash", tool_input: {} }),
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({ decision: "force_ask", reason: "needs confirmation" });
  });

  it("AntigravityBlockError maps to a deny decision on stdout at exit 0 — NOT a nonzero exit", async () => {
    const result = await runHookBundle(
      `
      import { AntigravityBlockError, preToolUseHook } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default preToolUseHook({ matcher: "Bash" }, () => {
        throw new AntigravityBlockError("blocked by policy");
      });
      `,
      antigravityPayload("PreToolUse", { tool_name: "Bash", tool_input: {} }),
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
      antigravityPayload("PreToolUse", { tool_name: "Read", tool_input: {} }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ decision: "allow" });
    expect(result.stdout.includes("reason")).toBe(false);
    expect(result.stdout.includes("additionalContext")).toBe(false);
  });
});

describe("PostToolUse", () => {
  it("empty response serializes as {} at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { postToolUseHook } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default postToolUseHook({}, () => undefined);
      `,
      antigravityPayload("PostToolUse", { tool_name: "Bash", tool_input: {}, tool_response: {} }),
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
      antigravityPayload("PostToolUse", { tool_name: "Bash", tool_input: {}, tool_response: {} }),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
    expect(result.stderr).toContain("ANTIGRAVITY_HANDLER_EXPLOSION");
  });
});

describe("PreInvocation / PostInvocation (no matcher)", () => {
  it("PreInvocation ask decision passes through at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { preInvocationHook, preInvocationOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default preInvocationHook({}, () => preInvocationOutput({ decision: "ask", reason: "unclear intent" }));
      `,
      antigravityPayload("PreInvocation", { prompt: "do the thing" }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ decision: "ask", reason: "unclear intent" });
  });

  it("PostInvocation additionalContext passes through at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { postInvocationHook, postInvocationOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default postInvocationHook({}, () => postInvocationOutput({ additionalContext: "logged" }));
      `,
      antigravityPayload("PostInvocation", { response: "done" }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ additionalContext: "logged" });
  });
});

describe("Stop", () => {
  it("stop:true termination signal is expressed only in the payload, exit 0", async () => {
    const result = await runHookBundle(
      `
      import { stopHook, stopOutput } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default stopHook({}, () => stopOutput({ stop: true, reason: "session budget exhausted" }));
      `,
      antigravityPayload("Stop", { last_assistant_message: "done" }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ stop: true, reason: "session budget exhausted" });
  });

  it("AntigravityBlockError on Stop is still expressed as a deny decision, not a session-halt shape — no per-event table exists for Antigravity", async () => {
    const result = await runHookBundle(
      `
      import { AntigravityBlockError, stopHook } from "${ANTIGRAVITY_SURFACE}/index.js";
      export default stopHook({}, () => {
        throw new AntigravityBlockError("cannot stop here");
      });
      `,
      antigravityPayload("Stop", { last_assistant_message: null }),
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
