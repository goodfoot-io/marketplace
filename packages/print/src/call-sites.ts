#!/usr/bin/env node

// Re-export the CallSiteFinder for library usage
export { CallSiteFinder, type CallSiteFinderOptions, type CallSiteFinderResult, type CallSite, type FunctionDefinition } from "./lib/CallSiteFinder.js";

// If this file is run directly, execute the CLI functionality
if (import.meta.url === `file://${process.argv[1]}`) {
  const { CallSiteFinder } = await import("./lib/CallSiteFinder.js");

  const args = process.argv.slice(2);

  function printUsage() {
    console.log(`
Usage: print-call-sites <function-name> <source-file> [options]

Find all call sites of a function or method in a TypeScript codebase.

Arguments:
  function-name    Name of the function or method to find calls for
  source-file      Path to the file containing the function definition

Options:
  --class <name>   Specify the class name if looking for a method
  --project <path> Path to tsconfig.json (auto-detected if not provided)
  --search <glob>  Glob pattern to limit search scope (can be repeated)
  -h, --help       Show this help message

Examples:
  print-call-sites formatDate src/utils/formatter.ts
  print-call-sites render src/components/Button.ts --class Button
  print-call-sites helper src/lib/helper.ts --search "src/**/*.ts"
`);
  }

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args.length < 2) {
    console.error("Error: Both function-name and source-file are required");
    printUsage();
    process.exit(1);
  }

  const functionName = args[0];
  const sourceFile = args[1];
  let className: string | undefined;
  let projectPath: string | undefined;
  const searchGlobs: string[] = [];

  // Parse optional arguments
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--class" && i + 1 < args.length) {
      className = args[++i];
    } else if (arg === "--project" && i + 1 < args.length) {
      projectPath = args[++i];
    } else if (arg === "--search" && i + 1 < args.length) {
      searchGlobs.push(args[++i]);
    } else if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  const finder = new CallSiteFinder({
    functionName,
    sourceFile,
    className,
    projectPath,
    searchGlobs: searchGlobs.length > 0 ? searchGlobs : undefined,
  });

  try {
    const result = await finder.execute();

    console.log(`Function: ${result.definition.name}`);
    console.log(`Defined at: ${result.definition.file}:${result.definition.line}`);
    if (result.definition.className) {
      console.log(`Class: ${result.definition.className}`);
    }
    console.log(`\nFound ${result.callSites.length} call site(s):\n`);

    for (const site of result.callSites) {
      console.log(`  ${site.file}:${site.line}:${site.column}`);
      console.log(`    ${site.context.trim()}`);
      console.log();
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
