import type { z } from "zod";
import type { XAIClientEvent } from "./xai-realtime-api.js";
export declare const DEFAULT_REALTIME_MODEL = "grok-voice-latest";
export declare const DEFAULT_REALTIME_VOICE = "eve";
export declare const DEFAULT_UI_TITLE = "Voice Agent";
/**
 * Default wake phrase the browser listens for while the conversation is
 * paused. Detecting it resumes the conversation, exactly as pressing Play.
 * Configurable via `browserSession.wakeWord`; `null` disables the feature.
 */
export declare const DEFAULT_WAKE_WORD = "Hey Computer";
export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
export interface VoiceSessionConfig {
    instructions: string;
    model?: string;
    voice?: string;
}
export interface BrowserSessionConfig {
    connectOnPageLoad?: boolean;
    firstMessage?: string;
    firstMessageRole?: FirstMessageRole;
    /**
     * Wake phrase the browser listens for (via the Web Speech API) while the
     * conversation is paused; detecting it resumes the conversation, exactly
     * like pressing Play. Omitted → defaults to {@link DEFAULT_WAKE_WORD}
     * ("Hey Computer"). Pass `null` to disable wake-word listening entirely.
     */
    wakeWord?: string | null;
}
export type FirstMessageRole = "user" | "system" | "assistant";
export interface VoiceAgentUiConfig {
    title?: string;
    settings?: VoiceAgentSettingItem[];
}
export type VoiceAgentSettingItem = VoiceAgentSettingButton;
export interface VoiceAgentSettingButton {
    type: "button";
    label: string;
    confirmation?: VoiceAgentSettingConfirmation;
    callback: () => void | Promise<void>;
}
export interface VoiceAgentSettingConfirmation {
    text: string;
    confirmLabel?: string;
    cancelLabel?: string;
}
/**
 * Serializable projection of a {@link VoiceAgentSettingItem} sent to the
 * browser in the `state` envelope. The `callback` is stripped (it cannot cross
 * the wire) and a stable `id` is assigned by the controller; the browser sends
 * that id back via a `settings.invoke` message to fire the callback.
 */
export interface VoiceAgentSettingDescriptor {
    id: string;
    type: "button";
    label: string;
    confirmation?: VoiceAgentSettingConfirmation;
}
export interface VoiceAgentServerConfig<TTools extends VoiceAgentToolMap> {
    port: number;
    apiKey: string;
    realtime: VoiceSessionConfig;
    tools: TTools;
    browserSession?: BrowserSessionConfig;
    ui?: VoiceAgentUiConfig;
}
export type VoiceAgentToolMap = Record<string, VoiceAgentToolDefinition<z.ZodTypeAny>>;
export interface VoiceAgentToolDefinition<TParameters extends z.ZodTypeAny> {
    description: string;
    parameters: TParameters;
    execute: VoiceAgentToolExecute<TParameters>;
}
export type VoiceAgentToolExecute<TParameters extends z.ZodTypeAny> = (input: z.infer<TParameters>, context: VoiceAgentToolContext) => JsonValue | Promise<JsonValue>;
export interface VoiceAgentToolContext {
    conversationId: string;
    callId: string;
    toolName: string;
    transcript: readonly TranscriptItem[];
    signal: AbortSignal;
}
export interface VoiceAgentServerController<TTools extends VoiceAgentToolMap> extends TypedEventEmitter<VoiceAgentServerEvents<TTools>> {
    readonly status: ControllerStatus;
    readonly responseInFlight: boolean;
    /**
     * True only while a realtime connection is established and has not been
     * closed or reported a session-level error. `status.conversation` can read
     * `"active"` even after the underlying socket has errored (the error handler
     * does not transition status), so callers that must know whether a
     * `response.create` can actually reach the model gate on this instead.
     */
    readonly realtimeConnected: boolean;
    readonly currentConversation?: ConversationSnapshot<TTools>;
    readonly previousConversations: Readonly<Record<string, ConversationSnapshot<TTools>>>;
    readonly browserClient: BrowserClientState;
    start(): Promise<void>;
    stop(options?: StopOptions): Promise<void>;
    startConversation(): Promise<void>;
    pauseConversation(): Promise<void>;
    resumeConversation(): Promise<void>;
    setAutoResponse(enabled: boolean): Promise<void>;
    requestResponse(): Promise<void>;
    endConversation(options?: EndConversationOptions): Promise<void>;
    resetConversation(options?: ResetConversationOptions): Promise<void>;
    injectUserMessage(input: InjectUserMessageInput): Promise<TranscriptItem>;
    injectAssistantMessage(input: InjectAssistantMessageInput): Promise<TranscriptItem>;
    injectSystemMessage(input: InjectSystemMessageInput): Promise<TranscriptItem>;
    setHtml(input: {
        html: string;
    } | {
        path: string;
    } | null): Promise<void>;
    cancelToolCall(callId: string): Promise<void>;
    updateVoiceSession(input: UpdateVoiceSessionInput<TTools>): Promise<void>;
    broadcastToBrowser(envelope: {
        type: string;
        data?: unknown;
    }): void;
}
export interface StopOptions {
    conversationShutdownTimeoutMs?: number;
}
export interface EndConversationOptions {
    shutdownTimeoutMs?: number;
}
export interface ResetConversationOptions {
    shutdownTimeoutMs?: number;
}
export interface ControllerStatus {
    server: ServerStatus;
    browserClient: BrowserClientStatus;
    conversation: ConversationControllerStatus;
}
export type ServerStatus = "stopped" | "starting" | "active" | "stopping" | "error";
export type BrowserClientStatus = "none" | "connected";
export type ConversationControllerStatus = "none" | "starting" | "active" | "paused" | "ending" | "resetting" | "error";
export interface BrowserClientState {
    connected: boolean;
    clientId?: string;
    connectedAt?: Date;
    audio?: BrowserAudioDeviceState;
}
export interface BrowserAudioDeviceState {
    permission: "unknown" | "prompt" | "granted" | "denied";
    devices: readonly BrowserAudioInputDevice[];
    selectedDeviceId?: string;
    ready: boolean;
    error?: BrowserAudioErrorDetails;
}
export interface BrowserAudioInputDevice {
    deviceId: string;
    label: string;
    groupId?: string;
}
export interface BrowserAudioErrorDetails {
    code: string;
    message: string;
    suggestedAction: string;
}
export interface ConversationSnapshot<TTools extends VoiceAgentToolMap = VoiceAgentToolMap> {
    id: string;
    status: ConversationStatus;
    startedAt: Date;
    endedAt?: Date;
    transcript: readonly TranscriptItem[];
    toolCalls: readonly ToolCallRecord<TTools>[];
    timeline: readonly ConversationTimelineItem[];
}
export type ConversationStatus = "starting" | "active" | "paused" | "ending" | "ended" | "resetting" | "error";
export interface TranscriptItem {
    id: string;
    conversationId: string;
    role: TranscriptRole;
    source: TranscriptSource;
    text: string;
    audio?: TranscriptAudioMetadata;
    createdAt: Date;
}
export type TranscriptRole = "user" | "assistant" | "system";
export type TranscriptSource = "microphone" | "textInput" | "firstMessage" | "assistantAudio" | "assistantText" | "system";
export interface TranscriptAudioMetadata {
    startedAt?: Date;
    endedAt?: Date;
    durationMs?: number;
}
export interface TranscriptDeltaEvent {
    conversationId: string;
    itemId: string;
    role: Extract<TranscriptRole, "user" | "assistant">;
    source: "microphone" | "assistantAudio" | "assistantText" | "textInput";
    delta: string;
    fullTextSoFar: string;
    createdAt: Date;
}
export type ToolName<TTools extends VoiceAgentToolMap> = Extract<keyof TTools, string>;
export type ToolInput<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools>> = TTools[TName] extends VoiceAgentToolDefinition<infer TParameters> ? z.infer<TParameters> : never;
export type ToolCallRecord<TTools extends VoiceAgentToolMap> = {
    [TName in ToolName<TTools>]: ToolCallRecordOfName<TTools, TName>;
}[ToolName<TTools>];
export type ToolCallRecordOfName<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools>> = ToolCallRecordStarted<TTools, TName> | ToolCallRecordCompleted<TTools, TName> | ToolCallRecordFailed<TTools, TName> | ToolCallRecordInterrupted<TTools, TName>;
interface ToolCallRecordBase<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools>> {
    id: string;
    conversationId: string;
    toolName: TName;
    callId: string;
    arguments: ToolInput<TTools, TName>;
    startedAt: Date;
}
export interface ToolCallRecordStarted<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools>> extends ToolCallRecordBase<TTools, TName> {
    status: "started";
}
export interface ToolCallRecordCompleted<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools>> extends ToolCallRecordBase<TTools, TName> {
    status: "completed";
    result: JsonValue;
    completedAt: Date;
}
export interface ToolCallRecordFailed<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools>> extends ToolCallRecordBase<TTools, TName> {
    status: "failed";
    error: VoiceAgentServerError;
    completedAt: Date;
}
export interface ToolCallRecordInterrupted<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools>> extends ToolCallRecordBase<TTools, TName> {
    status: "interrupted";
    error: VoiceAgentServerError;
    completedAt: Date;
}
export type ToolCallStatus = "started" | "completed" | "failed" | "interrupted";
export type ConversationTimelineItem = ConversationTranscriptTimelineItem | ConversationToolCallTimelineItem;
export interface ConversationTranscriptTimelineItem {
    id: string;
    type: "transcript";
    transcriptItemId: string;
    createdAt: Date;
    /**
     * Logical conversational position: a monotonic value stamped once when the
     * item's slot is first created, in xAI event arrival order. xAI emits a
     * user turn's `conversation.item.added` before the following assistant
     * response's transcript, so creation order is the true conversational
     * order; a late `input_audio_transcription.completed` updates text only and
     * keeps the sequence assigned at creation.
     */
    sequence: number;
}
export interface ConversationToolCallTimelineItem {
    id: string;
    type: "toolCall";
    toolCallId: string;
    createdAt: Date;
    /** Logical conversational position. See {@link ConversationTranscriptTimelineItem.sequence}. */
    sequence: number;
}
export type EventMap = object;
export type Unsubscribe = () => void;
export interface TypedEventEmitter<TEvents extends EventMap> {
    on<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): Unsubscribe;
    once<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): Unsubscribe;
    off<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): void;
}
export interface VoiceAgentServerEvents<TTools extends VoiceAgentToolMap> {
    "server.started": ServerStartedEvent;
    "server.stopped": ServerStoppedEvent;
    "browser.client.connected": BrowserClientConnectedEvent;
    "browser.client.disconnected": BrowserClientDisconnectedEvent;
    "browser.client.rejected": BrowserClientRejectedEvent;
    "browser.audio.error": BrowserAudioErrorEvent;
    "browser.audio.deviceChange": BrowserAudioDeviceChangeEvent;
    "conversation.started": ConversationStartedEvent<TTools>;
    "conversation.paused": ConversationPausedEvent;
    "conversation.resumed": ConversationResumedEvent;
    "conversation.ended": ConversationEndedEvent<TTools>;
    "conversation.reset": ConversationResetEvent<TTools>;
    "conversation.error": ConversationErrorEvent;
    "response.completed": ResponseCompletedEvent;
    "voice.session.updated": VoiceSessionUpdatedEvent;
    "transcript.delta": TranscriptDeltaEvent;
    "transcript.item": TranscriptItemEvent;
    "tool.call.started": ToolCallStartedEvent<TTools>;
    "tool.call.completed": ToolCallCompletedEvent<TTools>;
    "tool.call.failed": ToolCallFailedEvent<TTools>;
    "tool.call.interrupted": ToolCallInterruptedEvent<TTools>;
    "injected.error": InjectedErrorEvent;
    "html.click": HtmlClickEvent;
    log: LogEvent;
}
export interface ServerStartedEvent {
    port: number;
    url: string;
    createdAt: Date;
}
export interface ServerStoppedEvent {
    port: number;
    createdAt: Date;
}
export interface BrowserClientConnectedEvent {
    clientId: string;
    connectedAt: Date;
}
export interface BrowserClientDisconnectedEvent {
    clientId: string;
    disconnectedAt: Date;
}
export interface BrowserClientRejectedEvent {
    attemptedClientId: string;
    activeClientId: string;
    error: VoiceAgentServerError;
    createdAt: Date;
}
export interface BrowserAudioErrorEvent {
    clientId?: string;
    error: VoiceAgentServerError;
    createdAt: Date;
}
export interface BrowserAudioDeviceChangeEvent {
    clientId: string;
    audio: BrowserAudioDeviceState;
    createdAt: Date;
}
export interface ConversationStartedEvent<TTools extends VoiceAgentToolMap> {
    conversation: ConversationSnapshot<TTools>;
    createdAt: Date;
}
export interface ConversationPausedEvent {
    conversationId: string;
    createdAt: Date;
}
export interface ConversationResumedEvent {
    conversationId: string;
    createdAt: Date;
}
export interface ConversationEndedEvent<TTools extends VoiceAgentToolMap> {
    conversation: ConversationSnapshot<TTools>;
    createdAt: Date;
}
export interface ConversationResetEvent<TTools extends VoiceAgentToolMap> {
    previousConversation: ConversationSnapshot<TTools>;
    currentConversation: ConversationSnapshot<TTools>;
    createdAt: Date;
}
export interface ConversationErrorEvent {
    conversationId?: string;
    error: VoiceAgentServerError;
    createdAt: Date;
}
export interface ResponseCompletedEvent {
    conversationId?: string;
    createdAt: Date;
}
export interface VoiceSessionUpdatedEvent {
    instructionsUpdated: boolean;
    toolsUpdated: readonly string[];
    createdAt: Date;
}
export interface TranscriptItemEvent {
    item: TranscriptItem;
    createdAt: Date;
}
export interface ToolCallStartedEvent<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools> = ToolName<TTools>> {
    conversationId: string;
    toolCallId: string;
    callId: string;
    toolName: TName;
    arguments: ToolInput<TTools, TName>;
    startedAt: Date;
}
export type ToolCallFailedEvent<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools> = ToolName<TTools>> = ToolCallFailedAtValidation<TTools, TName> | ToolCallFailedAtExecution<TTools, TName> | ToolCallFailedAtSerialization<TTools, TName>;
export interface ToolCallCompletedEvent<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools> = ToolName<TTools>> {
    conversationId: string;
    toolCallId: string;
    callId: string;
    toolName: TName;
    arguments: ToolInput<TTools, TName>;
    result: JsonValue;
    startedAt: Date;
    completedAt: Date;
}
export interface ToolCallFailedAtValidation<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools> = ToolName<TTools>> {
    phase: "validation";
    conversationId: string;
    toolCallId: string;
    callId: string;
    toolName: TName;
    arguments?: JsonValue;
    error: VoiceAgentServerError;
    startedAt?: Date;
    failedAt: Date;
}
export interface ToolCallFailedAtExecution<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools> = ToolName<TTools>> {
    phase: "execution";
    conversationId: string;
    toolCallId: string;
    callId: string;
    toolName: TName;
    arguments: ToolInput<TTools, TName>;
    error: VoiceAgentServerError;
    startedAt: Date;
    failedAt: Date;
}
export interface ToolCallFailedAtSerialization<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools> = ToolName<TTools>> {
    phase: "serialization";
    conversationId: string;
    toolCallId: string;
    callId: string;
    toolName: TName;
    arguments: ToolInput<TTools, TName>;
    error: VoiceAgentServerError;
    startedAt: Date;
    failedAt: Date;
}
export interface ToolCallInterruptedEvent<TTools extends VoiceAgentToolMap, TName extends ToolName<TTools> = ToolName<TTools>> {
    conversationId: string;
    toolCallId: string;
    callId: string;
    toolName: TName;
    arguments?: JsonValue;
    reason: string;
    interruptedAt: Date;
}
export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogEvent {
    level: LogLevel;
    code: string;
    message: string;
    details?: JsonValue;
    error?: VoiceAgentServerError;
    createdAt: Date;
}
export interface InjectedErrorEvent {
    path: string;
    code: string;
    message: string;
    error: VoiceAgentServerError;
    createdAt: Date;
}
export interface HtmlClickEvent {
    x: number;
    y: number;
    width: number;
    height: number;
    path: string;
    createdAt: Date;
}
export type VoiceAgentServerErrorCode = "SERVER_ALREADY_STARTED" | "SERVER_NOT_STARTED" | "SERVER_START_FAILED" | "SERVER_STOP_FAILED" | "BROWSER_CLIENT_REQUIRED" | "BROWSER_CLIENT_ALREADY_CONNECTED" | "BROWSER_CLIENT_DISCONNECTED" | "MICROPHONE_PERMISSION_DENIED" | "MICROPHONE_DEVICE_UNAVAILABLE" | "MICROPHONE_DEVICE_ERROR" | "NO_CURRENT_CONVERSATION" | "CONVERSATION_ALREADY_ACTIVE" | "CONVERSATION_NOT_ACTIVE" | "CONVERSATION_NOT_PAUSED" | "CONVERSATION_START_FAILED" | "CONVERSATION_END_FAILED" | "CONVERSATION_RESET_FAILED" | "CONVERSATION_INVALID_STATE" | "MESSAGE_INJECTION_INVALID_STATE" | "MESSAGE_INJECTION_EMPTY_TEXT" | "MESSAGE_INJECTION_FAILED" | "MESSAGE_RESPONSE_TRIGGER_FAILED" | "TOOL_NOT_FOUND" | "TOOL_ARGUMENT_VALIDATION_FAILED" | "TOOL_EXECUTION_FAILED" | "TOOL_RESULT_SERIALIZATION_FAILED" | "TOOL_CALL_INTERRUPTED" | "SESSION_ERROR" | "SESSION_UPDATE_FAILED" | "CONFIG_INVALID" | "INTERNAL_INVARIANT_VIOLATION" | "INJECTED_FILE_UNREADABLE";
export interface VoiceAgentServerErrorInput {
    code: VoiceAgentServerErrorCode;
    message: string;
    details?: JsonValue;
    cause?: unknown;
}
export declare class VoiceAgentServerError extends Error {
    readonly name: "VoiceAgentServerError";
    readonly code: VoiceAgentServerErrorCode;
    readonly details?: JsonValue;
    readonly cause?: unknown;
    constructor(input: VoiceAgentServerErrorInput);
}
export interface InjectUserMessageInput {
    text: string;
    source?: InjectedUserMessageSource;
    triggerResponse?: boolean;
}
export type InjectedUserMessageSource = "textInput" | "system";
export interface InjectAssistantMessageInput {
    text: string;
    source?: InjectedAssistantMessageSource;
}
export type InjectedAssistantMessageSource = "assistantText" | "system";
export interface InjectSystemMessageInput {
    text: string;
    triggerResponse?: boolean;
}
export interface UpdateVoiceSessionInput<TTools extends VoiceAgentToolMap> {
    instructions?: string;
    tools?: Partial<{
        [K in keyof TTools]: UpdateVoiceSessionToolPatch<TTools[K]>;
    }>;
}
export type UpdateVoiceSessionToolPatch<TDef> = TDef extends VoiceAgentToolDefinition<infer TParameters> ? {
    description?: string;
    execute?: VoiceAgentToolExecute<TParameters>;
} : never;
export type ServerEnvelope = {
    type: "state";
    data: {
        server: ServerStatus;
        browserClient: BrowserClientStatus;
        conversation?: ConversationSnapshot<VoiceAgentToolMap>;
        conversationStatus: ConversationControllerStatus;
        instructions: string;
        connectOnPageLoad: boolean;
        wakeWord: string | null;
        injectedVersion: number | null;
        settings: VoiceAgentSettingDescriptor[];
    };
} | {
    type: "stage.injected";
    data: {
        injectedVersion: number | null;
    };
} | {
    type: "transcript.item";
    data: TranscriptItem;
} | {
    type: "transcript.delta";
    data: TranscriptDeltaEvent;
} | {
    type: "browser.audio.deviceChange";
    data: BrowserAudioDeviceState;
} | {
    type: "voice.session.start";
} | {
    type: "voice.session.token";
    data: {
        clientSecret: string;
        model: string;
        expiresAt?: number;
    };
} | {
    type: "voice.session.close";
    data: {
        code: number;
        reason: string;
    };
} | {
    type: "voice.send";
    data: {
        event: XAIClientEvent;
        gate?: "playback-drained";
    };
} | {
    type: "audio.output.delta";
    data: {
        audio: string;
    };
} | {
    type: "duplicate.client";
} | {
    type: "wait_for_context.start";
} | {
    type: "wait_for_context.end";
} | {
    type: "settings.result";
    data: {
        id: string;
        ok: boolean;
        error?: string;
    };
} | {
    type: "error";
    data: {
        code: string;
        message: string;
    };
};
export {};
