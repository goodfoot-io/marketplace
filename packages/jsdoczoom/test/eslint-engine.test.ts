/**
 * Tests for ESLint validation engine.
 *
 * @summary Unit and integration tests for eslint-engine module
 */

import { describe, expect, it } from "vitest";
import {
	createLintLinter,
	createValidationLinter,
	lintFileForLint,
	lintFileForValidation,
	mapToValidationStatus,
} from "../src/eslint-engine.js";

describe("mapToValidationStatus", () => {
	it("syntax error maps to syntax_error", () => {
		const messages = [{ ruleId: null, fatal: true }];
		expect(mapToValidationStatus(messages)).toBe("syntax_error");
	});

	it("missing JSDoc maps to missing_jsdoc", () => {
		const messages = [{ ruleId: "jsdoczoom/require-file-jsdoc" }];
		expect(mapToValidationStatus(messages)).toBe("missing_jsdoc");
	});

	it("missing summary maps to missing_summary", () => {
		const messages = [
			{ ruleId: "jsdoczoom/require-file-summary", messageId: "missingSummary" },
		];
		expect(mapToValidationStatus(messages)).toBe("missing_summary");
	});

	it("multiple summary maps to multiple_summary", () => {
		const messages = [
			{
				ruleId: "jsdoczoom/require-file-summary",
				messageId: "multipleSummary",
			},
		];
		expect(mapToValidationStatus(messages)).toBe("multiple_summary");
	});

	it("missing description maps to missing_description", () => {
		const messages = [{ ruleId: "jsdoczoom/require-file-description" }];
		expect(mapToValidationStatus(messages)).toBe("missing_description");
	});

	it("valid file maps to valid", () => {
		const messages: Array<{
			ruleId: string | null;
			messageId?: string;
			fatal?: boolean;
		}> = [];
		expect(mapToValidationStatus(messages)).toBe("valid");
	});

	it("priority ordering - missing_jsdoc wins over missing_description", () => {
		const messages = [
			{ ruleId: "jsdoczoom/require-file-description" },
			{ ruleId: "jsdoczoom/require-file-jsdoc" },
		];
		expect(mapToValidationStatus(messages)).toBe("missing_jsdoc");
	});
});

describe("ESLint integration tests", () => {
	const validationLinter = createValidationLinter();
	const lintLinter = createLintLinter();

	const validFile =
		"/** Description here.\n * @summary File summary\n */\nexport const x = 1;\n";
	const missingJsdoc = "export const x = 1;\n";
	const missingParam =
		"/** Desc.\n * @summary S\n */\nexport function foo(x: string): void {}\n";
	const missingReturns =
		"/** Desc.\n * @summary S\n */\nexport function foo(): string { return 'a'; }\n";
	const unusedVar =
		"/** This file demonstrates JSDoc-only constraint.\n * @summary JSDoc-only test\n */\nvar unused = 1;\n";
	const informativeDocs =
		"/** Desc.\n * @summary S\n */\n/** x */\nexport const x = 1;\n";

	it("createValidationLinter + lintFileForValidation: valid file returns empty messages", async () => {
		const messages = await lintFileForValidation(
			validationLinter,
			validFile,
			"test.ts",
		);
		expect(messages).toEqual([]);
	});

	it("createValidationLinter + lintFileForValidation: file missing JSDoc returns messages with jsdoczoom rules", async () => {
		const messages = await lintFileForValidation(
			validationLinter,
			missingJsdoc,
			"test.ts",
		);
		expect(messages.length).toBeGreaterThan(0);
		expect(messages.some((m) => m.ruleId?.startsWith("jsdoczoom/"))).toBe(true);
	});

	it("createLintLinter + lintFileForLint: missing @param gets lint diagnostic", async () => {
		const diagnostics = await lintFileForLint(
			lintLinter,
			missingParam,
			"test.ts",
		);
		expect(diagnostics.some((d) => d.rule === "jsdoc/require-param")).toBe(
			true,
		);
	});

	it("createLintLinter + lintFileForLint: file missing @returns gets lint diagnostic", async () => {
		const diagnostics = await lintFileForLint(
			lintLinter,
			missingReturns,
			"test.ts",
		);
		expect(diagnostics.some((d) => d.rule === "jsdoc/require-returns")).toBe(
			true,
		);
	});

	it("JSDoc-only constraint test: unused var produces zero diagnostics from BOTH validate and lint configs", async () => {
		const validationMessages = await lintFileForValidation(
			validationLinter,
			unusedVar,
			"test.ts",
		);
		const lintDiagnostics = await lintFileForLint(
			lintLinter,
			unusedVar,
			"test.ts",
		);

		expect(validationMessages).toEqual([]);
		expect(lintDiagnostics).toEqual([]);
	});

	it("createLintLinter: informative-docs violation caught", async () => {
		const diagnostics = await lintFileForLint(
			lintLinter,
			informativeDocs,
			"test.ts",
		);
		expect(diagnostics.some((d) => d.rule === "jsdoc/informative-docs")).toBe(
			true,
		);
	});
});
