import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-hooks-e2e-"));
  tempDirs.push(directory);
  return directory;
}

const packageRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(packageRoot, "../..");
const tsxBin = path.join(workspaceRoot, "node_modules", ".bin", "tsx");

describe("codex-hooks e2e", () => {
  it("builds hooks.json and runs a compiled SessionStart hook", () => {
    const projectDir = createTempDir();
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, ".codex"), { recursive: true });

    fs.writeFileSync(
      path.join(projectDir, "src", "session-start.ts"),
      `
        import { sessionStartHook } from ${JSON.stringify(path.join(packageRoot, "src", "index.ts"))};
        export default sessionStartHook({ matcher: "startup", timeout: 1500 }, () => "Loaded from text");
      `,
    );

    const build = spawnSync(
      tsxBin,
      [path.join(packageRoot, "src", "cli.ts"), "-i", "src/**/*.ts", "-o", ".codex/hooks.json"],
      {
        cwd: projectDir,
        encoding: "utf-8",
      },
    );
    expect(build.status).toBe(0);
    expect(build.stderr).toBe("");

    const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, ".codex", "hooks.json"), "utf-8"));
    expect(manifest).toEqual({
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [
              {
                type: "command",
                command: expect.stringContaining('node "$(git rev-parse --show-toplevel)/.codex/'),
                timeout: 2,
              },
            ],
          },
        ],
      },
    });

    const compiledFiles = fs.readdirSync(path.join(projectDir, ".codex")).filter((entry) => entry.endsWith(".mjs"));
    expect(compiledFiles.length).toBe(1);

    const run = spawnSync("node", [path.join(projectDir, ".codex", compiledFiles[0])], {
      input: JSON.stringify({
        cwd: projectDir,
        hook_event_name: "SessionStart",
        model: "gpt-5",
        permission_mode: "default",
        session_id: "sess-1",
        source: "startup",
        transcript_path: null,
      }),
      encoding: "utf-8",
    });

    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "Loaded from text",
      },
    });
  });

  it("maps BlockError to stderr plus exit code 2", () => {
    const projectDir = createTempDir();
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });

    fs.writeFileSync(
      path.join(projectDir, "src", "stop.ts"),
      `
        import { BlockError, stopHook } from ${JSON.stringify(path.join(packageRoot, "src", "index.ts"))};
        export default stopHook({}, () => {
          throw new BlockError("blocked");
        });
      `,
    );

    const build = spawnSync(
      tsxBin,
      [path.join(packageRoot, "src", "cli.ts"), "-i", "src/**/*.ts", "-o", "hooks.json"],
      {
        cwd: projectDir,
        encoding: "utf-8",
      },
    );
    expect(build.status).toBe(0);

    const compiledFile = fs.readdirSync(projectDir).find((entry) => entry.endsWith(".mjs"));
    expect(compiledFile).toBeDefined();

    const run = spawnSync("node", [path.join(projectDir, compiledFile ?? "")], {
      input: JSON.stringify({
        cwd: projectDir,
        hook_event_name: "Stop",
        last_assistant_message: null,
        model: "gpt-5",
        permission_mode: "default",
        session_id: "sess-1",
        stop_hook_active: false,
        transcript_path: null,
        turn_id: "turn-1",
      }),
      encoding: "utf-8",
    });

    expect(run.status).toBe(2);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("blocked");
  });

  it("continue policy emits {} and exits 0 for a compiled UserPromptSubmit hook that throws", () => {
    const projectDir = createTempDir();
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });

    fs.writeFileSync(
      path.join(projectDir, "src", "user-prompt-submit.ts"),
      `
        import { userPromptSubmitHook } from ${JSON.stringify(path.join(packageRoot, "src", "index.ts"))};
        export default userPromptSubmitHook({ unexpectedError: "continue" }, () => {
          throw new Error("advisory enrichment blew up");
        });
      `,
    );

    const build = spawnSync(
      tsxBin,
      [path.join(packageRoot, "src", "cli.ts"), "-i", "src/**/*.ts", "-o", "hooks.json"],
      {
        cwd: projectDir,
        encoding: "utf-8",
      },
    );
    expect(build.status).toBe(0);

    const compiledFile = fs.readdirSync(projectDir).find((entry) => entry.endsWith(".mjs"));
    expect(compiledFile).toBeDefined();

    const run = spawnSync("node", [path.join(projectDir, compiledFile ?? "")], {
      input: JSON.stringify({
        cwd: projectDir,
        hook_event_name: "UserPromptSubmit",
        model: "gpt-5",
        permission_mode: "default",
        prompt: "hello",
        session_id: "sess-1",
        transcript_path: null,
        turn_id: "turn-1",
      }),
      encoding: "utf-8",
    });

    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({});
  });

  it("continue policy emits {} and exits 0 for a compiled hook fed malformed stdin", () => {
    const projectDir = createTempDir();
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });

    fs.writeFileSync(
      path.join(projectDir, "src", "user-prompt-submit.ts"),
      `
        import { userPromptSubmitHook } from ${JSON.stringify(path.join(packageRoot, "src", "index.ts"))};
        export default userPromptSubmitHook({ unexpectedError: "continue" }, () => undefined);
      `,
    );

    const build = spawnSync(
      tsxBin,
      [path.join(packageRoot, "src", "cli.ts"), "-i", "src/**/*.ts", "-o", "hooks.json"],
      {
        cwd: projectDir,
        encoding: "utf-8",
      },
    );
    expect(build.status).toBe(0);

    const compiledFile = fs.readdirSync(projectDir).find((entry) => entry.endsWith(".mjs"));
    expect(compiledFile).toBeDefined();

    const run = spawnSync("node", [path.join(projectDir, compiledFile ?? "")], {
      input: "not valid json",
      encoding: "utf-8",
    });

    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({});
  });

  it("builds with --no-sourcemap and the compiled hook still runs", () => {
    const projectDir = createTempDir();
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, ".codex"), { recursive: true });

    fs.writeFileSync(
      path.join(projectDir, "src", "session-start.ts"),
      `
        import { sessionStartHook } from ${JSON.stringify(path.join(packageRoot, "src", "index.ts"))};
        export default sessionStartHook({ matcher: "startup" }, () => "No sourcemap");
      `,
    );

    const build = spawnSync(
      tsxBin,
      [path.join(packageRoot, "src", "cli.ts"), "-i", "src/**/*.ts", "-o", ".codex/hooks.json", "--no-sourcemap"],
      {
        cwd: projectDir,
        encoding: "utf-8",
      },
    );
    expect(build.status).toBe(0);
    expect(build.stderr).toBe("");

    const compiledFiles = fs.readdirSync(path.join(projectDir, ".codex")).filter((entry) => entry.endsWith(".mjs"));
    expect(compiledFiles.length).toBe(1);

    const bundle = fs.readFileSync(path.join(projectDir, ".codex", compiledFiles[0] ?? ""), "utf-8");
    expect(bundle).not.toContain("sourceMappingURL");

    const run = spawnSync("node", [path.join(projectDir, ".codex", compiledFiles[0] ?? "")], {
      input: JSON.stringify({
        cwd: projectDir,
        hook_event_name: "SessionStart",
        model: "gpt-5",
        permission_mode: "default",
        session_id: "sess-1",
        source: "startup",
        transcript_path: null,
      }),
      encoding: "utf-8",
    });

    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "No sourcemap",
      },
    });
  });

  it("reports the new package version via --version", () => {
    const version = spawnSync(tsxBin, [path.join(packageRoot, "src", "cli.ts"), "--version"], {
      encoding: "utf-8",
    });
    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toBe("1.3.2");
  });
});
