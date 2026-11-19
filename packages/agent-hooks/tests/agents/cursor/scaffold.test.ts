import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HOOK_EVENT_NAMES } from "../../../src/agents/cursor/events.js";
import { parseHookNames, scaffoldProject } from "../../../src/agents/cursor/scaffold.js";

const require = createRequire(import.meta.url);
const PACKAGE = path.resolve(__dirname, "../../..");
const CLI = path.join(PACKAGE, "src/cli.ts");
const TSX = require.resolve("tsx/cli");
let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-scaffold-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function cli(args: string[], cwd = root) {
  return spawnSync(process.execPath, [TSX, CLI, "--agent", "cursor", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 30000,
  });
}

describe("Cursor scaffolding", () => {
  it("normalizes native/Pascal names, removes duplicates, and rejects unknown or empty lists", () => {
    expect(parseHookNames("SessionStart, posttooluse, SessionStart,Stop")).toEqual([
      "sessionStart",
      "postToolUse",
      "stop",
    ]);
    expect(() => parseHookNames("SessionStart,SessionEnd")).toThrow(/Unknown Cursor/);
    expect(() => parseHookNames(" , ")).toThrow(/at least one/);
  });
  it("creates a discoverable plugin and all six source/test pairs through the actual CLI", () => {
    const directory = path.join(root, "my-plugin");
    const result = cli(["--scaffold", directory, "--hooks", HOOK_EVENT_NAMES.join(",")]);
    expect(result.status, result.stderr).toBe(0);
    const plugin = JSON.parse(fs.readFileSync(path.join(directory, ".cursor-plugin/plugin.json"), "utf8"));
    expect(plugin).toMatchObject({ name: "my-plugin", version: "1.0.0" });
    expect(plugin.hooks).toBeUndefined();
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
    const current = JSON.parse(fs.readFileSync(path.join(PACKAGE, "package.json"), "utf8"));
    expect(pkg.dependencies["@goodfoot/agent-hooks"]).toBe(`^${current.version}`);
    expect(pkg.scripts.build).toContain("--agent cursor");
    expect(pkg.scripts.build).toContain("hooks/hooks.json");
    expect(fs.readdirSync(path.join(directory, "src"))).toHaveLength(6);
    expect(fs.readdirSync(path.join(directory, "test"))).toHaveLength(6);
    for (const name of fs.readdirSync(path.join(directory, "src"))) {
      expect(fs.readFileSync(path.join(directory, "src", name), "utf8")).toContain(
        'from "@goodfoot/agent-hooks/cursor"',
      );
    }
  });
  it("records a custom output path in plugin.json and refuses an escaping path", () => {
    const directory = path.join(root, "custom");
    scaffoldProject({ directory, hooks: "sessionStart", outputPath: "generated/cursor.json" });
    const plugin = JSON.parse(fs.readFileSync(path.join(directory, ".cursor-plugin/plugin.json"), "utf8"));
    expect(plugin.hooks).toBe("./generated/cursor.json");
    for (const outputPath of ["../escaped.json", "/absolute.json", "not-json"]) {
      const invalid = path.join(root, "invalid");
      expect(() => scaffoldProject({ directory: invalid, hooks: "stop", outputPath })).toThrow(/plugin-relative/);
      expect(fs.existsSync(invalid)).toBe(false);
    }
  });
  it("prevents generated builds from overwriting package or plugin metadata", () => {
    for (const outputPath of ["package.json", "tsconfig.json", "biome.json", ".cursor-plugin/plugin.json"]) {
      const directory = path.join(root, "invalid");
      expect(() => scaffoldProject({ directory, hooks: "stop", outputPath })).toThrow(/must not overwrite/);
      expect(fs.existsSync(directory)).toBe(false);
    }
  });
  it("rejects unsupported hook types before creating files", () => {
    const directory = path.join(root, "invalid");
    const result = cli(["--scaffold", directory, "--hooks", "SessionStart,SessionEnd"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown Cursor");
    expect(fs.existsSync(directory)).toBe(false);
  });
  it("will not overwrite a user directory", () => {
    const directory = path.join(root, "existing");
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "keep.txt"), "keep");
    expect(() => scaffoldProject({ directory, hooks: "stop", outputPath: "hooks/hooks.json" })).toThrow(
      /already exists/,
    );
    expect(fs.readFileSync(path.join(directory, "keep.txt"), "utf8")).toBe("keep");
  });
  it("builds a Cursor source via the actual CLI and default plugin output", () => {
    fs.mkdirSync(path.join(root, ".cursor-plugin"));
    fs.mkdirSync(path.join(root, "src"));
    const surface = path.join(PACKAGE, "src/agents/cursor/index.js");
    fs.writeFileSync(
      path.join(root, "src/start.ts"),
      `import { sessionStartHook, sessionStartOutput } from ${JSON.stringify(surface)};
export default sessionStartHook({}, () => sessionStartOutput({ additionalContext: "ready" }));`,
    );
    const result = cli(["-i", "src/**/*.ts"]);
    expect(result.status, result.stderr).toBe(0);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "hooks/hooks.json"), "utf8"));
    expect(manifest.version).toBe(1);
    expect(manifest.hooks.sessionStart).toEqual([{ command: "node './hooks/bin/start.mjs'" }]);
  });
});
