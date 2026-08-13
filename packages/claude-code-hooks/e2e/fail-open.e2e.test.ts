/**
 * E2E tests for the `unexpectedError: "continue"` fail-open policy.
 *
 * Verifies that a real compiled hook — built by the CLI and run as a
 * standalone process, exactly as Codex/Claude Code would invoke it — emits
 * `{}` and exits 0 when its handler throws or when it receives malformed
 * stdin, instead of surfacing a failed-hook banner.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runTsxCli } from "./test-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLI_PATH = path.join(__dirname, "..", "src", "cli.ts");
const FIXTURES_DIR = path.join(__dirname, "fixtures");

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "claude-code-hooks-fail-open-e2e-"));
  tempDirs.push(directory);
  return directory;
}

function buildFixture(fixtureName: string, outputDir: string): string {
  const outputPath = path.join(outputDir, "hooks.json");
  const result = runTsxCli(CLI_PATH, ["-i", path.join(FIXTURES_DIR, fixtureName), "-o", outputPath], {
    cwd: path.dirname(CLI_PATH),
  });
  expect(result.status).toBe(0);
  expect(fs.existsSync(outputPath)).toBe(true);

  // Commands in hooks.json are always emitted relative to $CLAUDE_PLUGIN_ROOT
  // or $CLAUDE_PROJECT_DIR (never an absolute path), so resolve the compiled
  // file directly from the build directory instead of parsing the command.
  // Compiled .mjs files are always written to a "bin" subdirectory next to
  // hooks.json (see `buildDir` in src/cli.ts).
  const binDir = path.join(outputDir, "bin");
  const compiledFile = fs.readdirSync(binDir).find((entry) => entry.endsWith(".mjs"));
  expect(compiledFile).toBeDefined();
  return path.join(binDir, compiledFile ?? "");
}

describe("E2E: unexpectedError: continue fail-open policy", () => {
  it("emits {} and exits 0 when the handler throws", () => {
    const outputDir = createTempDir();
    const compiledPath = buildFixture("fail-open-user-prompt-submit-hook.ts", outputDir);

    const run = spawnSync("node", [compiledPath], {
      input: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "test-session",
        cwd: "/tmp",
        transcript_path: "/tmp/transcript.jsonl",
        prompt: "hello",
      }),
      encoding: "utf-8",
      timeout: 5000,
    });

    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({});
  });

  it("emits {} and exits 0 for malformed stdin", () => {
    const outputDir = createTempDir();
    const compiledPath = buildFixture("fail-open-user-prompt-submit-hook.ts", outputDir);

    const run = spawnSync("node", [compiledPath], {
      input: "not valid json",
      encoding: "utf-8",
      timeout: 5000,
    });

    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({});
  });
});
