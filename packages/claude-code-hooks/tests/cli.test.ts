/**
 * Unit tests for CLI functions.
 *
 * Tests:
 * - parseArgs for various input combinations
 * - validateArgs error conditions
 * - analyzeHookFile extracts correct metadata from sample hook files
 * - HOOK_FACTORY_TO_EVENT mapping
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliArgs } from "../src/cli.js";
import {
  analyzeHookFile,
  detectHookContext,
  generateCommandPath,
  HOOK_FACTORY_TO_EVENT,
  parseArgs,
  validateArgs,
} from "../src/cli.js";

describe("HOOK_FACTORY_TO_EVENT", () => {
  it("maps all 23 hook factory names to event names", () => {
    expect(Object.keys(HOOK_FACTORY_TO_EVENT)).toHaveLength(23);
  });

  it("maps preToolUseHook to PreToolUse", () => {
    expect(HOOK_FACTORY_TO_EVENT.preToolUseHook).toBe("PreToolUse");
  });

  it("maps postToolUseHook to PostToolUse", () => {
    expect(HOOK_FACTORY_TO_EVENT.postToolUseHook).toBe("PostToolUse");
  });

  it("maps postToolUseFailureHook to PostToolUseFailure", () => {
    expect(HOOK_FACTORY_TO_EVENT.postToolUseFailureHook).toBe("PostToolUseFailure");
  });

  it("maps notificationHook to Notification", () => {
    expect(HOOK_FACTORY_TO_EVENT.notificationHook).toBe("Notification");
  });

  it("maps userPromptSubmitHook to UserPromptSubmit", () => {
    expect(HOOK_FACTORY_TO_EVENT.userPromptSubmitHook).toBe("UserPromptSubmit");
  });

  it("maps sessionStartHook to SessionStart", () => {
    expect(HOOK_FACTORY_TO_EVENT.sessionStartHook).toBe("SessionStart");
  });

  it("maps sessionEndHook to SessionEnd", () => {
    expect(HOOK_FACTORY_TO_EVENT.sessionEndHook).toBe("SessionEnd");
  });

  it("maps stopHook to Stop", () => {
    expect(HOOK_FACTORY_TO_EVENT.stopHook).toBe("Stop");
  });

  it("maps subagentStartHook to SubagentStart", () => {
    expect(HOOK_FACTORY_TO_EVENT.subagentStartHook).toBe("SubagentStart");
  });

  it("maps subagentStopHook to SubagentStop", () => {
    expect(HOOK_FACTORY_TO_EVENT.subagentStopHook).toBe("SubagentStop");
  });

  it("maps preCompactHook to PreCompact", () => {
    expect(HOOK_FACTORY_TO_EVENT.preCompactHook).toBe("PreCompact");
  });

  it("maps permissionRequestHook to PermissionRequest", () => {
    expect(HOOK_FACTORY_TO_EVENT.permissionRequestHook).toBe("PermissionRequest");
  });

  it("maps setupHook to Setup", () => {
    expect(HOOK_FACTORY_TO_EVENT.setupHook).toBe("Setup");
  });
});

describe("parseArgs", () => {
  it("returns empty values for empty argv", () => {
    const result = parseArgs([]);

    expect(result.input).toBe("");
    expect(result.output).toBe("");
    expect(result.log).toBeUndefined();
    expect(result.logEnvVar).toBeUndefined();
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  it("parses -i/--input flag", () => {
    expect(parseArgs(["-i", "hooks/**/*.ts"]).input).toBe("hooks/**/*.ts");
    expect(parseArgs(["--input", "src/hooks/*.ts"]).input).toBe("src/hooks/*.ts");
  });

  it("parses -o/--output flag", () => {
    expect(parseArgs(["-o", "./dist/hooks.json"]).output).toBe("./dist/hooks.json");
    expect(parseArgs(["--output", "./build/hooks.json"]).output).toBe("./build/hooks.json");
  });

  it("parses --log flag", () => {
    expect(parseArgs(["--log", "./build.log"]).log).toBe("./build.log");
  });

  it("parses --log-env-var flag", () => {
    expect(parseArgs(["--log-env-var", "MY_LOG_FILE"]).logEnvVar).toBe("MY_LOG_FILE");
  });

  it("parses -h/--help flag", () => {
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(parseArgs(["--help"]).help).toBe(true);
  });

  it("parses -v/--version flag", () => {
    expect(parseArgs(["-v"]).version).toBe(true);
    expect(parseArgs(["--version"]).version).toBe(true);
  });

  it("parses multiple flags together", () => {
    const result = parseArgs(["-i", "hooks/**/*.ts", "-o", "./dist/hooks.json", "--log", "./build.log"]);

    expect(result.input).toBe("hooks/**/*.ts");
    expect(result.output).toBe("./dist/hooks.json");
    expect(result.log).toBe("./build.log");
  });

  it("ignores unknown flags", () => {
    const result = parseArgs(["--unknown", "value", "-i", "hooks/*.ts"]);

    expect(result.input).toBe("hooks/*.ts");
  });

  it("handles missing values for flags", () => {
    // If value is missing, it becomes empty string
    const result = parseArgs(["-i"]);

    expect(result.input).toBe("");
  });

  it("handles flags in any order", () => {
    const result = parseArgs(["--log", "./log.txt", "-o", "./out.json", "-i", "src/**/*.ts"]);

    expect(result.input).toBe("src/**/*.ts");
    expect(result.output).toBe("./out.json");
    expect(result.log).toBe("./log.txt");
  });
});

describe("validateArgs", () => {
  it("returns undefined for valid args with input and output", () => {
    const args: CliArgs = {
      input: "hooks/**/*.ts",
      output: "./dist/hooks.json",
      help: false,
      version: false,
    };

    expect(validateArgs(args)).toBeUndefined();
  });

  it("returns undefined when help flag is set", () => {
    const args: CliArgs = {
      input: "",
      output: "",
      help: true,
      version: false,
    };

    expect(validateArgs(args)).toBeUndefined();
  });

  it("returns undefined when version flag is set", () => {
    const args: CliArgs = {
      input: "",
      output: "",
      help: false,
      version: true,
    };

    expect(validateArgs(args)).toBeUndefined();
  });

  it("returns error when input is missing", () => {
    const args: CliArgs = {
      input: "",
      output: "./dist/hooks.json",
      help: false,
      version: false,
    };

    const error = validateArgs(args);

    expect(error).toBe("Missing required argument: -i/--input <glob>");
  });

  it("returns error when output is missing", () => {
    const args: CliArgs = {
      input: "hooks/**/*.ts",
      output: "",
      help: false,
      version: false,
    };

    const error = validateArgs(args);

    expect(error).toBe("Missing required argument: -o/--output <path>");
  });

  it("returns input error first when both missing", () => {
    const args: CliArgs = {
      input: "",
      output: "",
      help: false,
      version: false,
    };

    const error = validateArgs(args);

    expect(error).toBe("Missing required argument: -i/--input <glob>");
  });

  it("returns error when --log and --log-env-var are both set", () => {
    const args: CliArgs = {
      input: "hooks/**/*.ts",
      output: "./dist/hooks.json",
      log: "/tmp/hooks.log",
      logEnvVar: "MY_LOG_FILE",
      help: false,
      version: false,
    };

    const error = validateArgs(args);

    expect(error).toContain("Cannot use --log and --log-env-var together");
  });

  it("accepts --log-env-var without --log", () => {
    const args: CliArgs = {
      input: "hooks/**/*.ts",
      output: "./dist/hooks.json",
      logEnvVar: "MY_LOG_FILE",
      help: false,
      version: false,
    };

    expect(validateArgs(args)).toBeUndefined();
  });
});

describe("analyzeHookFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
  });

  afterEach(() => {
    // Clean up temp files
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      fs.unlinkSync(path.join(tempDir, file));
    }
    fs.rmdirSync(tempDir);
  });

  function writeHookFile(filename: string, content: string): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  it("extracts PreToolUse hook without config", () => {
    const filePath = writeHookFile(
      "pre-tool.ts",
      `
      import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

      export default preToolUseHook({}, (input) => {
        return preToolUseOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata).toBeDefined();
    expect(metadata?.hookEventName).toBe("PreToolUse");
    expect(metadata?.matcher).toBeUndefined();
    expect(metadata?.timeout).toBeUndefined();
  });

  it("extracts PreToolUse hook with matcher", () => {
    const filePath = writeHookFile(
      "bash-hook.ts",
      `
      import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

      export default preToolUseHook({ matcher: 'Bash' }, (input) => {
        return preToolUseOutput({ allow: true });
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PreToolUse");
    expect(metadata?.matcher).toBe("Bash");
  });

  it("extracts PreToolUse hook with timeout", () => {
    const filePath = writeHookFile(
      "timeout-hook.ts",
      `
      import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

      export default preToolUseHook({ timeout: 5000 }, (input) => {
        return preToolUseOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PreToolUse");
    expect(metadata?.timeout).toBe(5000);
  });

  it("extracts PreToolUse hook with matcher and timeout", () => {
    const filePath = writeHookFile(
      "full-config-hook.ts",
      `
      import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

      export default preToolUseHook({ matcher: 'Read|Write', timeout: 10000 }, (input) => {
        return preToolUseOutput({ allow: true });
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PreToolUse");
    expect(metadata?.matcher).toBe("Read|Write");
    expect(metadata?.timeout).toBe(10000);
  });

  it("extracts PostToolUse hook", () => {
    const filePath = writeHookFile(
      "post-tool.ts",
      `
      import { postToolUseHook } from '@goodfoot/claude-code-hooks';

      export default postToolUseHook({ matcher: 'Bash' }, (input) => {
        return { exitCode: 0, stdout: {} };
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PostToolUse");
    expect(metadata?.matcher).toBe("Bash");
  });

  it("extracts SessionStart hook", () => {
    const filePath = writeHookFile(
      "session-start.ts",
      `
      import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';

      export default sessionStartHook({ matcher: 'startup' }, (input) => {
        return sessionStartOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("SessionStart");
    expect(metadata?.matcher).toBe("startup");
  });

  it("extracts Stop hook", () => {
    const filePath = writeHookFile(
      "stop.ts",
      `
      import { stopHook, stopOutput } from '@goodfoot/claude-code-hooks';

      export default stopHook({}, (input) => {
        return stopOutput({ decision: 'approve' });
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("Stop");
  });

  it("extracts PermissionRequest hook", () => {
    const filePath = writeHookFile(
      "permission.ts",
      `
      import { permissionRequestHook, permissionRequestOutput } from '@goodfoot/claude-code-hooks';

      export default permissionRequestHook({ matcher: 'Bash' }, (input) => {
        return permissionRequestOutput({ allow: true });
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PermissionRequest");
    expect(metadata?.matcher).toBe("Bash");
  });

  it("extracts Notification hook", () => {
    const filePath = writeHookFile(
      "notification.ts",
      `
      import { notificationHook, notificationOutput } from '@goodfoot/claude-code-hooks';

      export default notificationHook({}, (input) => {
        return notificationOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("Notification");
  });

  it("extracts UserPromptSubmit hook", () => {
    const filePath = writeHookFile(
      "prompt.ts",
      `
      import { userPromptSubmitHook, userPromptSubmitOutput } from '@goodfoot/claude-code-hooks';

      export default userPromptSubmitHook({}, (input) => {
        return userPromptSubmitOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("UserPromptSubmit");
  });

  it("extracts SubagentStart hook", () => {
    const filePath = writeHookFile(
      "subagent-start.ts",
      `
      import { subagentStartHook } from '@goodfoot/claude-code-hooks';

      export default subagentStartHook({ matcher: 'explore' }, (input) => {
        return { exitCode: 0, stdout: {} };
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("SubagentStart");
    expect(metadata?.matcher).toBe("explore");
  });

  it("extracts SubagentStop hook", () => {
    const filePath = writeHookFile(
      "subagent-stop.ts",
      `
      import { subagentStopHook } from '@goodfoot/claude-code-hooks';

      export default subagentStopHook({}, (input) => {
        return { exitCode: 0, stdout: {} };
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("SubagentStop");
  });

  it("extracts PreCompact hook", () => {
    const filePath = writeHookFile(
      "pre-compact.ts",
      `
      import { preCompactHook, preCompactOutput } from '@goodfoot/claude-code-hooks';

      export default preCompactHook({ matcher: 'manual' }, (input) => {
        return preCompactOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PreCompact");
    expect(metadata?.matcher).toBe("manual");
  });

  it("extracts PostToolUseFailure hook", () => {
    const filePath = writeHookFile(
      "post-failure.ts",
      `
      import { postToolUseFailureHook, postToolUseFailureOutput } from '@goodfoot/claude-code-hooks';

      export default postToolUseFailureHook({ matcher: '.*' }, (input) => {
        return postToolUseFailureOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PostToolUseFailure");
    expect(metadata?.matcher).toBe(".*");
  });

  it("extracts SessionEnd hook", () => {
    const filePath = writeHookFile(
      "session-end.ts",
      `
      import { sessionEndHook, sessionEndOutput } from '@goodfoot/claude-code-hooks';

      export default sessionEndHook({}, (input) => {
        return sessionEndOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("SessionEnd");
  });

  it("returns undefined for non-hook file", () => {
    const filePath = writeHookFile(
      "not-a-hook.ts",
      `
      export function helper() {
        return 'hello';
      }
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata).toBeUndefined();
  });

  it("returns undefined for file without default export", () => {
    const filePath = writeHookFile(
      "named-export.ts",
      `
      import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

      export const myHook = preToolUseHook({}, (input) => {
        return preToolUseOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata).toBeUndefined();
  });

  it("handles async handlers", () => {
    const filePath = writeHookFile(
      "async-hook.ts",
      `
      import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

      export default preToolUseHook({ matcher: 'Bash' }, async (input) => {
        await someAsyncOperation();
        return preToolUseOutput({ allow: true });
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PreToolUse");
    expect(metadata?.matcher).toBe("Bash");
  });

  it("handles arrow function handlers", () => {
    const filePath = writeHookFile(
      "arrow-hook.ts",
      `
      import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

      export default preToolUseHook({ matcher: 'Write' }, (input) => preToolUseOutput({}));
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PreToolUse");
    expect(metadata?.matcher).toBe("Write");
  });

  it("handles template literal matcher", () => {
    const filePath = writeHookFile(
      "template-hook.ts",
      `
      import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';

      export default preToolUseHook({ matcher: \`Bash|Read|Write\` }, (input) => {
        return preToolUseOutput({});
      });
    `,
    );

    const metadata = analyzeHookFile(filePath);

    expect(metadata?.hookEventName).toBe("PreToolUse");
    expect(metadata?.matcher).toBe("Bash|Read|Write");
  });
});

describe("detectHookContext", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "context-detect-"));
  });

  afterEach(() => {
    // Clean up temp directory recursively
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns "agent" for paths within .claude/ directory', () => {
    const claudeDir = path.join(tempDir, ".claude", "hooks");
    fs.mkdirSync(claudeDir, { recursive: true });
    const outputPath = path.join(claudeDir, "hooks.json");

    const result = detectHookContext(outputPath);

    expect(result.context).toBe("agent");
    expect(result.rootDir).toBe(tempDir);
  });

  it('returns "plugin" when .claude-plugin/ directory exists', () => {
    // Create a plugin structure
    const pluginDir = path.join(tempDir, ".claude-plugin");
    const hooksDir = path.join(tempDir, "hooks");
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(hooksDir, { recursive: true });
    const outputPath = path.join(hooksDir, "hooks.json");

    const result = detectHookContext(outputPath);

    expect(result.context).toBe("plugin");
    expect(result.rootDir).toBe(tempDir);
  });

  it('returns "plugin" when .claude-plugin/ exists in parent directory', () => {
    // Create nested structure with .claude-plugin in parent
    const pluginDir = path.join(tempDir, ".claude-plugin");
    const nestedDir = path.join(tempDir, "src", "hooks", "output");
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(nestedDir, { recursive: true });
    const outputPath = path.join(nestedDir, "hooks.json");

    const result = detectHookContext(outputPath);

    expect(result.context).toBe("plugin");
    expect(result.rootDir).toBe(tempDir);
  });

  it('returns "plugin" as default when no indicators present', () => {
    const outputDir = path.join(tempDir, "build");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "hooks.json");

    const result = detectHookContext(outputPath);

    expect(result.context).toBe("plugin");
    // When no indicators, rootDir is the output directory's parent
    expect(result.rootDir).toBe(outputDir);
  });

  it("prioritizes .claude/ path over .claude-plugin/ directory", () => {
    // Edge case: both indicators present (unusual but possible)
    const pluginDir = path.join(tempDir, ".claude-plugin");
    const claudeHooksDir = path.join(tempDir, ".claude", "hooks");
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(claudeHooksDir, { recursive: true });
    const outputPath = path.join(claudeHooksDir, "hooks.json");

    const result = detectHookContext(outputPath);

    // .claude/ in path takes priority
    expect(result.context).toBe("agent");
    expect(result.rootDir).toBe(tempDir);
  });
});

describe("generateCommandPath", () => {
  it("generates plugin-style path for plugin context with default node executable", () => {
    const contextInfo = { context: "plugin" as const, rootDir: "/workspace/plugins/my-plugin" };
    const buildDir = "/workspace/plugins/my-plugin/hooks/build";
    const result = generateCommandPath("my-hook.abc123.mjs", buildDir, contextInfo);

    expect(result).toBe("node $CLAUDE_PLUGIN_ROOT/hooks/build/my-hook.abc123.mjs");
  });

  it("generates agent-style path for agent context with default node executable", () => {
    const contextInfo = { context: "agent" as const, rootDir: "/workspace/my-project" };
    const buildDir = "/workspace/my-project/.claude/hooks/build";
    const result = generateCommandPath("my-hook.abc123.mjs", buildDir, contextInfo);

    expect(result).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/build/my-hook.abc123.mjs');
  });

  it("handles filenames with special characters", () => {
    const pluginContext = { context: "plugin" as const, rootDir: "/workspace/plugins/test" };
    const pluginBuildDir = "/workspace/plugins/test/hooks/build";
    const pluginResult = generateCommandPath("pre-tool-use.12345678.mjs", pluginBuildDir, pluginContext);

    const agentContext = { context: "agent" as const, rootDir: "/workspace/project" };
    const agentBuildDir = "/workspace/project/.claude/hooks/build";
    const agentResult = generateCommandPath("pre-tool-use.12345678.mjs", agentBuildDir, agentContext);

    expect(pluginResult).toBe("node $CLAUDE_PLUGIN_ROOT/hooks/build/pre-tool-use.12345678.mjs");
    expect(agentResult).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/build/pre-tool-use.12345678.mjs');
  });

  it("handles standard plugin structure with hooks/build", () => {
    const contextInfo = { context: "plugin" as const, rootDir: "/workspace/plugins/simple" };
    const buildDir = "/workspace/plugins/simple/hooks/build";
    const result = generateCommandPath("hook.mjs", buildDir, contextInfo);

    expect(result).toBe("node $CLAUDE_PLUGIN_ROOT/hooks/build/hook.mjs");
  });

  it("uses custom executable when provided", () => {
    const contextInfo = { context: "plugin" as const, rootDir: "/workspace/plugins/my-plugin" };
    const buildDir = "/workspace/plugins/my-plugin/hooks/build";
    const result = generateCommandPath("my-hook.abc123.mjs", buildDir, contextInfo, "/usr/local/bin/node");

    expect(result).toBe("/usr/local/bin/node $CLAUDE_PLUGIN_ROOT/hooks/build/my-hook.abc123.mjs");
  });

  it("uses custom executable for agent context", () => {
    const contextInfo = { context: "agent" as const, rootDir: "/workspace/my-project" };
    const buildDir = "/workspace/my-project/.claude/hooks/build";
    const result = generateCommandPath("my-hook.abc123.mjs", buildDir, contextInfo, "node22");

    expect(result).toBe('node22 "$CLAUDE_PROJECT_DIR"/.claude/hooks/build/my-hook.abc123.mjs');
  });

  it("uses bun as executable when specified", () => {
    const contextInfo = { context: "plugin" as const, rootDir: "/workspace/plugins/my-plugin" };
    const buildDir = "/workspace/plugins/my-plugin/hooks/build";
    const result = generateCommandPath("my-hook.abc123.mjs", buildDir, contextInfo, "bun");

    expect(result).toBe("bun $CLAUDE_PLUGIN_ROOT/hooks/build/my-hook.abc123.mjs");
  });
});
