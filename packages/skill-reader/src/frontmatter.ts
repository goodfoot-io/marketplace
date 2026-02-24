/** Result of parsing frontmatter from a SKILL.md file */
export interface FrontmatterResult {
	frontmatter: Record<string, string>;
	body: string;
}

/**
 * Extracts YAML frontmatter from SKILL.md content.
 * Supports single-line key:value pairs and multiline block scalars (| and >).
 * Does not support nested objects or arrays.
 */
export function parseFrontmatter(content: string): FrontmatterResult {
	const match = /^---[^\S\n]*\n([\s\S]*?)\n---[^\S\n]*(?:\n|$)/.exec(content);

	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const yamlBlock = match[1];
	const body = content.slice(match[0].length);
	const frontmatter: Record<string, string> = {};

	const lines = yamlBlock.split("\n");
	let currentKey: string | null = null;
	let currentLines: string[] = [];
	let blockMode: "literal" | "folded" | null = null;

	const flushBlock = (): void => {
		if (currentKey === null) return;

		if (blockMode === "literal") {
			// Preserve newlines as-is, append trailing newline
			frontmatter[currentKey] = `${currentLines.join("\n")}\n`;
		} else if (blockMode === "folded") {
			// Join lines with spaces, append trailing newline
			frontmatter[currentKey] = `${currentLines.join(" ")}\n`;
		}

		currentKey = null;
		currentLines = [];
		blockMode = null;
	};

	for (const line of lines) {
		// Continuation line (starts with whitespace) — part of a block scalar
		if (blockMode !== null && /^\s/.test(line)) {
			currentLines.push(line.trim());
			continue;
		}

		// We have a block in progress but hit a non-indented line — flush it
		if (blockMode !== null) {
			flushBlock();
		}

		// Try to match a key: value pair
		const keyValueMatch = /^([\w-]+):\s*(.*)$/.exec(line);
		if (!keyValueMatch) {
			// Skip lines that don't match (e.g. list items `  - tag1` at top level,
			// or blank lines within a non-block context)
			continue;
		}

		const key = keyValueMatch[1];
		const rawValue = keyValueMatch[2].trim();

		if (rawValue === "|") {
			// Literal block scalar
			currentKey = key;
			currentLines = [];
			blockMode = "literal";
		} else if (rawValue === ">") {
			// Folded block scalar
			currentKey = key;
			currentLines = [];
			blockMode = "folded";
		} else {
			// Single-line value — strip surrounding quotes if present
			let value = rawValue;
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			frontmatter[key] = value;
		}
	}

	// Flush any remaining block
	flushBlock();

	return { frontmatter, body };
}
