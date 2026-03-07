import { addExpansion, formatExpansion, getExpansion, listKeys, removeExpansion } from "../expansion-store.js";

export type CliArgs =
  | { action: "list" }
  | { action: "view"; key: string }
  | { action: "add"; key: string; facts: string[] }
  | { action: "remove"; key: string }
  | { action: "usage" };

export function parseArgs(argv: string[]): CliArgs {
  if (argv.length === 0) return { action: "usage" };
  if (argv[0] === "--list") return { action: "list" };
  const key = argv[0];
  if (argv.length === 1) return { action: "view", key };
  if (argv[1] === "-d") return { action: "remove", key };
  return { action: "add", key, facts: argv.slice(1) };
}

export function run(args: CliArgs): string {
  switch (args.action) {
    case "list": {
      const keys = listKeys();
      return keys.join(",");
    }
    case "view": {
      const facts = getExpansion(args.key);
      if (facts === undefined) {
        void process.stderr.write(`Error: term "${args.key}" not found\n`);
        process.exit(1);
      }
      return formatExpansion(args.key, facts);
    }
    case "add": {
      addExpansion(args.key, args.facts);
      return "";
    }
    case "remove": {
      const found = removeExpansion(args.key);
      if (!found) {
        void process.stderr.write(`Error: term "${args.key}" not found\n`);
        process.exit(1);
      }
      return "";
    }
    case "usage": {
      void process.stderr.write(
        "Usage:\n" +
          "  expansion --list\n" +
          "  expansion <key>\n" +
          "  expansion <key> <fact1> [fact2 ...]\n" +
          "  expansion <key> -d\n",
      );
      process.exit(0);
    }
  }
}

// Entry point — only runs when executed directly
const currentFile = new URL(import.meta.url).pathname;
const scriptArg = process.argv[1];
if (scriptArg && (currentFile === scriptArg || currentFile.endsWith(scriptArg))) {
  const cliArgs = parseArgs(process.argv.slice(2));
  const output = run(cliArgs);
  if (output) void process.stdout.write(`${output}\n`);
}
