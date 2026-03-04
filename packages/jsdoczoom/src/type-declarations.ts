import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import ts from "typescript";
import { JsdocError } from "./errors.js";

/**
 * Produces .d.ts-like output from a TypeScript source file using the
 * TypeScript compiler's declaration emit. Preserves JSDoc comments and
 * source order while stripping implementation bodies and non-exported
 * internals.
 *
 * @summary Generate TypeScript declaration output from source files
 */

// Cache for resolved compiler options, keyed by tsconfig path
const compilerOptionsCache = new Map<
	string,
	{ tsconfigPath: string | null; options: ts.CompilerOptions }
>();

// Shared document registry for caching parsed source files across language services
const documentRegistry: ts.DocumentRegistry = ts.createDocumentRegistry();

// Cache for language services, keyed by tsconfig path
const serviceCache = new Map<
	string,
	{ service: ts.LanguageService; files: Set<string> }
>();

/**
 * Resolves compiler options for a given file path by finding and parsing
 * the nearest tsconfig.json file.
 *
 * @internal
 * @param filePath - Absolute path to the TypeScript source file
 * @returns Object containing the tsconfig path and resolved compiler options
 */
export function resolveCompilerOptions(filePath: string): {
	tsconfigPath: string | null;
	options: ts.CompilerOptions;
} {
	// Required overrides that must always be present
	const requiredOverrides: ts.CompilerOptions = {
		noEmit: false,
		declaration: true,
		emitDeclarationOnly: true,
		removeComments: false,
		skipLibCheck: true,
	};

	// Fallback defaults when no tsconfig is found
	const fallbackDefaults: ts.CompilerOptions = {
		...requiredOverrides,
		target: ts.ScriptTarget.Latest,
		module: ts.ModuleKind.NodeNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
	};

	// Try to find the nearest tsconfig.json
	const tsconfigPath = ts.findConfigFile(
		dirname(filePath),
		ts.sys.fileExists,
		"tsconfig.json",
	);

	// Use cache key based on tsconfig path (or "__default__" if none found)
	const cacheKey = tsconfigPath ?? "__default__";

	const cached = compilerOptionsCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	let result: { tsconfigPath: string | null; options: ts.CompilerOptions };

	if (!tsconfigPath) {
		// No tsconfig found - use fallback defaults
		result = {
			tsconfigPath: null,
			options: fallbackDefaults,
		};
	} else {
		// Try to parse the tsconfig
		try {
			const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

			if (configFile.error) {
				// Malformed JSON - fall back to defaults
				result = {
					tsconfigPath: null,
					options: fallbackDefaults,
				};
			} else {
				// Parse the config content
				const parsedConfig = ts.parseJsonConfigFileContent(
					configFile.config,
					ts.sys,
					dirname(tsconfigPath),
				);

				// Merge parsed options with required overrides
				result = {
					tsconfigPath,
					options: {
						...parsedConfig.options,
						...requiredOverrides,
					},
				};
			}
		} catch (_error) {
			// Error reading or parsing tsconfig - fall back to defaults
			// Note: This catches file system errors (EACCES, ENOENT) and any unexpected
			// errors from ts.readConfigFile or ts.parseJsonConfigFileContent
			result = {
				tsconfigPath: null,
				options: fallbackDefaults,
			};
		}
	}

	compilerOptionsCache.set(cacheKey, result);
	return result;
}

/**
 * Gets or creates a cached language service for the given tsconfig and compiler options.
 * Language services are shared across files in the same project (same tsconfig path) and
 * reuse parsed source files via the document registry.
 *
 * @internal
 * @param tsconfigPath - Path to the tsconfig.json file, or null if using defaults
 * @param compilerOptions - Resolved compiler options for this project
 * @returns Object containing the language service and mutable set of files
 */
export function getLanguageService(
	tsconfigPath: string | null,
	compilerOptions: ts.CompilerOptions,
): { service: ts.LanguageService; files: Set<string> } {
	const cacheKey = tsconfigPath ?? "__default__";

	const cachedService = serviceCache.get(cacheKey);
	if (cachedService) {
		return cachedService;
	}

	// Create a mutable set to track files for this service
	const files = new Set<string>();

	// Create a language service host
	const host: ts.LanguageServiceHost = {
		getScriptFileNames: () => Array.from(files),
		getScriptVersion: (_fileName: string) => "0", // Static version - no watch mode
		getScriptSnapshot: (fileName: string) => {
			const content = ts.sys.readFile(fileName);
			if (content === undefined) {
				return undefined;
			}
			return ts.ScriptSnapshot.fromString(content);
		},
		getCompilationSettings: () => compilerOptions,
		getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
		getDefaultLibFileName: (options: ts.CompilerOptions) =>
			ts.getDefaultLibFilePath(options),
		fileExists: ts.sys.fileExists,
		readFile: ts.sys.readFile,
		readDirectory: ts.sys.readDirectory,
		directoryExists: ts.sys.directoryExists,
		getDirectories: ts.sys.getDirectories,
	};

	// Create the language service with the document registry for caching
	const service = ts.createLanguageService(host, documentRegistry);

	const cacheEntry = { service, files };
	serviceCache.set(cacheKey, cacheEntry);
	return cacheEntry;
}

/**
 * Resets all caches (compiler options, language services, and document registry).
 * Used for test isolation to ensure a clean state between test runs.
 *
 * @internal
 */
export function resetCache(): void {
	compilerOptionsCache.clear();
	serviceCache.clear();
}

interface SourceRange {
	start: number;
	end: number;
}

/**
 * Extract exported symbol names from a top-level statement.
 * Returns an array of names (variable statements may have multiple).
 */
function exportedNamesOf(statement: ts.Statement): string[] {
	if (ts.isTypeAliasDeclaration(statement)) return [statement.name.text];
	if (ts.isInterfaceDeclaration(statement)) return [statement.name.text];
	if (ts.isFunctionDeclaration(statement) && statement.name) {
		return [statement.name.text];
	}
	if (ts.isClassDeclaration(statement) && statement.name) {
		return [statement.name.text];
	}
	if (ts.isEnumDeclaration(statement)) return [statement.name.text];
	if (ts.isVariableStatement(statement)) {
		return statement.declarationList.declarations
			.filter((d) => ts.isIdentifier(d.name))
			.map((d) => (d.name as ts.Identifier).text);
	}
	return [];
}

/**
 * Return true if the statement has an `export` modifier.
 */
function isExportedStatement(statement: ts.Statement): boolean {
	if (!ts.canHaveModifiers(statement)) return false;
	return (
		ts
			.getModifiers(statement)
			?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
	);
}

/**
 * Build a map of exported symbol names to their source line ranges.
 * Walks top-level statements looking for export modifiers.
 */
function buildSourceLineMap(filePath: string): Map<string, SourceRange> {
	const content = readFileSync(filePath, "utf-8");
	const sourceFile = ts.createSourceFile(
		filePath,
		content,
		ts.ScriptTarget.Latest,
		true,
	);
	const map = new Map<string, SourceRange>();

	for (const statement of sourceFile.statements) {
		if (!isExportedStatement(statement)) continue;

		const start =
			sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile))
				.line + 1;
		const end =
			sourceFile.getLineAndCharacterOfPosition(statement.getEnd()).line + 1;

		for (const name of exportedNamesOf(statement)) {
			map.set(name, { start, end });
		}
	}

	return map;
}

/** Regex matching the start of a top-level export declaration in .d.ts output. */
const DECL_PATTERN =
	/^export\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:type|interface|function|const|let|var|class|enum)\s+(\w+)/;

/**
 * Format a source range as a GitHub-style line annotation.
 */
function formatLineRef(range: SourceRange): string {
	return range.start === range.end
		? `// L${range.start}`
		: `// L${range.start}-L${range.end}`;
}

/**
 * Find the start of the JSDoc block above a declaration line.
 * Returns the declaration line index itself if no JSDoc is found.
 */
function findChunkStart(lines: string[], declLine: number): number {
	if (declLine === 0) return 0;
	const prev = lines[declLine - 1]?.trimEnd();
	if (prev === "*/" || prev?.endsWith("*/")) {
		for (let j = declLine - 1; j >= 0; j--) {
			if (lines[j].trimStart().startsWith("/**")) return j;
		}
	} else if (prev?.trimStart().startsWith("/**")) {
		// Single-line JSDoc: /** comment */
		return declLine - 1;
	}
	return declLine;
}

/**
 * Annotate .d.ts text with source line references for each top-level declaration.
 * Inserts GitHub-style `// LN` or `// LN-LM` on a separate line before each
 * declaration chunk, with a blank line above for visual separation.
 */
function annotateWithSourceLines(dtsText: string, filePath: string): string {
	const lineMap = buildSourceLineMap(filePath);
	if (lineMap.size === 0) return dtsText;

	const lines = dtsText.split("\n");

	// First pass: map chunk start lines to their annotations
	const annotations = new Map<number, string>();
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(DECL_PATTERN);
		if (!match) continue;
		const range = lineMap.get(match[1]);
		if (!range) continue;
		annotations.set(findChunkStart(lines, i), formatLineRef(range));
	}

	if (annotations.size === 0) return dtsText;

	// Second pass: build output with annotations inserted
	const result: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		const annotation = annotations.get(i);
		if (annotation) {
			// Blank line separator before annotation (if there's content above)
			if (result.length > 0 && result[result.length - 1]?.trim() !== "") {
				result.push("");
			}
			result.push(annotation);
		}
		result.push(lines[i]);
	}

	return result.join("\n");
}

/**
 * Splits annotated .d.ts text into individual declaration chunks.
 *
 * Splits on blank-line boundaries that precede a line annotation (`// L`)
 * or a declaration keyword (`export`, `declare`). Each chunk is a complete
 * declaration including its preceding JSDoc comment and line annotation.
 * Trailing whitespace is trimmed from each chunk. Empty chunks are filtered out.
 *
 * @param dtsText - The annotated .d.ts text to split
 * @returns Array of declaration chunks
 */
export function splitDeclarations(dtsText: string): string[] {
	if (dtsText === "") return [];

	const lines = dtsText.split("\n");
	const chunks: string[] = [];
	let start = 0;

	for (let i = 1; i < lines.length; i++) {
		// A split point is a blank line followed by a line annotation or declaration keyword
		if (lines[i - 1].trim() === "") {
			const nextLine = lines[i].trimStart();
			const isAnnotation = nextLine.startsWith("// L");
			const isDeclaration =
				nextLine.startsWith("export") || nextLine.startsWith("declare");
			if (isAnnotation || isDeclaration) {
				const chunk = lines
					.slice(start, i - 1)
					.join("\n")
					.trimEnd();
				if (chunk !== "") chunks.push(chunk);
				start = i;
			}
		}
	}

	// Push final chunk
	const last = lines.slice(start).join("\n").trimEnd();
	if (last !== "") chunks.push(last);

	return chunks;
}

/**
 * Find the 0-based line index where a leading JSDoc block starts above a statement.
 * Skips blank lines above the statement, then looks for a `/** ... * /` block.
 * Returns `statementLine` itself when no leading JSDoc is found.
 */
function findJsdocStart(lines: string[], statementLine: number): number {
	let line = statementLine - 1;
	// Skip blank lines immediately before the statement
	while (line >= 0 && lines[line].trim() === "") line--;
	if (line < 0) return statementLine;
	const trimmed = lines[line].trimEnd();
	if (trimmed === "*/" || trimmed.endsWith("*/")) {
		// Multi-line JSDoc: walk back to find opening /**
		for (let j = line; j >= 0; j--) {
			if (lines[j].trimStart().startsWith("/**")) return j;
		}
	} else if (trimmed.trimStart().startsWith("/**")) {
		// Single-line JSDoc: /** comment */
		return line;
	}
	return statementLine;
}

/** A single top-level source block with its line annotation. */
export interface SourceBlock {
	annotation: string; // e.g. "// L10" or "// L10-L25"
	blockText: string; // the source text (including leading JSDoc if any)
}

/**
 * Extracts all top-level source blocks from a TypeScript file.
 * Walks all top-level statements (not just exported), includes leading
 * JSDoc comments, and annotates each block with source line references.
 * Import declarations are excluded.
 *
 * Returns an empty array for empty files.
 *
 * @param filePath - Absolute path to the TypeScript source file
 * @param content - Pre-read file content (avoids redundant disk read)
 */
export function extractAllSourceBlocks(
	filePath: string,
	content: string,
): SourceBlock[] {
	if (content.trim() === "") return [];

	const lines = content.split("\n");
	const sourceFile = ts.createSourceFile(
		filePath,
		content,
		ts.ScriptTarget.Latest,
		true,
	);

	const blocks: SourceBlock[] = [];
	const seen = new Set<number>();

	for (const statement of sourceFile.statements) {
		// Skip import declarations — callers fall back to full file for import matches
		if (ts.isImportDeclaration(statement)) continue;

		const endLine =
			sourceFile.getLineAndCharacterOfPosition(statement.getEnd()).line + 1;
		const stmtStartLine = sourceFile.getLineAndCharacterOfPosition(
			statement.getStart(sourceFile),
		).line; // 0-based

		const jsdocStartLine = findJsdocStart(lines, stmtStartLine); // 0-based

		// Skip if we've already included this block (deduplication by start position)
		if (seen.has(jsdocStartLine)) continue;
		seen.add(jsdocStartLine);

		// Extract the source text for this block (lines are 0-based, endLine is 1-based)
		const blockText = lines.slice(jsdocStartLine, endLine).join("\n");

		const startLine1based = jsdocStartLine + 1; // 1-based
		const annotation = formatLineRef({ start: startLine1based, end: endLine });
		blocks.push({ annotation, blockText });
	}

	return blocks;
}

/**
 * Extracts top-level source blocks from a file that match a regex.
 *
 * Walks all top-level statements (not just exported ones), includes leading
 * JSDoc comments, and tests the regex against each block's source text.
 * Matching blocks are annotated with `// LN` or `// LN-LM` and joined with
 * blank line separators.
 *
 * @param filePath - Absolute path to the TypeScript source file
 * @param content - Pre-read file content (avoids redundant disk read)
 * @param regex - Regular expression to test against each block's source text
 * @returns Annotated matching blocks joined with blank lines, or null if no match
 */
export function extractSourceBlocks(
	filePath: string,
	content: string,
	regex: RegExp,
): string | null {
	const allBlocks = extractAllSourceBlocks(filePath, content);
	const matching = allBlocks.filter((b) => regex.test(b.blockText));
	if (matching.length === 0) return null;
	return matching.map((b) => `${b.annotation}\n${b.blockText}`).join("\n\n");
}

/**
 * Generates TypeScript declaration output from a source file.
 *
 * Produces .d.ts-like output containing:
 * - All exported type aliases, interfaces, enums
 * - All exported function signatures (no implementation bodies)
 * - All exported const/let/var declarations (type signatures only)
 * - All exported class declarations (signatures only, no method bodies)
 * - All JSDoc comments preserved
 * - Source order maintained
 *
 * Excludes:
 * - Import statements
 * - Non-exported internals
 *
 * @param filePath - Absolute path to the TypeScript source file
 * @returns The declaration output as a string
 * @throws {JsdocError} If the file cannot be read or parsed
 */
export function generateTypeDeclarations(filePath: string): string {
	// Verify the file exists and throw FILE_NOT_FOUND for any read errors
	try {
		readFileSync(filePath, "utf-8");
	} catch (_error) {
		throw new JsdocError("FILE_NOT_FOUND", `Failed to read file: ${filePath}`);
	}

	// Resolve compiler options from nearest tsconfig.json
	const { tsconfigPath, options } = resolveCompilerOptions(filePath);

	// Get or create a cached language service for this project
	const { service, files } = getLanguageService(tsconfigPath, options);

	// Register the file with the language service
	files.add(filePath);

	// Check for parse errors first
	const diagnostics = service.getSyntacticDiagnostics(filePath);
	if (diagnostics.length > 0) {
		throw new JsdocError("PARSE_ERROR", `Failed to parse file: ${filePath}`);
	}

	// Get emit output using the language service
	const emitOutput = service.getEmitOutput(filePath, true); // true = emitOnlyDtsFiles

	// Find the .d.ts output file
	const dtsFile = emitOutput.outputFiles.find((file) =>
		file.name.endsWith(".d.ts"),
	);

	if (!dtsFile) {
		// No declaration output - file has no exports
		return "";
	}

	// Clean up the output
	let cleaned = dtsFile.text;

	// Remove empty export statement if present and no other exports
	// Strip out any leading comments first to check if the only actual code is "export {};"
	const withoutComments = cleaned.replace(/\/\*\*[\s\S]*?\*\//g, "").trim();
	if (withoutComments === "export {};") {
		cleaned = "";
	}

	if (cleaned.length > 0) {
		cleaned = annotateWithSourceLines(cleaned, filePath);
	}

	return cleaned;
}
