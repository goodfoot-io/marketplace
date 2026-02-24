import { describe, expect, it } from "vitest";
import { SkillReaderError } from "../src/errors.js";

describe("SkillReaderError", () => {
	it("stores code and message", () => {
		const err = new SkillReaderError("SKILL_NOT_FOUND", "skill not found");
		expect(err.code).toBe("SKILL_NOT_FOUND");
		expect(err.message).toBe("skill not found");
	});

	it("is instanceof Error", () => {
		const err = new SkillReaderError("INVALID_ARGS", "bad args");
		expect(err).toBeInstanceOf(Error);
	});

	it("toJSON returns { error: { code, message } } shape", () => {
		const err = new SkillReaderError(
			"MARKETPLACE_FETCH_FAILED",
			"fetch failed",
		);
		expect(err.toJSON()).toEqual({
			error: {
				code: "MARKETPLACE_FETCH_FAILED",
				message: "fetch failed",
			},
		});
	});

	it("SkillReaderError.name is SkillReaderError", () => {
		const err = new SkillReaderError("INTERNAL_ERROR", "something went wrong");
		expect(err.name).toBe("SkillReaderError");
	});
});
