import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldProject, validateHookNames } from "../src/scaffold.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-hooks-scaffold-"));
  tempDirs.push(directory);
  return directory;
}

describe("scaffold", () => {
  it("validates supported hook names", () => {
    expect(validateHookNames(["sessionstart", "pretooluse"])).toEqual({
      valid: true,
      normalized: ["SessionStart", "PreToolUse"],
    });
    expect(validateHookNames(["bogus"]).valid).toBe(false);
  });

  it("creates a starter project", () => {
    const root = createTempDir();
    const target = path.join(root, "demo");
    scaffoldProject({
      directory: target,
      hooks: ["SessionStart", "PreToolUse"],
      outputPath: ".codex/hooks.json",
    });

    expect(fs.existsSync(path.join(target, "src", "session-start.ts"))).toBe(true);
    expect(fs.existsSync(path.join(target, "src", "pre-tool-use.ts"))).toBe(true);
    expect(fs.readFileSync(path.join(target, "package.json"), "utf-8")).toContain("@goodfoot/codex-hooks");
  });
});
