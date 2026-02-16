import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import {
	generateTypeDeclarations,
	getLanguageService,
	resetCache,
	resolveCompilerOptions,
} from "../src/type-declarations.js";
import { JsdocError } from "../src/errors.js";

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
		expect(dtsFile!.text).toContain("export");
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

		const sourceFiles = program!.getSourceFiles();
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
