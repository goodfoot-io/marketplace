import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
	generateTypeDeclarations,
	resetCache,
	resolveCompilerOptions,
} from "../src/type-declarations.js";

/**
 * Verifies that generateTypeDeclarations produces correct output even when
 * the project's tsconfig.json has `noEmit: true`. The `noEmit` flag should
 * be overridden internally so that declaration emit still works.
 *
 * @summary Reproduction test for noEmit suppressing declaration output
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

const noEmitFixtureDir = join(__dirname, "fixtures", "tsconfig-noemit");

describe("generateTypeDeclarations with noEmit tsconfig", () => {
	const samplePath = join(noEmitFixtureDir, "sample.ts");

	beforeEach(() => {
		resetCache();
	});

	it("resolveCompilerOptions sets noEmit to false when tsconfig has noEmit: true", () => {
		const result = resolveCompilerOptions(samplePath);

		// The resolved options should override noEmit to false so declaration emit works
		expect(result.options.noEmit).toBe(false);
	});

	it("produces non-empty declaration output when tsconfig has noEmit: true", () => {
		const declarations = generateTypeDeclarations(samplePath);

		// The file has exports, so declarations should NOT be empty
		expect(declarations).not.toBe("");
		expect(declarations.length).toBeGreaterThan(0);
	});

	it("includes exported type alias from noEmit project", () => {
		const declarations = generateTypeDeclarations(samplePath);

		expect(declarations).toContain("export type Greeting");
	});

	it("includes exported interface from noEmit project", () => {
		const declarations = generateTypeDeclarations(samplePath);

		expect(declarations).toContain("export interface Config");
		expect(declarations).toContain("host: string");
		expect(declarations).toContain("port: number");
		expect(declarations).toContain("debug?: boolean");
	});

	it("includes exported function signature from noEmit project", () => {
		const declarations = generateTypeDeclarations(samplePath);

		expect(declarations).toContain("export declare function greet");
		expect(declarations).toContain("name: string");
		expect(declarations).toContain(": Greeting");
	});

	it("preserves JSDoc comments from noEmit project", () => {
		const declarations = generateTypeDeclarations(samplePath);

		expect(declarations).toContain("A simple string type alias");
		expect(declarations).toContain("A configuration interface");
		expect(declarations).toContain("Creates a greeting message");
		expect(declarations).toContain("@param name - The name to greet");
		expect(declarations).toContain("@returns A greeting string");
	});
});
