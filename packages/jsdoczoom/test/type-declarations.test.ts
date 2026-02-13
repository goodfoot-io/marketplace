import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateTypeDeclarations } from "../src/type-declarations.js";

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
});
