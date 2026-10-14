import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const CHILD_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 75_000;
const OUTPUT_LIMIT_BYTES = 1_048_576;
const OUTPUT_TAIL_BYTES = 8192;

function runCli(
  args: readonly string[],
  options: { cwd?: string; env: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolveResult, reject) => {
    const started = performance.now();
    const child = spawn("node", args, {
      ...options,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout: Buffer = Buffer.alloc(0);
    let stderr: Buffer = Buffer.alloc(0);
    let stopReason: string | undefined;
    let transportError: Error | undefined;

    const stopGroup = () => {
      if (child.pid === undefined) return;
      if (process.platform === "win32") {
        child.kill("SIGKILL");
        return;
      }
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
      }
    };
    const abort = (reason: string) => {
      if (stopReason !== undefined) return;
      stopReason = reason;
      try {
        stopGroup();
      } catch (error) {
        transportError = error instanceof Error ? error : new Error(String(error));
        child.kill("SIGKILL");
      }
    };
    const timer = setTimeout(() => abort("child deadline exceeded"), CHILD_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);
      if (stdout.length > OUTPUT_LIMIT_BYTES) {
        stdout = stdout.subarray(-OUTPUT_LIMIT_BYTES);
        abort("stdout capture limit exceeded");
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = Buffer.concat([stderr, chunk]);
      if (stderr.length > OUTPUT_LIMIT_BYTES) {
        stderr = stderr.subarray(-OUTPUT_LIMIT_BYTES);
        abort("stderr capture limit exceeded");
      }
    });
    child.once("error", (error) => {
      transportError = error;
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      // On POSIX the launcher and its services share our owned process group.
      // Cleanup does not change the launcher's reported exit status.
      try {
        stopGroup();
      } catch (error) {
        transportError = error instanceof Error ? error : new Error(String(error));
      }
      if (stopReason !== undefined || transportError !== undefined || code !== 0 || signal !== null) {
        const failureKind =
          stopReason !== undefined || transportError !== undefined || code === null || signal !== null
            ? "transport"
            : "application";
        reject(
          new Error(
            `CLI ${failureKind} failed after ${Math.round(performance.now() - started)}ms ` +
              `(timeout=${CHILD_TIMEOUT_MS}ms, pid=${child.pid}, code=${code}, ` +
              `killed=${stopReason !== undefined}, signal=${signal}).\n` +
              `Reason: ${stopReason ?? transportError?.message ?? "child exited unsuccessfully"}\n` +
              `stdout tail:\n${stdout.subarray(-OUTPUT_TAIL_BYTES).toString("utf8") || "<empty>"}\n` +
              `stderr tail:\n${stderr.subarray(-OUTPUT_TAIL_BYTES).toString("utf8") || "<empty>"}`,
          ),
        );
        return;
      }
      resolveResult({ stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8") });
    });
  });
}

const packageRoot = resolve(import.meta.dirname, "..");
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
const tsconfig = resolve(packageRoot, "tsconfig.json");
const childEnvironment = { ...process.env, NODE_OPTIONS: undefined, ESBUILD_BINARY_PATH: undefined };
const ownedDirectories = new Set<string>();

afterEach(async () => {
  for (const path of ownedDirectories) {
    await rm(path, { recursive: true, force: true });
    ownedDirectories.delete(path);
  }
});

describe("agent-skills CLI", () => {
  it("builds through the TypeScript bin with package-safe imports", { timeout: TEST_TIMEOUT_MS }, async () => {
    const parent = await mkdtemp(join(tmpdir(), "agent-skills-e2e-"));
    ownedDirectories.add(parent);
    const root = join(parent, "src");
    await mkdir(root);
    await writeFile(join(root, "SKILL.md.eta"), "# <%= it.platform %>\n");
    const { stdout, stderr } = await runCli(
      [
        tsxCli,
        "--tsconfig",
        tsconfig,
        "--no-cache",
        resolve(packageRoot, "src/cli.ts"),
        "build",
        "--root",
        root,
        "--target",
        `codex=${join(parent, "out")}`,
        "SKILL.md.eta",
      ],
      {
        env: { ...childEnvironment, TMPDIR: parent, TMP: parent, TEMP: parent },
      },
    );
    expect(stderr).toBe("");
    expect(stdout).toContain("codex=");
    expect(await readFile(join(parent, "out", "SKILL.md"), "utf8")).toBe("# codex\n");
  });

  it("executes the documented repository build command", { timeout: TEST_TIMEOUT_MS }, async () => {
    const repo = await mkdtemp(join(tmpdir(), "agent-skills-documented-"));
    ownedDirectories.add(repo);
    const root = join(repo, "skills-src", "goodfoot");
    await mkdir(join(root, "demo"), { recursive: true });
    await writeFile(join(root, "demo", "SKILL.md.eta"), "# <%= it.platform %>\n");
    const args = [
      tsxCli,
      "--tsconfig",
      tsconfig,
      "--no-cache",
      resolve(packageRoot, "src/cli.ts"),
      "build",
      "--root",
      "skills-src/goodfoot",
      "--target",
      "claude-code=plugins-claude/goodfoot/skills",
      "--target",
      "codex=plugins-codex/goodfoot/skills",
      "**/*.md.eta",
    ];
    const { stderr } = await runCli(args, {
      cwd: repo,
      env: { ...childEnvironment, TMPDIR: repo, TMP: repo, TEMP: repo },
    });
    expect(stderr).toBe("");
    await expect(readFile(join(repo, "plugins-codex/goodfoot/skills/demo/SKILL.md"), "utf8")).resolves.toBe(
      "# codex\n",
    );
  });
});
