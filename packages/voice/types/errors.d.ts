import type { JsonValue, VoiceAgentServerErrorCode, VoiceAgentServerErrorInput } from "./types.js";
export declare class VoiceAgentServerError extends Error {
    readonly name = "VoiceAgentServerError";
    readonly code: VoiceAgentServerErrorCode;
    readonly details?: JsonValue;
    readonly cause?: unknown;
    constructor(input: VoiceAgentServerErrorInput);
}
/** @deprecated Use VoiceAgentServerError */
export declare const RealtimeVoiceServerError: typeof VoiceAgentServerError;
export declare function toVoiceError(code: VoiceAgentServerErrorCode, message: string, details?: JsonValue, cause?: unknown): VoiceAgentServerError;
/** @deprecated Use toVoiceError */
export declare const toRealtimeError: typeof toVoiceError;
