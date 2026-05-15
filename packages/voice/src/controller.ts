import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { StrictEventEmitter } from "./emitter.js";
import { toVoiceError, VoiceAgentServerError } from "./errors.js";
import {
  type BrowserAudioDeviceState,
  type BrowserClientState,
  type ControllerStatus,
  type ConversationSnapshot,
  type ConversationStatus,
  type ConversationTimelineItem,
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_VOICE,
  DEFAULT_UI_TITLE,
  type InjectAssistantMessageInput,
  type InjectSystemMessageInput,
  type InjectUserMessageInput,
  type JsonValue,
  type ServerStatus,
  type ToolCallCompletedEvent,
  type ToolCallFailedAtExecution,
  type ToolCallFailedAtSerialization,
  type ToolCallFailedAtValidation,
  type ToolCallRecord,
  type ToolInput,
  type ToolName,
  type TranscriptItem,
  type TranscriptRole,
  type TranscriptSource,
  type UpdateVoiceSessionInput,
  type VoiceAgentServerConfig,
  type VoiceAgentServerController,
  type VoiceAgentServerErrorCode,
  type VoiceAgentServerEvents,
  type VoiceAgentToolDefinition,
  type VoiceAgentToolExecute,
  type VoiceAgentToolMap,
} from "./types.js";
import uiHtml from "./ui/index.html";
import type {
  XAIClientEvent,
  XAIServerEvent,
  XAISessionConfig,
  XAIRealtimeModel,
  XAIVoice,
} from "./xai-realtime-api.js";

type MutableConversation<TTools extends VoiceAgentToolMap> = {
  id: string;
  status: ConversationStatus;
  startedAt: Date;
  endedAt?: Date;
  transcript: TranscriptItem[];
  toolCalls: ToolCallRecord<TTools>[];
  timeline: ConversationTimelineItem[];
};

type BrowserEnvelope =
  | { type: "conversation.start" }
  | { type: "conversation.pause" }
  | { type: "conversation.resume" }
  | { type: "conversation.reset" }
  | { type: "conversation.end" }
  | { type: "message.text"; data?: { text?: unknown } }
  | { type: "audio.device.select"; data?: { deviceId?: unknown } }
  | { type: "audio.device.state"; data?: BrowserAudioDeviceState }
  | { type: "browser.audio.error"; data?: { code?: unknown; message?: unknown; suggestedAction?: unknown } }
  | { type: "voice.session.requested" }
  | { type: "voice.session.connected" }
  | { type: "voice.session.failed"; data?: { error?: { code?: unknown; message?: unknown } } }
  | { type: "voice.event"; data?: { event?: unknown } }
  | { type: "browser.debug"; data?: { label?: unknown; info?: unknown; t?: unknown } };

type RealtimeGate = "playback-drained";

type RealtimeConnection = {
  send(event: XAIClientEvent, gate?: RealtimeGate): void;
  close(props?: { code: number; reason: string }): void;
  on(eventName: string, handler: (event: XAIServerEvent) => void): unknown;
  socket?: { readyState: number };
};

// xAI Voice Agent ephemeral client secret mint endpoint.
const XAI_CLIENT_SECRET_URL = "https://api.x.ai/v1/realtime/client_secrets";
const VOICE_CONNECT_TIMEOUT_MS = 30_000;

interface XaiClientSecretResponse {
  value?: unknown;
  token?: unknown;
  expires_at?: unknown;
  client_secret?: unknown;
}

type RealtimeConnectionEmitter = {
  emit(eventName: string, payload: XAIServerEvent): void;
  emitClose(): void;
};

type SocketRef = { readyState: number };

class BrowserProxiedVoiceConnection implements RealtimeConnection {
  readonly socket: SocketRef;
  readonly #handlers = new Map<string, Array<(event: XAIServerEvent) => void>>();
  readonly #sendToBrowser: (envelope: { type: string; data?: unknown }) => void;
  #closed = false;

  constructor(input: { sendToBrowser: (envelope: { type: string; data?: unknown }) => void; socket: SocketRef }) {
    this.#sendToBrowser = input.sendToBrowser;
    this.socket = input.socket;
  }

  send(event: XAIClientEvent, gate?: RealtimeGate): void {
    if (this.#closed) return;
    this.#sendToBrowser({ type: "voice.send", data: gate ? { event, gate } : { event } });
  }

  close(props?: { code: number; reason: string }): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#sendToBrowser({
      type: "voice.session.close",
      data: { code: props?.code ?? 1000, reason: props?.reason ?? "closed" },
    });
  }

  on(eventName: string, handler: (event: XAIServerEvent) => void): () => void {
    const list = this.#handlers.get(eventName) ?? [];
    list.push(handler);
    this.#handlers.set(eventName, list);
    return () => {
      const current = this.#handlers.get(eventName);
      if (!current) return;
      const next = current.filter((entry) => entry !== handler);
      if (next.length === 0) this.#handlers.delete(eventName);
      else this.#handlers.set(eventName, next);
    };
  }

  controller(): RealtimeConnectionEmitter {
    return {
      emit: (eventName: string, payload: XAIServerEvent) => {
        const list = this.#handlers.get(eventName);
        if (!list) return;
        for (const handler of [...list]) {
          try {
            handler(payload);
          } catch (cause) {
            // Re-surface asynchronously so one bad handler does not break the
            // fan-out loop, while still failing the process / surfacing in
            // unhandledRejection (rather than being silently dropped).
            queueMicrotask(() => {
              throw cause instanceof Error ? cause : new Error(String(cause));
            });
          }
        }
      },
      emitClose: () => {
        this.#closed = true;
      },
    };
  }
}

type InternalConfig<TTools extends VoiceAgentToolMap> = VoiceAgentServerConfig<TTools> & {
  __voiceFactory?: (input: { apiKey: string; model: string }) => RealtimeConnection | Promise<RealtimeConnection>;
};

export function createVoiceAgentServer<const TTools extends VoiceAgentToolMap>(
  config: VoiceAgentServerConfig<TTools>,
): VoiceAgentServerController<TTools> {
  return new VoiceAgentServerControllerImpl(config as InternalConfig<TTools>);
}

class VoiceAgentServerControllerImpl<const TTools extends VoiceAgentToolMap>
  extends StrictEventEmitter<VoiceAgentServerEvents<TTools>>
  implements VoiceAgentServerController<TTools>
{
  readonly #config: NormalizedConfig<TTools>;
  readonly #voiceFactory?: InternalConfig<TTools>["__voiceFactory"];
  readonly #tools: { [K in keyof TTools]: TTools[K] };
  readonly #toolDescriptions = new Map<string, string>();
  readonly #toolExecutors = new Map<string, VoiceAgentToolDefinition<TTools[keyof TTools]["parameters"]>["execute"]>();
  readonly #previousConversations: Record<string, ConversationSnapshot<TTools>> = {};
  readonly #browserClient: BrowserClientState = { connected: false };

  #status: ControllerStatus = { server: "stopped", browserClient: "none", conversation: "none" };
  #conversation?: MutableConversation<TTools>;
  #server?: Server;
  #wss?: WebSocketServer;
  #browserSocket?: WebSocket;
  #realtime?: RealtimeConnection;
  #browserProxiedEmitter?: RealtimeConnectionEmitter;
  #pendingVoiceSession?: {
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  };
  #lifecycleLocked = false;
  #autoResponseEnabled = true;
  #responseInFlight = false;
  #instructions: string;
  #pendingToolResultCount = 0;
  readonly #activeToolAbortControllers = new Map<string, AbortController>();
  readonly #streamingAssistantText = new Map<string, string>();

  constructor(config: InternalConfig<TTools>) {
    super();
    validateConfig(config);
    this.#config = normalizeConfig(config);
    this.#voiceFactory = config.__voiceFactory;
    this.#tools = config.tools;
    this.#instructions = config.realtime.instructions;
    for (const [name, definition] of Object.entries(config.tools)) {
      this.#toolDescriptions.set(name, definition.description);
      this.#toolExecutors.set(name, definition.execute);
    }
  }

  get status(): ControllerStatus {
    return { ...this.#status };
  }

  get responseInFlight(): boolean {
    return this.#responseInFlight;
  }

  get currentConversation(): ConversationSnapshot<TTools> | undefined {
    return this.#conversation ? snapshotConversation(this.#conversation) : undefined;
  }

  get previousConversations(): Readonly<Record<string, ConversationSnapshot<TTools>>> {
    return { ...this.#previousConversations };
  }

  get browserClient(): BrowserClientState {
    return cloneBrowserClient(this.#browserClient);
  }

  async start(): Promise<void> {
    if (this.#status.server !== "stopped") {
      throw this.#fail("SERVER_ALREADY_STARTED", "Server can only be started from the stopped state.", {
        server: this.#status.server,
      });
    }
    this.#setServerStatus("starting");
    try {
      const html = await this.#loadUi();
      const server = createServer((request, response) => this.#handleHttpRequest(request, response, html));
      const wss = new WebSocketServer({ noServer: true });
      server.on("upgrade", (request, socket, head) => {
        if (request.url !== "/ws") {
          socket.destroy();
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
      });
      wss.on("connection", (socket) => this.#handleBrowserConnection(socket));
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(this.#config.port, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      this.#server = server;
      this.#wss = wss;
      this.#setServerStatus("active");
      this.emit("server.started", {
        port: this.#config.port,
        url: `http://localhost:${this.#config.port}`,
        createdAt: new Date(),
      });
    } catch (cause) {
      this.#setServerStatus("error");
      throw this.#fail("SERVER_START_FAILED", "Failed to start the Voice Agent server.", undefined, cause);
    }
  }

  async stop(options?: { conversationShutdownTimeoutMs?: number }): Promise<void> {
    this.#assertLifecycleUnlocked();
    if (this.#status.server !== "active") {
      throw this.#fail("SERVER_NOT_STARTED", "Server can only be stopped from the active state.", {
        server: this.#status.server,
      });
    }
    this.#setServerStatus("stopping");
    try {
      if (this.#conversation) {
        await this.#endConversationLocked(options?.conversationShutdownTimeoutMs);
      }
      this.#closeRealtime("server stopped");
      await new Promise<void>((resolve, reject) => {
        // Forcibly terminate WebSocket clients — http.Server.close() waits
        // for all active connections (including WS upgrades) to be idle,
        // and a still-connected browser would otherwise block shutdown
        // indefinitely.
        for (const client of this.#wss?.clients ?? []) {
          client.terminate();
        }
        this.#wss?.close();
        this.#browserSocket?.terminate();
        this.#server?.closeAllConnections?.();
        this.#server?.close((error) => (error ? reject(error) : resolve()));
      });
      this.#server = undefined;
      this.#wss = undefined;
      this.#clearBrowserClient();
      this.#setServerStatus("stopped");
      this.emit("server.stopped", { port: this.#config.port, createdAt: new Date() });
    } catch (cause) {
      this.#setServerStatus("error");
      throw this.#fail("SERVER_STOP_FAILED", "Failed to stop the Voice Agent server cleanly.", undefined, cause);
    }
  }

  async startConversation(): Promise<void> {
    this.#assertLifecycleUnlocked();
    await this.#startConversationLocked();
  }

  async pauseConversation(): Promise<void> {
    this.#assertLifecycleUnlocked();
    const conversation = this.#requireConversation("CONVERSATION_NOT_ACTIVE");
    if (conversation.status !== "active") {
      throw this.#fail("CONVERSATION_NOT_ACTIVE", "Conversation must be active to pause.", {
        conversation: conversation.status,
      });
    }
    conversation.status = "paused";
    this.#setConversationStatus("paused");
    this.#broadcastState();
    this.emit("conversation.paused", { conversationId: conversation.id, createdAt: new Date() });
  }

  async resumeConversation(): Promise<void> {
    this.#assertLifecycleUnlocked();
    const conversation = this.#requireConversation("CONVERSATION_NOT_PAUSED");
    if (conversation.status !== "paused") {
      throw this.#fail("CONVERSATION_NOT_PAUSED", "Conversation must be paused to resume.", {
        conversation: conversation.status,
      });
    }
    conversation.status = "active";
    this.#setConversationStatus("active");
    this.#broadcastState();
    this.emit("conversation.resumed", { conversationId: conversation.id, createdAt: new Date() });
  }

  async requestResponse(): Promise<void> {
    await this.#requestModelResponse();
  }

  async setAutoResponse(enabled: boolean): Promise<void> {
    // xAI's `turn_detection` schema does not include `create_response` /
    // `interrupt_response` (OpenAI-only). Auto-response gating is enforced
    // locally via the `#sendToolResult` `response.create` gate; no network
    // call is needed to honor this flag.
    this.#autoResponseEnabled = enabled;
  }

  async endConversation(options?: { shutdownTimeoutMs?: number }): Promise<void> {
    this.#assertLifecycleUnlocked();
    try {
      await this.#endConversationLocked(options?.shutdownTimeoutMs);
    } catch (error) {
      if (error instanceof VoiceAgentServerError) {
        this.emit("conversation.error", {
          conversationId: this.#conversation?.id,
          error,
          createdAt: new Date(),
        });
      }
      throw error;
    }
  }

  async resetConversation(options?: { shutdownTimeoutMs?: number }): Promise<void> {
    this.#assertLifecycleUnlocked();
    this.#lifecycleLocked = true;
    try {
      const previous = await this.#endConversationLocked(options?.shutdownTimeoutMs, "resetting");
      await this.#startConversationLocked();
      const current = this.currentConversation;
      if (!current) {
        throw this.#fail("INTERNAL_INVARIANT_VIOLATION", "Reset completed without a current conversation.");
      }
      this.emit("conversation.reset", {
        previousConversation: previous,
        currentConversation: current,
        createdAt: new Date(),
      });
    } catch (cause) {
      const error =
        cause instanceof VoiceAgentServerError
          ? cause
          : this.#fail("CONVERSATION_RESET_FAILED", "Failed to reset the conversation.", undefined, cause);
      this.emit("conversation.error", {
        conversationId: this.#conversation?.id,
        error,
        createdAt: new Date(),
      });
      throw error;
    } finally {
      this.#lifecycleLocked = false;
    }
  }

  async injectUserMessage(input: InjectUserMessageInput): Promise<TranscriptItem> {
    const source = input.source ?? "system";
    const text = normalizeText(input.text);
    if (!text) {
      throw this.#fail("MESSAGE_INJECTION_EMPTY_TEXT", "Injected message text must be non-empty.");
    }
    const item = this.#injectMessage("user", source, text, "MESSAGE_INJECTION_INVALID_STATE");
    if (input.triggerResponse !== false) await this.#requestModelResponse();
    return item;
  }

  async injectAssistantMessage(input: InjectAssistantMessageInput): Promise<TranscriptItem> {
    return this.#injectMessage("assistant", input.source ?? "system", input.text, "MESSAGE_INJECTION_INVALID_STATE");
  }

  async injectSystemMessage(input: InjectSystemMessageInput): Promise<TranscriptItem> {
    const item = this.#injectMessage("system", "system", input.text, "MESSAGE_INJECTION_INVALID_STATE");
    if (input.triggerResponse === true) await this.#requestModelResponse();
    return item;
  }

  async cancelToolCall(callId: string): Promise<void> {
    const conversation = this.#requireInjectableConversation("CONVERSATION_INVALID_STATE");
    const toolCall = conversation.toolCalls.find((record) => record.callId === callId);
    if (!toolCall || toolCall.status !== "started") {
      throw this.#fail("TOOL_CALL_INTERRUPTED", "No in-flight tool call exists for the provided callId.", {
        callId,
      });
    }
    this.#activeToolAbortControllers.get(callId)?.abort("cancelToolCall");
    this.#markToolInterrupted(conversation, toolCall.id, toolCall.callId, toolCall.toolName, "cancelToolCall");
    this.#broadcastState();
  }

  async updateVoiceSession(input: UpdateVoiceSessionInput<TTools>): Promise<void> {
    if (this.#status.server !== "active") {
      throw this.#fail("SERVER_NOT_STARTED", "Realtime updates require an active server.", {
        server: this.#status.server,
      });
    }
    const toolEntries = Object.entries(input.tools ?? {});
    if (input.instructions === undefined && toolEntries.length === 0) {
      throw this.#fail("SESSION_UPDATE_FAILED", "Realtime update input cannot be empty.");
    }
    for (const [toolName] of toolEntries) {
      if (!(toolName in this.#tools)) {
        throw this.#fail("TOOL_NOT_FOUND", "Realtime update referenced an unknown tool.", { toolName });
      }
    }
    if (input.instructions !== undefined) this.#instructions = input.instructions;
    const updatedTools: string[] = [];
    for (const [toolName, patch] of toolEntries) {
      if (!patch) continue;
      if (patch.description !== undefined) this.#toolDescriptions.set(toolName, patch.description);
      if (patch.execute !== undefined) this.#toolExecutors.set(toolName, patch.execute);
      updatedTools.push(toolName);
    }
    try {
      this.#sendSessionUpdate();
    } catch (cause) {
      throw this.#fail("SESSION_UPDATE_FAILED", "Voice session rejected the update.", undefined, cause);
    }
    this.emit("voice.session.updated", {
      instructionsUpdated: input.instructions !== undefined,
      toolsUpdated: updatedTools,
      createdAt: new Date(),
    });
  }

  async #createRealtimeConnection(): Promise<RealtimeConnection> {
    try {
      if (this.#voiceFactory) {
        // Test factory is responsible for returning an already-ready connection.
        return await this.#voiceFactory({ apiKey: this.#config.apiKey, model: this.#config.realtime.model });
      }
      // Browser-proxied flow: the browser owns the WebSocket to xAI.
      // The daemon (a) mints an ephemeral client secret on request,
      // (b) routes xAI Voice Agent events to/from the browser over
      // the existing WebSocket. Construction blocks until the browser
      // signals voice.session.connected.
      const socketRef: SocketRef = { readyState: 0 /* CONNECTING */ };
      const connection = new BrowserProxiedVoiceConnection({
        sendToBrowser: (envelope) => this.#broadcast(envelope),
        socket: socketRef,
      });
      this.#browserProxiedEmitter = connection.controller();

      const connected = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.#pendingVoiceSession = undefined;
          reject(new Error("Timed out waiting for browser voice.session.connected."));
        }, VOICE_CONNECT_TIMEOUT_MS);
        this.#pendingVoiceSession = { resolve, reject, timeout };
      });

      // Tell the browser to begin its xAI WebSocket setup. Browser will respond with
      // voice.session.requested → daemon mints ephemeral key → browser
      // opens WS to xAI → browser signals voice.session.connected (or voice.session.failed).
      this.#broadcast({ type: "voice.session.start" });

      try {
        await connected;
      } catch (cause) {
        this.#browserProxiedEmitter = undefined;
        throw cause;
      }
      socketRef.readyState = 1 /* OPEN */;
      return connection;
    } catch (cause) {
      const error = this.#fail(
        "CONVERSATION_START_FAILED",
        "Failed to connect to the xAI Voice Agent.",
        undefined,
        cause,
      );
      this.emit("conversation.error", { conversationId: this.#conversation?.id, error, createdAt: new Date() });
      throw error;
    }
  }

  async #mintEphemeralClientSecret(): Promise<{ clientSecret: string; model: string; expiresAt: number }> {
    const model = this.#config.realtime.model;
    const response = await fetch(XAI_CLIENT_SECRET_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.#config.apiKey}`,
      },
      // xAI mint endpoint accepts only expires_after; model and session config
      // go over the WebSocket via session.update after connect.
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(`xAI client_secrets returned ${response.status}: ${bodyText}`);
    }
    const json = (await response.json()) as XaiClientSecretResponse;
    // Accept multiple plausible shapes (xAI docs do not quote field names).
    // Priority: top-level value → top-level token → client_secret string →
    //   client_secret.value → client_secret.token.
    const cs = json.client_secret;
    const csObj = cs !== null && typeof cs === "object" ? (cs as Record<string, unknown>) : undefined;
    const token =
      (typeof json.value === "string" ? json.value : undefined) ??
      (typeof json.token === "string" ? json.token : undefined) ??
      (typeof cs === "string" ? cs : undefined) ??
      (typeof csObj?.value === "string" ? csObj.value : undefined) ??
      (typeof csObj?.token === "string" ? csObj.token : undefined);

    const rawExpiry =
      (typeof json.expires_at === "number" ? json.expires_at : undefined) ??
      (typeof csObj?.expires_at === "number" ? (csObj.expires_at as number) : undefined);

    if (typeof token !== "string" || typeof rawExpiry !== "number") {
      throw new Error(`xAI client_secrets response has unexpected shape. Raw body: ${JSON.stringify(json)}`);
    }

    // Normalize expiresAt to seconds. xAI does not pin the unit; if the value
    // is > 1e12 it is almost certainly milliseconds.
    const expiresAt = rawExpiry > 1e12 ? rawExpiry / 1000 : rawExpiry;
    const unitApplied = rawExpiry > 1e12 ? "milliseconds → normalized to seconds" : "seconds";
    this.emit("log", {
      level: "info",
      code: "SESSION_ERROR",
      message: `xAI client_secrets expires_at interpreted as ${unitApplied} (raw=${rawExpiry}, normalized=${expiresAt}).`,
      details: { rawExpiry, expiresAt, unitApplied },
      createdAt: new Date(),
    });

    return { clientSecret: token, model, expiresAt };
  }

  #wireRealtimeConnection(realtime: RealtimeConnection): void {
    realtime.on("error", (error) => {
      // Benign: a `response.cancel` arrived while no response was in flight.
      // Swallow it instead of surfacing as conversation.error.
      if (error.error?.code === "response_cancel_not_active") return;

      const wrapped = toVoiceError("SESSION_ERROR", "Voice Agent session reported an error.", undefined, error);
      this.#log("error", wrapped);
      this.emit("conversation.error", {
        conversationId: this.#conversation?.id,
        error: wrapped,
        createdAt: new Date(),
      });
    });

    realtime.on("conversation.item.input_audio_transcription.completed", (event) =>
      this.#handleUserTranscriptCompleted(event),
    );

    realtime.on("conversation.item.added", (event) => this.#handleConversationItemAdded(event));

    realtime.on("response.created", () => {
      this.#responseInFlight = true;
    });
    realtime.on("response.done", () => {
      if (!this.#responseInFlight) return;
      this.#responseInFlight = false;
      this.emit("response.completed", {
        conversationId: this.#conversation?.id,
        createdAt: new Date(),
      });
    });
    // xAI event names per notes/xai-api-surface.md.
    realtime.on("response.output_audio_transcript.delta", (event) =>
      this.#handleAssistantTranscriptDelta(event, "assistantAudio"),
    );
    realtime.on("response.output_audio_transcript.done", (event) =>
      this.#handleAssistantTranscriptDone(event, "assistantAudio"),
    );
    // xAI's beta name for the text-only assistant transcript channel.
    // OpenAI GA emits `response.output_text.{delta,done}`; xAI emits
    // `response.text.{delta,done}` with functionally identical payloads.
    realtime.on("response.text.delta", (event) =>
      this.#handleAssistantTranscriptDelta(event, "assistantText"),
    );
    realtime.on("response.text.done", (event) =>
      this.#handleAssistantTranscriptDone(event, "assistantText"),
    );
    realtime.on("response.output_audio.delta", (event) =>
      // Relay to browser for visualizer only. Playback is driven by the
      // browser's xAI WS message handler directly — not by this relay.
      this.#broadcast({ type: "audio.output.delta", data: { audio: event.delta } }),
    );
    realtime.on("response.function_call_arguments.done", (event) => {
      void this.#handleToolCall(event);
    });

    // Catch-all: log any xAI event type not matched by an existing handler.
    // This makes event-name mismatches visible at runtime rather than silently
    // dropping audio or transcripts.
    // `response.text.done`, `response.cancelled`, `response.failed` are not in
    // the reference doc but are observed in practice; included to silence the
    // catch-all warn logger. No behavior change.
    const knownEventTypes = new Set([
      "error",
      "session.created",
      "conversation.created",
      "session.updated",
      "input_audio_buffer.speech_started",
      "input_audio_buffer.speech_stopped",
      "input_audio_buffer.committed",
      "input_audio_buffer.cleared",
      "conversation.item.deleted",
      "conversation.item.added",
      "conversation.item.input_audio_transcription.completed",
      "response.created",
      "response.output_item.added",
      "response.output_item.done",
      "response.content_part.added",
      "response.content_part.done",
      "response.output_audio_transcript.delta",
      "response.output_audio_transcript.done",
      "response.output_audio.delta",
      "response.output_audio.done",
      "response.text.delta",
      "response.text.done",
      "response.function_call_arguments.delta",
      "response.function_call_arguments.done",
      "response.cancelled",
      "response.failed",
      "mcp_list_tools.in_progress",
      "mcp_list_tools.completed",
      "mcp_list_tools.failed",
      "response.mcp_call_arguments.delta",
      "response.mcp_call_arguments.done",
      "response.mcp_call.in_progress",
      "response.mcp_call.completed",
      "response.mcp_call.failed",
      "response.done",
    ]);
    realtime.on("*", (event) => {
      if (!knownEventTypes.has(event.type)) {
        this.emit("log", {
          level: "warn",
          code: "VOICE_UNKNOWN_EVENT",
          message: `Unrecognized xAI event type: ${event.type}`,
          details: { eventType: event.type },
          createdAt: new Date(),
        });
      }
    });
  }

  #sendSessionUpdate(): void {
    if (!this.#realtime) return;
    this.#realtime.send({
      type: "session.update",
      session: {
        instructions: this.#instructions,
        model: this.#config.realtime.model,
        voice: this.#config.realtime.voice,
        audio: {
          input: { format: { type: "audio/pcm", rate: 48000 } },
          output: { format: { type: "audio/pcm", rate: 48000 } },
        },
        turn_detection: {
          type: "server_vad",
        },
        tools: toolsToRealtimeTools(this.#tools, this.#toolDescriptions),
      },
    });
  }

  #sendTranscriptItemToRealtime(item: TranscriptItem): void {
    if (!this.#realtime) return;
    const contentType = item.role === "assistant" ? "output_text" : "input_text";
    this.#realtime.send({
      type: "conversation.item.create",
      item: {
        id: item.id,
        type: "message",
        role: item.role,
        status: "completed",
        content: [{ type: contentType, text: item.text }],
      },
    });
  }

  #closeRealtime(reason: string): void {
    for (const abortController of this.#activeToolAbortControllers.values()) {
      abortController.abort(reason);
    }
    this.#activeToolAbortControllers.clear();
    this.#streamingAssistantText.clear();
    this.#pendingToolResultCount = 0;
    this.#realtime?.close({ code: 1000, reason });
    this.#realtime = undefined;
    this.#browserProxiedEmitter = undefined;
    this.#failPendingVoiceSession(new Error(`Voice connection closed: ${reason}`));
  }

  #failPendingVoiceSession(cause: Error): void {
    const pending = this.#pendingVoiceSession;
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.#pendingVoiceSession = undefined;
    pending.reject(cause);
  }

  #handleAssistantTranscriptDelta(event: XAIServerEvent, source: "assistantAudio" | "assistantText"): void {
    const conversation = this.#conversation;
    if (!conversation) return;
    if (!event.item_id || event.delta === undefined) return;
    const fullTextSoFar = (this.#streamingAssistantText.get(event.item_id) ?? "") + event.delta;
    this.#streamingAssistantText.set(event.item_id, fullTextSoFar);
    this.emit("transcript.delta", {
      conversationId: conversation.id,
      itemId: event.item_id,
      role: "assistant",
      source,
      delta: event.delta,
      fullTextSoFar,
      createdAt: new Date(),
    });
    this.#broadcast({
      type: "transcript.delta",
      data: {
        itemId: event.item_id,
        role: "assistant",
        source,
        delta: event.delta,
        fullTextSoFar,
      },
    });
  }

  #handleAssistantTranscriptDone(event: XAIServerEvent, source: "assistantAudio" | "assistantText"): void {
    const conversation = this.#conversation;
    if (!conversation || !event.item_id) return;
    const accumulated = this.#streamingAssistantText.get(event.item_id);
    this.#streamingAssistantText.delete(event.item_id);
    // `response.text.done` carries `event.text`; `response.output_audio_transcript.done`
    // carries `event.transcript`. Accept either, falling back to the accumulated deltas.
    const text =
      normalizeText(event.transcript ?? event.text ?? "") || (accumulated ? normalizeText(accumulated) : "");
    if (!text && accumulated === undefined) return;
    this.#appendTranscriptItemWithId(conversation, event.item_id, "assistant", source, text);
    this.#broadcastState();
  }

  // xAI's authoritative slot-creation event. Fires BEFORE response.created
  // for the assistant turn that follows, so creating the user transcript
  // slot here locks chronological order — transcription.completed (which
  // arrives later, ASR-bound) just fills in the text by item.id.
  #handleConversationItemAdded(event: XAIServerEvent): void {
    const conversation = this.#conversation;
    const item = event.item;
    if (!conversation || !item?.id || item.role !== "user") return;
    const initialText = normalizeText(
      item.content?.find((c) => c?.type === "input_audio")?.transcript ??
        item.content?.find((c) => c?.type === "input_text")?.text ??
        "",
    );
    this.#upsertUserTranscript(conversation, item.id, initialText);
  }

  #handleUserTranscriptCompleted(event: XAIServerEvent): void {
    const conversation = this.#conversation;
    if (!conversation || !event.item_id) return;
    const text = normalizeText(event.transcript ?? event.text ?? "");
    if (!text) return;
    this.#upsertUserTranscript(conversation, event.item_id, text);
  }

  // xAI emits `conversation.item.input_audio_transcription.completed` for both
  // partial and final transcripts under the same item_id. The first completed
  // creates the item; subsequent completeds must overwrite `text` in place and
  // re-broadcast so the UI re-renders the updated value.
  #upsertUserTranscript(conversation: MutableConversation<TTools>, id: string, text: string): TranscriptItem {
    const existing = conversation.transcript.find((item) => item.id === id);
    if (existing) {
      if (existing.text === text) return existing;
      // Preserve existing non-empty text against an empty incoming value:
      // `conversation.item.added` can arrive after `transcription.completed`
      // with an empty transcript field and must not clobber the real text.
      if (!text && existing.text) return existing;
      existing.text = text;
      this.emit("transcript.item", { item: existing, createdAt: new Date() });
      this.#broadcast({ type: "transcript.item", data: existing });
      return existing;
    }
    return this.#appendTranscriptItemWithId(conversation, id, "user", "microphone", text);
  }

  #appendTranscriptItemWithId(
    conversation: MutableConversation<TTools>,
    id: string,
    role: TranscriptRole,
    source: TranscriptSource,
    text: string,
  ): TranscriptItem {
    const existing = conversation.transcript.find((item) => item.id === id);
    if (existing) return existing;
    const item: TranscriptItem = {
      id,
      conversationId: conversation.id,
      role,
      source,
      text,
      createdAt: new Date(),
    };
    conversation.transcript.push(item);
    conversation.timeline.push({
      id: createId("timeline"),
      type: "transcript",
      transcriptItemId: item.id,
      createdAt: item.createdAt,
    });
    this.emit("transcript.item", { item, createdAt: new Date() });
    this.#broadcast({ type: "transcript.item", data: item });
    return item;
  }

  #removeTranscriptItem(conversation: MutableConversation<TTools>, itemId: string): void {
    conversation.transcript = conversation.transcript.filter((item) => item.id !== itemId);
    conversation.timeline = conversation.timeline.filter(
      (item) => item.type !== "transcript" || item.transcriptItemId !== itemId,
    );
  }

  async #handleToolCall(event: XAIServerEvent): Promise<void> {
    const conversation = this.#conversation;
    if (!conversation) return;
    if (!event.item_id || !event.call_id || !event.name || event.arguments === undefined) return;
    const toolName = event.name;
    const tool = this.#tools[toolName as keyof TTools];
    const failedAt = new Date();
    if (!tool) {
      const error = toVoiceError("TOOL_NOT_FOUND", "Voice Agent requested an unknown tool.", { toolName });
      this.emit("tool.call.failed", {
        phase: "validation",
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName: toolName as ToolName<TTools>,
        error,
        failedAt,
      } as ToolCallFailedAtValidation<TTools>);
      this.#log("error", error);
      return;
    }

    let parsedJson: JsonValue;
    try {
      parsedJson = JSON.parse(event.arguments) as JsonValue;
    } catch (cause) {
      const error = toVoiceError(
        "TOOL_ARGUMENT_VALIDATION_FAILED",
        "Tool arguments were not valid JSON.",
        {
          toolName,
          callId: event.call_id,
        },
        cause,
      );
      this.emit("tool.call.failed", {
        phase: "validation",
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName: toolName as ToolName<TTools>,
        error,
        failedAt,
      } as ToolCallFailedAtValidation<TTools>);
      this.#log("error", error);
      return;
    }

    const validation = tool.parameters.safeParse(parsedJson);
    if (!validation.success) {
      const error = toVoiceError("TOOL_ARGUMENT_VALIDATION_FAILED", "Tool arguments failed schema validation.", {
        toolName,
        callId: event.call_id,
        issues: validation.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
      this.emit("tool.call.failed", {
        phase: "validation",
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName: toolName as ToolName<TTools>,
        arguments: parsedJson,
        error,
        failedAt,
      } as ToolCallFailedAtValidation<TTools>);
      this.#log("error", error);
      return;
    }

    const startedAt = new Date();
    const abortController = new AbortController();
    const typedToolName = toolName as ToolName<TTools>;
    const typedArguments = validation.data as ToolInput<TTools, ToolName<TTools>>;
    const record = {
      id: event.item_id,
      conversationId: conversation.id,
      toolName: typedToolName,
      callId: event.call_id,
      arguments: typedArguments,
      startedAt,
      status: "started" as const,
    };
    conversation.toolCalls.push(record as ToolCallRecord<TTools>);
    conversation.timeline.push({
      id: createId("timeline"),
      type: "toolCall",
      toolCallId: record.id,
      createdAt: startedAt,
    });
    this.#activeToolAbortControllers.set(event.call_id, abortController);
    this.#pendingToolResultCount += 1;
    let cleanedUpEarly = false;
    this.emit("tool.call.started", {
      conversationId: conversation.id,
      toolCallId: event.item_id,
      callId: event.call_id,
      toolName: typedToolName,
      arguments: typedArguments,
      startedAt,
    });
    this.#broadcastState();

    const executor = this.#toolExecutors.get(toolName) as VoiceAgentToolExecute<typeof tool.parameters> | undefined;
    try {
      const result = await executor?.(validation.data, {
        conversationId: conversation.id,
        callId: event.call_id,
        toolName,
        transcript: [...conversation.transcript],
        signal: abortController.signal,
      });
      if (abortController.signal.aborted) {
        this.#markToolInterrupted(conversation, event.item_id, event.call_id, toolName, "aborted");
        return;
      }
      let serialized: string | undefined;
      if (!isJsonValue(result)) {
        serialized = undefined;
      } else {
        try {
          serialized = JSON.stringify(result);
        } catch {
          serialized = undefined;
        }
      }
      if (serialized === undefined) {
        const error = toVoiceError("TOOL_RESULT_SERIALIZATION_FAILED", "Tool result must be JSON-serializable.", {
          toolName,
          callId: event.call_id,
        });
        Object.assign(record, { status: "failed", error, completedAt: new Date() });
        this.emit("tool.call.failed", {
          phase: "serialization",
          conversationId: conversation.id,
          toolCallId: event.item_id,
          callId: event.call_id,
          toolName: typedToolName,
          arguments: typedArguments,
          error,
          startedAt,
          failedAt: new Date(),
        } as ToolCallFailedAtSerialization<TTools>);
        this.#log("error", error);
        return;
      }
      const completedAt = new Date();
      Object.assign(record, { status: "completed", result, completedAt });
      this.emit("tool.call.completed", {
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName: toolName as ToolName<TTools>,
        arguments: typedArguments,
        result,
        startedAt,
        completedAt,
      } as ToolCallCompletedEvent<TTools>);
      // Decrement before #sendToolResult so the pendingToolResultCount === 0
      // gate in #sendToolResult fires correctly for the last parallel call.
      // The finally block checks cleanedUpEarly to avoid double-decrement.
      this.#pendingToolResultCount -= 1;
      this.#activeToolAbortControllers.delete(event.call_id);
      cleanedUpEarly = true;
      this.#sendToolResult(event.call_id, serialized);
    } catch (cause) {
      if (abortController.signal.aborted) {
        this.#markToolInterrupted(conversation, event.item_id, event.call_id, toolName, "aborted");
        return;
      }
      const error = toVoiceError(
        "TOOL_EXECUTION_FAILED",
        "Tool execution failed.",
        { toolName, callId: event.call_id },
        cause,
      );
      Object.assign(record, { status: "failed", error, completedAt: new Date() });
      this.emit("tool.call.failed", {
        phase: "execution",
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName: typedToolName,
        arguments: typedArguments,
        error,
        startedAt,
        failedAt: new Date(),
      } as ToolCallFailedAtExecution<TTools>);
      this.#log("error", error);
    } finally {
      if (!cleanedUpEarly) {
        this.#pendingToolResultCount -= 1;
        this.#activeToolAbortControllers.delete(event.call_id);
      }
      this.#broadcastState();
    }
  }

  #sendToolResult(callId: string, serialized: string): void {
    this.#realtime?.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: serialized,
      },
    });
    // Only fire response.create when this is the last pending tool output.
    // xAI requires all function-call outputs be submitted before response.create.
    // The wait_for_context tool disables auto-response so the model stays silent
    // until fresh context/topics arrive.
    if (this.#status.conversation === "active" && this.#autoResponseEnabled && this.#pendingToolResultCount === 0) {
      // Gate on playback-drained: the browser holds this response.create until
      // any in-flight assistant audio has finished, preventing overlap of the
      // post-tool turn with the previous turn's tail.
      this.#realtime?.send({ type: "response.create" }, "playback-drained");
    }
  }

  #markToolInterrupted(
    conversation: MutableConversation<TTools>,
    toolCallId: string,
    callId: string,
    toolName: string,
    reason: string,
  ): void {
    const record = conversation.toolCalls.find((toolCall) => toolCall.id === toolCallId);
    if (record && record.status !== "started") return;
    const interruptedAt = new Date();
    const error = toVoiceError("TOOL_CALL_INTERRUPTED", "Tool call was interrupted.", { callId, reason });
    if (record) Object.assign(record, { status: "interrupted", error, completedAt: interruptedAt });
    this.emit("tool.call.interrupted", {
      conversationId: conversation.id,
      toolCallId,
      callId,
      toolName: toolName as ToolName<TTools>,
      reason,
      interruptedAt,
    });
  }

  async #startConversationLocked(): Promise<void> {
    if (this.#status.server !== "active") {
      throw this.#fail("SERVER_NOT_STARTED", "Conversation start requires an active server.", {
        server: this.#status.server,
      });
    }
    if (
      !this.#browserClient.connected ||
      !this.#browserSocket ||
      this.#browserSocket.readyState !== this.#browserSocket.OPEN
    ) {
      throw this.#fail(
        "BROWSER_CLIENT_REQUIRED",
        "Exactly one browser client must be connected before conversation start.",
      );
    }
    if (this.#conversation) {
      throw this.#fail("CONVERSATION_ALREADY_ACTIVE", "A current conversation already exists.", {
        conversationId: this.#conversation.id,
        status: this.#conversation.status,
      });
    }
    if (!this.#browserClient.audio?.ready) {
      const error = this.#fail(
        "MICROPHONE_DEVICE_UNAVAILABLE",
        "Microphone permission and device readiness are required.",
      );
      this.emit("browser.audio.error", { clientId: this.#browserClient.clientId, error, createdAt: new Date() });
      throw error;
    }
    this.#setConversationStatus("starting");
    this.#broadcastState();
    try {
      const realtime = await this.#createRealtimeConnection();
      this.#realtime = realtime;
      this.#wireRealtimeConnection(realtime);
      this.#sendSessionUpdate();
      const conversation: MutableConversation<TTools> = {
        id: createId("conv"),
        status: "starting",
        startedAt: new Date(),
        transcript: [],
        toolCalls: [],
        timeline: [],
      };
      this.#conversation = conversation;
      this.#pendingToolResultCount = 0;
      conversation.status = "active";
      this.#setConversationStatus("active");
      if (this.#config.browserSession.firstMessage) {
        const role = this.#config.browserSession.firstMessageRole;
        const firstMessage = this.#appendTranscriptItem(
          conversation,
          role,
          "firstMessage",
          this.#config.browserSession.firstMessage,
        );
        this.#sendTranscriptItemToRealtime(firstMessage);
        await this.#requestModelResponse();
      }
      this.#broadcastState();
      this.emit("conversation.started", { conversation: snapshotConversation(conversation), createdAt: new Date() });
    } catch (cause) {
      this.#setConversationStatus("none");
      this.#broadcastState();
      throw cause;
    }
  }

  async #endConversationLocked(
    _timeoutMs?: number,
    transitionalStatus: ConversationStatus = "ending",
  ): Promise<ConversationSnapshot<TTools>> {
    const conversation = this.#requireConversation("NO_CURRENT_CONVERSATION");
    if (conversation.status !== "active" && conversation.status !== "paused") {
      throw this.#fail("CONVERSATION_INVALID_STATE", "Conversation must be active or paused to end.", {
        conversation: conversation.status,
      });
    }
    conversation.status = transitionalStatus;
    this.#setConversationStatus(transitionalStatus === "resetting" ? "resetting" : "ending");
    this.#interruptInFlightToolCalls(conversation, transitionalStatus);
    this.#closeRealtime(`conversation ${transitionalStatus}`);
    this.#autoResponseEnabled = true;
    this.#responseInFlight = false;
    this.#pendingToolResultCount = 0;
    conversation.status = "ended";
    conversation.endedAt = new Date();
    const archived = snapshotConversation(conversation);
    this.#previousConversations[conversation.id] = archived;
    this.#conversation = undefined;
    this.#setConversationStatus("none");
    this.#broadcastState();
    this.emit("conversation.ended", { conversation: archived, createdAt: new Date() });
    return archived;
  }

  #appendTranscriptItem(
    conversation: MutableConversation<TTools>,
    role: TranscriptRole,
    source: TranscriptSource,
    text: string,
  ): TranscriptItem {
    const item: TranscriptItem = {
      id: createId("msg"),
      conversationId: conversation.id,
      role,
      source,
      text,
      createdAt: new Date(),
    };
    conversation.transcript.push(item);
    conversation.timeline.push({
      id: createId("timeline"),
      type: "transcript",
      transcriptItemId: item.id,
      createdAt: item.createdAt,
    });
    this.emit("transcript.item", { item, createdAt: new Date() });
    this.#broadcast({ type: "transcript.item", data: item });
    return item;
  }

  #injectMessage(
    role: TranscriptRole,
    source: TranscriptSource,
    text: string,
    invalidStateCode: VoiceAgentServerErrorCode,
  ): TranscriptItem {
    let conversation: MutableConversation<TTools>;
    try {
      conversation = this.#requireInjectableConversation(invalidStateCode);
    } catch (error) {
      if (error instanceof VoiceAgentServerError) {
        this.emit("conversation.error", {
          conversationId: this.#conversation?.id,
          error,
          createdAt: new Date(),
        });
      }
      throw error;
    }
    const normalized = normalizeText(text);
    if (!normalized) {
      throw this.#fail("MESSAGE_INJECTION_EMPTY_TEXT", "Injected message text must be non-empty.");
    }
    let item: TranscriptItem | undefined;
    try {
      item = this.#appendTranscriptItem(conversation, role, source, normalized);
      this.#sendTranscriptItemToRealtime(item);
      this.#broadcastState();
      return item;
    } catch (cause) {
      if (item) this.#removeTranscriptItem(conversation, item.id);
      const error = this.#fail(
        "MESSAGE_INJECTION_FAILED",
        "Failed to inject message into the current conversation.",
        undefined,
        cause,
      );
      this.emit("conversation.error", {
        conversationId: conversation.id,
        error,
        createdAt: new Date(),
      });
      throw error;
    }
  }

  async #requestModelResponse(): Promise<void> {
    const conversation = this.#requireInjectableConversation("MESSAGE_INJECTION_INVALID_STATE");
    if (conversation.status !== "active" && conversation.status !== "paused") {
      throw this.#fail("MESSAGE_RESPONSE_TRIGGER_FAILED", "Cannot trigger a model response in the current state.", {
        conversation: conversation.status,
      });
    }
    try {
      this.#realtime?.send({ type: "response.create" });
    } catch (cause) {
      throw this.#fail(
        "MESSAGE_RESPONSE_TRIGGER_FAILED",
        "Voice session rejected the response request.",
        undefined,
        cause,
      );
    }
  }

  #requireConversation(code: VoiceAgentServerErrorCode): MutableConversation<TTools> {
    if (!this.#conversation) {
      throw this.#fail(code, "There is no current conversation.");
    }
    return this.#conversation;
  }

  #requireInjectableConversation(code: VoiceAgentServerErrorCode): MutableConversation<TTools> {
    const conversation = this.#requireConversation(code);
    if (conversation.status !== "active" && conversation.status !== "paused") {
      throw this.#fail(code, "Current conversation is not active or paused.", {
        conversation: conversation.status,
      });
    }
    return conversation;
  }

  #assertLifecycleUnlocked(): void {
    if (this.#lifecycleLocked) {
      throw this.#fail("CONVERSATION_INVALID_STATE", "Another conversation lifecycle operation is in progress.");
    }
  }

  #interruptInFlightToolCalls(conversation: MutableConversation<TTools>, reason: string): void {
    for (const toolCall of conversation.toolCalls) {
      if (toolCall.status !== "started") continue;
      const interruptedAt = new Date();
      const error = toVoiceError("TOOL_CALL_INTERRUPTED", "Tool call was interrupted by conversation cleanup.", {
        callId: toolCall.callId,
        reason,
      });
      Object.assign(toolCall, { status: "interrupted", error, completedAt: interruptedAt });
      this.emit("tool.call.interrupted", {
        conversationId: conversation.id,
        toolCallId: toolCall.id,
        callId: toolCall.callId,
        toolName: toolCall.toolName,
        arguments: toolCall.arguments as JsonValue,
        reason,
        interruptedAt,
      });
    }
  }

  async #loadUi(): Promise<string> {
    return uiHtml;
  }

  #handleHttpRequest(request: IncomingMessage, response: ServerResponse, html: string): void {
    if (request.method !== "GET" || (request.url !== "/" && request.url !== "/index.html")) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html.replaceAll("__REALTIME_VOICE_TITLE__", escapeHtml(this.#config.ui.title)));
  }

  #handleBrowserConnection(socket: WebSocket): void {
    const attemptedClientId = createId("client");
    if (this.#browserSocket && this.#browserSocket.readyState === socket.OPEN) {
      const error = toVoiceError("BROWSER_CLIENT_ALREADY_CONNECTED", "Another browser client is already connected.", {
        activeClientId: this.#browserClient.clientId ?? "",
        attemptedClientId,
      });
      socket.send(JSON.stringify({ type: "duplicate.client" }));
      socket.close(1008, "duplicate client");
      this.emit("browser.client.rejected", {
        attemptedClientId,
        activeClientId: this.#browserClient.clientId ?? "",
        error,
        createdAt: new Date(),
      });
      this.#log("warn", error);
      return;
    }
    this.#browserSocket = socket;
    this.#browserClient.connected = true;
    this.#browserClient.clientId = attemptedClientId;
    this.#browserClient.connectedAt = new Date();
    this.#browserClient.audio = { permission: "unknown", devices: [], ready: false };
    this.#setBrowserStatus("connected");
    this.emit("browser.client.connected", {
      clientId: attemptedClientId,
      connectedAt: this.#browserClient.connectedAt,
    });
    this.#broadcastState();

    socket.on("message", (message) => {
      void this.#handleBrowserMessage(String(message)).catch((error: unknown) => {
        const normalized =
          error instanceof VoiceAgentServerError
            ? error
            : toVoiceError("INTERNAL_INVARIANT_VIOLATION", "Browser message handling failed.", undefined, error);
        socket.send(JSON.stringify({ type: "error", data: serializeError(normalized) }));
      });
    });
    socket.on("close", () => {
      const clientId = this.#browserClient.clientId;
      this.#clearBrowserClient();
      this.#broadcastState();
      if (clientId) this.emit("browser.client.disconnected", { clientId, disconnectedAt: new Date() });
    });
  }

  async #handleBrowserMessage(raw: string): Promise<void> {
    let message: BrowserEnvelope;
    try {
      message = JSON.parse(raw) as BrowserEnvelope;
    } catch (cause) {
      throw this.#fail("CONFIG_INVALID", "Browser message was not valid JSON.", undefined, cause);
    }
    switch (message.type) {
      case "conversation.start":
        await this.startConversation();
        break;
      case "conversation.pause":
        await this.pauseConversation();
        break;
      case "conversation.resume":
        await this.resumeConversation();
        break;
      case "conversation.reset":
        await this.resetConversation();
        break;
      case "conversation.end":
        await this.endConversation();
        break;
      case "message.text": {
        const text = typeof message.data?.text === "string" ? message.data.text : "";
        if (this.#status.conversation === "none") await this.startConversation();
        await this.injectUserMessage({ text, source: "textInput" });
        break;
      }
      case "voice.session.requested": {
        try {
          const token = await this.#mintEphemeralClientSecret();
          this.#broadcast({
            type: "voice.session.token",
            data: {
              clientSecret: token.clientSecret,
              model: token.model,
              expiresAt: token.expiresAt,
            },
          });
        } catch (cause) {
          const error = this.#fail(
            "CONVERSATION_START_FAILED",
            "Failed to mint xAI ephemeral client secret.",
            undefined,
            cause,
          );
          this.#failPendingVoiceSession(error);
          this.emit("conversation.error", {
            conversationId: this.#conversation?.id,
            error,
            createdAt: new Date(),
          });
        }
        break;
      }
      case "voice.session.connected": {
        const pending = this.#pendingVoiceSession;
        if (pending) {
          clearTimeout(pending.timeout);
          this.#pendingVoiceSession = undefined;
          pending.resolve();
        }
        break;
      }
      case "voice.session.failed": {
        const code = String(message.data?.error?.code ?? "VOICE_SESSION_FAILED");
        const text = String(message.data?.error?.message ?? "Browser reported a Voice Agent session failure.");
        const error = toVoiceError("CONVERSATION_START_FAILED", text, { code });
        this.#failPendingVoiceSession(error);
        // If the session failed mid-conversation (after connect), mark a
        // session error so the controller's wired error handler runs.
        this.#browserProxiedEmitter?.emit("error", { type: "error", error: { message: error.message, code: error.code } });
        break;
      }
      case "voice.event": {
        const event = message.data?.event;
        if (event && typeof event === "object") {
          const eventRecord = event as Record<string, unknown>;
          const eventType = typeof eventRecord.type === "string" ? eventRecord.type : undefined;
          if (eventType) this.#browserProxiedEmitter?.emit(eventType, eventRecord as XAIServerEvent);
        }
        break;
      }
      case "audio.device.select":
        if (this.#browserClient.audio && typeof message.data?.deviceId === "string") {
          this.#browserClient.audio = { ...this.#browserClient.audio, selectedDeviceId: message.data.deviceId };
          this.#emitAudioChange();
        }
        break;
      case "audio.device.state":
        if (message.data) {
          this.#browserClient.audio = message.data;
          this.#emitAudioChange();
        }
        break;
      case "browser.debug": {
        let details: JsonValue | undefined;
        try {
          details = JSON.parse(JSON.stringify({ info: message.data?.info, t: message.data?.t })) as JsonValue;
        } catch {
          details = undefined;
        }
        this.emit("log", {
          level: "debug",
          code: "BROWSER_DEBUG",
          message: typeof message.data?.label === "string" ? message.data.label : "browser.debug",
          details,
          createdAt: new Date(),
        });
        break;
      }
      case "browser.audio.error": {
        const error = toVoiceError("MICROPHONE_DEVICE_ERROR", "Browser reported a microphone error.", {
          code: String(message.data?.code ?? "unknown"),
          message: String(message.data?.message ?? "Unknown microphone error."),
          suggestedAction: String(message.data?.suggestedAction ?? "Check microphone access and try again."),
        });
        this.emit("browser.audio.error", { clientId: this.#browserClient.clientId, error, createdAt: new Date() });
        this.#log("error", error);
        break;
      }
    }
  }

  #emitAudioChange(): void {
    const clientId = this.#browserClient.clientId;
    const audio = this.#browserClient.audio;
    if (!clientId || !audio) return;
    this.emit("browser.audio.deviceChange", { clientId, audio, createdAt: new Date() });
    this.#broadcast({
      type: "browser.audio.deviceChange",
      data: { devices: audio.devices, selectedDeviceId: audio.selectedDeviceId },
    });
    this.#broadcastState();
    if (this.#config.browserSession.connectOnPageLoad && audio.ready && this.#status.conversation === "none") {
      void this.startConversation().catch((error: unknown) => {
        const wrapped =
          error instanceof VoiceAgentServerError
            ? error
            : toVoiceError("CONVERSATION_START_FAILED", "connectOnPageLoad failed.", undefined, error);
        this.emit("conversation.error", {
          conversationId: this.#conversation?.id,
          error: wrapped,
          createdAt: new Date(),
        });
      });
    }
  }

  #clearBrowserClient(): void {
    this.#browserSocket = undefined;
    this.#browserClient.connected = false;
    delete this.#browserClient.clientId;
    delete this.#browserClient.connectedAt;
    delete this.#browserClient.audio;
    this.#setBrowserStatus("none");
  }

  #setServerStatus(server: ServerStatus): void {
    this.#status = { ...this.#status, server };
  }

  #setBrowserStatus(browserClient: ControllerStatus["browserClient"]): void {
    this.#status = { ...this.#status, browserClient };
  }

  #setConversationStatus(conversation: ControllerStatus["conversation"]): void {
    this.#status = { ...this.#status, conversation };
  }

  #broadcastState(): void {
    this.#broadcast({
      type: "state",
      data: {
        ...this.status,
        // Include controller-level conversation status separately so the
        // browser sees transitional states (e.g. "starting") even when
        // currentConversation is not yet populated.
        conversationStatus: this.#status.conversation,
        conversation: this.currentConversation,
      },
    });
  }

  broadcastToBrowser(envelope: { type: string; data?: unknown }): void {
    this.#broadcast(envelope);
  }

  #broadcast(payload: unknown): void {
    if (this.#browserSocket?.readyState === WebSocket.OPEN) {
      this.#browserSocket.send(JSON.stringify(payload));
    }
  }

  #fail(code: VoiceAgentServerErrorCode, message: string, details?: JsonValue, cause?: unknown): VoiceAgentServerError {
    const error = toVoiceError(code, message, details, cause);
    this.#log("error", error);
    return error;
  }

  #log(level: "debug" | "info" | "warn" | "error", error: VoiceAgentServerError): void {
    this.emit("log", {
      level,
      code: error.code,
      message: error.message,
      details: error.details,
      error,
      createdAt: new Date(),
    });
  }
}

interface NormalizedConfig<TTools extends VoiceAgentToolMap> extends VoiceAgentServerConfig<TTools> {
  realtime: Required<VoiceAgentServerConfig<TTools>["realtime"]>;
  browserSession: Required<NonNullable<VoiceAgentServerConfig<TTools>["browserSession"]>>;
  ui: Required<NonNullable<VoiceAgentServerConfig<TTools>["ui"]>>;
}

function normalizeConfig<TTools extends VoiceAgentToolMap>(
  config: VoiceAgentServerConfig<TTools>,
): NormalizedConfig<TTools> {
  return {
    ...config,
    realtime: {
      instructions: config.realtime.instructions,
      model: config.realtime.model ?? DEFAULT_REALTIME_MODEL,
      voice: config.realtime.voice ?? DEFAULT_REALTIME_VOICE,
    },
    browserSession: {
      connectOnPageLoad: config.browserSession?.connectOnPageLoad ?? false,
      firstMessage: config.browserSession?.firstMessage ?? "",
      firstMessageRole: config.browserSession?.firstMessageRole ?? "user",
    },
    ui: {
      title: config.ui?.title ?? DEFAULT_UI_TITLE,
    },
  };
}

function validateConfig<TTools extends VoiceAgentToolMap>(config: VoiceAgentServerConfig<TTools>): void {
  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    throw toVoiceError("CONFIG_INVALID", "port must be an integer between 1 and 65535.", { port: config.port });
  }
  if (!config.apiKey) {
    throw toVoiceError("CONFIG_INVALID", "apiKey is required.");
  }
  if (!normalizeText(config.realtime?.instructions)) {
    throw toVoiceError("CONFIG_INVALID", "realtime.instructions is required.");
  }
  for (const [name, tool] of Object.entries(config.tools)) {
    if (!name || !tool.description || !tool.parameters || typeof tool.execute !== "function") {
      throw toVoiceError("CONFIG_INVALID", "Each tool requires a name, description, parameters, and execute.", {
        name,
      });
    }
  }
}

function snapshotConversation<TTools extends VoiceAgentToolMap>(
  conversation: MutableConversation<TTools>,
): ConversationSnapshot<TTools> {
  return {
    id: conversation.id,
    status: conversation.status,
    startedAt: conversation.startedAt,
    endedAt: conversation.endedAt,
    transcript: [...conversation.transcript],
    toolCalls: [...conversation.toolCalls],
    timeline: [...conversation.timeline],
  };
}

function cloneBrowserClient(input: BrowserClientState): BrowserClientState {
  return {
    connected: input.connected,
    clientId: input.clientId,
    connectedAt: input.connectedAt,
    audio: input.audio
      ? {
          ...input.audio,
          devices: [...input.audio.devices],
          error: input.audio.error ? { ...input.audio.error } : undefined,
        }
      : undefined,
  };
}

function normalizeText(text: string): string {
  return typeof text === "string" ? text.trim() : "";
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function serializeError(error: VoiceAgentServerError): JsonValue {
  return { name: error.name, code: error.code, message: error.message, details: error.details ?? null };
}

function toolsToRealtimeTools<TTools extends VoiceAgentToolMap>(
  tools: TTools,
  descriptions: ReadonlyMap<string, string>,
): JsonValue[] {
  return Object.entries(tools).map(([name, definition]) => ({
    type: "function",
    name,
    description: descriptions.get(name) ?? definition.description,
    parameters: zodToJsonSchema(definition.parameters),
  }));
}

function zodToJsonSchema(schema: z.ZodTypeAny): JsonValue {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, JsonValue> = {};
    const required: string[] = [];
    for (const [key, child] of Object.entries(shape)) {
      const childSchema = child as z.ZodTypeAny;
      properties[key] = zodToJsonSchema(unwrapOptional(childSchema));
      if (!(childSchema instanceof z.ZodOptional) && !(childSchema instanceof z.ZodDefault)) required.push(key);
    }
    return { type: "object", properties, required, additionalProperties: false };
  }
  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodArray) return { type: "array", items: zodToJsonSchema(schema.element) };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: [...schema.options] };
  if (schema instanceof z.ZodLiteral) {
    const value = schema.value as JsonValue;
    return { const: value, type: typeof value };
  }
  if (schema instanceof z.ZodNullable) return zodToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodOptional) return zodToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return zodToJsonSchema(schema.removeDefault());
  return { type: "object", additionalProperties: true };
}

function unwrapOptional(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional) return schema.unwrap();
  if (schema instanceof z.ZodDefault) return schema.removeDefault();
  return schema;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return Number.isFinite(value as number) || valueType !== "number";
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (valueType !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

const _fallbackHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>__REALTIME_VOICE_TITLE__</title>
  </head>
  <body style="background:#09090b;color:#e4e4e7;font-family:system-ui,sans-serif">
    <main style="max-width:680px;margin:40px auto;padding:16px">
      <h1>__REALTIME_VOICE_TITLE__</h1>
      <p>Voice Agent UI asset was not found.</p>
    </main>
  </body>
</html>`;
