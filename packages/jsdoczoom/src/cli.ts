#!/usr/bin/env node

import { resolve } from "node:path";
import { drilldown, drilldownFiles } from "./drilldown.js";
import { JsdocError } from "./errors.js";
import { parseSelector } from "./selector.js";
import { SKILL_TEXT } from "./skill-text.js";
import type {
	SelectorInfo,
	ValidationResult,
	ValidationStatus,
} from "./types.js";
import { validate, validateFiles } from "./validate.js";

/**
 * Parses argv flags (--help, --validate, --skill, --pretty, --limit,
 * --no-gitignore), dispatches to drilldown or validation mode, and handles
 * stdin piping. Errors are written to stderr as JSON; validation failures
 * use exit code 2 while other errors use exit code 1.
 *
 * @summary CLI entry point -- argument parsing, mode dispatch, and exit code handling
 */

const HELP_TEXT = `Usage: jsdoczoom [options] [selector]

Progressively explore TypeScript codebase documentation.
Each file has four detail levels (1-indexed): @1 summary, @2 description,
@3 type declarations, @4 full source. Higher depth = more detail.

Options:
  -h, --help       Show this help text
  -v, --validate   Run validation mode
  -s, --skill      Print JSDoc writing guidelines
  --pretty         Format JSON output with 2-space indent
  --limit N        Max results shown (default 100)
  --no-gitignore   Include files ignored by .gitignore

Selector:
  A glob pattern or file path, optionally with @depth suffix (1-4).
  Examples:
    jsdoczoom src/**/*.ts       # All .ts files at depth 1 (summary)
    jsdoczoom src/index.ts@2    # Single file at depth 2 (description)
    jsdoczoom **/*.ts@3         # All .ts files at depth 3 (type decls)

Stdin:
  Pipe file paths one per line:
    find . -name "*.ts" | jsdoczoom
    find . -name "*.ts" | jsdoczoom @2
    find . -name "*.ts" | jsdoczoom -v

Output:
  JSON items. Items with "next_id" have more detail; use that value as the next
  selector. Items with "id" (no next_id) are at terminal depth.

Barrel gating (glob mode):
  index.ts files with a @summary gate sibling files at depths 1-2.
  At depth 3 the barrel disappears and its children appear at depth 1.

Workflow:
  $ jsdoczoom src/**/*.ts
  { "items": [{ "next_id": "src/utils@2", "text": "..." }, ...] }

  $ jsdoczoom src/utils@2                # use next_id from above
  { "items": [{ "next_id": "src/utils@3", "text": "..." }] }

  $ jsdoczoom src/utils@3                # use next_id again
  { "items": [{ "id": "src/utils@3", "text": "..." }] }
  # "id" instead of "next_id" means terminal depth — stop here
`;

/**
 * Parse CLI arguments into flags and positional args.
 */
function parseArgs(args: string[]): {
	help: boolean;
	validateMode: boolean;
	skillMode: boolean;
	pretty: boolean;
	limit: number;
	gitignore: boolean;
	selectorArg: string | undefined;
} {
	let help = false;
	let validateMode = false;
	let skillMode = false;
	let pretty = false;
	let limit = 100;
	let gitignore = true;
	let selectorArg: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-h" || arg === "--help") {
			help = true;
		} else if (arg === "-v" || arg === "--validate") {
			validateMode = true;
		} else if (arg === "-s" || arg === "--skill") {
			skillMode = true;
		} else if (arg === "--pretty") {
			pretty = true;
		} else if (arg === "--limit") {
			const next = args[++i];
			limit = Number(next);
		} else if (arg === "--no-gitignore") {
			gitignore = false;
		} else if (selectorArg === undefined) {
			selectorArg = arg;
		}
	}

	return {
		help,
		validateMode,
		skillMode,
		pretty,
		limit,
		gitignore,
		selectorArg,
	};
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
function processStdin(
	stdin: string,
	selectorArg: string | undefined,
	validateMode: boolean,
	pretty: boolean,
	limit: number,
	cwd: string,
): void {
	const stdinPaths = parseStdinPaths(stdin, cwd);
	const depth =
		selectorArg !== undefined ? extractDepthFromArg(selectorArg) : undefined;

	if (validateMode) {
		const result = validateFiles(stdinPaths, cwd, limit);
		writeValidationResult(result, pretty);
	} else {
		const result = drilldownFiles(stdinPaths, depth, cwd, limit);
		writeResult(result, pretty);
	}
}

/**
 * Process selector mode: glob or path argument.
 */
function processSelector(
	selectorArg: string | undefined,
	validateMode: boolean,
	pretty: boolean,
	limit: number,
	gitignore: boolean,
	cwd: string,
): void {
	const selector: SelectorInfo = selectorArg
		? parseSelector(selectorArg)
		: { type: "glob", pattern: "**/*.{ts,tsx}", depth: undefined };

	if (validateMode) {
		const result = validate(selector, cwd, limit, gitignore);
		writeValidationResult(result, pretty);
	} else {
		const result = drilldown(selector, cwd, gitignore, limit);
		writeResult(result, pretty);
	}
}

/**
 * Write an error to stderr as JSON and set exit code.
 */
function writeError(error: unknown): void {
	if (error instanceof JsdocError) {
		process.stderr.write(`${JSON.stringify(error.toJSON())}\n`);
		process.exitCode = 1;
		return;
	}

	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(
		`${JSON.stringify({ error: { code: "INTERNAL_ERROR", message } })}\n`,
	);
	process.exitCode = 1;
}

/**
 * Main CLI entry point. Exported for testability.
 */
export async function main(args: string[], stdin?: string): Promise<void> {
	const {
		help,
		validateMode,
		skillMode,
		pretty,
		limit,
		gitignore,
		selectorArg,
	} = parseArgs(args);

	if (help) {
		process.stdout.write(HELP_TEXT);
		return;
	}

	if (skillMode) {
		process.stdout.write(SKILL_TEXT);
		return;
	}

	try {
		const cwd = process.cwd();
		if (stdin !== undefined) {
			processStdin(stdin, selectorArg, validateMode, pretty, limit, cwd);
		} else {
			processSelector(selectorArg, validateMode, pretty, limit, gitignore, cwd);
		}
	} catch (error: unknown) {
		writeError(error);
	}
}

/**
 * Write a result to stdout as JSON.
 */
function writeResult(result: unknown, pretty: boolean): void {
	const json = pretty
		? JSON.stringify(result, null, 2)
		: JSON.stringify(result);
	process.stdout.write(`${json}\n`);
}

/** Status keys used to detect validation failures */
const STATUS_KEYS: ValidationStatus[] = [
	"syntax_error",
	"missing_jsdoc",
	"missing_summary",
	"multiple_summary",
	"missing_description",
	"missing_barrel",
];

/**
 * Count invalid files across all validation groups.
 */
function countInvalid(result: ValidationResult): number {
	return STATUS_KEYS.reduce(
		(sum, k) => sum + (result[k]?.files.length ?? 0),
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
		writeResult({ ...result, success: false }, pretty);
		process.stderr.write(
			`${JSON.stringify(
				new JsdocError(
					"VALIDATION_FAILED",
					`${invalidCount} file(s) failed validation`,
				).toJSON(),
			)}\n`,
		);
		process.exitCode = 2;
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
