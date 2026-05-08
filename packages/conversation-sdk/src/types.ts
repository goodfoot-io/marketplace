import type { z } from "zod";

export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2";
export const DEFAULT_REALTIME_VOICE = "alloy";
export const DEFAULT_UI_TITLE = "Realtime Voice Console";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface RealtimeSessionConfig {
  instructions: string;
  model?: string;
  voice?: string;
}

export interface BrowserSessionConfig {
  connectOnPageLoad?: boolean;
  firstMessage?: string;
  firstMessageRole?: FirstMessageRole;
}

export type FirstMessageRole = "user" | "system" | "assistant";

export interface RealtimeVoiceUiConfig {
  title?: string;
}

export interface RealtimeVoiceServerConfig<TTools extends RealtimeVoiceToolMap> {
  port: number;
  apiKey: string;
  realtime: RealtimeSessionConfig;
  tools: TTools;
  browserSession?: BrowserSessionConfig;
  ui?: RealtimeVoiceUiConfig;
}

export type RealtimeVoiceToolMap = Record<string, RealtimeVoiceToolDefinition<z.ZodTypeAny>>;

export interface RealtimeVoiceToolDefinition<TParameters extends z.ZodTypeAny> {
  description: string;
  parameters: TParameters;
  execute: RealtimeVoiceToolExecute<TParameters>;
}

export type RealtimeVoiceToolExecute<TParameters extends z.ZodTypeAny> = (
  input: z.infer<TParameters>,
  context: RealtimeVoiceToolContext,
) => JsonValue | Promise<JsonValue>;

export interface RealtimeVoiceToolContext {
  conversationId: string;
  callId: string;
  toolName: string;
  transcript: readonly TranscriptItem[];
  signal: AbortSignal;
}

export interface RealtimeVoiceServerController<TTools extends RealtimeVoiceToolMap>
  extends TypedEventEmitter<RealtimeVoiceServerEvents<TTools>> {
  readonly status: ControllerStatus;
  readonly currentConversation?: ConversationSnapshot<TTools>;
  readonly previousConversations: Readonly<Record<string, ConversationSnapshot<TTools>>>;
  readonly browserClient: BrowserClientState;

  start(): Promise<void>;
  stop(options?: StopOptions): Promise<void>;
  startConversation(): Promise<void>;
  pauseConversation(): Promise<void>;
  resumeConversation(): Promise<void>;
  endConversation(options?: EndConversationOptions): Promise<void>;
  resetConversation(options?: ResetConversationOptions): Promise<void>;
  injectUserMessage(input: InjectUserMessageInput): Promise<TranscriptItem>;
  injectAssistantMessage(input: InjectAssistantMessageInput): Promise<TranscriptItem>;
  injectSystemMessage(input: InjectSystemMessageInput): Promise<TranscriptItem>;
  cancelToolCall(callId: string): Promise<void>;
  updateRealtime(input: UpdateRealtimeInput<TTools>): Promise<void>;
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

export interface ConversationSnapshot<TTools extends RealtimeVoiceToolMap = RealtimeVoiceToolMap> {
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
export type TranscriptSource =
  | "microphone"
  | "textInput"
  | "firstMessage"
  | "assistantAudio"
  | "assistantText"
  | "system";

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

export type ToolName<TTools extends RealtimeVoiceToolMap> = Extract<keyof TTools, string>;

export type ToolInput<TTools extends RealtimeVoiceToolMap, TName extends ToolName<TTools>> =
  TTools[TName] extends RealtimeVoiceToolDefinition<infer TParameters> ? z.infer<TParameters> : never;

export type ToolCallRecord<TTools extends RealtimeVoiceToolMap> = {
  [TName in ToolName<TTools>]: ToolCallRecordOfName<TTools, TName>;
}[ToolName<TTools>];

export type ToolCallRecordOfName<TTools extends RealtimeVoiceToolMap, TName extends ToolName<TTools>> =
  | ToolCallRecordStarted<TTools, TName>
  | ToolCallRecordCompleted<TTools, TName>
  | ToolCallRecordFailed<TTools, TName>
  | ToolCallRecordInterrupted<TTools, TName>;

interface ToolCallRecordBase<TTools extends RealtimeVoiceToolMap, TName extends ToolName<TTools>> {
  id: string;
  conversationId: string;
  toolName: TName;
  callId: string;
  arguments: ToolInput<TTools, TName>;
  startedAt: Date;
}

export interface ToolCallRecordStarted<TTools extends RealtimeVoiceToolMap, TName extends ToolName<TTools>>
  extends ToolCallRecordBase<TTools, TName> {
  status: "started";
}

export interface ToolCallRecordCompleted<TTools extends RealtimeVoiceToolMap, TName extends ToolName<TTools>>
  extends ToolCallRecordBase<TTools, TName> {
  status: "completed";
  result: JsonValue;
  completedAt: Date;
}

export interface ToolCallRecordFailed<TTools extends RealtimeVoiceToolMap, TName extends ToolName<TTools>>
  extends ToolCallRecordBase<TTools, TName> {
  status: "failed";
  error: RealtimeVoiceServerError;
  completedAt: Date;
}

export interface ToolCallRecordInterrupted<TTools extends RealtimeVoiceToolMap, TName extends ToolName<TTools>>
  extends ToolCallRecordBase<TTools, TName> {
  status: "interrupted";
  error: RealtimeVoiceServerError;
  completedAt: Date;
}

export type ToolCallStatus = "started" | "completed" | "failed" | "interrupted";

export type ConversationTimelineItem = ConversationTranscriptTimelineItem | ConversationToolCallTimelineItem;

export interface ConversationTranscriptTimelineItem {
  id: string;
  type: "transcript";
  transcriptItemId: string;
  createdAt: Date;
}

export interface ConversationToolCallTimelineItem {
  id: string;
  type: "toolCall";
  toolCallId: string;
  createdAt: Date;
}

export type EventMap = object;
export type Unsubscribe = () => void;

export interface TypedEventEmitter<TEvents extends EventMap> {
  on<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): Unsubscribe;
  once<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): Unsubscribe;
  off<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): void;
}

export interface RealtimeVoiceServerEvents<TTools extends RealtimeVoiceToolMap> {
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
  "realtime.updated": RealtimeUpdatedEvent;
  "transcript.delta": TranscriptDeltaEvent;
  "transcript.item": TranscriptItemEvent;
  "tool.call.started": ToolCallStartedEvent<TTools>;
  "tool.call.completed": ToolCallCompletedEvent<TTools>;
  "tool.call.failed": ToolCallFailedEvent<TTools>;
  "tool.call.interrupted": ToolCallInterruptedEvent<TTools>;
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
  error: RealtimeVoiceServerError;
  createdAt: Date;
}

export interface BrowserAudioErrorEvent {
  clientId?: string;
  error: RealtimeVoiceServerError;
  createdAt: Date;
}

export interface BrowserAudioDeviceChangeEvent {
  clientId: string;
  audio: BrowserAudioDeviceState;
  createdAt: Date;
}

export interface ConversationStartedEvent<TTools extends RealtimeVoiceToolMap> {
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

export interface ConversationEndedEvent<TTools extends RealtimeVoiceToolMap> {
  conversation: ConversationSnapshot<TTools>;
  createdAt: Date;
}

export interface ConversationResetEvent<TTools extends RealtimeVoiceToolMap> {
  previousConversation: ConversationSnapshot<TTools>;
  currentConversation: ConversationSnapshot<TTools>;
  createdAt: Date;
}

export interface ConversationErrorEvent {
  conversationId?: string;
  error: RealtimeVoiceServerError;
  createdAt: Date;
}

export interface RealtimeUpdatedEvent {
  instructionsUpdated: boolean;
  toolsUpdated: readonly string[];
  createdAt: Date;
}

export interface TranscriptItemEvent {
  item: TranscriptItem;
  createdAt: Date;
}

export interface ToolCallStartedEvent<
  TTools extends RealtimeVoiceToolMap,
  TName extends ToolName<TTools> = ToolName<TTools>,
> {
  conversationId: string;
  toolCallId: string;
  callId: string;
  toolName: TName;
  arguments: ToolInput<TTools, TName>;
  startedAt: Date;
}

export type ToolCallFailedEvent<
  TTools extends RealtimeVoiceToolMap,
  TName extends ToolName<TTools> = ToolName<TTools>,
> =
  | ToolCallFailedAtValidation<TTools, TName>
  | ToolCallFailedAtExecution<TTools, TName>
  | ToolCallFailedAtSerialization<TTools, TName>;

export interface ToolCallCompletedEvent<
  TTools extends RealtimeVoiceToolMap,
  TName extends ToolName<TTools> = ToolName<TTools>,
> {
  conversationId: string;
  toolCallId: string;
  callId: string;
  toolName: TName;
  arguments: ToolInput<TTools, TName>;
  result: JsonValue;
  startedAt: Date;
  completedAt: Date;
}

export interface ToolCallFailedAtValidation<
  TTools extends RealtimeVoiceToolMap,
  TName extends ToolName<TTools> = ToolName<TTools>,
> {
  phase: "validation";
  conversationId: string;
  toolCallId: string;
  callId: string;
  toolName: TName;
  arguments?: JsonValue;
  error: RealtimeVoiceServerError;
  startedAt?: Date;
  failedAt: Date;
}

export interface ToolCallFailedAtExecution<
  TTools extends RealtimeVoiceToolMap,
  TName extends ToolName<TTools> = ToolName<TTools>,
> {
  phase: "execution";
  conversationId: string;
  toolCallId: string;
  callId: string;
  toolName: TName;
  arguments: ToolInput<TTools, TName>;
  error: RealtimeVoiceServerError;
  startedAt: Date;
  failedAt: Date;
}

export interface ToolCallFailedAtSerialization<
  TTools extends RealtimeVoiceToolMap,
  TName extends ToolName<TTools> = ToolName<TTools>,
> {
  phase: "serialization";
  conversationId: string;
  toolCallId: string;
  callId: string;
  toolName: TName;
  arguments: ToolInput<TTools, TName>;
  error: RealtimeVoiceServerError;
  startedAt: Date;
  failedAt: Date;
}

export interface ToolCallInterruptedEvent<
  TTools extends RealtimeVoiceToolMap,
  TName extends ToolName<TTools> = ToolName<TTools>,
> {
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
  error?: RealtimeVoiceServerError;
  createdAt: Date;
}

export type RealtimeVoiceServerErrorCode =
  | "SERVER_ALREADY_STARTED"
  | "SERVER_NOT_STARTED"
  | "SERVER_START_FAILED"
  | "SERVER_STOP_FAILED"
  | "BROWSER_CLIENT_REQUIRED"
  | "BROWSER_CLIENT_ALREADY_CONNECTED"
  | "BROWSER_CLIENT_DISCONNECTED"
  | "MICROPHONE_PERMISSION_DENIED"
  | "MICROPHONE_DEVICE_UNAVAILABLE"
  | "MICROPHONE_DEVICE_ERROR"
  | "NO_CURRENT_CONVERSATION"
  | "CONVERSATION_ALREADY_ACTIVE"
  | "CONVERSATION_NOT_ACTIVE"
  | "CONVERSATION_NOT_PAUSED"
  | "CONVERSATION_START_FAILED"
  | "CONVERSATION_END_FAILED"
  | "CONVERSATION_RESET_FAILED"
  | "CONVERSATION_INVALID_STATE"
  | "MESSAGE_INJECTION_INVALID_STATE"
  | "MESSAGE_INJECTION_EMPTY_TEXT"
  | "MESSAGE_INJECTION_FAILED"
  | "MESSAGE_RESPONSE_TRIGGER_FAILED"
  | "TOOL_NOT_FOUND"
  | "TOOL_ARGUMENT_VALIDATION_FAILED"
  | "TOOL_EXECUTION_FAILED"
  | "TOOL_RESULT_SERIALIZATION_FAILED"
  | "TOOL_CALL_INTERRUPTED"
  | "REALTIME_UPDATE_FAILED"
  | "CONFIG_INVALID"
  | "INTERNAL_INVARIANT_VIOLATION";

export interface RealtimeVoiceServerErrorInput {
  code: RealtimeVoiceServerErrorCode;
  message: string;
  details?: JsonValue;
  cause?: unknown;
}

export declare class RealtimeVoiceServerError extends Error {
  readonly name: "RealtimeVoiceServerError";
  readonly code: RealtimeVoiceServerErrorCode;
  readonly details?: JsonValue;
  readonly cause?: unknown;
  constructor(input: RealtimeVoiceServerErrorInput);
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

export interface UpdateRealtimeInput<TTools extends RealtimeVoiceToolMap> {
  instructions?: string;
  tools?: Partial<{
    [K in keyof TTools]: UpdateRealtimeToolPatch<TTools[K]>;
  }>;
}

export type UpdateRealtimeToolPatch<TDef> =
  TDef extends RealtimeVoiceToolDefinition<infer TParameters>
    ? {
        description?: string;
        execute?: RealtimeVoiceToolExecute<TParameters>;
      }
    : never;
