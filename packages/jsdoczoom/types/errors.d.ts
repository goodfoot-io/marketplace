import type { ErrorCode } from "./types.js";
/** Custom error class that serializes to the documented JSON error contract */
export declare class JsdocError extends Error {
	readonly code: ErrorCode;
	constructor(code: ErrorCode, message: string);
	toJSON(): {
		error: {
			code: ErrorCode;
			message: string;
		};
	};
}
