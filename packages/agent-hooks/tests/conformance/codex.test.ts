/**
 * Conformance matrix for the Codex entry point (plan step 3.6).
 *
 * Every case compiles a real hook bundle with esbuild and executes it in a
 * child process (`node bundle.mjs`), asserting EXACT stdout bytes, stderr,
 * and exit code. Expected values are hand-written from the codex-hooks
 * README contract (sections cited per describe block) and from the vendored
 * host-behaviour notes recorded in the plan's round-11 correction
 * (codex-rs/hooks/src/events/session_start.rs gates `should_stop` to
 * `SessionStart` specifically) — NOT snapshotted from implementation output.
 *
 * THE THREE ADVISORY ROWS ARE NOT UNIFORM (plan Decisions, round-11): a
 * returned `{ continue: false }` is a genuine halt signal for SessionStart
 * and UserPromptSubmit, while the IDENTICAL payload returned from
 * SubagentStart is schema-accepted but silently ignored by the host. The
 * wire triple below is the same for all three (the transport always emits
 * what the handler returned); what differs — and what these rows document —
 * is how the HOST reads each payload.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let workDir: string;

beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-codex-conformance-"));
});

afterAll(() => {
  if (workDir !== undefined) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

const CODEX_SURFACE = path.resolve(__dirname, "..", "..", "src", "agents", "codex");

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
        `import { execute } from '${CODEX_SURFACE}/transport.js';`,
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

function codexPayload(eventName: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    hook_event_name: eventName,
    session_id: "conformance-session",
    transcript_path: null,
    cwd: process.cwd(),
    model: "gpt-5",
    permission_mode: "default",
    turn_id: "turn-1",
    ...extra,
  });
}

describe("SessionStart (README: synchronous hooks / e2e oracle runtime-and-build)", () => {
  it("string return normalizes to additionalContext JSON at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { sessionStartHook } from "${CODEX_SURFACE}/index.js";
      export default sessionStartHook({ matcher: "startup" }, () => "Loaded from text");
      `,
      codexPayload("SessionStart", { source: "startup" }),
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "Loaded from text" },
    });
  });

  it("ADVISORY ROW (halt): returned continue:false is a genuine halt signal for this event", async () => {
    // Host behaviour (session_start.rs): should_stop is gated to SessionStart.
    const result = await runHookBundle(
      `
      import { sessionStartHook, sessionStartOutput } from "${CODEX_SURFACE}/index.js";
      export default sessionStartHook({}, () => sessionStartOutput({ continue: false }));
      `,
      codexPayload("SessionStart", { source: "startup" }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: false });
  });

  it("BlockError maps to its reason on stderr plus exit code 2 with EMPTY stdout", async () => {
    const result = await runHookBundle(
      `
      import { BlockError, stopHook } from "${CODEX_SURFACE}/index.js";
      export default stopHook({}, () => {
        throw new BlockError("blocked");
      });
      `,
      codexPayload("Stop"),
    );
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("blocked\n");
  });
});

describe("UserPromptSubmit (README: advisory enrichment)", () => {
  it("decision block with reason passes through as JSON on the success channel", async () => {
    const result = await runHookBundle(
      `
      import { userPromptSubmitHook, userPromptSubmitOutput } from "${CODEX_SURFACE}/index.js";
      export default userPromptSubmitHook({}, () =>
        userPromptSubmitOutput({ decision: "block", reason: "Prompt must not be empty." }),
      );
      `,
      codexPayload("UserPromptSubmit"),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ decision: "block", reason: "Prompt must not be empty." });
  });

  it("ADVISORY ROW (halt): returned continue:false is a genuine halt signal for this event too", async () => {
    const result = await runHookBundle(
      `
      import { userPromptSubmitHook, userPromptSubmitOutput } from "${CODEX_SURFACE}/index.js";
      export default userPromptSubmitHook({}, () => userPromptSubmitOutput({ continue: false }));
      `,
      codexPayload("UserPromptSubmit"),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: false });
  });

  it("throw+error (default policy): stacktrace on stderr, exit 1 (NOT 2 — Codex rule), no stdout", async () => {
    const result = await runHookBundle(
      `
      import { userPromptSubmitHook } from "${CODEX_SURFACE}/index.js";
      export default userPromptSubmitHook({}, () => {
        throw new Error("CODEX_HANDLER_EXPLOSION");
      });
      `,
      codexPayload("UserPromptSubmit"),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("CODEX_HANDLER_EXPLOSION");
  });

  it("throw+continue (advisory): {} at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { userPromptSubmitHook } from "${CODEX_SURFACE}/index.js";
      export default userPromptSubmitHook({ unexpectedError: "continue" }, () => {
        throw new Error("swallowed");
      });
      `,
      codexPayload("UserPromptSubmit"),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
    expect(result.stderr).toBe("");
  });
});

describe("SubagentStart (round-11 correction: host IGNORES continue:false here)", () => {
  it("ADVISORY ROW (ignored): the identical continue:false payload is schema-accepted but silently ignored by the host — wire still emits it verbatim, never asserted as a halt", async () => {
    const result = await runHookBundle(
      `
      import { subagentStartHook, subagentStartOutput } from "${CODEX_SURFACE}/index.js";
      export default subagentStartHook({}, () => subagentStartOutput({ continue: false }));
      `,
      codexPayload("SubagentStart", { agent_id: "a-1", agent_type: "explore" }),
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: false });
  });
});

describe("Wire fundamentals (README: Fail-Open Execution / error handling)", () => {
  it("malformed stdin under the DEFAULT policy exits 1 with a stacktrace — Codex does NOT fail open unconditionally", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook } from "${CODEX_SURFACE}/index.js";
      export default preToolUseHook({}, () => undefined);
      `,
      "{not json",
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("malformed stdin under 'continue' policy emits {} at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { userPromptSubmitHook } from "${CODEX_SURFACE}/index.js";
      export default userPromptSubmitHook({ unexpectedError: "continue" }, () => undefined);
      `,
      "{not json",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
  });

  it("empty response serializes as {} at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { postToolUseHook } from "${CODEX_SURFACE}/index.js";
      export default postToolUseHook({}, () => undefined);
      `,
      codexPayload("PostToolUse", { tool_name: "Bash", tool_input: {}, tool_response: {}, tool_use_id: "t1" }),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
  });

  it("plain-string return from a non-text event fails through the policy path", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook } from "${CODEX_SURFACE}/index.js";
      export default preToolUseHook({}, () => "nope");
      `,
      codexPayload("PreToolUse", { tool_name: "Bash", tool_input: {}, tool_use_id: "t1" }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PreToolUse hooks cannot return plain text");
  });
});

describe("Reserved fields are emitted only when explicitly passed (card acceptance signal)", () => {
  it("PreToolUse permissionDecision 'ask' passes through when given", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook, preToolUseOutput } from "${CODEX_SURFACE}/index.js";
      export default preToolUseHook({}, () =>
        preToolUseOutput({ permissionDecision: "ask", permissionDecisionReason: "unsure" }),
      );
      `,
      codexPayload("PreToolUse", { tool_name: "Bash", tool_input: {}, tool_use_id: "t1" }),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { hookSpecificOutput?: Record<string, unknown> };
    expect(payload.hookSpecificOutput?.permissionDecision).toBe("ask");
    expect(payload.hookSpecificOutput?.permissionDecisionReason).toBe("unsure");
  });

  it("PermissionRequest interrupt/updatedInput/updatedPermissions pass through when given", async () => {
    const result = await runHookBundle(
      `
      import { permissionRequestHook, permissionRequestOutput } from "${CODEX_SURFACE}/index.js";
      export default permissionRequestHook({}, () =>
        permissionRequestOutput({
          behavior: "deny",
          message: "nope",
          interrupt: true,
          updatedInput: { command: "safe" },
          updatedPermissions: [{ type: "allow", toolName: "Bash" }],
        }),
      );
      `,
      codexPayload("PermissionRequest", { tool_name: "Bash", tool_input: {}, turn_id: "t1" }),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { decision?: Record<string, unknown> };
    };
    expect(payload.hookSpecificOutput?.decision).toEqual({
      behavior: "deny",
      message: "nope",
      interrupt: true,
      updatedInput: { command: "safe" },
      updatedPermissions: [{ type: "allow", toolName: "Bash" }],
    });
  });

  it("omitted reserved fields are ABSENT from the emitted JSON, never defaulted", async () => {
    const result = await runHookBundle(
      `
      import { permissionRequestHook, permissionRequestOutput } from "${CODEX_SURFACE}/index.js";
      export default permissionRequestHook({}, () => permissionRequestOutput({ behavior: "allow" }));
      `,
      codexPayload("PermissionRequest", { tool_name: "Read", tool_input: {}, turn_id: "t1" }),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { decision?: Record<string, unknown>; additionalContext?: unknown };
    };
    expect(payload.hookSpecificOutput?.decision).toEqual({ behavior: "allow" });
    expect(payload.hookSpecificOutput?.additionalContext).toBeUndefined();
    expect(result.stdout.includes('"interrupt"')).toBe(false);
    expect(result.stdout.includes('"updatedInput"')).toBe(false);
    expect(result.stdout.includes('"updatedPermissions"')).toBe(false);
    expect(result.stdout.includes('"continue"')).toBe(false);
    expect(result.stdout.includes('"stopReason"')).toBe(false);
  });
});
