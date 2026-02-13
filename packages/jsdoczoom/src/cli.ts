#!/usr/bin/env node

import { resolve } from "node:path";
import { drilldown, drilldownFiles } from "./drilldown.js";
import { JsdocError } from "./errors.js";
import { parseSelector } from "./selector.js";
import { SKILL_TEXT } from "./skill-text.js";
import type { SelectorInfo, ValidationResult } from "./types.js";
import { validate, validateFiles } from "./validate.js";

const HELP_TEXT = `Usage: jsdoczoom [options] [selector]

Progressively explore TypeScript codebase documentation.

Options:
  -h, --help       Show this help text
  -v, --validate   Run validation mode
  -s, --skill      Print JSDoc writing guidelines
  --pretty         Format JSON output with 2-space indent
  --limit N        Max results shown (default 100)
  --no-gitignore   Include files ignored by .gitignore

Selector:
  A glob pattern or file path, optionally with @depth suffix.
  Examples:
    jsdoczoom src/**/*.ts       # All .ts files at depth 0
    jsdoczoom src/index.ts@2    # Single file at depth 2
    jsdoczoom **/*.ts@1         # All .ts files at depth 1

Stdin:
  Pipe file paths one per line:
    find . -name "*.ts" | jsdoczoom
    find . -name "*.ts" | jsdoczoom @2
    find . -name "*.ts" | jsdoczoom -v
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
		writeResult(result, pretty);
		handleValidationExitCode(result);
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
		writeResult(result, pretty);
		handleValidationExitCode(result);
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

/**
 * Set exit code 2 if validation has failures.
 */
function handleValidationExitCode(result: ValidationResult): void {
	if (result.summary.invalid > 0) {
		process.stderr.write(
			`${JSON.stringify(
				new JsdocError(
					"VALIDATION_FAILED",
					`${result.summary.invalid} file(s) failed validation`,
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
