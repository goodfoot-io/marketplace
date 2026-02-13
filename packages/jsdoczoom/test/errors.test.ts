import { describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";

/**
 * Verifies that JsdocError stores code and message properties, extends
 * Error, and serializes to the documented JSON shape via toJSON().
 *
 * @summary Tests for JsdocError construction and JSON serialization
 */

describe("JsdocError", () => {
	it("stores code and message properties", () => {
		const err = new JsdocError("PARSE_ERROR", "failed to parse");
		expect(err.code).toBe("PARSE_ERROR");
		expect(err.message).toBe("failed to parse");
		expect(err).toBeInstanceOf(Error);
	});

	it("toJSON() returns { error: { code, message } } shape", () => {
		const err = new JsdocError("FILE_NOT_FOUND", "not found");
		expect(err.toJSON()).toEqual({
			error: {
				code: "FILE_NOT_FOUND",
				message: "not found",
			},
		});
	});
});
