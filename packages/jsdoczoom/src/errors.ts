import type { ErrorCode } from './types.js';

/** Custom error class that serializes to the documented JSON error contract */
export class JsdocError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'JsdocError';
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
