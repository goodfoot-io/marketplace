#!/usr/bin/env node

import { resolve } from "node:path";
import { drilldown, drilldownFiles } from "./drilldown.js";
import { JsdocError } from "./errors.js";
import { parseSelector } from "./selector.js";
import type { SelectorInfo, ValidationResult } from "./types.js";
import { validate, validateFiles } from "./validate.js";

const HELP_TEXT = `Usage: jsdoczoom [options] [selector]

Progressively explore TypeScript codebase documentation.

Options:
  -h, --help       Show this help text
  -v, --validate   Run validation mode
  --pretty         Format JSON output with 2-space indent

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
	pretty: boolean;
	selectorArg: string | undefined;
} {
	let help = false;
	let validateMode = false;
	let pretty = false;
	let selectorArg: string | undefined;

	for (const arg of args) {
		if (arg === "-h" || arg === "--help") {
			help = true;
		} else if (arg === "-v" || arg === "--validate") {
			validateMode = true;
		} else if (arg === "--pretty") {
			pretty = true;
		} else if (selectorArg === undefined) {
			selectorArg = arg;
		}
	}

	return { help, validateMode, pretty, selectorArg };
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
 * Main CLI entry point. Exported for testability.
 */
export async function main(args: string[], stdin?: string): Promise<void> {
	const { help, validateMode, pretty, selectorArg } = parseArgs(args);

	if (help) {
		process.stdout.write(HELP_TEXT);
		return;
	}

	try {
		const cwd = process.cwd();

		if (stdin !== undefined) {
			// Stdin mode: file paths piped in
			const stdinPaths = parseStdinPaths(stdin, cwd);
			const depth =
				selectorArg !== undefined
					? extractDepthFromArg(selectorArg)
					: undefined;

			if (validateMode) {
				const result = validateFiles(stdinPaths, cwd);
				writeResult(result, pretty);
				handleValidationExitCode(result);
			} else {
				const result = drilldownFiles(stdinPaths, depth, cwd);
				writeResult(result, pretty);
			}
		} else {
			// No stdin: use selector argument or default
			const selector: SelectorInfo = selectorArg
				? parseSelector(selectorArg)
				: { type: "glob", pattern: "**/*.{ts,tsx}", depth: undefined };

			if (validateMode) {
				const result = validate(selector, cwd);
				writeResult(result, pretty);
				handleValidationExitCode(result);
			} else {
				const result = drilldown(selector, cwd);
				writeResult(result, pretty);
			}
		}
	} catch (error: unknown) {
		if (error instanceof JsdocError) {
			process.stderr.write(`${JSON.stringify(error.toJSON())}\n`);
			process.exitCode = 1;
		} else {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(
				`${JSON.stringify({ error: { code: "INTERNAL_ERROR", message } })}\n`,
			);
			process.exitCode = 1;
		}
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
	if (result.summary.failed > 0) {
		process.stderr.write(
			`${JSON.stringify(
				new JsdocError(
					"VALIDATION_FAILED",
					`${result.summary.failed} file(s) failed validation`,
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
		return false;
	}
}

if (isDirectRun()) {
	const stdinText = process.stdin.isTTY ? undefined : await readStdin();
	main(process.argv.slice(2), stdinText).catch(() => {
		// Error already handled in main
	});
}
