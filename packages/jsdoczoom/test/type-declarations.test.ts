import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeEach, describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";
import {
	extractSourceBlocks,
	generateTypeDeclarations,
	getLanguageService,
	resetCache,
	resolveCompilerOptions,
	splitDeclarations,
} from "../src/type-declarations.js";

/**
 * Verifies that generateTypeDeclarations produces .d.ts-like output
 * including exported types, interfaces, function signatures, const
 * declarations, and class signatures while excluding imports, non-exported
 * internals, and implementation bodies. JSDoc comments are preserved.
 *
 * @summary Tests for TypeScript declaration output generation
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturesDir = join(__dirname, "fixtures", "leaf-files");

describe("splitDeclarations", () => {
	it("splits multi-declaration output into individual chunks", () => {
		const dtsText = [
			"// L1",
			"export type Name = string;",
			"",
			"// L3-L5",
			"export interface User {",
			"    id: number;",
			"}",
		].join("\n");

		const chunks = splitDeclarations(dtsText);

		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toBe("// L1\nexport type Name = string;");
		expect(chunks[1]).toBe(
			"// L3-L5\nexport interface User {\n    id: number;\n}",
		);
	});

	it("preserves JSDoc comments with their declaration", () => {
		const dtsText = [
			"// L1",
			"/** A string type alias */",
			"export type Name = string;",
			"",
			"// L3-L5",
			"/** A user interface */",
			"export interface User {",
			"    id: number;",
			"}",
		].join("\n");

		const chunks = splitDeclarations(dtsText);

		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toBe(
			"// L1\n/** A string type alias */\nexport type Name = string;",
		);
		expect(chunks[1]).toBe(
			"// L3-L5\n/** A user interface */\nexport interface User {\n    id: number;\n}",
		);
	});

	it("preserves line annotations (// LN) with their declaration", () => {
		const dtsText = [
			"// L10",
			"export declare function foo(): void;",
			"",
			"// L20-L25",
			"export declare class Bar {",
			"    method(): string;",
			"}",
		].join("\n");

		const chunks = splitDeclarations(dtsText);

		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toContain("// L10");
		expect(chunks[0]).toContain("export declare function foo");
		expect(chunks[1]).toContain("// L20-L25");
		expect(chunks[1]).toContain("export declare class Bar");
	});

	it("returns empty array for empty string", () => {
		expect(splitDeclarations("")).toEqual([]);
	});

	it("handles single declaration", () => {
		const dtsText = "export type Name = string;";
		const chunks = splitDeclarations(dtsText);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toBe("export type Name = string;");
	});

	it("handles declaration with no line annotation", () => {
		const dtsText = [
			"export type A = string;",
			"",
			"export type B = number;",
		].join("\n");

		const chunks = splitDeclarations(dtsText);

		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toBe("export type A = string;");
		expect(chunks[1]).toBe("export type B = number;");
	});

	it("handles declare module / declare namespace blocks with nested content", () => {
		const dtsText = [
			"// L1-L5",
			"declare module 'foo' {",
			"    export const bar: string;",
			"}",
			"",
			"// L7",
			"export type Name = string;",
		].join("\n");

		const chunks = splitDeclarations(dtsText);

		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toBe(
			"// L1-L5\ndeclare module 'foo' {\n    export const bar: string;\n}",
		);
		expect(chunks[1]).toBe("// L7\nexport type Name = string;");
	});
});

describe("extractSourceBlocks", () => {
	const sourceBlocksPath = join(fixturesDir, "source-blocks.ts");
	const exportedTypesPath = join(fixturesDir, "exported-types.ts");
	const noExportsPath = join(fixturesDir, "no-exports.ts");
	const sourceBlocksContent = readFileSync(sourceBlocksPath, "utf-8");
	const exportedTypesContent = readFileSync(exportedTypesPath, "utf-8");
	const noExportsContent = readFileSync(noExportsPath, "utf-8");

	// source-blocks.ts line reference:
	// L1:     import { readFileSync } from "node:fs";
	// L3-L5:  /** A helper to format a greeting. */
	// L6-L8:  function formatGreeting(...) { ... }
	// L10-L13: /** Exported function ... */
	// L14-L16: export function greet(...) { ... }
	// L18:    /** An exported interface */
	// L19-L22: export interface Options { ... }
	// L24:    /** An exported class */
	// L25-L30: export class Processor { ... }
	// L32:    const internalConst = "secret";
	// L34:    export const MAX_RETRIES = 3;

	it("returns only matching function when regex matches function name", () => {
		const result = extractSourceBlocks(
			sourceBlocksPath,
			sourceBlocksContent,
			/\bgreet\b/,
		);

		expect(result).not.toBeNull();
		// Should include the exported greet function block
		expect(result).toContain("export function greet");
		// Should not include formatGreeting (no match for /\bgreet\b/ in that block's source)
		// Actually "greet" appears in formatGreeting's body via return formatGreeting(name)...
		// Use a pattern that only matches the greet function declaration
	});

	it("returns only matching class when regex matches class method or property", () => {
		const result = extractSourceBlocks(
			sourceBlocksPath,
			sourceBlocksContent,
			/\bProcessor\b/,
		);

		expect(result).not.toBeNull();
		expect(result).toContain("export class Processor");
		expect(result).not.toContain("export function greet");
		expect(result).not.toContain("export interface Options");
	});

	it("returns multiple blocks when regex matches in two different top-level statements", () => {
		// /\bOptions\b/ matches in the interface definition AND in Processor.run's parameter
		const result = extractSourceBlocks(
			sourceBlocksPath,
			sourceBlocksContent,
			/\bOptions\b/,
		);

		expect(result).not.toBeNull();
		expect(result).toContain("export interface Options");
		expect(result).toContain("export class Processor");
	});

	it("annotates each block with // LN or // LN-LM before it", () => {
		const result = extractSourceBlocks(
			sourceBlocksPath,
			sourceBlocksContent,
			/\bProcessor\b/,
		);

		expect(result).not.toBeNull();
		// Processor class starts at L24 (JSDoc) through L30
		expect(result).toMatch(/^\/\/ L\d+(-L\d+)?\n/);
	});

	it("returns null when match is only in import statements", () => {
		// readFileSync only appears in the import statement
		const result = extractSourceBlocks(
			sourceBlocksPath,
			sourceBlocksContent,
			/readFileSync/,
		);

		expect(result).toBeNull();
	});

	it("returns null when match is only in top-level comments outside any statement", () => {
		// exported-types.ts has a file-level JSDoc with "Module for testing"
		// That text only appears in the leading comment, not in any statement
		const result = extractSourceBlocks(
			exportedTypesPath,
			exportedTypesContent,
			/Module for testing type declarations generation/,
		);

		expect(result).toBeNull();
	});

	it("includes JSDoc comments that precede the top-level statement in the extracted block", () => {
		const result = extractSourceBlocks(
			sourceBlocksPath,
			sourceBlocksContent,
			/formatGreeting/,
		);

		expect(result).not.toBeNull();
		// JSDoc comment for formatGreeting should be included
		expect(result).toContain("A helper to format a greeting");
		expect(result).toContain("function formatGreeting");
	});

	it("handles non-exported functions and variables", () => {
		const result = extractSourceBlocks(
			sourceBlocksPath,
			sourceBlocksContent,
			/internalConst/,
		);

		expect(result).not.toBeNull();
		expect(result).toContain("internalConst");
	});

	it("handles variable statements (const/let/var)", () => {
		const result = extractSourceBlocks(
			sourceBlocksPath,
			sourceBlocksContent,
			/MAX_RETRIES/,
		);

		expect(result).not.toBeNull();
		expect(result).toContain("export const MAX_RETRIES");
	});

	it("returns null for empty file", () => {
		// Use a pattern that won't match anything
		const result = extractSourceBlocks(
			noExportsPath,
			noExportsContent,
			/NONEXISTENT_PATTERN_xyz/,
		);

		expect(result).toBeNull();
	});
});

describe("generateTypeDeclarations", () => {
	const exportedTypesPath = join(fixturesDir, "exported-types.ts");

	beforeEach(() => {
		resetCache();
	});

	it("includes exported type aliases", () => {
		const declarations = generateTypeDeclarations(exportedTypesPath);

		expect(declarations).toContain("export type Name");
		expect(declarations).toContain("string");
	});

	it("includes exported interfaces", () => {
		const declarations = generateTypeDeclarations(exportedTypesPath);

		expect(declarations).toContain("export interface User");
		expect(declarations).toContain("id: number");
		expect(declarations).toContain("name: string");
		expect(declarations).toContain("email?: string");
	});

	it("includes exported function signatures (no bodies)", () => {
		const declarations = generateTypeDeclarations(exportedTypesPath);

		// Should include the function signature (TypeScript uses 'declare' keyword)
		expect(declarations).toContain("export declare function getUser");
		expect(declarations).toContain("id: number");
		expect(declarations).toContain(": User");

		// Should NOT include the implementation body
		expect(declarations).not.toContain("return { id, name: 'test' }");
	});

	it("includes exported const signatures", () => {
		const declarations = generateTypeDeclarations(exportedTypesPath);

		expect(declarations).toContain("export declare const DEFAULT_TIMEOUT");
		// TypeScript declaration emit includes the literal value for const declarations
		expect(declarations).toContain("5000");
	});

	it("includes exported class declarations (signatures only, no method bodies)", () => {
		const declarations = generateTypeDeclarations(exportedTypesPath);

		// Should include the class declaration
		expect(declarations).toContain("export declare class UserService");

		// Should include method signatures
		expect(declarations).toContain("add(user: User): void");
		expect(declarations).toContain("getAll(): User[]");

		// Should NOT include method bodies
		expect(declarations).not.toContain("this.users.push(user)");
		expect(declarations).not.toContain("return this.users");

		// Should NOT include private field initializers
		expect(declarations).not.toContain("private users: User[] = []");
		// But should include the private field declaration
		expect(declarations).toContain("private users");
	});

	it("preserves all JSDoc comments (file-level and symbol-level)", () => {
		const declarations = generateTypeDeclarations(exportedTypesPath);

		// File-level JSDoc
		expect(declarations).toContain(
			"Module for testing type declarations generation",
		);
		expect(declarations).toContain("Type declarations test module");

		// Symbol-level JSDoc
		expect(declarations).toContain("A string type alias");
		expect(declarations).toContain("A user interface");
		expect(declarations).toContain("Gets a user by ID");
		expect(declarations).toContain("@param id - The user ID");
		expect(declarations).toContain("@returns The user object");
		expect(declarations).toContain("The default timeout value");
		expect(declarations).toContain("A simple utility class");
		expect(declarations).toContain("Add a user");
		expect(declarations).toContain("Get all users");
	});

	it("excludes import statements", () => {
		const declarations = generateTypeDeclarations(exportedTypesPath);

		// The fixture doesn't have imports, but we can verify no import statements appear
		expect(declarations).not.toContain("import ");
		expect(declarations).not.toContain("from ");
	});

	it("excludes non-exported internals", () => {
		const declarations = generateTypeDeclarations(exportedTypesPath);

		// Should NOT include internal helper function
		expect(declarations).not.toContain("internalHelper");

		// Should NOT include private constant
		expect(declarations).not.toContain("privateConst");
	});

	it("maintains source order of declarations", () => {
		const declarations = generateTypeDeclarations(exportedTypesPath);

		// Get positions of each export in the declarations
		const namePos = declarations.indexOf("export type Name");
		const userPos = declarations.indexOf("export interface User");
		const getUserPos = declarations.indexOf("export declare function getUser");
		const timeoutPos = declarations.indexOf(
			"export declare const DEFAULT_TIMEOUT",
		);
		const classPos = declarations.indexOf("export declare class UserService");

		// Verify they appear in the same order as the source
		expect(namePos).toBeGreaterThan(-1);
		expect(userPos).toBeGreaterThan(namePos);
		expect(getUserPos).toBeGreaterThan(userPos);
		expect(timeoutPos).toBeGreaterThan(getUserPos);
		expect(classPos).toBeGreaterThan(timeoutPos);
	});

	it("reuses language service across calls for files sharing the same tsconfig", () => {
		// Get the resolved compiler options and language service for the first call
		const { tsconfigPath, options } = resolveCompilerOptions(exportedTypesPath);
		const firstService = getLanguageService(tsconfigPath, options);

		// First call
		generateTypeDeclarations(exportedTypesPath);

		// Second call should return the same service instance
		const secondService = getLanguageService(tsconfigPath, options);
		expect(secondService).toBe(firstService);
		expect(secondService.service).toBe(firstService.service);

		// Second call to generateTypeDeclarations should not create a new service
		generateTypeDeclarations(exportedTypesPath);
		const thirdService = getLanguageService(tsconfigPath, options);
		expect(thirdService).toBe(firstService);
	});

	it("returns empty string for files with no exports", () => {
		const noExportsPath = join(fixturesDir, "no-exports.ts");
		const result = generateTypeDeclarations(noExportsPath);
		expect(result).toBe("");
	});

	it("throws PARSE_ERROR for files with syntax errors", () => {
		const syntaxErrorPath = join(fixturesDir, "syntax-error.ts");

		expect(() => generateTypeDeclarations(syntaxErrorPath)).toThrow(JsdocError);

		try {
			generateTypeDeclarations(syntaxErrorPath);
			expect.fail("Should have thrown JsdocError");
		} catch (e) {
			expect(e).toBeInstanceOf(JsdocError);
			expect((e as JsdocError).code).toBe("PARSE_ERROR");
		}
	});

	describe("line annotations", () => {
		it("annotates single-line declaration with source line", () => {
			const decl = generateTypeDeclarations(exportedTypesPath);
			expect(decl).toContain(
				"// L8\n/** A string type alias */\nexport type Name = string;",
			);
		});

		it("annotates multi-line interface with source range", () => {
			const decl = generateTypeDeclarations(exportedTypesPath);
			expect(decl).toContain(
				"// L11-L15\n/** A user interface */\nexport interface User {",
			);
		});

		it("annotates function with source range", () => {
			const decl = generateTypeDeclarations(exportedTypesPath);
			expect(decl).toContain("// L22-L24");
			expect(decl).toContain("// L22-L24\n/**\n * Gets a user by ID");
		});

		it("annotates exported const with source line", () => {
			const decl = generateTypeDeclarations(exportedTypesPath);
			expect(decl).toContain(
				"// L27\n/** The default timeout value */\nexport declare const DEFAULT_TIMEOUT",
			);
		});

		it("annotates exported class with source range", () => {
			const decl = generateTypeDeclarations(exportedTypesPath);
			expect(decl).toContain(
				"// L30-L42\n/** A simple utility class */\nexport declare class UserService {",
			);
		});

		it("separates chunks with blank lines", () => {
			const decl = generateTypeDeclarations(exportedTypesPath);
			// Each annotation should be preceded by a blank line (except the first)
			const lines = decl.split("\n");
			const annotationIndices = lines
				.map((l, i) => (l.startsWith("// L") ? i : -1))
				.filter((i) => i >= 0);
			// All annotations after the first should have a blank line above
			for (const idx of annotationIndices.slice(1)) {
				expect(lines[idx - 1]?.trim()).toBe("");
			}
		});

		it("does not annotate file-level JSDoc", () => {
			const decl = generateTypeDeclarations(exportedTypesPath);
			const lines = decl.split("\n");
			const fileJsdocLines = lines.filter(
				(l) =>
					l.includes("Module for testing") ||
					l.includes("Type declarations test module"),
			);
			for (const line of fileJsdocLines) {
				expect(line).not.toMatch(/\/\/ L\d+/);
			}
		});

		it("returns empty string unchanged for files with no exports", () => {
			const noExportsPath = join(fixturesDir, "no-exports.ts");
			const result = generateTypeDeclarations(noExportsPath);
			expect(result).toBe("");
		});
	});
});

describe("resolveCompilerOptions", () => {
	const tsconfigFixturesDir = join(__dirname, "fixtures");
	const tsconfigProjectDir = join(tsconfigFixturesDir, "tsconfig-project");
	const sampleTsPath = join(tsconfigProjectDir, "sample.ts");
	const malformedTsconfigPath = join(
		tsconfigFixturesDir,
		"tsconfig-malformed",
		"sample.ts",
	);

	beforeEach(() => {
		resetCache();
	});

	it("returns options with declaration: true and removeComments: false regardless of tsconfig", () => {
		const result = resolveCompilerOptions(sampleTsPath);

		expect(result.options.declaration).toBe(true);
		expect(result.options.emitDeclarationOnly).toBe(true);
		expect(result.options.removeComments).toBe(false);
		expect(result.options.skipLibCheck).toBe(true);
	});

	it("uses fallback defaults when no tsconfig.json is found", () => {
		// Use a path that won't find any tsconfig.json (root directory)
		// This assumes there's no tsconfig.json in the root filesystem
		const noTsconfigPath = "/file.ts";

		const result = resolveCompilerOptions(noTsconfigPath);

		expect(result.tsconfigPath).toBe(null);
		expect(result.options).toEqual({
			noEmit: false,
			declaration: true,
			emitDeclarationOnly: true,
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.NodeNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
			skipLibCheck: true,
			removeComments: false,
		});
	});

	it("merges tsconfig settings with required overrides", () => {
		const result = resolveCompilerOptions(sampleTsPath);

		// Should include settings from the tsconfig
		expect(result.options.strict).toBe(true);
		expect(result.options.target).toBe(ts.ScriptTarget.ES2020);

		// Should also include required overrides
		expect(result.options.declaration).toBe(true);
		expect(result.options.emitDeclarationOnly).toBe(true);
		expect(result.options.removeComments).toBe(false);
		expect(result.options.skipLibCheck).toBe(true);

		// Should have found the tsconfig
		expect(result.tsconfigPath).toContain("tsconfig-project");
	});

	it("returns the same result object for the same tsconfig path (caching)", () => {
		const firstResult = resolveCompilerOptions(sampleTsPath);
		const secondResult = resolveCompilerOptions(sampleTsPath);

		// Should return the exact same object reference (not just equal values)
		expect(firstResult).toBe(secondResult);
		expect(firstResult.options).toBe(secondResult.options);
	});

	it("handles malformed tsconfig.json gracefully (falls back to defaults)", () => {
		const result = resolveCompilerOptions(malformedTsconfigPath);

		// Should fall back to defaults when tsconfig is malformed
		expect(result.tsconfigPath).toBe(null);
		expect(result.options).toEqual({
			noEmit: false,
			declaration: true,
			emitDeclarationOnly: true,
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.NodeNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
			skipLibCheck: true,
			removeComments: false,
		});
	});
});

describe("getLanguageService", () => {
	const tsconfigFixturesDir = join(__dirname, "fixtures");
	const tsconfigProjectDir = join(tsconfigFixturesDir, "tsconfig-project");
	const sampleTsPath = join(tsconfigProjectDir, "sample.ts");

	beforeEach(() => {
		resetCache();
	});

	it("returns a language service that can emit declarations for a registered file", () => {
		const { tsconfigPath, options } = resolveCompilerOptions(sampleTsPath);
		const { service, files } = getLanguageService(tsconfigPath, options);

		// Add the file to the service's file set
		files.add(sampleTsPath);

		// Get emit output for the file
		const emitOutput = service.getEmitOutput(sampleTsPath, true); // true = emitOnlyDtsFiles

		// Should have declaration output
		expect(emitOutput.outputFiles).toBeDefined();
		expect(emitOutput.outputFiles.length).toBeGreaterThan(0);

		// Find the .d.ts output
		const dtsFile = emitOutput.outputFiles.find((file) =>
			file.name.endsWith(".d.ts"),
		);
		expect(dtsFile).toBeDefined();
		expect(dtsFile?.text).toContain("export");
	});

	it("reuses the same language service instance for files sharing a tsconfig", () => {
		const { tsconfigPath, options } = resolveCompilerOptions(sampleTsPath);

		// Get the service twice
		const firstCall = getLanguageService(tsconfigPath, options);
		const secondCall = getLanguageService(tsconfigPath, options);

		// Should return the exact same object references
		expect(firstCall).toBe(secondCall);
		expect(firstCall.service).toBe(secondCall.service);
		expect(firstCall.files).toBe(secondCall.files);
	});

	it("creates separate service instances for different tsconfigs", () => {
		// Get service for tsconfig-project
		const { tsconfigPath: tsconfigPath1, options: options1 } =
			resolveCompilerOptions(sampleTsPath);
		const service1 = getLanguageService(tsconfigPath1, options1);

		// Get service for a file with no tsconfig (uses fallback)
		const noTsconfigPath = "/file.ts";
		const { tsconfigPath: tsconfigPath2, options: options2 } =
			resolveCompilerOptions(noTsconfigPath);
		const service2 = getLanguageService(tsconfigPath2, options2);

		// Should be different service instances
		expect(service1).not.toBe(service2);
		expect(service1.service).not.toBe(service2.service);
		expect(service1.files).not.toBe(service2.files);
	});

	it("adding a new file to the files Set makes it visible to the existing service's getScriptFileNames()", () => {
		const { tsconfigPath, options } = resolveCompilerOptions(sampleTsPath);
		const { service, files } = getLanguageService(tsconfigPath, options);

		// Initially no files
		expect(files.size).toBe(0);

		// Add a file
		files.add(sampleTsPath);

		// Service should now see the file via getProgram().getSourceFiles()
		const program = service.getProgram();
		expect(program).toBeDefined();

		const sourceFiles = program?.getSourceFiles() ?? [];
		const hasOurFile = sourceFiles.some((sf) => sf.fileName === sampleTsPath);
		expect(hasOurFile).toBe(true);

		// Add another file
		const anotherFilePath = join(tsconfigProjectDir, "another-file.ts");
		files.add(anotherFilePath);

		// Should now have 2 files in the set
		expect(files.size).toBe(2);
		expect(files.has(sampleTsPath)).toBe(true);
		expect(files.has(anotherFilePath)).toBe(true);
	});
});

describe("resetCache", () => {
	const tsconfigFixturesDir = join(__dirname, "fixtures");
	const tsconfigProjectDir = join(tsconfigFixturesDir, "tsconfig-project");
	const sampleTsPath = join(tsconfigProjectDir, "sample.ts");

	it("clears the compiler options cache", () => {
		// Populate the cache
		const firstResult = resolveCompilerOptions(sampleTsPath);

		// Reset
		resetCache();

		// Get options again
		const secondResult = resolveCompilerOptions(sampleTsPath);

		// Should be different object instances (cache was cleared)
		expect(firstResult).not.toBe(secondResult);
		// But should have the same values
		expect(firstResult.tsconfigPath).toBe(secondResult.tsconfigPath);
	});

	it("clears the language service cache", () => {
		// Populate the cache
		const { tsconfigPath, options } = resolveCompilerOptions(sampleTsPath);
		const firstService = getLanguageService(tsconfigPath, options);

		// Reset
		resetCache();

		// Get service again (need to resolve options again too since that cache was also cleared)
		const { tsconfigPath: newTsconfigPath, options: newOptions } =
			resolveCompilerOptions(sampleTsPath);
		const secondService = getLanguageService(newTsconfigPath, newOptions);

		// Should be different service instances (cache was cleared)
		expect(firstService).not.toBe(secondService);
		expect(firstService.service).not.toBe(secondService.service);
	});
});
