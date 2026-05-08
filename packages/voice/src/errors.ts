import type { JsonValue, RealtimeVoiceServerErrorCode, RealtimeVoiceServerErrorInput } from "./types.js";

export class RealtimeVoiceServerError extends Error {
  override readonly name = "RealtimeVoiceServerError";
  readonly code: RealtimeVoiceServerErrorCode;
  readonly details?: JsonValue;
  override readonly cause?: unknown;

  constructor(input: RealtimeVoiceServerErrorInput) {
    super(input.message, { cause: input.cause });
    this.code = input.code;
    this.details = input.details;
    this.cause = input.cause;
  }
}

export function toRealtimeError(
  code: RealtimeVoiceServerErrorCode,
  message: string,
  details?: JsonValue,
  cause?: unknown,
): RealtimeVoiceServerError {
  return new RealtimeVoiceServerError({ code, message, details, cause });
}
