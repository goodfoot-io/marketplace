import type { JsonValue, VoiceAgentServerErrorCode, VoiceAgentServerErrorInput } from "./types.js";
export declare class VoiceAgentServerError extends Error {
    readonly name = "VoiceAgentServerError";
    readonly code: VoiceAgentServerErrorCode;
    readonly details?: JsonValue;
    readonly cause?: unknown;
    constructor(input: VoiceAgentServerErrorInput);
}
export declare function toVoiceError(code: VoiceAgentServerErrorCode, message: string, details?: JsonValue, cause?: unknown): VoiceAgentServerError;
