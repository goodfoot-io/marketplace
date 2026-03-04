#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drilldown, drilldownFiles } from "./drilldown.js";
import { JsdocError } from "./errors.js";
import { lint, lintFiles } from "./lint.js";
import { search, searchFiles } from "./search.js";
import { parseSelector } from "./selector.js";
import { RULE_EXPLANATIONS, SKILL_TEXT } from "./skill-text.js";
import { formatTextOutput } from "./text-format.js";
import type {
	CacheConfig,
	LintResult,
	SelectorInfo,
	ValidationResult,
} from "./types.js";
import { DEFAULT_CACHE_DIR, VALIDATION_STATUS_PRIORITY } from "./types.js";
import { validate, validateFiles } from "./validate.js";

/**
 * Parses argv flags (--help, --version, --check, --lint, --skill, --pretty,
 * --limit, --no-gitignore), dispatches to drilldown, validation, or lint mode,
 * and handles stdin piping. Errors are written to stderr as JSON; validation
 * and lint failures use exit code 2 while other errors use exit code 1.
 *
 * @summary CLI entry point -- argument parsing, mode dispatch, and exit code handling
 */

const HELP_TEXT = `Usage: jsdoczoom [options] [selector]

Progressively explore TypeScript codebase documentation.
Each file has four detail levels (1-indexed): @1 summary, @2 description,
@3 type declarations, @4 full source. Higher depth = more detail.

Options:
  -h, --help       Show this help text
  -v, --version    Show version number
  -c, --check      Validate file-level structure (has JSDoc block, @summary, description)
  -l, --lint       Lint comprehensive JSDoc quality (file-level + function-level tags)
  -s, --skill      Print JSDoc writing guidelines
  --json           Output as JSON (default is plain text)
  --pretty         Format JSON output with 2-space indent (use with --json)
  --limit N        Max results shown (default 500)
  --no-gitignore   Include files ignored by .gitignore
  --search <query>   Search files by regex pattern
  --disable-cache    Skip all cache operations
  --cache-directory  Override cache directory (default: system temp)
  --explain-rule R  Explain a lint rule with examples (e.g. jsdoc/informative-docs)

Selector:
  A glob pattern or file path, optionally with @depth suffix (1-4).
	
  Examples:
    jsdoczoom src/**/*.ts       # All .ts files at depth 1 (summary)
    jsdoczoom src/foo.ts@2      # Single file at depth 2 (description)
    jsdoczoom **/*.ts@3         # All .ts files at depth 3 (type decls)

Search (--search):
  Searches all **/*.{ts,tsx} files (or a selector's file set) by regex.

  Examples:
    jsdoczoom --search "CacheConfig"          # find where CacheConfig is used
    jsdoczoom --search "auth-loader"          # searches file name
    jsdoczoom src/*.ts --search "TODO|FIXME"  # restrict to a file subset

Output:
  Plain text by default. Each item has a "# path@depth" header followed by
  content. Use the header value as the next selector to drill deeper.

  Use --json for machine-parseable JSON output, use "next_id" to drill deeper.

  Type declarations (@3) include source line annotations (// LN or // LN-LM)
  so you can locate the implementation in the source file.

Stdin:
  Pipe file paths one per line (useful with -c/-l for targeted validation):
    git diff --name-only | jsdoczoom -c    # validate changed files
    cat filelist.txt | jsdoczoom -l        # lint a specific set of files

Barrel gating (glob mode):
  A barrel's @summary and description reflect the cumulative functionality
  of its directory's children, not the barrel file itself. Barrels with a
  @summary gate sibling files at depths 1-2. At depth 3 the barrel
  disappears and its children appear at depth 1.

Exit codes:
  0  Success (all files pass)
  1  Runtime error (invalid arguments, missing files)
  2  Validation or lint failures found

Workflow:
  $ jsdoczoom src/**/*.ts                # list summaries
  $ jsdoczoom src/utils@2                # drill into description
  $ jsdoczoom src/utils@3                # see type declarations
  $ jsdoczoom src/**/*.ts | grep "^#"   # list all file headers
`;

/** Parsed CLI arguments */
interface ParsedArgs {
	help: boolean;
	version: boolean;
	checkMode: boolean;
	lintMode: boolean;
	skillMode: boolean;
	json: boolean;
	pretty: boolean;
	limit: number;
	gitignore: boolean;
	disableCache: boolean;
	cacheDirectory: string | undefined;
	explainRule: string | undefined;
	selectorArg: string | undefined;
	searchQuery: string | undefined;
}

/**
 * Parse a flag that requires a value argument.
 * @returns Updated index after consuming the value
 */
function parseValueFlag(
	args: string[],
	index: number,
): { value: string; nextIndex: number } {
	return { value: args[index + 1], nextIndex: index + 1 };
}

/**
 * Parse CLI arguments into flags and positional args.
 */
function parseArgs(args: string[]): ParsedArgs {
	const parsed: ParsedArgs = {
		help: false,
		version: false,
		checkMode: false,
		lintMode: false,
		skillMode: false,
		json: false,
		pretty: false,
		limit: 500,
		gitignore: true,
		disableCache: false,
		cacheDirectory: undefined,
		explainRule: undefined,
		selectorArg: undefined,
		searchQuery: undefined,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		// Boolean flags
		if (arg === "-h" || arg === "--help") {
			parsed.help = true;
			continue;
		}
		if (arg === "-v" || arg === "--version") {
			parsed.version = true;
			continue;
		}
		if (arg === "-c" || arg === "--check") {
			parsed.checkMode = true;
			continue;
		}
		if (arg === "-l" || arg === "--lint") {
			parsed.lintMode = true;
			continue;
		}
		if (arg === "-s" || arg === "--skill") {
			parsed.skillMode = true;
			continue;
		}
		if (arg === "--json") {
			parsed.json = true;
			continue;
		}
		if (arg === "--pretty") {
			parsed.pretty = true;
			continue;
		}
		if (arg === "--no-gitignore") {
			parsed.gitignore = false;
			continue;
		}
		if (arg === "--disable-cache") {
			parsed.disableCache = true;
			continue;
		}

		// Value flags
		if (arg === "--limit") {
			const { value, nextIndex } = parseValueFlag(args, i);
			parsed.limit = Number(value);
			i = nextIndex;
			continue;
		}
		if (arg === "--cache-directory") {
			const { value, nextIndex } = parseValueFlag(args, i);
			parsed.cacheDirectory = value;
			i = nextIndex;
			continue;
		}
		if (arg === "--explain-rule") {
			const { value, nextIndex } = parseValueFlag(args, i);
			parsed.explainRule = value;
			i = nextIndex;
			continue;
		}
		if (arg === "--search") {
			const { value, nextIndex } = parseValueFlag(args, i);
			if (value === undefined) {
				throw new JsdocError("INVALID_SELECTOR", "--search requires a value");
			}
			parsed.searchQuery = value;
			i = nextIndex;
			continue;
		}

		// Unknown flag or positional arg
		if (arg.startsWith("-")) {
			throw new JsdocError("INVALID_SELECTOR", `Unrecognized option: ${arg}`);
		}

		// Positional selector arg
		if (parsed.selectorArg === undefined) {
			parsed.selectorArg = arg;
		} else {
			throw new JsdocError(
				"INVALID_SELECTOR",
				`Unexpected extra argument: "${arg}" (only one selector is allowed — did you forget to quote the glob?)`,
			);
		}
	}

	return parsed;
}

/**
 * Resolve stdin file paths to absolute paths.
 */
function parseStdinPaths(stdin: string, cwd: string): string[] {
	return stdin
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => resolve(cwd, line));
}

/**
 * Extract depth from a selector argument string.
 * Returns undefined if no @depth suffix is present.
 */
function extractDepthFromArg(selectorArg: string): number | undefined {
	const parsed = parseSelector(selectorArg);
	return parsed.depth;
}

/**
 * Process stdin mode: file paths piped in.
 */
async function processStdin(
	stdin: string,
	selectorArg: string | undefined,
	checkMode: boolean,
	lintMode: boolean,
	json: boolean,
	pretty: boolean,
	limit: number,
	cwd: string,
	cacheConfig: CacheConfig,
	searchQuery: string | undefined,
): Promise<void> {
	const stdinPaths = parseStdinPaths(stdin, cwd);
	const depth =
		selectorArg !== undefined ? extractDepthFromArg(selectorArg) : undefined;

	if (searchQuery !== undefined) {
		const result = await searchFiles(
			stdinPaths,
			searchQuery,
			cwd,
			limit,
			cacheConfig,
		);
		writeDrilldownResult(result, json, pretty);
		return;
	}

	if (lintMode) {
		const result = await lintFiles(stdinPaths, cwd, limit, cacheConfig);
		writeLintResult(result, pretty);
	} else if (checkMode) {
		const result = await validateFiles(stdinPaths, cwd, limit, cacheConfig);
		writeValidationResult(result, pretty);
	} else {
		const result = await drilldownFiles(
			stdinPaths,
			depth,
			cwd,
			limit,
			cacheConfig,
		);
		writeDrilldownResult(result, json, pretty);
	}
}

/**
 * Process selector mode: glob or path argument.
 */
async function processSelector(
	selectorArg: string | undefined,
	checkMode: boolean,
	lintMode: boolean,
	json: boolean,
	pretty: boolean,
	limit: number,
	gitignore: boolean,
	cwd: string,
	cacheConfig: CacheConfig,
	searchQuery: string | undefined,
): Promise<void> {
	const selector: SelectorInfo = selectorArg
		? parseSelector(selectorArg)
		: { type: "glob", pattern: "**/*.{ts,tsx}", depth: undefined };

	if (searchQuery !== undefined) {
		const result = await search(
			{ type: selector.type, pattern: selector.pattern, depth: undefined },
			searchQuery,
			cwd,
			gitignore,
			limit,
			cacheConfig,
		);
		writeDrilldownResult(result, json, pretty);
		return;
	}

	if (lintMode) {
		const result = await lint(selector, cwd, limit, gitignore, cacheConfig);
		writeLintResult(result, pretty);
	} else if (checkMode) {
		const result = await validate(selector, cwd, limit, gitignore, cacheConfig);
		writeValidationResult(result, pretty);
	} else {
		const result = await drilldown(
			selector,
			cwd,
			gitignore,
			limit,
			cacheConfig,
		);
		writeDrilldownResult(result, json, pretty);
	}
}

/**
 * Write an error to stderr as JSON and set exit code.
 */
function writeError(error: unknown): void {
	if (error instanceof JsdocError) {
		void process.stderr.write(`${JSON.stringify(error.toJSON())}\n`);
		process.exitCode = 1;
		return;
	}

	const message = error instanceof Error ? error.message : String(error);
	void process.stderr.write(
		`${JSON.stringify({ error: { code: "INTERNAL_ERROR", message } })}\n`,
	);
	process.exitCode = 1;
}

/**
 * Handle --help flag by printing help text.
 */
function handleHelp(): void {
	void process.stdout.write(HELP_TEXT);
}

/**
 * Handle --version flag by reading and printing version from package.json.
 */
async function handleVersion(): Promise<void> {
	const pkgPath = resolve(
		dirname(fileURLToPath(import.meta.url)),
		"..",
		"package.json",
	);
	const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as {
		version: string;
	};
	void process.stdout.write(`${pkg.version}\n`);
}

/**
 * Handle --skill flag by printing JSDoc writing guidelines.
 */
function handleSkill(): void {
	void process.stdout.write(SKILL_TEXT);
}

/**
 * Handle --explain-rule flag by printing rule explanation.
 */
function handleExplainRule(ruleName: string): void {
	const explanation = RULE_EXPLANATIONS[ruleName];
	if (explanation) {
		void process.stdout.write(explanation);
		return;
	}

	const available = Object.keys(RULE_EXPLANATIONS).join(", ");
	writeError(
		new JsdocError(
			"INVALID_SELECTOR",
			`Unknown rule: ${ruleName}. Available rules: ${available}`,
		),
	);
}

/**
 * Handle early-exit flags that print output and return without processing files.
 * Returns true if an early-exit flag was handled.
 */
async function handleEarlyExitFlags(parsed: ParsedArgs): Promise<boolean> {
	if (parsed.help) {
		handleHelp();
		return true;
	}
	if (parsed.version) {
		await handleVersion();
		return true;
	}
	if (parsed.skillMode) {
		handleSkill();
		return true;
	}
	if (parsed.explainRule !== undefined) {
		handleExplainRule(parsed.explainRule);
		return true;
	}
	return false;
}

/**
 * Validate that mode flags are not used in incompatible combinations.
 * Returns true if validation passed (no conflicts), false if an error was written.
 */
function validateModeCombinations(parsed: ParsedArgs): boolean {
	if (parsed.checkMode && parsed.lintMode) {
		writeError(
			new JsdocError("INVALID_SELECTOR", "Cannot use -c and -l together"),
		);
		return false;
	}
	if (
		parsed.searchQuery !== undefined &&
		(parsed.checkMode || parsed.lintMode)
	) {
		writeError(
			new JsdocError("INVALID_SELECTOR", "Cannot use --search with -c or -l"),
		);
		return false;
	}
	return true;
}

/**
 * Main CLI entry point. Exported for testability.
 */
export async function main(args: string[], stdin?: string): Promise<void> {
	try {
		const parsed = parseArgs(args);

		if (await handleEarlyExitFlags(parsed)) return;
		if (!validateModeCombinations(parsed)) return;

		const cacheConfig: CacheConfig = {
			enabled: !parsed.disableCache,
			directory: parsed.cacheDirectory ?? DEFAULT_CACHE_DIR,
		};

		const cwd = process.cwd();
		if (stdin !== undefined) {
			await processStdin(
				stdin,
				parsed.selectorArg,
				parsed.checkMode,
				parsed.lintMode,
				parsed.json,
				parsed.pretty,
				parsed.limit,
				cwd,
				cacheConfig,
				parsed.searchQuery,
			);
		} else {
			await processSelector(
				parsed.selectorArg,
				parsed.checkMode,
				parsed.lintMode,
				parsed.json,
				parsed.pretty,
				parsed.limit,
				parsed.gitignore,
				cwd,
				cacheConfig,
				parsed.searchQuery,
			);
		}
	} catch (error: unknown) {
		writeError(error);
	}
}

/**
 * Write a drilldown result to stdout as text (default) or JSON.
 */
function writeDrilldownResult(
	result: import("./types.js").DrilldownResult,
	json: boolean,
	pretty: boolean,
): void {
	if (json) {
		writeResult(result, pretty);
	} else {
		void process.stdout.write(formatTextOutput(result));
	}
}

/**
 * Write a result to stdout as JSON.
 */
function writeResult(result: unknown, pretty: boolean): void {
	const json = pretty
		? JSON.stringify(result, null, 2)
		: JSON.stringify(result);
	void process.stdout.write(`${json}\n`);
}

/**
 * Count invalid files across all validation groups.
 */
function countInvalid(result: ValidationResult): number {
	return VALIDATION_STATUS_PRIORITY.reduce(
		(sum, status) => sum + (result[status]?.files.length ?? 0),
		0,
	);
}

/**
 * Write validation result to stdout and set exit code.
 * Adds success/message fields to the output.
 */
function writeValidationResult(
	result: ValidationResult,
	pretty: boolean,
): void {
	const invalidCount = countInvalid(result);

	if (invalidCount === 0) {
		writeResult(
			{ success: true, message: "All files passed validation" },
			pretty,
		);
	} else {
		writeResult(
			{
				...result,
				success: false,
				error: {
					code: "VALIDATION_FAILED",
					message: `${invalidCount} file(s) failed validation`,
				},
			},
			pretty,
		);
		process.exitCode = 2;
	}
}

/**
 * Write lint result to stdout and set exit code 2 if issues found.
 */
function writeLintResult(result: LintResult, pretty: boolean): void {
	if (result.summary.filesWithIssues === 0) return;
	writeResult(result, pretty);
	if (result.summary.filesWithIssues > 0) {
		process.exitCode = 2;
		// Warn if output was truncated
		if (result.summary.filesWithIssues > result.files.length) {
			void process.stderr.write(
				`Warning: output truncated to ${result.files.length} of ${result.summary.filesWithIssues} files with issues. Use --limit to see more.\n`,
			);
		}
	}
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

// Auto-invoke when run as CLI
function isDirectRun(): boolean {
	if (!process.argv[1]) return false;
	try {
		const scriptPath = process.argv[1].replace(/\\/g, "/");
		return (
			import.meta.url.endsWith(scriptPath) ||
			import.meta.url.endsWith("/cli.js")
		);
	} catch {
		// Cannot determine script path — safe to skip auto-invoke
		return false;
	}
}

if (isDirectRun()) {
	// Only read stdin when it's explicitly piped (isTTY === false, not just undefined)
	const stdinText =
		process.stdin.isTTY === false ? await readStdin() : undefined;
	main(process.argv.slice(2), stdinText).catch(() => {
		// Error already handled in main
	});
}
