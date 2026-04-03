import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeHookFile, generateHooksJson } from "../src/cli.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-hooks-test-"));
  tempDirs.push(directory);
  return directory;
}

describe("cli helpers", () => {
  it("extract metadata from an exported hook factory", () => {
    const directory = createTempDir();
    const sourcePath = path.join(directory, "hook.ts");
    fs.writeFileSync(
      sourcePath,
      `
        import { preToolUseHook } from "../src/index.js";
        export default preToolUseHook({ matcher: "Bash", timeout: 2500, statusMessage: "Checking" }, () => undefined);
      `,
    );

    expect(analyzeHookFile(sourcePath)).toEqual({
      hookEventName: "PreToolUse",
      matcher: "Bash",
      timeout: 2500,
      statusMessage: "Checking",
    });
  });

  it("generates repo-root commands and omits matcher for unsupported events", () => {
    const compiledHooks = [
      {
        sourcePath: "/repo/src/session-start.ts",
        outputPath: "/repo/.codex/bin/session-start.abc123.mjs",
        outputFilename: "session-start.abc123.mjs",
        metadata: {
          hookEventName: "SessionStart" as const,
          matcher: "startup",
          timeout: 2500,
          statusMessage: "Loading",
        },
      },
      {
        sourcePath: "/repo/src/user-prompt-submit.ts",
        outputPath: "/repo/.codex/bin/user-prompt-submit.def456.mjs",
        outputFilename: "user-prompt-submit.def456.mjs",
        metadata: {
          hookEventName: "UserPromptSubmit" as const,
          matcher: "ignored",
          timeout: 1500,
        },
      },
    ];

    expect(generateHooksJson(compiledHooks, "/repo/.codex/hooks.json")).toEqual({
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [
              {
                type: "command",
                command: 'node "$(git rev-parse --show-toplevel)/.codex/bin/session-start.abc123.mjs"',
                timeout: 3,
                statusMessage: "Loading",
              },
            ],
          },
        ],
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command: 'node "$(git rev-parse --show-toplevel)/.codex/bin/user-prompt-submit.def456.mjs"',
                timeout: 2,
              },
            ],
          },
        ],
      },
    });
  });
});
