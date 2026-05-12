import uiHtml from "./ui/index.html";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";

import { StrictEventEmitter } from "./emitter.js";
import { RealtimeVoiceServerError, toRealtimeError } from "./errors.js";
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
  type RealtimeVoiceServerConfig,
  type RealtimeVoiceServerController,
  type RealtimeVoiceServerErrorCode,
  type RealtimeVoiceServerEvents,
  type RealtimeVoiceToolDefinition,
  type RealtimeVoiceToolExecute,
  type RealtimeVoiceToolMap,
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
  type UpdateRealtimeInput,
} from "./types.js";

type MutableConversation<TTools extends RealtimeVoiceToolMap> = {
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
  | { type: "webrtc.session.requested" }
  | { type: "webrtc.session.connected" }
  | { type: "webrtc.session.failed"; data?: { error?: { code?: unknown; message?: unknown } } }
  | { type: "realtime.event"; data?: { event?: unknown } }
  | { type: "browser.debug"; data?: { label?: unknown; info?: unknown; t?: unknown } };


type RealtimeConnection = {
  send(event: Record<string, unknown>): void;
  close(props?: { code: number; reason: string }): void;
  on(eventName: string, handler: (event: unknown) => void): unknown;
  socket?: { readyState: number };
};

// OpenAI Realtime "ephemeral client secret" mint endpoint.
// TODO(verify-against-openai-docs): Confirm exact response shape — current
// implementation reads `value` (string) and `expires_at` (unix seconds) from
// the top-level response. Some docs nest these under `client_secret`.
const OPENAI_CLIENT_SECRET_URL = "https://api.openai.com/v1/realtime/client_secrets";
const WEBRTC_CONNECT_TIMEOUT_MS = 30_000;

interface OpenAIClientSecretResponse {
  value?: string;
  expires_at?: number;
  client_secret?: { value?: string; expires_at?: number };
}

type RealtimeConnectionEmitter = {
  emit(eventName: string, payload: unknown): void;
  emitClose(): void;
};

type SocketRef = { readyState: number };

class BrowserProxiedRealtimeConnection implements RealtimeConnection {
  readonly socket: SocketRef;
  readonly #handlers = new Map<string, Array<(event: unknown) => void>>();
  readonly #sendToBrowser: (envelope: { type: string; data?: unknown }) => void;
  #closed = false;

  constructor(input: { sendToBrowser: (envelope: { type: string; data?: unknown }) => void; socket: SocketRef }) {
    this.#sendToBrowser = input.sendToBrowser;
    this.socket = input.socket;
  }

  send(event: Record<string, unknown>): void {
    if (this.#closed) return;
    this.#sendToBrowser({ type: "realtime.send", data: { event } });
  }

  close(props?: { code: number; reason: string }): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#sendToBrowser({
      type: "webrtc.session.close",
      data: { code: props?.code ?? 1000, reason: props?.reason ?? "closed" },
    });
  }

  on(eventName: string, handler: (event: unknown) => void): () => void {
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
      emit: (eventName: string, payload: unknown) => {
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

type InternalConfig<TTools extends RealtimeVoiceToolMap> = RealtimeVoiceServerConfig<TTools> & {
  __realtimeFactory?: (input: { apiKey: string; model: string }) => RealtimeConnection | Promise<RealtimeConnection>;
};

export function createRealtimeVoiceServer<const TTools extends RealtimeVoiceToolMap>(
  config: RealtimeVoiceServerConfig<TTools>,
): RealtimeVoiceServerController<TTools> {
  return new RealtimeVoiceServerControllerImpl(config as InternalConfig<TTools>);
}

class RealtimeVoiceServerControllerImpl<const TTools extends RealtimeVoiceToolMap>
  extends StrictEventEmitter<RealtimeVoiceServerEvents<TTools>>
  implements RealtimeVoiceServerController<TTools>
{
  readonly #config: NormalizedConfig<TTools>;
  readonly #realtimeFactory?: InternalConfig<TTools>["__realtimeFactory"];
  readonly #tools: { [K in keyof TTools]: TTools[K] };
  readonly #toolDescriptions = new Map<string, string>();
  readonly #toolExecutors = new Map<
    string,
    RealtimeVoiceToolDefinition<TTools[keyof TTools]["parameters"]>["execute"]
  >();
  readonly #previousConversations: Record<string, ConversationSnapshot<TTools>> = {};
  readonly #browserClient: BrowserClientState = { connected: false };

  #status: ControllerStatus = { server: "stopped", browserClient: "none", conversation: "none" };
  #conversation?: MutableConversation<TTools>;
  #server?: Server;
  #wss?: WebSocketServer;
  #browserSocket?: WebSocket;
  #realtime?: RealtimeConnection;
  #browserProxiedRealtime?: BrowserProxiedRealtimeConnection;
  #browserProxiedEmitter?: RealtimeConnectionEmitter;
  #pendingWebrtcSession?: {
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  };
  #lifecycleLocked = false;
  #autoResponseEnabled = true;
  #responseInFlight = false;
  #instructions: string;
  readonly #activeToolAbortControllers = new Map<string, AbortController>();
  readonly #streamingAssistantText = new Map<string, string>();

  constructor(config: InternalConfig<TTools>) {
    super();
    validateConfig(config);
    this.#config = normalizeConfig(config);
    this.#realtimeFactory = config.__realtimeFactory;
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
      throw this.#fail("SERVER_START_FAILED", "Failed to start the Realtime voice server.", undefined, cause);
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
      throw this.#fail("SERVER_STOP_FAILED", "Failed to stop the Realtime voice server cleanly.", undefined, cause);
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
    if (this.#autoResponseEnabled === enabled) return;
    this.#autoResponseEnabled = enabled;
    if (!this.#realtime) return;
    try {
      this.#realtime.send({
        type: "session.update",
        session: {
          type: "realtime",
          audio: {
            input: {
              turn_detection: {
                type: "semantic_vad",
                eagerness: "medium",
                create_response: enabled,
                interrupt_response: true,
              },
            },
          },
        },
      });
    } catch (cause) {
      throw this.#fail(
        "REALTIME_UPDATE_FAILED",
        "Realtime session rejected the auto-response update.",
        undefined,
        cause,
      );
    }
  }

  async endConversation(options?: { shutdownTimeoutMs?: number }): Promise<void> {
    this.#assertLifecycleUnlocked();
    try {
      await this.#endConversationLocked(options?.shutdownTimeoutMs);
    } catch (error) {
      if (error instanceof RealtimeVoiceServerError) {
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
        cause instanceof RealtimeVoiceServerError
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

  async updateRealtime(input: UpdateRealtimeInput<TTools>): Promise<void> {
    if (this.#status.server !== "active") {
      throw this.#fail("SERVER_NOT_STARTED", "Realtime updates require an active server.", {
        server: this.#status.server,
      });
    }
    const toolEntries = Object.entries(input.tools ?? {});
    if (input.instructions === undefined && toolEntries.length === 0) {
      throw this.#fail("REALTIME_UPDATE_FAILED", "Realtime update input cannot be empty.");
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
      throw this.#fail("REALTIME_UPDATE_FAILED", "Realtime session rejected the update.", undefined, cause);
    }
    this.emit("realtime.updated", {
      instructionsUpdated: input.instructions !== undefined,
      toolsUpdated: updatedTools,
      createdAt: new Date(),
    });
  }

  async #createRealtimeConnection(): Promise<RealtimeConnection> {
    try {
      if (this.#realtimeFactory) {
        // Test factory is responsible for returning an already-ready connection.
        return await this.#realtimeFactory({ apiKey: this.#config.apiKey, model: this.#config.realtime.model });
      }
      // Browser-proxied flow: the browser owns the WebRTC peer connection
      // with OpenAI. The daemon (a) mints an ephemeral client secret on
      // request, (b) routes Realtime API events to/from the browser over
      // the existing WebSocket. Construction blocks until the browser
      // signals webrtc.session.connected.
      const socketRef: SocketRef = { readyState: 0 /* CONNECTING */ };
      const connection = new BrowserProxiedRealtimeConnection({
        sendToBrowser: (envelope) => this.#broadcast(envelope),
        socket: socketRef,
      });
      this.#browserProxiedRealtime = connection;
      this.#browserProxiedEmitter = connection.controller();

      const connected = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.#pendingWebrtcSession = undefined;
          reject(new Error("Timed out waiting for browser webrtc.session.connected."));
        }, WEBRTC_CONNECT_TIMEOUT_MS);
        this.#pendingWebrtcSession = { resolve, reject, timeout };
      });

      // Tell the browser to begin its WebRTC setup. Browser will respond with
      // webrtc.session.requested → daemon mints ephemeral key → browser
      // performs SDP exchange directly with OpenAI → browser signals
      // webrtc.session.connected (or webrtc.session.failed).
      this.#broadcast({ type: "webrtc.session.start" });

      try {
        await connected;
      } catch (cause) {
        this.#browserProxiedRealtime = undefined;
        this.#browserProxiedEmitter = undefined;
        throw cause;
      }
      socketRef.readyState = 1 /* OPEN */;
      return connection;
    } catch (cause) {
      const error = this.#fail("CONVERSATION_START_FAILED", "Failed to connect to the Realtime API.", undefined, cause);
      this.emit("conversation.error", { conversationId: this.#conversation?.id, error, createdAt: new Date() });
      throw error;
    }
  }

  async #mintEphemeralClientSecret(): Promise<{ clientSecret: string; model: string; expiresAt: number }> {
    const model = this.#config.realtime.model;
    const response = await fetch(OPENAI_CLIENT_SECRET_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.#config.apiKey}`,
      },
      body: JSON.stringify({ session: { type: "realtime", model } }),
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(`OpenAI client_secrets endpoint returned ${response.status}: ${bodyText}`);
    }
    const json = (await response.json()) as OpenAIClientSecretResponse;
    // TODO(verify-against-openai-docs): The exact response shape of
    // POST /v1/realtime/client_secrets should be confirmed. Some references
    // show top-level { value, expires_at }; others nest under client_secret.
    // We accept both for resilience.
    const value = json.value ?? json.client_secret?.value;
    const expiresAt = json.expires_at ?? json.client_secret?.expires_at;
    if (typeof value !== "string" || typeof expiresAt !== "number") {
      throw new Error("OpenAI client_secrets response did not include value/expires_at.");
    }
    return { clientSecret: value, model, expiresAt };
  }

  #wireRealtimeConnection(realtime: RealtimeConnection): void {
    realtime.on("error", (error) => {
      // Benign: a `response.cancel` arrived while no response was in flight.
      // We send cancel proactively on pause; if nothing was speaking, OpenAI
      // returns this error. Swallow it instead of surfacing as conversation.error.
      const realtimeCode = (error as { error?: { code?: string } } | undefined)?.error?.code;
      if (realtimeCode === "response_cancel_not_active") return;

      const wrapped = toRealtimeError(
        "REALTIME_SESSION_ERROR",
        "Realtime session reported an error.",
        undefined,
        error,
      );
      this.#log("error", wrapped);
      this.emit("conversation.error", {
        conversationId: this.#conversation?.id,
        error: wrapped,
        createdAt: new Date(),
      });
    });
    realtime.on("conversation.item.input_audio_transcription.delta", (event) =>
      this.#handleUserTranscriptDelta(event as { item_id: string; delta: string }),
    );
    realtime.on("conversation.item.input_audio_transcription.completed", (event) =>
      this.#handleUserTranscriptDone(event as { item_id: string; transcript: string }),
    );
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
    realtime.on("response.output_audio_transcript.delta", (event) =>
      this.#handleAssistantTranscriptDelta(event as { item_id: string; delta: string }),
    );
    realtime.on("response.output_audio_transcript.done", (event) =>
      this.#handleAssistantTranscriptDone(event as { item_id: string; transcript: string }),
    );
    realtime.on("response.output_text.delta", (event) =>
      this.#handleAssistantTranscriptDelta(event as { item_id: string; delta: string }),
    );
    realtime.on("response.output_text.done", (event) =>
      this.#handleAssistantTranscriptDone({
        item_id: (event as { item_id: string }).item_id,
        transcript: (event as { text: string }).text,
      }),
    );
    realtime.on("response.output_audio.delta", (event) =>
      this.#broadcast({ type: "audio.output.delta", data: { audio: (event as { delta: string }).delta } }),
    );
    realtime.on("response.function_call_arguments.done", (event) => {
      void this.#handleToolCall(event as { item_id: string; call_id: string; name: string; arguments: string });
    });
  }

  #sendSessionUpdate(): void {
    if (!this.#realtime) return;
    this.#realtime.send({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: this.#instructions,
        model: this.#config.realtime.model,
        output_modalities: ["audio"],
        reasoning: { effort: "low" },
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            transcription: { model: "gpt-realtime-whisper" },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "medium",
              create_response: this.#autoResponseEnabled,
              interrupt_response: this.#autoResponseEnabled,
            },
          },
          output: {
            format: { type: "audio/pcm", rate: 24000 },
            voice: this.#config.realtime.voice,
            speed: 1.0,
          },
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
    this.#realtime?.close({ code: 1000, reason });
    this.#realtime = undefined;
    this.#browserProxiedRealtime = undefined;
    this.#browserProxiedEmitter = undefined;
    this.#failPendingWebrtcSession(new Error(`Realtime connection closed: ${reason}`));
  }

  #failPendingWebrtcSession(cause: Error): void {
    const pending = this.#pendingWebrtcSession;
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.#pendingWebrtcSession = undefined;
    pending.reject(cause);
  }

  #handleUserTranscriptDelta(event: { item_id: string; delta: string }): void {
    const conversation = this.#conversation;
    if (!conversation) return;
    const fullTextSoFar = (this.#streamingAssistantText.get(event.item_id) ?? "") + event.delta;
    this.#streamingAssistantText.set(event.item_id, fullTextSoFar);
    this.emit("transcript.delta", {
      conversationId: conversation.id,
      itemId: event.item_id,
      role: "user",
      source: "microphone",
      delta: event.delta,
      fullTextSoFar,
      createdAt: new Date(),
    });
    this.#broadcast({
      type: "transcript.delta",
      data: {
        itemId: event.item_id,
        role: "user",
        source: "microphone",
        delta: event.delta,
        fullTextSoFar,
      },
    });
  }

  #handleUserTranscriptDone(event: { item_id: string; transcript: string }): void {
    const conversation = this.#conversation;
    if (!conversation) return;
    const accumulated = this.#streamingAssistantText.get(event.item_id);
    this.#streamingAssistantText.delete(event.item_id);
    const text = normalizeText(event.transcript) || (accumulated ? normalizeText(accumulated) : "");
    if (!text && accumulated === undefined) return;
    this.#appendTranscriptItemWithId(conversation, event.item_id, "user", "microphone", text);
    this.#broadcastState();
  }

  #handleAssistantTranscriptDelta(event: { item_id: string; delta: string }): void {
    const conversation = this.#conversation;
    if (!conversation) return;
    const fullTextSoFar = (this.#streamingAssistantText.get(event.item_id) ?? "") + event.delta;
    this.#streamingAssistantText.set(event.item_id, fullTextSoFar);
    this.emit("transcript.delta", {
      conversationId: conversation.id,
      itemId: event.item_id,
      role: "assistant",
      source: "assistantAudio",
      delta: event.delta,
      fullTextSoFar,
      createdAt: new Date(),
    });
    this.#broadcast({
      type: "transcript.delta",
      data: {
        itemId: event.item_id,
        role: "assistant",
        source: "assistantAudio",
        delta: event.delta,
        fullTextSoFar,
      },
    });
  }

  #handleAssistantTranscriptDone(event: { item_id: string; transcript: string }): void {
    const conversation = this.#conversation;
    if (!conversation) return;
    const accumulated = this.#streamingAssistantText.get(event.item_id);
    this.#streamingAssistantText.delete(event.item_id);
    const text = normalizeText(event.transcript) || (accumulated ? normalizeText(accumulated) : "");
    if (!text && accumulated === undefined) return;
    this.#appendTranscriptItemWithId(conversation, event.item_id, "assistant", "assistantAudio", text);
    this.#broadcastState();
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

  async #handleToolCall(event: { item_id: string; call_id: string; name: string; arguments: string }): Promise<void> {
    const conversation = this.#conversation;
    if (!conversation) return;
    const toolName = event.name;
    const tool = this.#tools[toolName as keyof TTools];
    const failedAt = new Date();
    if (!tool) {
      const error = toRealtimeError("TOOL_NOT_FOUND", "Realtime requested an unknown tool.", { toolName });
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
      const error = toRealtimeError(
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
      const error = toRealtimeError("TOOL_ARGUMENT_VALIDATION_FAILED", "Tool arguments failed schema validation.", {
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
    this.emit("tool.call.started", {
      conversationId: conversation.id,
      toolCallId: event.item_id,
      callId: event.call_id,
      toolName: typedToolName,
      arguments: typedArguments,
      startedAt,
    });
    this.#broadcastState();

    const executor = this.#toolExecutors.get(toolName) as RealtimeVoiceToolExecute<typeof tool.parameters> | undefined;
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
        const error = toRealtimeError("TOOL_RESULT_SERIALIZATION_FAILED", "Tool result must be JSON-serializable.", {
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
      this.#sendToolResult(event.call_id, serialized);
    } catch (cause) {
      if (abortController.signal.aborted) {
        this.#markToolInterrupted(conversation, event.item_id, event.call_id, toolName, "aborted");
        return;
      }
      const error = toRealtimeError(
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
      this.#activeToolAbortControllers.delete(event.call_id);
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
    // Only trigger a follow-up model response when the conversation is
    // active AND auto-response is enabled. The `wait_for_context` tool
    // disables auto-response so the model stays silent until fresh
    // context/topics arrive.
    if (this.#status.conversation === "active" && this.#autoResponseEnabled) {
      this.#realtime?.send({ type: "response.create" });
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
    const error = toRealtimeError("TOOL_CALL_INTERRUPTED", "Tool call was interrupted.", { callId, reason });
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
    invalidStateCode: RealtimeVoiceServerErrorCode,
  ): TranscriptItem {
    let conversation: MutableConversation<TTools>;
    try {
      conversation = this.#requireInjectableConversation(invalidStateCode);
    } catch (error) {
      if (error instanceof RealtimeVoiceServerError) {
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
        "Realtime session rejected the response request.",
        undefined,
        cause,
      );
    }
  }

  #requireConversation(code: RealtimeVoiceServerErrorCode): MutableConversation<TTools> {
    if (!this.#conversation) {
      throw this.#fail(code, "There is no current conversation.");
    }
    return this.#conversation;
  }

  #requireInjectableConversation(code: RealtimeVoiceServerErrorCode): MutableConversation<TTools> {
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
      const error = toRealtimeError("TOOL_CALL_INTERRUPTED", "Tool call was interrupted by conversation cleanup.", {
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
      const error = toRealtimeError(
        "BROWSER_CLIENT_ALREADY_CONNECTED",
        "Another browser client is already connected.",
        {
          activeClientId: this.#browserClient.clientId ?? "",
          attemptedClientId,
        },
      );
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
          error instanceof RealtimeVoiceServerError
            ? error
            : toRealtimeError("INTERNAL_INVARIANT_VIOLATION", "Browser message handling failed.", undefined, error);
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
      case "webrtc.session.requested": {
        try {
          const token = await this.#mintEphemeralClientSecret();
          this.#broadcast({
            type: "webrtc.session.token",
            data: {
              clientSecret: token.clientSecret,
              model: token.model,
              expiresAt: token.expiresAt,
            },
          });
        } catch (cause) {
          const error = this.#fail(
            "CONVERSATION_START_FAILED",
            "Failed to mint OpenAI ephemeral client secret.",
            undefined,
            cause,
          );
          this.#failPendingWebrtcSession(error);
          this.emit("conversation.error", {
            conversationId: this.#conversation?.id,
            error,
            createdAt: new Date(),
          });
        }
        break;
      }
      case "webrtc.session.connected": {
        const pending = this.#pendingWebrtcSession;
        if (pending) {
          clearTimeout(pending.timeout);
          this.#pendingWebrtcSession = undefined;
          pending.resolve();
        }
        break;
      }
      case "webrtc.session.failed": {
        const code = String(message.data?.error?.code ?? "WEBRTC_SESSION_FAILED");
        const text = String(message.data?.error?.message ?? "Browser reported a WebRTC session failure.");
        const error = toRealtimeError("CONVERSATION_START_FAILED", text, { code });
        this.#failPendingWebrtcSession(error);
        // If the session failed mid-conversation (after connect), mark a
        // realtime error so the controller's wired error handler runs.
        this.#browserProxiedEmitter?.emit("error", error);
        break;
      }
      case "realtime.event": {
        const event = message.data?.event;
        if (event && typeof event === "object") {
          const eventRecord = event as Record<string, unknown>;
          const eventType = typeof eventRecord.type === "string" ? eventRecord.type : undefined;
          if (eventType) this.#browserProxiedEmitter?.emit(eventType, event);
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
        const error = toRealtimeError("MICROPHONE_DEVICE_ERROR", "Browser reported a microphone error.", {
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
          error instanceof RealtimeVoiceServerError
            ? error
            : toRealtimeError("CONVERSATION_START_FAILED", "connectOnPageLoad failed.", undefined, error);
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

  #fail(
    code: RealtimeVoiceServerErrorCode,
    message: string,
    details?: JsonValue,
    cause?: unknown,
  ): RealtimeVoiceServerError {
    const error = toRealtimeError(code, message, details, cause);
    this.#log("error", error);
    return error;
  }

  #log(level: "debug" | "info" | "warn" | "error", error: RealtimeVoiceServerError): void {
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

interface NormalizedConfig<TTools extends RealtimeVoiceToolMap> extends RealtimeVoiceServerConfig<TTools> {
  realtime: Required<RealtimeVoiceServerConfig<TTools>["realtime"]>;
  browserSession: Required<NonNullable<RealtimeVoiceServerConfig<TTools>["browserSession"]>>;
  ui: Required<NonNullable<RealtimeVoiceServerConfig<TTools>["ui"]>>;
}

function normalizeConfig<TTools extends RealtimeVoiceToolMap>(
  config: RealtimeVoiceServerConfig<TTools>,
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

function validateConfig<TTools extends RealtimeVoiceToolMap>(config: RealtimeVoiceServerConfig<TTools>): void {
  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    throw toRealtimeError("CONFIG_INVALID", "port must be an integer between 1 and 65535.", { port: config.port });
  }
  if (!config.apiKey) {
    throw toRealtimeError("CONFIG_INVALID", "apiKey is required.");
  }
  if (!normalizeText(config.realtime?.instructions)) {
    throw toRealtimeError("CONFIG_INVALID", "realtime.instructions is required.");
  }
  for (const [name, tool] of Object.entries(config.tools)) {
    if (!name || !tool.description || !tool.parameters || typeof tool.execute !== "function") {
      throw toRealtimeError("CONFIG_INVALID", "Each tool requires a name, description, parameters, and execute.", {
        name,
      });
    }
  }
}

function snapshotConversation<TTools extends RealtimeVoiceToolMap>(
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

function serializeError(error: RealtimeVoiceServerError): JsonValue {
  return { name: error.name, code: error.code, message: error.message, details: error.details ?? null };
}

function toolsToRealtimeTools<TTools extends RealtimeVoiceToolMap>(
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

const fallbackHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>__REALTIME_VOICE_TITLE__</title>
  </head>
  <body style="background:#09090b;color:#e4e4e7;font-family:system-ui,sans-serif">
    <main style="max-width:680px;margin:40px auto;padding:16px">
      <h1>__REALTIME_VOICE_TITLE__</h1>
      <p>Realtime Voice Console UI asset was not found.</p>
    </main>
  </body>
</html>`;
