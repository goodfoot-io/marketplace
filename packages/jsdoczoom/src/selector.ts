import { JsdocError } from "./errors.js";
import type { SelectorInfo } from "./types.js";

/**
 * Parses a selector string into its components.
 *
 * @param input - Selector string (e.g., "src/star-star/star.ts@3", "file.ts", "../config.js@2")
 * @returns SelectorInfo with type, pattern, and optional depth
 * @throws JsdocError INVALID_SELECTOR if input is empty
 * @throws JsdocError INVALID_DEPTH if depth is negative, non-integer, or float
 */
export function parseSelector(input: string): SelectorInfo {
	if (!input || input.trim() === "") {
		throw new JsdocError("INVALID_SELECTOR", "Selector cannot be empty");
	}

	// Reject float depths like @2.5 before extracting integer depth
	if (/@\d+\.\d+$/.test(input)) {
		throw new JsdocError(
			"INVALID_DEPTH",
			"Depth must be an integer, not a float",
		);
	}

	let pattern = input;
	let depth: number | undefined;

	// Match @<digits> at the end of the string
	const depthMatch = input.match(/@(\d+)$/);
	if (depthMatch) {
		depth = parseInt(depthMatch[1], 10);
		pattern = input.substring(0, depthMatch.index);
	}

	const hasGlobChars = /[*?[\]{]/.test(pattern);

	return {
		type: hasGlobChars ? "glob" : "path",
		pattern,
		depth,
	};
}
