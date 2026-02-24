import { execSync } from "node:child_process";
import { SkillReaderError } from "./errors.js";

/** Options for processContent */
export interface ProcessContentOptions {
	pluginRoot?: string;
	executeBash?: boolean;
}

/** Block bash pattern: ```! ... ``` */
const BLOCK_BASH_RE = /```!\s*\n?([\s\S]*?)\n?```/g;

/** Inline bash pattern: !`command` not preceded by word char or $ */
const INLINE_BASH_RE = /(?<!\w|\$)!`([^`]+)`/g;

/**
 * Runs a shell command synchronously and returns its trimmed stdout.
 * Throws SkillReaderError on failure.
 */
function runCommand(command: string): string {
	try {
		const stdout = execSync(command, {
			encoding: "utf-8",
			timeout: 10000,
			stdio: ["pipe", "pipe", "pipe"],
		});
		return stdout.trim();
	} catch (err) {
		throw new SkillReaderError(
			"BASH_EXECUTION_FAILED",
			`Bash execution failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

/**
 * Processes SKILL.md body content:
 * 1. Replaces ${CLAUDE_PLUGIN_ROOT} with the provided plugin root path.
 * 2. Executes embedded bash commands (block and inline) and substitutes their stdout.
 *
 * Block bash is processed before inline bash to avoid false matches inside block fences.
 */
export function processContent(
	body: string,
	options: ProcessContentOptions,
): string {
	// Step 1: Replace ${CLAUDE_PLUGIN_ROOT}
	let result = body.replace(
		/\$\{CLAUDE_PLUGIN_ROOT\}/g,
		options.pluginRoot ?? "",
	);

	// Step 2: Execute bash if not disabled
	if (options.executeBash !== false) {
		// Step 2a: Process block bash first
		result = result.replace(BLOCK_BASH_RE, (_match, command: string) => {
			return runCommand(command.trim());
		});

		// Step 2b: Process inline bash
		result = result.replace(INLINE_BASH_RE, (_match, command: string) => {
			return runCommand(command);
		});
	}

	return result;
}
