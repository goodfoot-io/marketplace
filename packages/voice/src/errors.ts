import type { JsonValue, VoiceAgentServerErrorCode, VoiceAgentServerErrorInput } from "./types.js";

export class VoiceAgentServerError extends Error {
  override readonly name = "VoiceAgentServerError";
  readonly code: VoiceAgentServerErrorCode;
  readonly details?: JsonValue;
  override readonly cause?: unknown;

  constructor(input: VoiceAgentServerErrorInput) {
    super(input.message, { cause: input.cause });
    this.code = input.code;
    this.details = input.details;
    this.cause = input.cause;
  }
}

export function toVoiceError(
  code: VoiceAgentServerErrorCode,
  message: string,
  details?: JsonValue,
  cause?: unknown,
): VoiceAgentServerError {
  return new VoiceAgentServerError({ code, message, details, cause });
}
