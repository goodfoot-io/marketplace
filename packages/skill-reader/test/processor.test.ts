import { describe, expect, it } from "vitest";
import { SkillReaderError } from "../src/errors.js";
import { processContent } from "../src/processor.js";

describe("processContent", () => {
	it("replaces ${CLAUDE_PLUGIN_ROOT} with provided path", () => {
		const body = "Install path: ${CLAUDE_PLUGIN_ROOT}/bin";
		const result = processContent(body, {
			pluginRoot: "/home/user/.claude/plugins/myplugin",
		});
		expect(result).toBe(
			"Install path: /home/user/.claude/plugins/myplugin/bin",
		);
	});

	it("leaves content unchanged when no CLAUDE_PLUGIN_ROOT and no bash", () => {
		const body = "Just plain text with no special tokens.";
		const result = processContent(body, { pluginRoot: "/some/path" });
		expect(result).toBe("Just plain text with no special tokens.");
	});

	it("replaces CLAUDE_PLUGIN_ROOT with empty string when pluginRoot is undefined", () => {
		const body = "Path: ${CLAUDE_PLUGIN_ROOT}/bin";
		const result = processContent(body, {});
		expect(result).toBe("Path: /bin");
	});

	it("executes inline bash !`echo hello` and substitutes stdout", () => {
		const body = "Result: !`echo hello`";
		const result = processContent(body, { executeBash: true });
		expect(result).toBe("Result: hello");
	});

	it("executes block bash and substitutes stdout", () => {
		const body = "before\n```!\necho hello\n```\nafter";
		const result = processContent(body, { executeBash: true });
		expect(result).toBe("before\nhello\nafter");
	});

	it("handles failed bash command (throws SkillReaderError with BASH_EXECUTION_FAILED)", () => {
		const body = "!`exit 1`";
		expect(() => processContent(body, { executeBash: true })).toThrow(
			SkillReaderError,
		);
		try {
			processContent(body, { executeBash: true });
		} catch (err) {
			expect(err).toBeInstanceOf(SkillReaderError);
			expect((err as SkillReaderError).code).toBe("BASH_EXECUTION_FAILED");
		}
	});

	it("does not match ! preceded by word character", () => {
		const body = "word!`echo should-not-run`";
		const result = processContent(body, { executeBash: true });
		expect(result).toBe("word!`echo should-not-run`");
	});

	it("does not match ! preceded by $", () => {
		const body = "$!`echo should-not-run`";
		const result = processContent(body, { executeBash: true });
		expect(result).toBe("$!`echo should-not-run`");
	});

	it("preserves surrounding content around bash substitutions", () => {
		const body = "prefix !`echo mid` suffix";
		const result = processContent(body, { executeBash: true });
		expect(result).toBe("prefix mid suffix");
	});

	it("handles multiple bash substitutions in one document", () => {
		const body = "!`echo one` and !`echo two`";
		const result = processContent(body, { executeBash: true });
		expect(result).toBe("one and two");
	});

	it("bash stdout only (stderr not included in substitution)", () => {
		// Write to stderr only; stdout should be empty -> trimmed to empty string
		const body = "!`echo err >&2`";
		const result = processContent(body, { executeBash: true });
		expect(result).toBe("");
	});

	it("respects executeBash:false (skips bash execution and leaves patterns as-is)", () => {
		const body = "!`echo hello`";
		const result = processContent(body, { executeBash: false });
		expect(result).toBe("!`echo hello`");
	});

	it("handles bash command timeout (10 second limit)", () => {
		const body = "!`sleep 20`";
		expect(() => processContent(body, { executeBash: true })).toThrow(
			SkillReaderError,
		);
		try {
			processContent(body, { executeBash: true });
		} catch (err) {
			expect(err).toBeInstanceOf(SkillReaderError);
			expect((err as SkillReaderError).code).toBe("BASH_EXECUTION_FAILED");
		}
	}, 30000);
});
