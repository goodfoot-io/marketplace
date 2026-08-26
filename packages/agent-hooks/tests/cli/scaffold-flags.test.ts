/**
 * CLI --agent flag smoke test (plan step 2.9) — new behavior with no source
 * counterpart: `claude-code-hooks`' CLI never required an agent flag, so the
 * ported scaffold e2e cannot exercise it. This file asserts:
 *
 * (a) the CLI exits non-zero and writes NO output files when invoked without
 *     `--agent` (there is no default agent, never inferred);
 * (b) every usage line carries `--agent <agent>` and scaffold output emits
 *     `@goodfoot/agent-hooks` imports plus a build script that passes
 *     `--agent claude-code`;
 * (c) codex/antigravity values are accepted by validation but fail closed
 *     until their parity steps land.
 */

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, "..", "..", "src", "cli.ts");

// Same tsx-entrypoint resolution technique as the e2e test-utils: run the JS
// entry directly under the current Node binary (Windows-safe, npx-free).
const tsxCliPath = createRequire(import.meta.url).resolve("tsx/cli");

function runCli(args: string[], cwd?: string): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [tsxCliPath, CLI_PATH, ...args], {
    encoding: "utf-8",
    stdio: "pipe",
    ...(cwd === undefined ? {} : { cwd }),
  });
}

describe("--agent is required", () => {
  it("exits non-zero with no files written when --agent is absent", () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-no-agent-"));
    const outputPath = path.join(outDir, "hooks.json");

    const result = runCli(["-i", `${outDir}/*.ts`, "-o", outputPath]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--agent");
    expect(fs.existsSync(outputPath)).toBe(false);
    expect(fs.readdirSync(outDir)).toEqual([]);
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("exits non-zero for a bare invocation (no arguments at all)", () => {
    const result = runCli([]);
    // The source CLI treated zero args as a help request (exit 0); requiring
    // --agent means a bare invocation now fails closed instead.
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--agent");
  });

  it("rejects an unknown agent value by name", () => {
    const result = runCli(["--agent", "claudecode", "-i", "x.ts", "-o", "hooks.json"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Invalid --agent value: claudecode");
  });

  it("codex builds for real (un-stubbed in step 3)", () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-codex-cli-"));
    const srcDir = path.join(outDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "stop.ts"),
      `import { stopHook } from "${path.resolve(__dirname, "..", "..", "src", "agents", "codex", "index.js")}";\n` +
        `export default stopHook({}, () => undefined);\n`,
    );
    const result = runCli(["--agent", "codex", "-i", `${srcDir}/*.ts`, "-o", path.join(outDir, "hooks.json")]);
    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(outDir, "hooks.json"))).toBe(true);
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("antigravity still fails closed until step 5 lands", () => {
    const result = runCli(["--agent", "antigravity", "-i", "nonexistent-hook.ts", "-o", "hooks.json"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--agent antigravity is not implemented in this release");
  });
});

describe("usage lines carry the required flag", () => {
  it("help text shows --agent in usage, as a required section, and in examples", () => {
    const result = runCli(["--help"]);
    expect(result.status).toBe(0);

    const help = result.stdout;
    const usageIndex = help.indexOf("Usage:");
    expect(usageIndex).toBeGreaterThanOrEqual(0);
    // The flag appears in the usage block itself and in the required section.
    const usageBlock = help.slice(usageIndex, usageIndex + 400);
    expect(usageBlock).toContain("--agent <agent>");
    expect(help).toContain("Required Arguments:");
    expect(help).toContain("--agent <claude-code|codex|antigravity>");
    // Every numbered example compiles or scaffolds through the flag.
    const exampleLines = help.split("\n").filter((line) => /npx -y @goodfoot\/agent-hooks/.test(line));
    expect(exampleLines.length).toBeGreaterThan(0);
    for (const line of exampleLines) {
      expect(line).toContain("--agent");
    }
    // Codex branch documents its plugin-root option under the unified help.
    expect(help).toContain("Codex-specific options");
  });

  it("--version reports this package's binary identity", () => {
    const result = runCli(["--version"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("agent-hooks v");
  });
});

describe("scaffold output targets the new surface", () => {
  function scaffold(hooks: string): { status: number | null; dir: string; stderr: string } {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-scaffold-flags-"));
    const dir = path.join(parent, "project");
    const result = runCli(["--agent", "claude-code", "--scaffold", dir, "--hooks", hooks, "-o", "dist/hooks.json"]);
    return { status: result.status ?? 1, dir, stderr: result.stderr };
  }

  it("generated hook source imports @goodfoot/agent-hooks/claude-code", () => {
    const { status, dir } = scaffold("PreToolUse");
    expect(status).toBe(0);
    const hookSource = fs.readFileSync(path.join(dir, "src", "pre-tool-use.ts"), "utf-8");
    expect(hookSource).toContain('from "@goodfoot/agent-hooks/claude-code"');
    expect(hookSource).not.toContain("@goodfoot/claude-code-hooks");
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  });

  it("generated package.json build script passes --agent claude-code to the renamed binary", () => {
    const { status, dir } = scaffold("Stop");
    expect(status).toBe(0);
    const generated = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(generated.scripts.build).toBe('agent-hooks --agent claude-code -i "src/**/*.ts" -o "dist/hooks.json"');
    expect(generated.dependencies["@goodfoot/agent-hooks"]).toBeDefined();
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  });

  it("generated test template asserts eventName metadata on the new surface", () => {
    const { status, dir } = scaffold("Notification");
    expect(status).toBe(0);
    const testSource = fs.readFileSync(path.join(dir, "test", "notification.test.ts"), "utf-8");
    expect(testSource).toContain("hook.eventName");
    expect(testSource).not.toContain("hookEventName");
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  });
});
