/**
 * Type declarations generation for JSDoc Zoom
 *
 * @summary Generates TypeScript declaration output from source files
 */

import { readFileSync } from "node:fs";
import ts from "typescript";
import { JsdocError } from "./errors.js";

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
	let sourceText: string;
	try {
		sourceText = readFileSync(filePath, "utf-8");
	} catch (_error) {
		throw new JsdocError("FILE_NOT_FOUND", `Failed to read file: ${filePath}`);
	}

	// Create compiler options matching the project setup
	const compilerOptions: ts.CompilerOptions = {
		declaration: true,
		emitDeclarationOnly: true,
		target: ts.ScriptTarget.Latest,
		module: ts.ModuleKind.NodeNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
		skipLibCheck: true,
		removeComments: false, // Preserve JSDoc comments
	};

	// Create a custom compiler host that provides our file
	const host = ts.createCompilerHost(compilerOptions);
	const originalGetSourceFile = host.getSourceFile;

	host.getSourceFile = (
		fileName: string,
		languageVersion: ts.ScriptTarget,
		onError?: (message: string) => void,
		shouldCreateNewSourceFile?: boolean,
	): ts.SourceFile | undefined => {
		if (fileName === filePath) {
			return ts.createSourceFile(fileName, sourceText, languageVersion, true);
		}
		return originalGetSourceFile.call(
			host,
			fileName,
			languageVersion,
			onError,
			shouldCreateNewSourceFile,
		);
	};

	// Capture emitted output
	let declarationOutput = "";
	host.writeFile = (fileName: string, data: string): void => {
		if (fileName.endsWith(".d.ts")) {
			declarationOutput = data;
		}
	};

	// Create program and emit declarations
	const program = ts.createProgram([filePath], compilerOptions, host);
	const sourceFile = program.getSourceFile(filePath);

	if (!sourceFile) {
		throw new JsdocError("PARSE_ERROR", `Failed to parse file: ${filePath}`);
	}

	const emitResult = program.emit(
		sourceFile,
		undefined,
		undefined,
		true, // emitOnlyDtsFiles
	);

	// Check for emit errors
	const diagnostics = ts
		.getPreEmitDiagnostics(program)
		.concat(emitResult.diagnostics);

	if (diagnostics.length > 0) {
		const errors = diagnostics
			.map((diagnostic) => {
				if (diagnostic.file && diagnostic.start !== undefined) {
					const { line, character } =
						diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
					const message = ts.flattenDiagnosticMessageText(
						diagnostic.messageText,
						"\n",
					);
					return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
				}
				return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
			})
			.join("\n");

		throw new JsdocError("PARSE_ERROR", `TypeScript errors:\n${errors}`);
	}

	if (!declarationOutput) {
		// If no output was generated, the file may have no exports
		// Return empty string in this case
		return "";
	}

	// Clean up the output
	let cleaned = declarationOutput;

	// Remove empty export statement if present and no other exports
	if (cleaned.trim() === "export {};") {
		cleaned = "";
	}

	return cleaned;
}
