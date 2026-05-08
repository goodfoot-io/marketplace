import type { JsonValue, RealtimeVoiceServerErrorCode, RealtimeVoiceServerErrorInput } from "./types.js";
export declare class RealtimeVoiceServerError extends Error {
    readonly name = "RealtimeVoiceServerError";
    readonly code: RealtimeVoiceServerErrorCode;
    readonly details?: JsonValue;
    readonly cause?: unknown;
    constructor(input: RealtimeVoiceServerErrorInput);
}
export declare function toRealtimeError(code: RealtimeVoiceServerErrorCode, message: string, details?: JsonValue, cause?: unknown): RealtimeVoiceServerError;
