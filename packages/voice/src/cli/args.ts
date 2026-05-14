/**
 * argv parsing helpers for the voice CLI
 */

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
 * Read all of stdin as a string.
 */
export async function readStdin(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").trim()));
    process.stdin.on("error", reject);
  });
}
