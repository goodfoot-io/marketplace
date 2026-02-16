/**
 * PostToolUse hook that enriches Grep/Glob results with JSDoc summaries.
 *
 * After a Grep or Glob tool returns file paths, this hook filters for
 * .ts/.tsx files and runs drilldownFiles to extract JSDoc summaries,
 * returning them as additional context for Claude.
 *
 * @summary Enriches search results with JSDoc drill-down summaries
 */

import {
	postToolUseHook,
	postToolUseOutput,
} from "@goodfoot/claude-code-hooks";
import { drilldownFiles } from "../drilldown.js";
import type { DrilldownResult } from "../types.js";

/**
 * Extract unique absolute .ts/.tsx file paths from a tool response string.
 *
 * Handles both Glob output (bare file paths) and Grep output
 * (files_with_matches paths or content-mode "path:line:content" lines).
 */
function extractTsFilePaths(toolResponse: unknown): string[] {
	const raw = String(toolResponse ?? "");
	if (!raw.trim()) return [];

	const lines = raw.split("\n");
	const paths = new Set<string>();

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || !trimmed.startsWith("/")) continue;

		// Absolute path, possibly with :line:content suffix from Grep content mode.
		// Extract everything up to the first colon after the leading slash.
		const colonIdx = trimmed.indexOf(":", 1);
		const candidate = colonIdx > 0 ? trimmed.slice(0, colonIdx) : trimmed;

		if (candidate.endsWith(".ts") || candidate.endsWith(".tsx")) {
			paths.add(candidate);
		}
	}

	return [...paths];
}

/** Format a DrilldownResult into a readable string for context injection. */
function formatDrilldownResult(result: DrilldownResult): string {
	if (result.items.length === 0) return "";

	const parts: string[] = [];
	for (const item of result.items) {
		if ("error" in item) {
			parts.push(`${item.id}: [${item.error.code}] ${item.error.message}`);
		} else {
			parts.push(item.text);
		}
	}

	let output = parts.join("\n\n");
	if (result.truncated) {
		output += "\n\n[Results truncated]";
	}
	return output;
}

export default postToolUseHook(
	{ matcher: "Grep|Glob" },
	(input, { logger }) => {
		const filePaths = extractTsFilePaths(input.tool_response);

		if (filePaths.length === 0) {
			logger.debug("No .ts/.tsx files found in tool response");
			return postToolUseOutput({});
		}

		logger.info("Running JSDoc drilldown on search results", {
			fileCount: filePaths.length,
		});

		const result = drilldownFiles(filePaths, 1, input.cwd);
		const formatted = formatDrilldownResult(result);

		if (!formatted) {
			return postToolUseOutput({});
		}

		return postToolUseOutput({
			systemMessage: formatted,
			hookSpecificOutput: {
				additionalContext: formatted,
			},
		});
	},
);
