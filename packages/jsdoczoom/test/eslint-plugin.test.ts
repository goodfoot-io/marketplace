import type { Linter as LinterType } from "eslint";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";
import plugin from "../src/eslint-plugin.js";

/**
 * Tests for the custom jsdoczoom ESLint plugin rules that validate
 * file-level JSDoc presence, @summary tags, and descriptions.
 *
 * @summary Tests for custom jsdoczoom ESLint plugin rules
 */

const linter = new Linter();

const config: LinterType.Config = {
	plugins: { jsdoczoom: plugin },
	rules: {
		"jsdoczoom/require-file-jsdoc": "error",
		"jsdoczoom/require-file-summary": "error",
		"jsdoczoom/require-file-description": "error",
	},
	languageOptions: {
		ecmaVersion: "latest" as const,
		sourceType: "module" as const,
	},
};

function verify(code: string): LinterType.LintMessage[] {
	return linter.verify(code, config);
}

function ruleIds(messages: LinterType.LintMessage[]): string[] {
	return messages
		.filter((m) => m.ruleId !== null)
		.map((m) => m.ruleId as string);
}

function messageIds(messages: LinterType.LintMessage[]): string[] {
	return messages
		.filter((m) => m.messageId !== undefined)
		.map((m) => m.messageId as string);
}

// ---------------------------------------------------------------------------
// require-file-jsdoc
// ---------------------------------------------------------------------------

describe("jsdoczoom/require-file-jsdoc", () => {
	it("valid file passes all rules", () => {
		const code = [
			"/** Description.",
			" * @summary Summary */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		expect(messages).toHaveLength(0);
	});

	it("missing JSDoc fails require-file-jsdoc", () => {
		const code = "export const x = 1;";
		const messages = verify(code);
		expect(ruleIds(messages)).toContain("jsdoczoom/require-file-jsdoc");
		expect(messageIds(messages)).toContain("missingFileJsdoc");
	});

	it("JSDoc after imports is valid", () => {
		const code = [
			'import { x } from "y";',
			"/** Desc",
			" * @summary S */",
			"export const z = 1;",
		].join("\n");
		const messages = verify(code);
		expect(messages).toHaveLength(0);
	});

	it("file with only imports and JSDoc passes", () => {
		const code = [
			"/** Desc",
			" * @summary S */",
			'import { x } from "y";',
		].join("\n");
		const messages = verify(code);
		expect(messages).toHaveLength(0);
	});

	it("/*** triple-asterisk block is ignored", () => {
		const code = ["/*** Desc", " * @summary S */", "export const x = 1;"].join(
			"\n",
		);
		const messages = verify(code);
		expect(ruleIds(messages)).toContain("jsdoczoom/require-file-jsdoc");
		expect(messageIds(messages)).toContain("missingFileJsdoc");
	});
});

// ---------------------------------------------------------------------------
// require-file-summary
// ---------------------------------------------------------------------------

describe("jsdoczoom/require-file-summary", () => {
	it("missing @summary fails require-file-summary", () => {
		const code = ["/** Description only */", "export const x = 1;"].join("\n");
		const messages = verify(code);
		expect(ruleIds(messages)).toContain("jsdoczoom/require-file-summary");
		expect(messageIds(messages)).toContain("missingSummary");
	});

	it("multiple @summary fails require-file-summary", () => {
		const code = [
			"/** Desc",
			" * @summary First",
			" * @summary Second */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		expect(ruleIds(messages)).toContain("jsdoczoom/require-file-summary");
		expect(messageIds(messages)).toContain("multipleSummary");
	});

	it("whitespace-only @summary is skipped", () => {
		const code = [
			"/** Desc",
			" * @summary   ",
			" * @summary Real summary */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		// Only one non-whitespace @summary, so should pass (no multipleSummary)
		const summaryMessages = messages.filter(
			(m) => m.ruleId === "jsdoczoom/require-file-summary",
		);
		expect(summaryMessages).toHaveLength(0);
	});

	it("case-sensitive @summary enforcement — @Summary not recognized", () => {
		const code = [
			"/** Desc",
			" * @Summary Not recognized */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		expect(ruleIds(messages)).toContain("jsdoczoom/require-file-summary");
		expect(messageIds(messages)).toContain("missingSummary");
	});

	it("multi-line @summary content is joined — counts as one summary", () => {
		const code = [
			"/** Desc.",
			" * @summary Multi",
			" * line summary */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		// One @summary with multi-line content — should pass
		const summaryMessages = messages.filter(
			(m) => m.ruleId === "jsdoczoom/require-file-summary",
		);
		expect(summaryMessages).toHaveLength(0);
	});

	it("no report when file-level JSDoc is missing (rule 1 handles that)", () => {
		const code = "export const x = 1;";
		const messages = verify(code);
		// require-file-summary should NOT report — only require-file-jsdoc reports
		expect(ruleIds(messages)).not.toContain("jsdoczoom/require-file-summary");
	});
});

// ---------------------------------------------------------------------------
// require-file-description
// ---------------------------------------------------------------------------

describe("jsdoczoom/require-file-description", () => {
	it("missing description fails require-file-description", () => {
		const code = ["/** @summary Summary only */", "export const x = 1;"].join(
			"\n",
		);
		const messages = verify(code);
		expect(ruleIds(messages)).toContain("jsdoczoom/require-file-description");
		expect(messageIds(messages)).toContain("missingDescription");
	});

	it("@desc tag counts as description", () => {
		const code = [
			"/** @desc Description here",
			" * @summary Summary */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		expect(ruleIds(messages)).not.toContain(
			"jsdoczoom/require-file-description",
		);
	});

	it("@description tag counts as description", () => {
		const code = [
			"/** @description Desc",
			" * @summary S */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		expect(ruleIds(messages)).not.toContain(
			"jsdoczoom/require-file-description",
		);
	});

	it("@file tag counts as description", () => {
		const code = [
			"/** @file Desc",
			" * @summary S */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		expect(ruleIds(messages)).not.toContain(
			"jsdoczoom/require-file-description",
		);
	});

	it("@fileoverview tag counts as description (case-insensitive)", () => {
		const code = [
			"/** @fileoverview Desc",
			" * @summary S */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		expect(ruleIds(messages)).not.toContain(
			"jsdoczoom/require-file-description",
		);
	});

	it("free-text before @tags counts as description", () => {
		const code = [
			"/** This is a description.",
			" * @summary Summary */",
			"export const x = 1;",
		].join("\n");
		const messages = verify(code);
		expect(ruleIds(messages)).not.toContain(
			"jsdoczoom/require-file-description",
		);
	});

	it("no report when file-level JSDoc is missing (rule 1 handles that)", () => {
		const code = "export const x = 1;";
		const messages = verify(code);
		// require-file-description should NOT report
		expect(ruleIds(messages)).not.toContain(
			"jsdoczoom/require-file-description",
		);
	});
});
