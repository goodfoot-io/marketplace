import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeCodexHookFile as analyzeHookFile,
  detectCodexCommandContext as detectCommandContext,
  generateCodexHooksJson as generateHooksJson,
} from "../../src/agents/codex/cli-support.js";
import { parseArgs } from "../../src/cli.js";

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
        import { preToolUseHook } from "../../src/agents/codex/index.js";
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
      {
        sourcePath: "/repo/src/pre-compact.ts",
        outputPath: "/repo/.codex/bin/pre-compact.ghi789.mjs",
        outputFilename: "pre-compact.ghi789.mjs",
        metadata: {
          hookEventName: "PreCompact" as const,
          matcher: "manual",
        },
      },
    ];

    expect(generateHooksJson(compiledHooks, "/repo/.codex/hooks.json", "node", { mode: "codex-local" })).toEqual({
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
        PreCompact: [
          {
            matcher: "manual",
            hooks: [
              {
                type: "command",
                command: 'node "$(git rev-parse --show-toplevel)/.codex/bin/pre-compact.ghi789.mjs"',
              },
            ],
          },
        ],
      },
    });
  });

  it(`emits \${PLUGIN_ROOT}-relative commands in plugin mode`, () => {
    const compiledHooks = [
      {
        sourcePath: "/build/src/session-start.ts",
        outputPath: "/build/my-plugin/hooks/session-start.mjs",
        outputFilename: "session-start.mjs",
        metadata: { hookEventName: "SessionStart" as const, matcher: "startup" },
      },
    ];

    expect(
      generateHooksJson(compiledHooks, "/build/my-plugin/hooks/hooks.json", "node", {
        mode: "plugin",
        pluginRoot: "/build/my-plugin",
      }),
    ).toEqual({
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [{ type: "command", command: `node "\${PLUGIN_ROOT}/hooks/session-start.mjs"` }],
          },
        ],
      },
    });
  });

  it("produces byte-identical output across repeated calls (trust stability)", () => {
    const compiledHooks = [
      {
        sourcePath: "/build/src/pre.ts",
        outputPath: "/build/plugin/hooks/pre.mjs",
        outputFilename: "pre.mjs",
        metadata: { hookEventName: "PreToolUse" as const, matcher: "Bash" },
      },
    ];
    const context = { mode: "plugin" as const, pluginRoot: "/build/plugin" };
    const outputPath = "/build/plugin/hooks/hooks.json";
    const first = JSON.stringify(generateHooksJson(compiledHooks, outputPath, "node", context));
    const second = JSON.stringify(generateHooksJson(compiledHooks, outputPath, "node", context));
    expect(first).toEqual(second);
  });

  it("auto-detects plugin context by walking up to a .codex-plugin/ marker", () => {
    const directory = createTempDir();
    const pluginRoot = path.join(directory, "my-plugin");
    fs.mkdirSync(path.join(pluginRoot, ".codex-plugin"), { recursive: true });
    fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
    const outputPath = path.join(pluginRoot, "hooks", "hooks.json");
    expect(detectCommandContext(outputPath, false)).toEqual({ mode: "plugin", pluginRoot });
  });

  it("falls back to absolute mode outside .codex/ and without a plugin marker", () => {
    const directory = createTempDir();
    const outputPath = path.join(directory, "hooks", "hooks.json");
    expect(detectCommandContext(outputPath, false)).toEqual({ mode: "absolute" });
  });

  it("treats --plugin-root as plugin mode with the parent of hooks/ as the root", () => {
    const directory = createTempDir();
    const pluginRoot = path.join(directory, "my-plugin");
    const outputPath = path.join(pluginRoot, "hooks", "hooks.json");
    expect(detectCommandContext(outputPath, true)).toEqual({ mode: "plugin", pluginRoot });
  });
});

describe("parseArgs", () => {
  it("defaults sourcemap to false", () => {
    expect(parseArgs([]).sourcemap).toBe(false);
  });

  it("parses --sourcemap as true", () => {
    expect(parseArgs(["--sourcemap"]).sourcemap).toBe(true);
  });

  it("parses --no-sourcemap as false", () => {
    expect(parseArgs(["--no-sourcemap"]).sourcemap).toBe(false);
  });
});
