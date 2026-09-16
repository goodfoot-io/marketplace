/**
 * `shell-mcp openai`: the CLI half of the OpenAI Secure MCP Tunnel start.
 *
 * The launcher itself is a separate program, `scripts/start-tunnel.mjs`, shipped
 * inside the package because it supervises two child processes and owns the
 * readiness gates. This module only decides that the `openai` word selects it,
 * locates it inside the installation, runs it, and forwards its exit status.
 *
 * The launcher is spawned rather than imported so the CLI process stays a thin
 * wrapper: the run's terminal, signals, and exit code all belong to the launcher,
 * and a run that fails still reports its own diagnostic.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { constants } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The CLI word that selects the tunnel launcher. */
const TUNNEL_COMMAND = "openai";

/** Package name the installation is located by, and must be located by. */
const PACKAGE_NAME = "@goodfoot/shell-mcp";

/** Launcher path relative to the package root. */
const LAUNCHER_PATH = join("scripts", "start-tunnel.mjs");

export function isTunnelCommand(argv: readonly string[]): boolean {
  return argv[0] === TUNNEL_COMMAND;
}

export function tunnelArguments(argv: readonly string[]): readonly string[] {
  return argv.slice(1);
}

/**
 * Walk up from a directory inside the installed package to the root the
 * launcher can be started from, so it resolves the same way from `src/` and
 * from the compiled `build/dist/src/`.
 *
 * Declaring this package is not enough to be that root: the compiler emits a
 * copy of the manifest beside the compiled `src/`, so the nearest manifest
 * naming this package is the build output, and stopping there aims the launcher
 * at a path no archive contains. The root is the directory that both declares
 * the package and holds the launcher, so a nearer copy that does not is walked
 * past, and when none holds it the error names the directory that declares it
 * rather than the copy.
 *
 * A manifest that merely exists is never the root — another workspace member, a
 * consumer's own package.json — and a manifest that cannot be read is a defect
 * rather than a place to keep walking past.
 */
export function findPackageRoot(startDir: string): string {
  let declared: string | undefined;
  for (let directory = startDir; ; ) {
    const manifest = join(directory, "package.json");
    if (existsSync(manifest) && packageName(manifest) === PACKAGE_NAME) {
      if (existsSync(join(directory, LAUNCHER_PATH))) return directory;
      declared = directory;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      if (declared !== undefined) {
        throw new Error(`tunnel launcher missing from this installation: ${join(declared, LAUNCHER_PATH)}`);
      }
      throw new Error(`no ${PACKAGE_NAME} package.json above ${startDir}`);
    }
    directory = parent;
  }
}

function packageName(manifestPath: string): string | undefined {
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read ${manifestPath}: ${message}`);
  }
  if (typeof manifest !== "object" || manifest === null) return undefined;
  const name = (manifest as { readonly name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

/**
 * Run the tunnel launcher against the caller's arguments and return its exit
 * status.
 *
 * The terminal is inherited, so the launcher keeps the user's own signal
 * behaviour. The first SIGINT/SIGTERM reaches the launcher through the terminal's
 * process group and only unhooks this wrapper's handling of it: the wrapper stays
 * alive so the launcher's orderly stop runs to completion and its exit code —
 * not this wrapper's — is the run's result. A second signal ends the wrapper
 * immediately, which is what a user who interrupts twice is asking for.
 */
export async function runTunnelLauncher(argv: readonly string[]): Promise<number> {
  const launcher = join(findPackageRoot(dirname(fileURLToPath(import.meta.url))), LAUNCHER_PATH);
  const child = spawn(process.execPath, [launcher, ...argv], { stdio: "inherit" });
  const stopRelaying = (): void => {
    process.off("SIGINT", stopRelaying);
    process.off("SIGTERM", stopRelaying);
  };
  process.on("SIGINT", stopRelaying);
  process.on("SIGTERM", stopRelaying);
  return await new Promise<number>((resolve, reject) => {
    child.once("error", (error: unknown) => {
      stopRelaying();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      stopRelaying();
      resolve(code ?? exitCodeForSignal(signal));
    });
  });
}

/** The shell convention for a child that died on a signal this wrapper did not send. */
function exitCodeForSignal(signal: NodeJS.Signals | null): number {
  const number = signal === null ? 0 : (constants.signals[signal] ?? 0);
  return number === 0 ? 1 : 128 + number;
}
