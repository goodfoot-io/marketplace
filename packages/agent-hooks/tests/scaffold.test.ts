import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldProject } from "../src/scaffold.js";

const ownPackageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "claude-code-hooks-scaffold-"));
  tempDirs.push(directory);
  return directory;
}

describe("scaffold", () => {
  it("creates a starter project", () => {
    const root = createTempDir();
    const target = path.join(root, "demo");
    scaffoldProject({
      directory: target,
      hooks: ["Stop", "PreToolUse"],
      outputPath: "dist/hooks.json",
    });

    expect(fs.existsSync(path.join(target, "src", "stop.ts"))).toBe(true);
    expect(fs.existsSync(path.join(target, "src", "pre-tool-use.ts"))).toBe(true);

    const generatedPackageJson = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf-8")) as {
      dependencies: Record<string, string>;
    };
    expect(generatedPackageJson.dependencies["@goodfoot/agent-hooks"]).toBeDefined();

    // The scaffolded project's pin must track this package's own version so a
    // release that bumps package.json without updating the scaffold fails here.
    const ownVersion = (JSON.parse(fs.readFileSync(ownPackageJsonPath, "utf-8")) as { version: string }).version;
    expect(generatedPackageJson.dependencies["@goodfoot/agent-hooks"]).toBe(`^${ownVersion}`);
  });
});
