/**
 * ESLint validation engine for jsdoczoom.
 *
 * @summary Bridge between ESLint API and jsdoczoom validation/lint formats
 */

import tsParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import jsdocPlugin from "eslint-plugin-jsdoc";
import plugin from "./eslint-plugin.js";
import type { LintDiagnostic, ValidationStatus } from "./types.js";

/** Common invalid JSDoc tags and their recommended replacements */
const TAG_MIGRATION_HINTS: Record<string, string> = {
	"@remarks": "Move content to the description paragraph (prose before tags)",
	"@packageDocumentation": "Use @module instead",
	"@concept": "Move content to the description paragraph",
	"@constraint": "Move content to the description paragraph",
	"@vitest-environment":
		"Use a plain comment instead: // @vitest-environment node",
};

/**
 * Enhance a check-tag-names diagnostic message with a migration hint
 * if the invalid tag is a commonly encountered one.
 *
 * @param message - Original ESLint diagnostic message
 * @returns Enhanced message with hint, or original message if no hint available
 */
function enhanceTagNameMessage(message: string): string {
	for (const [tag, hint] of Object.entries(TAG_MIGRATION_HINTS)) {
		if (message.includes(tag)) {
			return `${message} (Hint: ${hint})`;
		}
	}
	return message;
}

/**
 * Creates an ESLint instance configured for validation mode.
 *
 * This linter only runs jsdoczoom's custom rules for file-level JSDoc validation.
 *
 * @returns Configured ESLint instance for validation
 */
export function createValidationLinter(): ESLint {
	const eslint = new ESLint({
		overrideConfigFile: true,
		overrideConfig: [
			{
				files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
				plugins: { jsdoczoom: plugin },
				rules: {
					"jsdoczoom/require-file-jsdoc": "error",
					"jsdoczoom/require-file-summary": "error",
					"jsdoczoom/require-file-description": "error",
				},
				languageOptions: {
					parser: tsParser,
					ecmaVersion: "latest" as const,
					sourceType: "module" as const,
				},
			},
		],
	});
	return eslint;
}

/**
 * Creates an ESLint instance configured for lint mode.
 *
 * This linter runs both jsdoczoom rules and eslint-plugin-jsdoc rules for comprehensive JSDoc validation.
 *
 * @param cwd - Optional working directory for ESLint base path resolution
 * @returns Configured ESLint instance for lint mode
 */
export function createLintLinter(cwd?: string): ESLint {
	const eslint = new ESLint({
		cwd,
		overrideConfigFile: true,
		overrideConfig: [
			{
				files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
				plugins: { jsdoczoom: plugin, jsdoc: jsdocPlugin },
				rules: {
					"jsdoczoom/require-file-jsdoc": "error",
					"jsdoczoom/require-file-summary": "error",
					"jsdoczoom/require-file-description": "error",
					"jsdoc/require-jsdoc": ["error", { publicOnly: true }],
					"jsdoc/require-param": "warn",
					"jsdoc/require-param-description": "warn",
					"jsdoc/require-returns": "warn",
					"jsdoc/require-returns-description": "warn",
					"jsdoc/require-throws": "warn",
					"jsdoc/check-param-names": "error",
					"jsdoc/check-tag-names": "error",
					"jsdoc/no-types": "error",
					"jsdoc/informative-docs": "error",
					"jsdoc/tag-lines": "off",
					"jsdoc/no-blank-blocks": "error",
					"jsdoc/require-description": "error",
				},
				languageOptions: {
					parser: tsParser,
					ecmaVersion: "latest" as const,
					sourceType: "module" as const,
				},
			},
		],
	});
	return eslint;
}

/**
 * Lints source text for validation mode and returns simplified messages.
 *
 * @param eslint - ESLint instance (typically from createValidationLinter)
 * @param sourceText - Source code to lint
 * @param filePath - Path to the file being linted
 * @returns Simplified message list with ruleId, messageId, and fatal flag
 */
export async function lintFileForValidation(
	eslint: ESLint,
	sourceText: string,
	filePath: string,
): Promise<
	Array<{ ruleId: string | null; messageId?: string; fatal?: boolean }>
> {
	const results = await eslint.lintText(sourceText, { filePath });
	if (results.length === 0) return [];
	return results[0].messages.map((msg) => ({
		ruleId: msg.ruleId,
		messageId: (msg as { messageId?: string }).messageId,
		fatal: msg.fatal,
	}));
}

/**
 * Extract the nearest symbol name from source text at a given line.
 * Looks at lines from the diagnostic line downward (up to 3 lines)
 * for function, class, method, or variable declarations.
 *
 * @param sourceText - Full file source text
 * @param line - 1-based line number from the diagnostic
 * @returns Symbol name if found, undefined otherwise
 */
function extractSymbolName(
	sourceText: string,
	line: number,
): string | undefined {
	const lines = sourceText.split("\n");
	const searchEnd = Math.min(line + 2, lines.length);
	const declarationPattern =
		/(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|(\w+)\s*\()/;
	for (let i = line - 1; i <= searchEnd; i++) {
		const match = lines[i]?.match(declarationPattern);
		if (match) {
			return match[1] ?? match[2] ?? match[3] ?? match[4];
		}
	}
	return undefined;
}

/**
 * Lints source text for lint mode and returns detailed diagnostics.
 *
 * @param eslint - ESLint instance (typically from createLintLinter)
 * @param sourceText - Source code to lint
 * @param filePath - Path to the file being linted
 * @returns Array of lint diagnostics with line, column, rule, message, and severity
 */
export async function lintFileForLint(
	eslint: ESLint,
	sourceText: string,
	filePath: string,
): Promise<LintDiagnostic[]> {
	const results = await eslint.lintText(sourceText, { filePath });
	if (results.length === 0) return [];
	return results[0].messages.map((msg) => {
		const diagnostic: LintDiagnostic = {
			line: msg.line,
			column: msg.column,
			rule: msg.ruleId ?? "unknown",
			message:
				msg.ruleId === "jsdoc/check-tag-names"
					? enhanceTagNameMessage(msg.message)
					: msg.message,
			severity: msg.severity === 2 ? "error" : "warning",
		};
		const symbol = extractSymbolName(sourceText, msg.line);
		if (symbol) {
			diagnostic.symbol = symbol;
		}
		return diagnostic;
	});
}

/**
 * Maps ESLint messages to a single ValidationStatus using priority order.
 *
 * Priority order (first match wins):
 * 1. Parse errors (null ruleId with fatal flag) → syntax_error
 * 2. jsdoczoom/require-file-jsdoc → missing_jsdoc
 * 3. jsdoczoom/require-file-summary with missingSummary → missing_summary
 * 4. jsdoczoom/require-file-summary with multipleSummary → multiple_summary
 * 5. jsdoczoom/require-file-description → missing_description
 * 6. No matches → valid
 *
 * @param messages - Simplified ESLint messages from lintFileForValidation
 * @returns ValidationStatus or "valid"
 */
export function mapToValidationStatus(
	messages: Array<{
		ruleId: string | null;
		messageId?: string;
		fatal?: boolean;
	}>,
): ValidationStatus | "valid" {
	// Priority 1: Parse errors
	if (messages.some((msg) => msg.ruleId === null && msg.fatal)) {
		return "syntax_error";
	}

	// Priority 2: Missing JSDoc
	if (messages.some((msg) => msg.ruleId === "jsdoczoom/require-file-jsdoc")) {
		return "missing_jsdoc";
	}

	// Priority 3: Missing summary
	if (
		messages.some(
			(msg) =>
				msg.ruleId === "jsdoczoom/require-file-summary" &&
				msg.messageId === "missingSummary",
		)
	) {
		return "missing_summary";
	}

	// Priority 4: Multiple summary
	if (
		messages.some(
			(msg) =>
				msg.ruleId === "jsdoczoom/require-file-summary" &&
				msg.messageId === "multipleSummary",
		)
	) {
		return "multiple_summary";
	}

	// Priority 5: Missing description
	if (
		messages.some((msg) => msg.ruleId === "jsdoczoom/require-file-description")
	) {
		return "missing_description";
	}

	// No matches
	return "valid";
}
