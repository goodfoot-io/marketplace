#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drilldown, drilldownFiles } from "./drilldown.js";
import { JsdocError } from "./errors.js";
import { lint } from "./lint.js";
import { parseSelector } from "./selector.js";
import { RULE_EXPLANATIONS, SKILL_TEXT } from "./skill-text.js";
import type { LintResult, SelectorInfo, ValidationResult } from "./types.js";
import { VALIDATION_STATUS_PRIORITY } from "./types.js";
import { validate } from "./validate.js";

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
  -c, --check      Run validation mode
  -l, --lint       Run lint mode (comprehensive JSDoc quality)
  -s, --skill      Print JSDoc writing guidelines
  --pretty         Format JSON output with 2-space indent
  --limit N        Max results shown (default 500)
  --no-gitignore   Include files ignored by .gitignore
  --explain-rule R  Explain a lint rule with examples (e.g. jsdoc/informative-docs)

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
    find . -name "*.ts" | jsdoczoom -c

Output:
  JSON items. Items with "next_id" have more detail; use that value as the next
  selector. Items with "id" (no next_id) are at terminal depth.

Barrel gating (glob mode):
  A barrel's @summary and description reflect the cumulative functionality
  of its directory's children, not the barrel file itself. Barrels with a
  @summary gate sibling files at depths 1-2. At depth 3 the barrel
  disappears and its children appear at depth 1.

Modes:
  -c  Validate file-level structure (has JSDoc block, @summary, description)
  -l  Lint comprehensive JSDoc quality (file-level + function-level tags)

Exit codes:
  0  Success (all files pass)
  1  Runtime error (invalid arguments, missing files)
  2  Validation or lint failures found

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
	version: boolean;
	checkMode: boolean;
	lintMode: boolean;
	skillMode: boolean;
	pretty: boolean;
	limit: number;
	gitignore: boolean;
	explainRule: string | undefined;
	selectorArg: string | undefined;
} {
	let help = false;
	let version = false;
	let checkMode = false;
	let lintMode = false;
	let skillMode = false;
	let pretty = false;
	let limit = 500;
	let gitignore = true;
	let explainRule: string | undefined;
	let selectorArg: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-h" || arg === "--help") {
			help = true;
		} else if (arg === "-v" || arg === "--version") {
			version = true;
		} else if (arg === "-c" || arg === "--check") {
			checkMode = true;
		} else if (arg === "-l" || arg === "--lint") {
			lintMode = true;
		} else if (arg === "-s" || arg === "--skill") {
			skillMode = true;
		} else if (arg === "--pretty") {
			pretty = true;
		} else if (arg === "--limit") {
			const next = args[++i];
			limit = Number(next);
		} else if (arg === "--no-gitignore") {
			gitignore = false;
		} else if (arg === "--explain-rule") {
			const next = args[++i];
			explainRule = next;
		} else if (arg.startsWith("-")) {
			throw new JsdocError("INVALID_SELECTOR", `Unrecognized option: ${arg}`);
		} else if (selectorArg === undefined) {
			selectorArg = arg;
		}
	}

	return {
		help,
		version,
		checkMode,
		lintMode,
		skillMode,
		pretty,
		limit,
		gitignore,
		explainRule,
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
async function processStdin(
	stdin: string,
	selectorArg: string | undefined,
	checkMode: boolean,
	lintMode: boolean,
	pretty: boolean,
	limit: number,
	cwd: string,
): Promise<void> {
	const stdinPaths = parseStdinPaths(stdin, cwd);
	const depth =
		selectorArg !== undefined ? extractDepthFromArg(selectorArg) : undefined;

	if (lintMode) {
		const { lintFiles } = await import("./lint.js");
		const result = await lintFiles(stdinPaths, cwd, limit);
		writeLintResult(result, pretty);
	} else if (checkMode) {
		const { validateFiles } = await import("./validate.js");
		const result = await validateFiles(stdinPaths, cwd, limit);
		writeValidationResult(result, pretty);
	} else {
		const result = drilldownFiles(stdinPaths, depth, cwd, limit);
		writeResult(result, pretty);
	}
}

/**
 * Process selector mode: glob or path argument.
 */
async function processSelector(
	selectorArg: string | undefined,
	checkMode: boolean,
	lintMode: boolean,
	pretty: boolean,
	limit: number,
	gitignore: boolean,
	cwd: string,
): Promise<void> {
	const selector: SelectorInfo = selectorArg
		? parseSelector(selectorArg)
		: { type: "glob", pattern: "**/*.{ts,tsx}", depth: undefined };

	if (lintMode) {
		const result = await lint(selector, cwd, limit, gitignore);
		writeLintResult(result, pretty);
	} else if (checkMode) {
		const result = await validate(selector, cwd, limit, gitignore);
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
	try {
		const {
			help,
			version,
			checkMode,
			lintMode,
			skillMode,
			pretty,
			limit,
			gitignore,
			explainRule,
			selectorArg,
		} = parseArgs(args);

		if (help) {
			process.stdout.write(HELP_TEXT);
			return;
		}

		if (version) {
			const pkgPath = resolve(
				dirname(fileURLToPath(import.meta.url)),
				"..",
				"package.json",
			);
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
				version: string;
			};
			process.stdout.write(`${pkg.version}\n`);
			return;
		}

		if (skillMode) {
			process.stdout.write(SKILL_TEXT);
			return;
		}

		if (explainRule !== undefined) {
			const explanation = RULE_EXPLANATIONS[explainRule];
			if (explanation) {
				process.stdout.write(explanation);
			} else {
				const available = Object.keys(RULE_EXPLANATIONS).join(", ");
				writeError(
					new JsdocError(
						"INVALID_SELECTOR",
						`Unknown rule: ${explainRule}. Available rules: ${available}`,
					),
				);
			}
			return;
		}

		if (checkMode && lintMode) {
			writeError(
				new JsdocError("INVALID_SELECTOR", "Cannot use -c and -l together"),
			);
			return;
		}

		const cwd = process.cwd();
		if (stdin !== undefined) {
			await processStdin(
				stdin,
				selectorArg,
				checkMode,
				lintMode,
				pretty,
				limit,
				cwd,
			);
		} else {
			await processSelector(
				selectorArg,
				checkMode,
				lintMode,
				pretty,
				limit,
				gitignore,
				cwd,
			);
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
	writeResult(result, pretty);
	if (result.summary.filesWithIssues > 0) {
		process.exitCode = 2;
		// Warn if output was truncated
		if (result.summary.filesWithIssues > result.files.length) {
			process.stderr.write(
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
