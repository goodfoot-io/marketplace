import type { ErrorCode } from "./types.js";

/**
 * JsdocError extends Error with an error code and serializes to the
 * `{ error: { code, message } }` JSON shape. This is the single error type
 * used across the entire tool for both programmatic and CLI error output.
 *
 * @summary Structured error type with JSON serialization for CLI and programmatic use
 */

/** Custom error class that serializes to the documented JSON error contract */
export class JsdocError extends Error {
	readonly code: ErrorCode;

	constructor(code: ErrorCode, message: string) {
		super(message);
		this.code = code;
		this.name = "JsdocError";
	}

	toJSON(): { error: { code: ErrorCode; message: string } } {
		return {
			error: {
				code: this.code,
				message: this.message,
			},
		};
	}
}
