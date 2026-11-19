import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  analyzeCursorHookFile,
  type CursorHooksJson,
  detectCursorCommandContext,
  generateCursorHooksJson,
  resolveCursorOutput,
  runCursorCli,
} from "../../../src/agents/cursor/cli-support.js";
import { parseArgs, validateArgs } from "../../../src/cli.js";

const SURFACE = path.resolve(__dirname, "../../../src/agents/cursor");
let root: string;
let previousCwd: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-hooks-"));
  previousCwd = process.cwd();
});
afterEach(() => {
  process.chdir(previousCwd);
  fs.rmSync(root, { recursive: true, force: true });
});

function write(relative: string, contents: string): string {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  return file;
}
function hook(relative: string, event: string, config = "{}", reply = "undefined"): string {
  return write(
    relative,
    `import { ${event}Hook, ${event}Output } from ${JSON.stringify(`${SURFACE}/index.js`)};
export default ${event}Hook(${config}, () => ${reply});`,
  );
}
async function build(output = "", extra = {}): Promise<CursorHooksJson> {
  process.chdir(root);
  const result = await runCursorCli({ input: "src/**/*.ts", output, loaderFlags: [], sourcemap: false, ...extra });
  return JSON.parse(fs.readFileSync(result.outputPath, "utf8"));
}
function execute(command: string, cwd: string, pluginRoot?: string) {
  const env = { ...process.env };
  delete env.CURSOR_PLUGIN_ROOT;
  if (pluginRoot) env.CURSOR_PLUGIN_ROOT = pluginRoot;
  return spawnSync("sh", ["-c", command], { cwd, env, input: "{}", encoding: "utf8", timeout: 10000 });
}

describe("Cursor build-time config", () => {
  it("extracts aliases, quoted keys, milliseconds, and explicit false", () => {
    const file = write(
      "guard.ts",
      `import { preToolUseHook as gate } from "@goodfoot/agent-hooks/cursor";
export default (gate({ "matcher": "Shell", timeout: 4500, failClosed: false }, () => undefined));`,
    );
    expect(analyzeCursorHookFile(file)).toEqual({
      hookEventName: "preToolUse",
      matcher: "Shell",
      timeout: 4500,
      failClosed: false,
    });
  });
  it("recognizes namespace imports and preserves loopLimit null", () => {
    const file = write(
      "stop.ts",
      `import * as cursor from "@goodfoot/agent-hooks/cursor";
export default cursor.stopHook({ loopLimit: null }, () => undefined);`,
    );
    expect(analyzeCursorHookFile(file)).toEqual({ hookEventName: "stop", loopLimit: null });
  });
  it("does not misclassify a Claude Code factory with the same name", () => {
    const file = write(
      "other.ts",
      `import { sessionStartHook } from "@goodfoot/agent-hooks/claude-code";
export default sessionStartHook({}, () => undefined);`,
    );
    expect(analyzeCursorHookFile(file)).toBeUndefined();
  });
  it.each([
    "settings",
    "{ ...settings }",
    "{ timeout }",
    "{ timeout: 2 * 1000 }",
    "{ failClosed: flag }",
    "{ failClosed: null }",
    "{ loop_limit: 5 }",
    "{ timeout: 0 }",
    "{ unexpectedError: 'continue' }",
  ])("rejects ambiguous or invalid permission metadata %s", (config) => {
    expect(() => analyzeCursorHookFile(hook("bad.ts", "preToolUse", config))).toThrow();
  });
  it("rejects a session matcher, rather than inventing matcher-based identities", () => {
    expect(() => analyzeCursorHookFile(hook("bad.ts", "sessionStart", '{ matcher: "startup" }'))).toThrow(/matcher/);
  });
  it("accepts cursor in common argument validation and reserves output resolution for the target", () => {
    const args = parseArgs(["--agent", "cursor", "-i", "src/**/*.ts"]);
    expect(validateArgs(args)).toBeUndefined();
    expect(() => resolveCursorOutput(args, root)).toThrow(/requires -o/);
    expect(
      validateArgs(parseArgs(["--agent", "cursor", "--scaffold", "new", "--hooks", "SessionStart"])),
    ).toBeUndefined();
  });
});

describe("Cursor flat versioned manifest", () => {
  it("keeps two sessionStart scripts and tool scripts separate, with no type wrappers", async () => {
    write(".cursor-plugin/plugin.json", "{}");
    hook("src/a.ts", "sessionStart", "{}", 'sessionStartOutput({ additionalContext: "first" })');
    hook("src/b.ts", "sessionStart");
    hook("src/tool.ts", "postToolUse", '{ matcher: "Shell", timeout: 4500 }');
    const manifest = await build();
    expect(manifest.version).toBe(1);
    expect(manifest.hooks.sessionStart).toEqual([
      { command: "node './hooks/bin/a.mjs'" },
      { command: "node './hooks/bin/b.mjs'" },
    ]);
    expect(manifest.hooks.postToolUse).toEqual([
      { command: "node './hooks/bin/tool.mjs'", matcher: "Shell", timeout: 5 },
    ]);
    expect(JSON.parse(execute(manifest.hooks.sessionStart?.[0]?.command ?? "", root).stdout)).toEqual({
      additional_context: "first",
    });
  });
  it("emits failClosed, ceil(seconds), loop_limit null and zero without changing their meaning", () => {
    const outputPath = path.join(root, "hooks.json");
    const manifest = generateCursorHooksJson(
      [
        { outputPath: "guard.mjs", metadata: { hookEventName: "preToolUse", timeout: 1 } },
        {
          outputPath: "prompt.mjs",
          metadata: { hookEventName: "beforeSubmitPrompt", failClosed: false, matcher: "UserPromptSubmit" },
        },
        { outputPath: "stop.mjs", metadata: { hookEventName: "stop", loopLimit: null } },
        { outputPath: "sub.mjs", metadata: { hookEventName: "subagentStop", loopLimit: 0, matcher: "explore" } },
      ],
      outputPath,
    );
    expect(manifest.hooks.preToolUse?.[0]).toMatchObject({ timeout: 1, failClosed: true });
    expect(manifest.hooks.beforeSubmitPrompt?.[0]).toMatchObject({ failClosed: false, matcher: "UserPromptSubmit" });
    expect(manifest.hooks.stop?.[0]).toMatchObject({ loop_limit: null });
    expect(manifest.hooks.subagentStop?.[0]).toMatchObject({ loop_limit: 0, matcher: "explore" });
  });
  it("uses the plugin marker from arbitrarily nested source directories", () => {
    write(".cursor-plugin/plugin.json", "{}");
    expect(resolveCursorOutput({ output: "" }, path.join(root, "a/b/c/d/e"))).toBe(path.join(root, "hooks/hooks.json"));
    expect(detectCursorCommandContext(path.join(root, "a/b/c/d/e/hooks.json"))).toEqual({ mode: "plugin", root });
  });
  it("keeps same-basename hooks distinct", async () => {
    write(".cursor-plugin/plugin.json", "{}");
    hook("src/a/same.ts", "sessionStart", "{}", 'sessionStartOutput({ additionalContext: "a" })');
    hook("src/b/same.ts", "sessionStart", "{}", 'sessionStartOutput({ additionalContext: "b" })');
    const manifest = await build();
    const commands = manifest.hooks.sessionStart?.map((script) => script.command) ?? [];
    expect(new Set(commands).size).toBe(2);
    expect(commands.map((command) => JSON.parse(execute(command, root).stdout).additional_context).sort()).toEqual([
      "a",
      "b",
    ]);
  });
  it("rebuilds byte-identical manifests and prunes hashes when switching to stable names", async () => {
    hook("src/start.ts", "sessionStart", "{}", 'sessionStartOutput({ additionalContext: "first" })');
    await build(".cursor/hooks.json");
    const file = path.join(root, ".cursor/hooks.json");
    const first = fs.readFileSync(file, "utf8");
    await build(".cursor/hooks.json");
    expect(fs.readFileSync(file, "utf8")).toBe(first);
    const oldBundle = fs.readdirSync(path.join(root, ".cursor/bin"))[0];
    write(".cursor/bin/manual.mjs", "// leave handwritten scripts alone");
    hook("src/start.ts", "sessionStart", "{}", 'sessionStartOutput({ additionalContext: "second" })');
    const manifest = await build(".cursor/hooks.json", { stableNames: true });
    const files = fs.readdirSync(path.join(root, ".cursor/bin"));
    expect(files).not.toContain(oldBundle);
    expect(files).toContain("manual.mjs");
    const result = execute(manifest.hooks.sessionStart?.[0]?.command ?? "", root);
    expect(JSON.parse(result.stdout)).toEqual({ additional_context: "second" });
  });
  it("does not modify the old manifest when validation fails", async () => {
    write(".cursor-plugin/plugin.json", "{}");
    const manifestPath = write("hooks/hooks.json", '{"previous":true}\n');
    hook("src/good.ts", "sessionStart");
    hook("src/bad.ts", "preToolUse", "{ failClosed: unknownSetting }");
    await expect(build()).rejects.toThrow();
    expect(fs.readFileSync(manifestPath, "utf8")).toBe('{"previous":true}\n');
    expect(fs.existsSync(path.join(root, "hooks/bin"))).toBe(false);
  });
  it("refuses an empty input set rather than replacing hooks with an empty manifest", async () => {
    await expect(build("hooks.json")).rejects.toThrow(/No Cursor hooks/);
    expect(fs.existsSync(path.join(root, "hooks.json"))).toBe(false);
  });
});

describe("Cursor command working directories", () => {
  it("executes relocated plugin hooks and stop hooks from their different native working directories", async () => {
    write(".cursor-plugin/plugin.json", "{}");
    for (const event of ["sessionStart", "stop", "subagentStop"]) {
      hook(
        `src/${event}.ts`,
        event,
        "{}",
        `${event}Output(${event === "sessionStart" ? '{ additionalContext: "ready" }' : '{ followupMessage: "finish" }'})`,
      );
    }
    const manifest = await build();
    const installed = path.join(root, "installed plugin's $HOME `echo unsafe`");
    fs.mkdirSync(installed);
    fs.cpSync(path.join(root, "hooks"), path.join(installed, "hooks"), { recursive: true });
    const workspace = path.join(root, "workspace");
    fs.mkdirSync(workspace);
    const ordinary = execute(manifest.hooks.sessionStart?.[0]?.command ?? "", installed);
    expect(ordinary.status).toBe(0);
    expect(JSON.parse(ordinary.stdout)).toEqual({ additional_context: "ready" });
    for (const event of ["stop", "subagentStop"] as const) {
      const command = manifest.hooks[event]?.[0]?.command ?? "";
      expect(command).toContain("CURSOR_PLUGIN_ROOT");
      const result = execute(command, workspace, installed);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ followup_message: "finish" });
      const missing = execute(command, workspace);
      expect(missing.status).not.toBe(0);
      expect(missing.stderr).toContain("CURSOR_PLUGIN_ROOT is required");
    }
  });
  it("executes project hooks from the project root without Git or plugin env", async () => {
    hook("src/project.ts", "preToolUse");
    const manifest = await build(".cursor/hooks.json");
    expect(detectCursorCommandContext(path.join(root, ".cursor/hooks.json"))).toEqual({ mode: "project", root });
    const command = manifest.hooks.preToolUse?.[0]?.command ?? "";
    expect(command).toMatch(/^node '\.\/\.cursor\/bin\/project\.[a-f0-9]{8}\.mjs'$/);
    const result = execute(command, root);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ permission: "allow" });
  });
  it("quotes literal shell metacharacters in bundle names and absolute paths", async () => {
    hook("src/$HOME `echo nope` it's.ts", "sessionStart");
    const manifest = await build("artifacts/.cursor-like/hooks.json");
    expect(detectCursorCommandContext(path.join(root, "artifacts/.cursor-like/hooks.json"))).toEqual({
      mode: "absolute",
    });
    const result = execute(manifest.hooks.sessionStart?.[0]?.command ?? "", os.tmpdir());
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("{}");
  });
  it("supports explicit plugin mode without a marker", async () => {
    hook("src/stop.ts", "stop");
    const manifest = await build("", { pluginRoot: true });
    expect(fs.existsSync(path.join(root, "hooks/hooks.json"))).toBe(true);
    expect(manifest.hooks.stop?.[0]?.command).toContain("CURSOR_PLUGIN_ROOT");
  });
  it("distinguishes user hooks from project hooks", () => {
    const user = path.join(os.homedir(), ".cursor");
    expect(detectCursorCommandContext(path.join(user, "hooks.json"))).toEqual({ mode: "user", root: user });
  });
});
