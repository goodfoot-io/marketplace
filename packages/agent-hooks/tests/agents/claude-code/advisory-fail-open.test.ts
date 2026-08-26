/**
 * Advisory-event fail-open table (plan step 2.2, extended per the
 * HookBlockError fix): for every one of the 24 advisory events,
 *
 * (a) a plain `Error` thrown under `unexpectedError: "continue"` produces
 *     the empty response wire result — advisory intent preserved for
 *     unrelated bugs. Under that policy, core's `drive()` classifies a plain
 *     handler throw as `{ kind: "response", output: undefined }` (core unit
 *     tests own that classification); this table pins each event's WIRE half:
 *     the transport serializes the empty response to `{}` on stdout at
 *     exit 0.
 * (b) a `HookBlockError` thrown under the same policy still produces the
 *     block wire result with `continue: false` + `stopReason` — the
 *     in-flight block decision survives the crash mid-computation because
 *     `drive()` classifies it before consulting policy.
 */

import { describe, expect, it } from "vitest";
import { ADVISORY_EVENTS } from "../../../src/agents/claude-code/index.js";
import { createClaudeCodeTransport } from "../../../src/agents/claude-code/transport.js";
import { HookBlockError } from "../../../src/core/transport.js";

const REASON = "blocked: in-flight decision";

describe("advisory events fail open for unrelated errors", () => {
  it.each([...ADVISORY_EVENTS])("%s: plain Error under 'continue' → empty response wire result", (event) => {
    const transport = createClaudeCodeTransport(event, "continue");
    const result = transport.finalize({ kind: "response", output: undefined });
    expect(result).toEqual({ stdout: "{}", exitCode: 0 });
    expect(result.stderr).toBeUndefined();
  });

  it.each([...ADVISORY_EVENTS])("%s: HookBlockError under 'continue' → continue:false + stopReason", (event) => {
    const transport = createClaudeCodeTransport(event, "continue");
    const result = transport.finalize({ kind: "block", error: new HookBlockError(REASON) });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBeUndefined();
    expect(JSON.parse(result.stdout ?? "")).toEqual({ continue: false, stopReason: REASON });
  });

  it("no advisory event translates a block into a native tool-call deny shape", () => {
    for (const event of ADVISORY_EVENTS) {
      const transport = createClaudeCodeTransport(event, "continue");
      const result = transport.finalize({ kind: "block", error: new HookBlockError(REASON) });
      const payload = JSON.parse(result.stdout ?? "") as Record<string, unknown>;
      expect(payload.decision).toBeUndefined();
      expect(payload.hookSpecificOutput).toBeUndefined();
    }
  });
});
