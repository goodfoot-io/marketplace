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
		// Only process exported declarations
		const modifiers = ts.canHaveModifiers(statement)
			? ts.getModifiers(statement)
			: undefined;
		const isExported = modifiers?.some(
			(m) => m.kind === ts.SyntaxKind.ExportKeyword,
		);
		if (!isExported) continue;

		const start =
			sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile))
				.line + 1;
		const end =
			sourceFile.getLineAndCharacterOfPosition(statement.getEnd()).line + 1;

		const addName = (name: string) => map.set(name, { start, end });

		if (ts.isTypeAliasDeclaration(statement)) {
			addName(statement.name.text);
		} else if (ts.isInterfaceDeclaration(statement)) {
			addName(statement.name.text);
		} else if (ts.isFunctionDeclaration(statement) && statement.name) {
			addName(statement.name.text);
		} else if (ts.isClassDeclaration(statement) && statement.name) {
			addName(statement.name.text);
		} else if (ts.isEnumDeclaration(statement)) {
			addName(statement.name.text);
		} else if (ts.isVariableStatement(statement)) {
			for (const decl of statement.declarationList.declarations) {
				if (ts.isIdentifier(decl.name)) {
					addName(decl.name.text);
				}
			}
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
