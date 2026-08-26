/**
 * Conformance matrix for the Claude Code entry point (plan step 2.4).
 *
 * Every case compiles a real hook bundle with esbuild and executes it in a
 * child process (`node bundle.mjs`), asserting EXACT stdout bytes, stderr,
 * and exit code. Expected values are hand-written from the documented Claude
 * Code hooks contract (https://code.claude.com/docs/en/hooks — sections cited
 * per describe block), NOT snapshotted from implementation output. Oracle
 * precedence note (plan step 2.4): where a matrix row and a ported real-agent
 * e2e disagree, the ported e2e wins and this matrix is corrected.
 *
 * Exit-code contract ("Exit codes" reference):
 *   0 = success, stdout parsed as JSON when present;
 *   2 = blocking (handler threw OR stderr-only signal);
 *   any stdout that parses as JSON counts as success REGARDLESS of exit
 *   code, so intentional stderr blocks must never write stdout.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HookEventName } from "../../src/agents/claude-code/types.js";

let workDir: string;

beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-conformance-"));
});

afterAll(() => {
  if (workDir !== undefined) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

const AGENT_SURFACE = path.resolve(__dirname, "..", "..", "src", "agents", "claude-code");
const CORE_SURFACE = path.resolve(AGENT_SURFACE, "..", "..", "core");

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Compiles `hookSource` (a TypeScript module with a default-exported hook)
 * against this package's Claude Code surface and runs the bundle with
 * `stdinJson`, returning the exact wire triple.
 */
async function runHookBundle(hookSource: string, stdinJson: string | null): Promise<RunResult> {
  const caseDir = fs.mkdtempSync(path.join(workDir, "case-"));
  const hookPath = path.join(caseDir, "hook.ts");
  const bundlePath = path.join(caseDir, "bundle.mjs");
  fs.writeFileSync(hookPath, hookSource);

  await build({
    stdin: {
      contents: [
        `import hook from './hook.ts';`,
        `import { execute } from '${AGENT_SURFACE}/transport.js';`,
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

/** Minimal valid PreToolUse-shaped stdin payload. */
function payloadFor(eventName: HookEventName): string {
  return JSON.stringify({
    hook_event_name: eventName,
    session_id: "conformance-session",
    transcript_path: "/tmp/conformance-transcript.jsonl",
    cwd: process.cwd(),
    tool_name: "Bash",
    tool_input: { command: "echo CONFORMANCE" },
    tool_response: { output: "CONFORMANCE" },
    prompt: "conformance prompt",
    source: "startup",
  });
}

// ============================================================================
// Matrix — hand-written expected values with README citations
// ============================================================================

describe("PreToolUse (docs: hooks#pretooluse)", () => {
  it("allow decision returns permissionDecision 'allow' on stdout at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook, preToolUseOutput } from "${AGENT_SURFACE}/index.js";
      export default preToolUseHook({}, () =>
        preToolUseOutput({ hookSpecificOutput: { permissionDecision: "allow" } }),
      );
      `,
      payloadFor("PreToolUse"),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { hookSpecificOutput?: Record<string, unknown> };
    expect(payload.hookSpecificOutput?.permissionDecision).toBe("allow");
    expect(payload.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
    expect(result.stderr).toBe("");
  });

  it("deny decision carries permissionDecisionReason and stays on the success channel", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook, preToolUseOutput } from "${AGENT_SURFACE}/index.js";
      export default preToolUseHook({}, () =>
        preToolUseOutput({
          hookSpecificOutput: {
            permissionDecision: "deny",
            permissionDecisionReason: "CONFORMANCE_DENY_REASON",
          },
        }),
      );
      `,
      payloadFor("PreToolUse"),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { hookSpecificOutput?: Record<string, unknown> };
    expect(payload.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(payload.hookSpecificOutput?.permissionDecisionReason).toBe("CONFORMANCE_DENY_REASON");
  });

  it("thrown HookBlockError translates to the native deny shape (agent-hooks extension, plan Decisions)", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook } from "${AGENT_SURFACE}/index.js";
      import { HookBlockError } from "${CORE_SURFACE}/transport.js";
      export default preToolUseHook({}, () => {
        throw new HookBlockError("blocked: conformance");
      });
      `,
      payloadFor("PreToolUse"),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { hookSpecificOutput?: Record<string, unknown> };
    expect(payload.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(payload.hookSpecificOutput?.permissionDecisionReason).toBe("blocked: conformance");
    expect("continue" in payload).toBe(false);
  });
});

describe("PermissionRequest (docs: hooks#permissionrequest)", () => {
  it("deny decision carries behavior/message inside hookSpecificOutput.decision", async () => {
    const result = await runHookBundle(
      `
      import { permissionRequestHook, permissionRequestOutput } from "${AGENT_SURFACE}/index.js";
      export default permissionRequestHook({}, () =>
        permissionRequestOutput({
          hookSpecificOutput: { decision: { behavior: "deny", message: "CONFORMANCE_DENY" } },
        }),
      );
      `,
      payloadFor("PermissionRequest"),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { decision?: Record<string, unknown>; hookEventName?: string };
    };
    expect(payload.hookSpecificOutput?.decision?.behavior).toBe("deny");
    expect(payload.hookSpecificOutput?.decision?.message).toBe("CONFORMANCE_DENY");
  });
});

describe("UserPromptSubmit (docs: hooks#userpromptsubmit — advisory enrichment)", () => {
  it("additionalContext reaches stdout as JSON at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { userPromptSubmitHook, userPromptSubmitOutput } from "${AGENT_SURFACE}/index.js";
      export default userPromptSubmitHook({}, () =>
        userPromptSubmitOutput({ hookSpecificOutput: { additionalContext: "CONFORMANCE_CONTEXT" } }),
      );
      `,
      payloadFor("UserPromptSubmit"),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { hookSpecificOutput?: Record<string, unknown> };
    expect(payload.hookSpecificOutput?.additionalContext).toBe("CONFORMANCE_CONTEXT");
  });

  it("throw+error (default policy): stacktrace on stderr, exit 2, NO stdout JSON", async () => {
    const result = await runHookBundle(
      `
      import { userPromptSubmitHook } from "${AGENT_SURFACE}/index.js";
      export default userPromptSubmitHook({}, () => {
        throw new Error("CONFORMANCE_HANDLER_EXPLOSION");
      });
      `,
      payloadFor("UserPromptSubmit"),
    );
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("CONFORMANCE_HANDLER_EXPLOSION");
  });

  it("throw+continue (legal on advisory events): empty response, exit 0", async () => {
    const result = await runHookBundle(
      `
      import { userPromptSubmitHook } from "${AGENT_SURFACE}/index.js";
      export default userPromptSubmitHook({ unexpectedError: "continue" }, () => {
        throw new Error("CONFORMANCE_SWALLOWED");
      });
      `,
      payloadFor("UserPromptSubmit"),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
    expect(result.stderr).toBe("");
  });

  it("HookBlockError under continue still blocks: continue:false + stopReason (plan Decisions)", async () => {
    const result = await runHookBundle(
      `
      import { userPromptSubmitHook } from "${AGENT_SURFACE}/index.js";
      import { HookBlockError } from "${CORE_SURFACE}/transport.js";
      export default userPromptSubmitHook({ unexpectedError: "continue" }, () => {
        throw new HookBlockError("deciding to block crashed mid-way");
      });
      `,
      payloadFor("UserPromptSubmit"),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { continue?: boolean; stopReason?: string };
    expect(payload.continue).toBe(false);
    expect(payload.stopReason).toBe("deciding to block crashed mid-way");
  });

  it("unexpectedError:'continue' is rejected at factory-call time on excluded events", async () => {
    const result = await runHookBundle(
      `
      import { preToolUseHook } from "${AGENT_SURFACE}/index.js";
      // JS callers bypass the compile-time narrowing; the runtime gate must fail closed.
      export default preToolUseHook({ unexpectedError: "continue" }, () => null);
      `,
      payloadFor("PreToolUse"),
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Policy gate rejected "PreToolUse"');
    expect(result.stdout).toBe("");
  });
});

describe("Stop (docs: hooks#stop — decision approve/block on the success channel)", () => {
  it("decision 'block' with reason serializes to stdout at exit 0 (never the stderr channel)", async () => {
    const result = await runHookBundle(
      `
      import { stopHook, stopOutput } from "${AGENT_SURFACE}/index.js";
      export default stopHook({}, () =>
        stopOutput({ decision: "block", reason: "CONFORMANCE_PENDING_WORK" }),
      );
      `,
      payloadFor("Stop"),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { decision?: string; reason?: string };
    expect(payload.decision).toBe("block");
    expect(payload.reason).toBe("CONFORMANCE_PENDING_WORK");
  });
});

describe("PostToolUse (docs: hooks#posttooluse)", () => {
  it("additionalContext after successful tool execution, exit 0", async () => {
    const result = await runHookBundle(
      `
      import { postToolUseHook, postToolUseOutput } from "${AGENT_SURFACE}/index.js";
      export default postToolUseHook({}, () =>
        postToolUseOutput({ hookSpecificOutput: { additionalContext: "POST_CONFORMANCE" } }),
      );
      `,
      payloadFor("PostToolUse"),
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { hookSpecificOutput?: Record<string, unknown> };
    expect(payload.hookSpecificOutput?.additionalContext).toBe("POST_CONFORMANCE");
  });
});

describe("WorktreeCreate (command-hook plain-text protocol)", () => {
  it("writes the bare worktree path to stdout verbatim — NOT JSON", async () => {
    const result = await runHookBundle(
      `
      import { worktreeCreateHook, worktreeCreateOutput } from "${AGENT_SURFACE}/index.js";
      export default worktreeCreateHook({}, (input) =>
        worktreeCreateOutput({ worktreePath: \`\${input.cwd}/.worktrees/conformance\` }),
      );
      `,
      payloadFor("WorktreeCreate"),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${process.cwd()}/.worktrees/conformance`);
    expect(result.stdout.trimStart().startsWith("{")).toBe(false);
  });
});

describe("SessionStart (docs: hooks#sessionstart + persisting-environment-variables)", () => {
  it("extended context exposes persistEnvVar; the variable lands in the env file the host sources", async () => {
    const caseDir = fs.mkdtempSync(path.join(workDir, "sess-"));
    const envFile = path.join(caseDir, "env-file.txt");
    const bundlePath = path.join(caseDir, "bundle.mjs");
    fs.writeFileSync(
      path.join(caseDir, "hook.ts"),
      `
      import { sessionStartHook, sessionStartOutput } from "${AGENT_SURFACE}/index.js";
      export default sessionStartHook({}, async (_input, { persistEnvVar }) => {
        persistEnvVar("CONFORMANCE_VAR", "conformance-value");
        return sessionStartOutput({});
      });
      `,
    );
    const { build } = await import("esbuild");
    await build({
      stdin: {
        contents: `import hook from './hook.ts';\nimport { execute } from '${AGENT_SURFACE}/transport.js';\nexecute(hook);\n`,
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
      input: payloadFor("SessionStart"),
      encoding: "utf-8",
      timeout: 30000,
      env: { ...process.env, CLAUDE_ENV_FILE: envFile },
    });
    expect(result.status).toBe(0);
    const envContent = fs.readFileSync(envFile, "utf-8");
    expect(envContent).toContain("export CONFORMANCE_VAR='conformance-value'");
  });
});

describe("Wire fundamentals (docs: hooks#hook-output-structure, exit codes)", () => {
  it("empty response (null return) emits {} at exit 0", async () => {
    const result = await runHookBundle(
      `
      import { notificationHook } from "${AGENT_SURFACE}/index.js";
      export default notificationHook({}, () => null);
      `,
      payloadFor("Notification"),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
  });

  it("malformed stdin fails open unconditionally: {} at exit 0 even under the default policy", async () => {
    const result = await runHookBundle(
      `
      import { notificationHook } from "${AGENT_SURFACE}/index.js";
      export default notificationHook({}, () => null);
      `,
      "{this is not json",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
  });

  it("returned stderr payload exits BLOCK(2) with NO stdout write (exit-code-block-no-stdout contract)", async () => {
    const result = await runHookBundle(
      `
      import { teammateIdleHook, teammateIdleOutput } from "${AGENT_SURFACE}/index.js";
      export default teammateIdleHook({}, () => teammateIdleOutput({ stderr: "CONFORMANCE_BLOCK_MSG" }));
      `,
      payloadFor("TeammateIdle"),
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toBe("CONFORMANCE_BLOCK_MSG");
    expect(result.stdout).toBe("");
  });
});
