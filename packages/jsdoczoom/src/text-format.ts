import type { DrilldownResult, OutputEntry, OutputItemNext } from "./types.js";

/**
 * Formats drilldown results as human-readable text for shell piping.
 * Each item gets a `# id` header line followed by its content.
 * Items are separated by blank lines.
 *
 * @summary Plain-text output formatter for drilldown results
 */

/**
 * Format a single output entry as a text block (header + content).
 */
function formatEntry(entry: OutputEntry): string {
	if ("error" in entry) {
		return `# ${entry.id} [${entry.error.code}]\n${entry.error.message}`;
	}

	const text = entry.text.trimEnd();

	if ("next_id" in entry) {
		const lines = [`# ${entry.next_id}`];
		const children = (entry as OutputItemNext).children;
		if (children) {
			lines.push(`## children: ${children.join(", ")}`);
		}
		if (text) lines.push(text);
		return lines.join("\n");
	}

	// Terminal item
	if (!text) return `# ${entry.id}`;
	return `# ${entry.id}\n${text}`;
}

/**
 * Format a DrilldownResult as plain text for CLI output.
 * Returns the formatted string with a trailing newline.
 */
export function formatTextOutput(result: DrilldownResult): string {
	const blocks = result.items.map(formatEntry);
	let output = blocks.join("\n\n");

	if (result.truncated && result.total !== undefined) {
		output += `\n\n# truncated (showing ${result.items.length} of ${result.total})`;
	} else if (result.truncated) {
		output += "\n\n# truncated";
	}

	return `${output}\n`;
}
