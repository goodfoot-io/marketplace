/**
 * Manifest-shape tests for the Antigravity build branch.
 *
 * The oracle is `src/agents/antigravity/CONTRACT.md`. Each assertion below
 * names the rule it enforces, because the shape differs from every other
 * agent's in ways that look like mistakes if read against them: hook names at
 * the top level, only two events grouped under a matcher, and commands
 * relative to the manifest rather than absolute or `${PLUGIN_ROOT}`-prefixed.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type AntigravityHooksJson,
  analyzeAntigravityHookFile,
  runAntigravityCli,
  validateAntigravityArgs,
} from "../../../src/agents/antigravity/cli-support.js";

const SURFACE = path.resolve(__dirname, "..", "..", "..", "src", "agents", "antigravity");

let workDir: string;
let previousCwd: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-antigravity-cli-"));
  previousCwd = process.cwd();
});

afterEach(() => {
  process.chdir(previousCwd);
  fs.rmSync(workDir, { recursive: true, force: true });
});

function writeHook(name: string, body: string): string {
  const dir = path.join(workDir, "src");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.ts`);
  fs.writeFileSync(filePath, body);
  return filePath;
}

async function build(): Promise<AntigravityHooksJson> {
  process.chdir(workDir);
  const manifestPath = path.join(workDir, "plugin", "hooks.json");
  await runAntigravityCli({
    input: "src/**/*.ts",
    output: manifestPath,
    loaderFlags: [],
    sourcemap: false,
  });
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as AntigravityHooksJson;
}

describe("analyzeAntigravityHookFile", () => {
  it("recovers the event, matcher, and timeout from the default export", () => {
    const filePath = writeHook(
      "guard",
      `import { preToolUseHook } from "${SURFACE}/index.js";
       export default preToolUseHook({ matcher: "browser_.*", timeout: 4500 }, () => undefined);`,
    );
    expect(analyzeAntigravityHookFile(filePath)).toEqual({
      hookEventName: "PreToolUse",
      matcher: "browser_.*",
      timeout: 4500,
    });
  });

  it("returns undefined for a file whose default export is not a hook factory", () => {
    const filePath = writeHook("helper", `export default function helper() { return 1; }`);
    expect(analyzeAntigravityHookFile(filePath)).toBeUndefined();
  });
});

describe("generated hooks.json", () => {
  it("keys the manifest by hook name, not by event — the host merges same-named entries", async () => {
    writeHook(
      "lint-checker",
      `import { postToolUseHook } from "${SURFACE}/index.js";
       export default postToolUseHook({ matcher: "run_command" }, () => undefined);`,
    );
    const manifest = await build();
    expect(Object.keys(manifest)).toStrictEqual(["lint-checker"]);
    expect(manifest["lint-checker"]).toHaveProperty("PostToolUse");
  });

  it("wraps the two tool events in a matcher group and leaves the other three flat", async () => {
    writeHook(
      "gate",
      `import { preToolUseHook } from "${SURFACE}/index.js";
       export default preToolUseHook({ matcher: "run_command" }, () => undefined);`,
    );
    writeHook(
      "reminder",
      `import { preInvocationHook } from "${SURFACE}/index.js";
       export default preInvocationHook({}, () => undefined);`,
    );
    const manifest = await build();

    const grouped = manifest.gate?.PreToolUse;
    expect(grouped).toStrictEqual([
      { matcher: "run_command", hooks: [{ type: "command", command: expect.any(String), timeout: 30 }] },
    ]);

    const flat = manifest.reminder?.PreInvocation;
    expect(flat).toStrictEqual([{ type: "command", command: expect.any(String), timeout: 30 }]);
  });

  it('defaults a grouped event with no matcher to "*", which the host reads as every tool', async () => {
    writeHook(
      "catch-all",
      `import { preToolUseHook } from "${SURFACE}/index.js";
       export default preToolUseHook({}, () => undefined);`,
    );
    const manifest = await build();
    expect(manifest["catch-all"]?.PreToolUse?.[0]?.matcher).toBe("*");
  });

  it("emits commands relative to the manifest, because that is the working directory the host uses", async () => {
    writeHook(
      "gate",
      `import { preToolUseHook } from "${SURFACE}/index.js";
       export default preToolUseHook({}, () => undefined);`,
    );
    const manifest = await build();
    const command = manifest.gate?.PreToolUse?.[0]?.hooks[0]?.command ?? "";
    expect(command).toBe('node "./bin/gate.mjs"');
    expect(fs.existsSync(path.join(workDir, "plugin", "bin", "gate.mjs"))).toBe(true);
  });

  it("converts the source timeout from milliseconds to the seconds the host expects", async () => {
    writeHook(
      "slow",
      `import { stopHook } from "${SURFACE}/index.js";
       export default stopHook({ timeout: 4500 }, () => undefined);`,
    );
    const manifest = await build();
    expect(manifest.slow?.Stop?.[0]?.timeout).toBe(5);
  });
});

describe("validateAntigravityArgs", () => {
  it("rejects a scaffold naming an event this agent does not have", () => {
    expect(
      validateAntigravityArgs({
        input: "",
        output: "hooks.json",
        loaderFlags: [],
        scaffold: "x",
        hooks: "SessionStart",
      }),
    ).toMatch(/Unknown Antigravity hook name/);
  });

  it("accepts the five events case-insensitively", () => {
    expect(
      validateAntigravityArgs({
        input: "",
        output: "hooks.json",
        loaderFlags: [],
        scaffold: "x",
        hooks: "pretooluse,Stop,postInvocation",
      }),
    ).toBeUndefined();
  });

  it("requires an input glob in build mode", () => {
    expect(validateAntigravityArgs({ input: "", output: "hooks.json", loaderFlags: [] })).toMatch(/-i\/--input/);
  });
});
