/**
 * Scaffold module for generating new Claude Code hook projects.
 *
 * Generates a complete TypeScript project structure with:
 * - package.json with dependencies and scripts
 * - tsconfig.json with ESM/Node20 configuration
 * - biome.json for linting/formatting
 * - Hook template files for each requested hook type
 * - Vitest test files for each hook
 * - vitest.config.ts for test configuration
 * @module
 * @example
 * ```bash
 * npx @goodfoot/agent-hooks --agent claude-code --scaffold ./my-hooks --hooks Stop,SubagentStop -o dist/hooks.json
 * ```
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { HookEventName } from "./agents/claude-code/types.js";
import { HOOK_FACTORY_TO_EVENT } from "./constants.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for scaffolding a new hook project.
 */
export interface ScaffoldOptions {
  /** Directory path where the project will be created. */
  directory: string;
  /** Array of hook event names to generate (e.g., ['Stop', 'SubagentStop']). */
  hooks: string[];
  /** Relative path for hooks.json output in the build script. */
  outputPath: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid hook event names (derived from HOOK_FACTORY_TO_EVENT values).
 */
const VALID_HOOK_EVENT_NAMES: Set<HookEventName> = new Set(Object.values(HOOK_FACTORY_TO_EVENT));

/**
 * Case-insensitive lookup map for hook event names.
 * Built once at module load to avoid recreation on each validation call.
 */
const CASE_INSENSITIVE_EVENT_LOOKUP: Map<string, HookEventName> = new Map(
  Array.from(VALID_HOOK_EVENT_NAMES).map((name) => [name.toLowerCase(), name]),
);

/**
 * Mapping from hook event name to factory function name.
 */
const EVENT_TO_HOOK_FACTORY: Record<HookEventName, string> = Object.fromEntries(
  Object.entries(HOOK_FACTORY_TO_EVENT).map(([factory, event]) => [event, factory]),
) as Record<HookEventName, string>;

/**
 * Mapping from hook event name to output function name.
 */
const EVENT_TO_OUTPUT_FUNCTION: Record<HookEventName, string> = {
  PreToolUse: "preToolUseOutput",
  PostToolUse: "postToolUseOutput",
  PostToolUseFailure: "postToolUseFailureOutput",
  PostToolBatch: "postToolBatchOutput",
  Notification: "notificationOutput",
  UserPromptExpansion: "userPromptExpansionOutput",
  UserPromptSubmit: "userPromptSubmitOutput",
  SessionStart: "sessionStartOutput",
  SessionEnd: "sessionEndOutput",
  Stop: "stopOutput",
  StopFailure: "stopFailureOutput",
  SubagentStart: "subagentStartOutput",
  SubagentStop: "subagentStopOutput",
  PreCompact: "preCompactOutput",
  PostCompact: "postCompactOutput",
  PermissionRequest: "permissionRequestOutput",
  PermissionDenied: "permissionDeniedOutput",
  Setup: "setupOutput",
  TeammateIdle: "teammateIdleOutput",
  TaskCreated: "taskCreatedOutput",
  TaskCompleted: "taskCompletedOutput",
  Elicitation: "elicitationOutput",
  ElicitationResult: "elicitationResultOutput",
  ConfigChange: "configChangeOutput",
  InstructionsLoaded: "instructionsLoadedOutput",
  WorktreeCreate: "worktreeCreateOutput",
  WorktreeRemove: "worktreeRemoveOutput",
  CwdChanged: "cwdChangedOutput",
  FileChanged: "fileChangedOutput",
  MessageDisplay: "messageDisplayOutput",
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates hook names against valid hook event names.
 *
 * Accepts PascalCase names case-insensitively (e.g., 'stop' -> 'Stop').
 * @param hookNames - Array of hook names to validate
 * @returns Object with normalized hook names or error message
 */
function validateHookNames(
  hookNames: string[],
): { valid: true; normalized: HookEventName[] } | { valid: false; error: string } {
  const normalized: HookEventName[] = [];
  const invalid: string[] = [];

  for (const hookName of hookNames) {
    const normalizedName = CASE_INSENSITIVE_EVENT_LOOKUP.get(hookName.toLowerCase());
    if (normalizedName !== undefined) {
      normalized.push(normalizedName);
    } else {
      invalid.push(hookName);
    }
  }

  if (invalid.length > 0) {
    const validNames = Array.from(VALID_HOOK_EVENT_NAMES).sort().join(", ");
    return {
      valid: false,
      error: `Invalid hook name(s): ${invalid.join(", ")}\nValid hook names: ${validNames}`,
    };
  }

  return { valid: true, normalized };
}

// ============================================================================
// File Generation
// ============================================================================

/**
 * Converts a PascalCase hook event name to kebab-case filename.
 * @param eventName - Hook event name (e.g., 'PreToolUse')
 * @returns Kebab-case filename (e.g., 'pre-tool-use')
 */
function toKebabCase(eventName: string): string {
  return eventName
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Generates package.json content for the scaffolded project.
 * @param projectName - Name derived from directory basename
 * @param outputPath - Relative path for hooks.json output
 * @returns JSON string for package.json
 */
function generatePackageJson(projectName: string, outputPath: string): string {
  const packageJson = {
    name: projectName,
    version: "1.0.0",
    type: "module",
    scripts: {
      build: `agent-hooks --agent claude-code -i "src/**/*.ts" -o "${outputPath}"`,
      test: "vitest run",
      lint: "biome check .",
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      "@goodfoot/agent-hooks": "^1.0.8",
    },
    devDependencies: {
      "@biomejs/biome": "2.4.16",
      "@types/node": "^22.0.0",
      typescript: "^5.9.3",
      vitest: "^4.0.16",
    },
    engines: {
      node: ">=20.11.0",
    },
  };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

/**
 * Generates tsconfig.json content for the scaffolded project.
 * @returns JSON string for tsconfig.json
 */
function generateTsConfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      outDir: "./dist",
    },
    include: ["src/**/*.ts", "test/**/*.ts"],
    exclude: ["node_modules", "dist"],
  };

  return `${JSON.stringify(tsconfig, null, 2)}\n`;
}

/**
 * Generates biome.json content for the scaffolded project.
 *
 * Uses Biome v2 configuration format with:
 * - assist.actions.source.organizeImports for import organization
 * - files.includes for specifying which files to process
 * @returns JSON string for biome.json
 */
function generateBiomeConfig(): string {
  return `{
  "$schema": "https://biomejs.dev/schemas/2.4.16/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 120
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "files": {
    "includes": ["src/**/*.ts", "test/**/*.ts", "*.ts"]
  }
}
`;
}

/**
 * Generates vitest.config.ts content for the scaffolded project.
 *
 * Uses double quotes and trailing commas to match biome's formatting preferences.
 * @returns TypeScript content for vitest.config.ts
 */
function generateVitestConfig(): string {
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globals: false,
  },
});
`;
}

/**
 * Generates CLAUDE.md content for the scaffolded project.
 * @returns Markdown content for CLAUDE.md
 */
function generateClaudeMd(): string {
  return "Load the `agent-hooks:claude-code` skill immediately if it is available.\n";
}

/**
 * Generates .gitignore content for the scaffolded project.
 * @returns Content for .gitignore
 */
function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Build outputs
dist/
bin/
*.mjs

# Generated files
hooks.json

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
`;
}

/**
 * Generates README.md content for the scaffolded project.
 * @param projectName - Name of the project
 * @param hooks - Array of hook event names included in this project
 * @returns Markdown content for README.md
 */
function generateReadme(projectName: string, hooks: HookEventName[]): string {
  const hookList = hooks.map((h) => `\`${h}\``).join(", ");
  return `# ${projectName}

This project contains [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) built with the \`@goodfoot/agent-hooks\` library. Hooks let you extend Claude Code's behavior by running custom code at specific points during a session—before or after tool execution, when Claude starts or stops, and more. This project includes hooks for: ${hookList}.

To get started, run \`npm install\` to install dependencies, then \`npm run build\` to compile your hooks into \`hooks.json\`. Copy the generated \`hooks.json\` to your Claude Code settings directory (or reference it in your \`.claude/settings.json\`), and your hooks will run automatically. Edit the files in \`src/\` to customize behavior, and use \`npm test\` to verify your changes work correctly.
`;
}

/**
 * Generates a hook template file for a specific hook type.
 *
 * Uses double quotes for all strings to match biome's formatting preferences.
 * @param eventName - Hook event name (e.g., 'Stop')
 * @returns TypeScript content for the hook file
 */
function generateHookTemplate(eventName: HookEventName): string {
  const factoryName = EVENT_TO_HOOK_FACTORY[eventName];
  const outputName = EVENT_TO_OUTPUT_FUNCTION[eventName];

  // Generate appropriate return statement based on hook type
  // All hooks include systemMessage to demonstrate the pattern
  let returnStatement: string;
  switch (eventName) {
    case "Stop":
    case "SubagentStop":
      returnStatement = `return ${outputName}({
    decision: "approve",
    systemMessage: "${eventName} hook executed successfully.",
  });`;
      break;
    case "PreToolUse":
      returnStatement = `return ${outputName}({
    systemMessage: "Tool execution allowed by ${eventName} hook.",
    hookSpecificOutput: { permissionDecision: "allow" },
  });`;
      break;
    case "PostToolUse":
    case "PostToolUseFailure":
    case "PostToolBatch":
      returnStatement = `return ${outputName}({
    systemMessage: "${eventName} hook processed the result.",
    hookSpecificOutput: { additionalContext: "Hook completed successfully." },
  });`;
      break;
    case "SessionStart":
      returnStatement = `return ${outputName}({
    systemMessage: "Session initialized by ${eventName} hook.",
    hookSpecificOutput: { additionalContext: "Environment ready." },
  });`;
      break;
    case "UserPromptExpansion":
      returnStatement = `return ${outputName}({
    systemMessage: "Prompt expansion observed.",
    hookSpecificOutput: { additionalContext: \`Command: \${input.command_name}\` },
  });`;
      break;
    case "UserPromptSubmit":
      returnStatement = `return ${outputName}({
    systemMessage: "User prompt received.",
    hookSpecificOutput: { additionalContext: "Prompt processed by hook." },
  });`;
      break;
    case "PreCompact":
      returnStatement = `return ${outputName}({
    systemMessage: "Remember: Context is being compacted.",
  });`;
      break;
    case "PermissionRequest":
      returnStatement = `return ${outputName}({
    systemMessage: "Permission request processed.",
  });`;
      break;
    case "Elicitation":
      returnStatement = `return ${outputName}({
    hookSpecificOutput: { action: "accept" },
  });`;
      break;
    case "ElicitationResult":
      returnStatement = `return ${outputName}({});`;
      break;
    case "WorktreeCreate":
      // WorktreeCreate is a command hook whose protocol is the bare worktree path on
      // stdout. `worktreePath` is required and written to stdout as plain text.
      returnStatement = `return ${outputName}({
    worktreePath: \`\${input.cwd}/.worktrees/\${input.name}\`,
  });`;
      break;
    case "ConfigChange":
    case "InstructionsLoaded":
    case "WorktreeRemove":
      returnStatement = `return ${outputName}({});`;
      break;
    case "MessageDisplay":
      returnStatement = `return ${outputName}({});`;
      break;
    default:
      // SessionEnd, Notification, SubagentStart use simple output with systemMessage
      returnStatement = `return ${outputName}({
    systemMessage: "${eventName} hook executed.",
  });`;
  }

  // SessionStart hooks get extended context with persistEnvVar
  const contextDestructure = eventName === "SessionStart" ? "{ logger, persistEnvVar }" : "{ logger }";

  return `/**
 * ${eventName} hook implementation.
 *
 * @see https://code.claude.com/docs/en/hooks#${eventName.toLowerCase()}
 */

import { ${factoryName}, ${outputName} } from "@goodfoot/agent-hooks/claude-code";

export default ${factoryName}({}, (input, ${contextDestructure}) => {
  logger.info("${eventName} hook triggered", { input });
  ${returnStatement}
});
`;
}

/**
 * Generates a test file for a specific hook type.
 *
 * Uses double quotes, alphabetical import order (describe, expect, it),
 * and trailing commas to match biome's formatting preferences.
 * Uses the real Logger class (silent by default) instead of mocks.
 * @param eventName - Hook event name (e.g., 'Stop')
 * @param hookFilename - Kebab-case filename of the hook (e.g., 'stop')
 * @returns TypeScript content for the test file
 */
function generateTestFile(eventName: HookEventName, hookFilename: string): string {
  // SessionStart hooks need extended context with persistEnvVar
  const contextCode =
    eventName === "SessionStart"
      ? `{
      logger,
      persistEnvVar: () => {},
      persistEnvVars: () => {},
    }`
      : "{ logger }";

  return `/**
 * Tests for the ${eventName} hook.
 */

import { Logger } from "@goodfoot/agent-hooks/claude-code";
import { describe, expect, it } from "vitest";
import hook from "../src/${hookFilename}.js";

// Logger is silent by default (no stdout/stderr output) — no mocking needed
const logger = new Logger();

describe("${eventName} Hook", () => {
  it("exports a valid hook function", () => {
    expect(hook).toBeDefined();
    expect(typeof hook).toBe("function");
  });

  it("has correct eventName metadata", () => {
    expect(hook.eventName).toBe("${eventName}");
  });

  it("returns a valid output shape", async () => {
    const mockInput = {} as Parameters<typeof hook>[0];
    const context = ${contextCode};

    const result = await hook(mockInput, context);

    // Verify output has expected structure
    if (result == null) {
      throw new Error("hook returned null");
    }
    expect(result).toHaveProperty("_type", "${eventName}");
    expect(result).toHaveProperty("stdout");
    expect(typeof result.stdout).toBe("object");
  });
});
`;
}

// ============================================================================
// Main Scaffold Function
// ============================================================================

/**
 * Scaffolds a new Claude Code hook project.
 *
 * Creates the complete project structure including:
 * - package.json, tsconfig.json, biome.json, vitest.config.ts
 * - src/ directory with hook implementations
 * - test/ directory with vitest tests
 * @param options - Scaffold configuration options
 * @throws Exits with code 1 if directory exists or hook names are invalid
 * @example
 * ```typescript
 * scaffoldProject({
 *   directory: './my-hooks',
 *   hooks: ['Stop', 'SubagentStop'],
 *   outputPath: 'dist/hooks.json'
 * });
 * ```
 */
export function scaffoldProject(options: ScaffoldOptions): void {
  const { directory, hooks, outputPath } = options;

  // Resolve to absolute path
  const absoluteDir = path.resolve(process.cwd(), directory);

  // Check if directory already exists
  if (fs.existsSync(absoluteDir)) {
    process.stderr.write(`Error: Directory already exists: ${absoluteDir}\n`);
    process.exit(1);
  }

  // Validate hook names
  const validation = validateHookNames(hooks);
  if (!validation.valid) {
    process.stderr.write(`Error: ${validation.error}\n`);
    process.exit(1);
  }

  const normalizedHooks = validation.normalized;

  // Create directory structure
  const srcDir = path.join(absoluteDir, "src");
  const testDir = path.join(absoluteDir, "test");

  fs.mkdirSync(absoluteDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(testDir, { recursive: true });

  // Generate project name from directory basename
  const projectName = path.basename(absoluteDir);

  // Generate configuration files
  fs.writeFileSync(path.join(absoluteDir, "package.json"), generatePackageJson(projectName, outputPath));
  fs.writeFileSync(path.join(absoluteDir, "tsconfig.json"), generateTsConfig());
  fs.writeFileSync(path.join(absoluteDir, "biome.json"), generateBiomeConfig());
  fs.writeFileSync(path.join(absoluteDir, "vitest.config.ts"), generateVitestConfig());
  fs.writeFileSync(path.join(absoluteDir, "CLAUDE.md"), generateClaudeMd());
  fs.writeFileSync(path.join(absoluteDir, ".gitignore"), generateGitignore());
  fs.writeFileSync(path.join(absoluteDir, "README.md"), generateReadme(projectName, normalizedHooks));

  // Generate hook files and tests
  for (const eventName of normalizedHooks) {
    const kebabName = toKebabCase(eventName);

    // Generate hook file
    const hookContent = generateHookTemplate(eventName);
    fs.writeFileSync(path.join(srcDir, `${kebabName}.ts`), hookContent);

    // Generate test file
    const testContent = generateTestFile(eventName, kebabName);
    fs.writeFileSync(path.join(testDir, `${kebabName}.test.ts`), testContent);
  }

  // Output success message
  process.stdout.write(`Created hook project at ${absoluteDir}\n`);
  process.stdout.write("\nNext steps:\n");
  process.stdout.write(`  cd ${directory}\n`);
  process.stdout.write("  npm install\n");
  process.stdout.write("  npm run build\n");
  process.stdout.write("\nGenerated hooks:\n");
  for (const eventName of normalizedHooks) {
    const kebabName = toKebabCase(eventName);
    process.stdout.write(`  - src/${kebabName}.ts\n`);
  }
}
