/**
 * argv parsing helpers for the voice CLI
 */

import { readFileSync } from "node:fs";

export interface ParsedArgs {
  command: string;
  subcommand?: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Parse process.argv[2...] into a structured object.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  let command = "";
  let subcommand: string | undefined;

  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  if (positional.length > 0) {
    command = positional[0];
  }
  if (positional.length > 1) {
    subcommand = positional[1];
  }

  return { command, subcommand, positional: positional.slice(2), flags };
}

export function getPort(flags: Record<string, string | boolean>): number {
  const p = flags.port;
  if (typeof p === "string") {
    const n = parseInt(p, 10);
    if (!Number.isNaN(n)) return n;
  }
  return 3000;
}

export function getString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  if (typeof v === "string") return v;
  return undefined;
}

export function getBoolean(flags: Record<string, string | boolean>, key: string): boolean {
  return flags[key] === true || flags[key] === "true";
}

/**
 * Synchronously drain piped stdin (fd 0), race-free.
 *
 * The previous event-based reader attached `.on("data")`/`.on("end")` only
 * AFTER ESM init + arg parsing + an await. A small heredoc/pipe that EOFs
 * immediately could end before those listeners attached, losing the input
 * and resolving empty — observed as `voice html <<EOF …` intermittently
 * clearing the stage instead of setting it. `readFileSync(0)` captures every
 * buffered byte regardless of when it runs, eliminating the race.
 *
 * Returns null (caller falls back to the async stream reader) when fd 0 is
 * non-blocking (EAGAIN) or otherwise not synchronously readable. Must only
 * be used when stdin is not an interactive TTY — a TTY read blocks to EOF.
 */
function readStdinSync(): string | null {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return null;
  }
}

async function readStdinStream(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

/**
 * Read all of stdin as a string (trimmed).
 */
export async function readStdin(): Promise<string> {
  const sync = readStdinSync();
  if (sync !== null) return sync.trim();
  return (await readStdinStream()).trim();
}

/**
 * Read all of stdin as a string without trimming (verbatim bytes).
 */
export async function readStdinRaw(): Promise<string> {
  const sync = readStdinSync();
  if (sync !== null) return sync;
  return readStdinStream();
}
