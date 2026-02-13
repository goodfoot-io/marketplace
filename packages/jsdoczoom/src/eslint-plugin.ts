import type { Rule, SourceCode } from "eslint";
import type { Comment, Node } from "estree";

/**
 * Custom ESLint plugin for jsdoczoom file-level JSDoc validation.
 *
 * Provides three rules that replicate the file-level JSDoc checks from
 * jsdoc-parser.ts: detecting presence of file-level JSDoc blocks,
 * validating exact lowercase @summary tags, and checking for description
 * content (free-text or description-synonym tags).
 *
 * @summary Custom ESLint plugin with file-level JSDoc validation rules
 */

/** Tags whose content is treated as description (free-text). */
const DESCRIPTION_TAGS = new Set([
	"desc",
	"description",
	"file",
	"fileoverview",
]);

/**
 * Find the file-level JSDoc block comment from the source code.
 *
 * The file-level JSDoc block is the first block comment that starts with
 * a single asterisk (not double) and appears before the first non-import
 * statement. When no non-import statements exist, the first qualifying
 * block comment in the file is used.
 */
function findFileJsdocComment(
	sourceCode: SourceCode,
	programBody: ReadonlyArray<Node>,
): Comment | null {
	const firstNonImport = programBody.find(
		(node) => node.type !== "ImportDeclaration",
	);

	const allComments = sourceCode.getAllComments();

	// Filter to JSDoc block comments (/** but not /***)
	// In ESLint's AST, /** foo */ has comment.type === "Block" and
	// comment.value === "* foo ". A /*** foo */ has value === "** foo ".
	const jsdocComments = allComments.filter(
		(c) =>
			c.type === "Block" &&
			c.value.startsWith("*") &&
			!c.value.startsWith("**"),
	);

	if (firstNonImport) {
		// Find first JSDoc comment that ends before the first non-import statement starts
		return (
			jsdocComments.find(
				(c) =>
					c.range !== undefined &&
					firstNonImport.range !== undefined &&
					c.range[1] <= firstNonImport.range[0],
			) ?? null
		);
	}

	// If no non-import statements, return first JSDoc comment in file
	return jsdocComments[0] ?? null;
}

interface ParsedJsdocTag {
	name: string;
	content: string;
}

interface ParsedJsdoc {
	freeText: string;
	summaryTags: ParsedJsdocTag[];
	hasDescription: boolean;
}

/**
 * Append non-empty text to an accumulator with space separation.
 */
function appendText(existing: string, addition: string): string {
	if (addition.length === 0) return existing;
	if (existing.length === 0) return addition;
	return `${existing} ${addition}`;
}

/**
 * Parse the inner content of a JSDoc block comment.
 *
 * Extracts summary tags (exact lowercase only), description tags
 * (case-insensitive), and free-text content before any @ tags.
 * Replicates the parsing behavior from jsdoc-parser.ts parseJsdocContent().
 */
function parseJsdocBlock(comment: Comment): ParsedJsdoc {
	// comment.value is the text between /* and */
	// For /** ... */, value starts with "*". Strip that leading *.
	const innerText = comment.value.slice(1);
	const lines = innerText.split("\n");

	let freeText = "";
	const summaryTags: ParsedJsdocTag[] = [];
	let currentTag: string | null = null;
	let currentContent = "";

	function flushCurrentTag(): void {
		if (currentTag === "summary") {
			const trimmed = currentContent.trim();
			// Only count non-whitespace summaries
			if (trimmed.length > 0) {
				summaryTags.push({ name: "summary", content: trimmed });
			}
		}
	}

	for (const rawLine of lines) {
		const stripped = rawLine.replace(/^\s*\*?\s?/, "");
		const tagMatch = stripped.match(/^@([a-zA-Z]+)(?:\s|$)/);

		if (tagMatch) {
			flushCurrentTag();
			const rawTagName = tagMatch[1];
			const tagContent = stripped.slice(tagMatch[0].length);

			if (DESCRIPTION_TAGS.has(rawTagName.toLowerCase())) {
				freeText = appendText(freeText, tagContent);
				currentTag = null;
				currentContent = "";
			} else {
				// Store exact tag name (case-sensitive for @summary)
				currentTag = rawTagName;
				currentContent = tagContent;
			}
			continue;
		}

		// Continuation line
		if (currentTag === null) {
			freeText = appendText(freeText, stripped);
		} else if (stripped.length > 0) {
			currentContent += ` ${stripped}`;
		}
	}

	flushCurrentTag();

	const trimmedFreeText = freeText.trim();

	return {
		freeText: trimmedFreeText,
		summaryTags,
		hasDescription: trimmedFreeText.length > 0,
	};
}

const requireFileJsdoc: Rule.RuleModule = {
	meta: {
		type: "problem",
		messages: {
			missingFileJsdoc:
				"File is missing a file-level JSDoc block (/** ... */) before the first code statement.",
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				const sourceCode = context.sourceCode;
				const jsdocComment = findFileJsdocComment(sourceCode, node.body);

				if (jsdocComment === null) {
					context.report({
						node,
						messageId: "missingFileJsdoc",
					});
				}
			},
		};
	},
};

const requireFileSummary: Rule.RuleModule = {
	meta: {
		type: "problem",
		messages: {
			missingSummary:
				"File-level JSDoc is missing an @summary tag (exact lowercase required).",
			multipleSummary:
				"File-level JSDoc has multiple @summary tags. Use exactly one.",
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				const sourceCode = context.sourceCode;
				const jsdocComment = findFileJsdocComment(sourceCode, node.body);

				// If no file-level JSDoc exists, that's rule 1's job to report
				if (jsdocComment === null) {
					return;
				}

				const parsed = parseJsdocBlock(jsdocComment);

				if (parsed.summaryTags.length === 0) {
					context.report({
						node,
						messageId: "missingSummary",
					});
				} else if (parsed.summaryTags.length > 1) {
					context.report({
						node,
						messageId: "multipleSummary",
					});
				}
			},
		};
	},
};

const requireFileDescription: Rule.RuleModule = {
	meta: {
		type: "problem",
		messages: {
			missingDescription:
				"File-level JSDoc is missing a description. Add free-text before @tags or use @desc/@description/@file/@fileoverview.",
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				const sourceCode = context.sourceCode;
				const jsdocComment = findFileJsdocComment(sourceCode, node.body);

				// If no file-level JSDoc exists, that's rule 1's job to report
				if (jsdocComment === null) {
					return;
				}

				const parsed = parseJsdocBlock(jsdocComment);

				if (!parsed.hasDescription) {
					context.report({
						node,
						messageId: "missingDescription",
					});
				}
			},
		};
	},
};

const plugin = {
	rules: {
		"require-file-jsdoc": requireFileJsdoc,
		"require-file-summary": requireFileSummary,
		"require-file-description": requireFileDescription,
	},
} as const;

export default plugin;
