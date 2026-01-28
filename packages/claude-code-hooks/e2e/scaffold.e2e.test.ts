/**
 * E2E tests for the CLI scaffold command.
 *
 * These tests verify that the scaffold command correctly generates
 * a complete hook project structure with proper configuration files,
 * hook templates, and test files.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to the CLI script.
 */
const CLI_PATH = path.join(__dirname, "..", "src", "cli.ts");

/**
 * Path to the package root (for file: protocol reference).
 */
const PACKAGE_ROOT = path.join(__dirname, "..");

/**
 * Output directory for scaffold test results.
 */
const SCAFFOLD_TEST_OUTPUT = path.join(__dirname, "dist", "scaffold-test");

/**
 * Runs the CLI with scaffold arguments.
 * @param args - Arguments to pass to the CLI
 * @returns Object with exit code and captured stdout/stderr
 */
function runScaffoldCli(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync("npx", ["tsx", CLI_PATH, ...args], {
    cwd: path.dirname(CLI_PATH),
    encoding: "utf-8",
    stdio: "pipe",
  });

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/**
 * Cleans up the scaffold test output directory.
 */
function cleanScaffoldTestOutput(): void {
  if (fs.existsSync(SCAFFOLD_TEST_OUTPUT)) {
    fs.rmSync(SCAFFOLD_TEST_OUTPUT, { recursive: true });
  }
}

/**
 * Creates a unique test directory path.
 * @param testName - Name of the test for directory naming
 * @returns Absolute path to the test directory
 */
function getTestDir(testName: string): string {
  return path.join(SCAFFOLD_TEST_OUTPUT, testName);
}

/**
 * Modifies a scaffolded project's package.json to use local file: protocol.
 * This allows npm install to use the local package instead of fetching from npm.
 * @param testDir - Path to the scaffolded project directory
 */
function useLocalPackage(testDir: string): void {
  const packageJsonPath = path.join(testDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as Record<string, unknown>;
  const deps = packageJson.dependencies as Record<string, string>;
  deps["@goodfoot/claude-code-hooks"] = `file:${PACKAGE_ROOT}`;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

describe("E2E: Scaffold Command", () => {
  beforeAll(() => {
    // Ensure clean output directory
    cleanScaffoldTestOutput();
    fs.mkdirSync(SCAFFOLD_TEST_OUTPUT, { recursive: true });
  });

  afterAll(() => {
    cleanScaffoldTestOutput();
  });

  describe("File Structure Generation", () => {
    it("scaffold creates expected file structure", () => {
      const testDir = getTestDir("file-structure");
      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "Stop,SubagentStop", "-o", "dist/hooks.json"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Created hook project");

      // Verify root configuration files exist
      expect(fs.existsSync(path.join(testDir, "package.json"))).toBe(true);
      expect(fs.existsSync(path.join(testDir, "tsconfig.json"))).toBe(true);
      expect(fs.existsSync(path.join(testDir, "biome.json"))).toBe(true);
      expect(fs.existsSync(path.join(testDir, "vitest.config.ts"))).toBe(true);
      expect(fs.existsSync(path.join(testDir, "CLAUDE.md"))).toBe(true);

      // Verify src directory contains hook files
      expect(fs.existsSync(path.join(testDir, "src", "stop.ts"))).toBe(true);
      expect(fs.existsSync(path.join(testDir, "src", "subagent-stop.ts"))).toBe(true);

      // Verify test directory contains test files
      expect(fs.existsSync(path.join(testDir, "test", "stop.test.ts"))).toBe(true);
      expect(fs.existsSync(path.join(testDir, "test", "subagent-stop.test.ts"))).toBe(true);
    });

    it("generates correct package.json content", () => {
      const testDir = getTestDir("package-json-content");
      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "PreToolUse", "-o", "dist/hooks.json"]);

      expect(result.exitCode).toBe(0);

      const packageJson = JSON.parse(fs.readFileSync(path.join(testDir, "package.json"), "utf-8")) as Record<
        string,
        unknown
      >;

      // Verify package.json structure
      expect(packageJson.name).toBe("package-json-content");
      expect(packageJson.type).toBe("module");
      expect(packageJson.scripts).toBeDefined();

      const scripts = packageJson.scripts as Record<string, string>;
      expect(scripts.build).toContain("dist/hooks.json");
      expect(scripts.test).toBe("vitest run");
      expect(scripts.lint).toBe("biome check .");
      expect(scripts.typecheck).toBe("tsc --noEmit");

      const deps = packageJson.dependencies as Record<string, string>;
      expect(deps["@goodfoot/claude-code-hooks"]).toBeDefined();
    });

    it("generates correct tsconfig.json content", () => {
      const testDir = getTestDir("tsconfig-content");
      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "SessionStart", "-o", "build/hooks.json"]);

      expect(result.exitCode).toBe(0);

      const tsconfig = JSON.parse(fs.readFileSync(path.join(testDir, "tsconfig.json"), "utf-8")) as Record<
        string,
        unknown
      >;

      const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;
      expect(compilerOptions.target).toBe("ES2022");
      expect(compilerOptions.module).toBe("NodeNext");
      expect(compilerOptions.moduleResolution).toBe("NodeNext");
      expect(compilerOptions.strict).toBe(true);
    });

    it("generates hook templates with correct imports", () => {
      const testDir = getTestDir("hook-imports");
      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "PreToolUse,Stop", "-o", "dist/hooks.json"]);

      expect(result.exitCode).toBe(0);

      // Check PreToolUse hook (uses double quotes to match biome formatting)
      const preToolUseContent = fs.readFileSync(path.join(testDir, "src", "pre-tool-use.ts"), "utf-8");
      expect(preToolUseContent).toContain("import { preToolUseHook, preToolUseOutput }");
      expect(preToolUseContent).toContain('from "@goodfoot/claude-code-hooks"');
      expect(preToolUseContent).toContain("export default preToolUseHook");
      expect(preToolUseContent).toContain("permissionDecision");

      // Check Stop hook (uses double quotes to match biome formatting)
      const stopContent = fs.readFileSync(path.join(testDir, "src", "stop.ts"), "utf-8");
      expect(stopContent).toContain("import { stopHook, stopOutput }");
      expect(stopContent).toContain('decision: "approve"');
    });

    it("generates test files with correct structure", () => {
      const testDir = getTestDir("test-structure");
      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "Notification", "-o", "dist/hooks.json"]);

      expect(result.exitCode).toBe(0);

      // Test files use double quotes and alphabetical import order to match biome formatting
      const testContent = fs.readFileSync(path.join(testDir, "test", "notification.test.ts"), "utf-8");

      expect(testContent).toContain('import { Logger } from "@goodfoot/claude-code-hooks"');
      expect(testContent).toContain('import hook from "../src/notification.js"');
      expect(testContent).toContain('describe("Notification Hook"');
      expect(testContent).toContain("hookEventName");
      expect(testContent).toContain('toBe("Notification")');
    });

    it("generates CLAUDE.md with skill loading instruction", () => {
      const testDir = getTestDir("claude-md-content");
      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "Stop", "-o", "dist/hooks.json"]);

      expect(result.exitCode).toBe(0);

      const claudeMdContent = fs.readFileSync(path.join(testDir, "CLAUDE.md"), "utf-8");

      expect(claudeMdContent).toBe(
        "Load the `claude-code-hooks:claude-code-hooks` skill immediately if it is available.\n",
      );
    });

    it("supports all 13 hook types", () => {
      const testDir = getTestDir("all-hooks");
      const allHooks = [
        "PreToolUse",
        "PostToolUse",
        "PostToolUseFailure",
        "Notification",
        "UserPromptSubmit",
        "SessionStart",
        "SessionEnd",
        "Stop",
        "SubagentStart",
        "SubagentStop",
        "PreCompact",
        "PermissionRequest",
        "Setup",
      ];

      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", allHooks.join(","), "-o", "dist/hooks.json"]);

      expect(result.exitCode).toBe(0);

      // Verify a file exists for each hook type
      const expectedFiles = [
        "pre-tool-use.ts",
        "post-tool-use.ts",
        "post-tool-use-failure.ts",
        "notification.ts",
        "user-prompt-submit.ts",
        "session-start.ts",
        "session-end.ts",
        "stop.ts",
        "subagent-start.ts",
        "subagent-stop.ts",
        "pre-compact.ts",
        "permission-request.ts",
      ];

      for (const file of expectedFiles) {
        expect(fs.existsSync(path.join(testDir, "src", file))).toBe(true);
        expect(fs.existsSync(path.join(testDir, "test", file.replace(".ts", ".test.ts")))).toBe(true);
      }
    });
  });

  describe("Build Integration", () => {
    it("scaffolded project builds successfully with file: protocol dependency", () => {
      const testDir = getTestDir("build-integration");
      const scaffoldResult = runScaffoldCli([
        "--scaffold",
        testDir,
        "--hooks",
        "Stop,PreToolUse",
        "-o",
        "dist/hooks.json",
      ]);

      expect(scaffoldResult.exitCode).toBe(0);

      // Modify package.json to use local package for testing
      useLocalPackage(testDir);

      // Run npm install in scaffolded project (as recommended by scaffold command)
      const installResult = spawnSync("npm", ["install"], {
        cwd: testDir,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 120000,
      });

      expect(installResult.status).toBe(0);

      // Run npm run build in scaffolded project
      const buildResult = spawnSync("npm", ["run", "build"], {
        cwd: testDir,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 120000,
      });

      expect(buildResult.status).toBe(0);

      // Verify hooks.json is created
      const hooksJsonPath = path.join(testDir, "dist", "hooks.json");
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      // Verify hooks.json has correct structure
      const hooksJson = JSON.parse(fs.readFileSync(hooksJsonPath, "utf-8")) as Record<string, unknown>;
      expect(hooksJson.hooks).toBeDefined();
      expect(hooksJson.__generated).toBeDefined();

      const hooks = hooksJson.hooks as Record<string, unknown>;
      expect(hooks.Stop).toBeDefined();
      expect(hooks.PreToolUse).toBeDefined();
    }, 180000); // 3 minute timeout for install + build

    it("scaffolded project tests pass", () => {
      const testDir = getTestDir("test-integration");
      const scaffoldResult = runScaffoldCli([
        "--scaffold",
        testDir,
        "--hooks",
        "Stop,Notification",
        "-o",
        "dist/hooks.json",
      ]);

      expect(scaffoldResult.exitCode).toBe(0);

      // Modify package.json to use local package for testing
      useLocalPackage(testDir);

      // Run npm install (as recommended by scaffold command)
      const installResult = spawnSync("npm", ["install"], {
        cwd: testDir,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 120000,
      });

      expect(installResult.status).toBe(0);

      // Run npm test
      const testResult = spawnSync("npm", ["test"], {
        cwd: testDir,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 60000,
      });

      expect(testResult.status).toBe(0);
      expect(testResult.stdout).toContain("passed");
    }, 180000); // 3 minute timeout for install + test
  });

  describe("Error Handling", () => {
    it("existing directory fails with exit code 1", () => {
      const testDir = getTestDir("existing-dir-error");

      // Create the directory first
      fs.mkdirSync(testDir, { recursive: true });

      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "Stop", "-o", "dist/hooks.json"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Directory already exists");
      expect(result.stderr).toContain(testDir);
    });

    it("missing --hooks argument fails with error", () => {
      const testDir = getTestDir("missing-hooks-error");

      const result = runScaffoldCli(["--scaffold", testDir, "-o", "dist/hooks.json"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("--hooks");
    });

    it("missing -o argument fails with error", () => {
      const testDir = getTestDir("missing-output-error");

      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "Stop"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("-o");
    });

    it("invalid hook name fails with error listing valid names", () => {
      const testDir = getTestDir("invalid-hook-error");

      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "InvalidHook,Stop", "-o", "dist/hooks.json"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid hook name");
      expect(result.stderr).toContain("InvalidHook");

      // Verify valid hook names are listed
      expect(result.stderr).toContain("Valid hook names");
      expect(result.stderr).toContain("PreToolUse");
      expect(result.stderr).toContain("PostToolUse");
      expect(result.stderr).toContain("Stop");
      expect(result.stderr).toContain("SessionStart");
    });

    it("case-insensitive hook names are accepted", () => {
      const testDir = getTestDir("case-insensitive");

      const result = runScaffoldCli([
        "--scaffold",
        testDir,
        "--hooks",
        "stop,pretooluse,SESSIONSTART",
        "-o",
        "dist/hooks.json",
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(path.join(testDir, "src", "stop.ts"))).toBe(true);
      expect(fs.existsSync(path.join(testDir, "src", "pre-tool-use.ts"))).toBe(true);
      expect(fs.existsSync(path.join(testDir, "src", "session-start.ts"))).toBe(true);
    });
  });

  describe("Output Path Configuration", () => {
    it("configures build script with specified output path", () => {
      const testDir = getTestDir("custom-output-path");
      const result = runScaffoldCli(["--scaffold", testDir, "--hooks", "Stop", "-o", "custom/path/hooks.json"]);

      expect(result.exitCode).toBe(0);

      const packageJson = JSON.parse(fs.readFileSync(path.join(testDir, "package.json"), "utf-8")) as Record<
        string,
        unknown
      >;

      const scripts = packageJson.scripts as Record<string, string>;
      expect(scripts.build).toContain("custom/path/hooks.json");
    });
  });
});
