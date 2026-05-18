#!/usr/bin/env node
/**
 * Daemon entry point for voice.
 * Spawned as a detached child by `voice start`. Communicates config via env vars.
 */

import { appendFileSync, closeSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

// Close any FDs > 19 inherited from the parent shell (e.g. tee pipes from
// bash process substitution at FDs 62/63). Node's own internals occupy low
// FDs (event loop, epoll, internal pipes — typically <= 19), so closing
// higher FDs releases the parent's tee pipes without disturbing Node.
try {
  for (const name of readdirSync("/proc/self/fd")) {
    const fd = Number(name);
    if (Number.isFinite(fd) && fd > 19) {
      try {
        closeSync(fd);
      } catch (err: unknown) {
        void err; // FD may already be closed by Node — non-fatal
      }
    }
  }
} catch (err: unknown) {
  void err; // /proc unavailable (non-Linux); skip
}

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { createVoiceAgentServer } from "../index.js";
import type { JsonValue, VoiceAgentServerEvents, VoiceAgentToolMap } from "../types.js";

// ---------------------------------------------------------------------------
// Config from env
// ---------------------------------------------------------------------------

const port = parseInt(process.env.VOICE_PORT ?? "3000", 10);
const apiKey = process.env.VOICE_API_KEY ?? "";
const instructions = process.env.VOICE_INSTRUCTIONS ?? "";
const title = process.env.VOICE_TITLE;
const model = process.env.VOICE_MODEL;
const voice = process.env.VOICE_VOICE;

const controlPort = port + 1;
const tmpDir = `/tmp/voice-${port}`;
const eventsFile = `${tmpDir}/events.jsonl`;
const cursorFile = `${tmpDir}/cursor`;
const pidFile = `${tmpDir}/daemon.pid`;

// ---------------------------------------------------------------------------
// JSONL event log
// ---------------------------------------------------------------------------

let seq = 0;

function appendEvent(event: string, data: Record<string, unknown>): void {
  seq += 1;
  const line = `${JSON.stringify({ seq, event, timestamp: new Date().toISOString(), data: serializeData(data) })}\n`;
  appendFileSync(eventsFile, line, "utf8");
}

// Recursively serialize Date values to ISO strings
function serializeData(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeData) as JsonValue[];
  if (typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeData(v);
    }
    return out;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

// ---------------------------------------------------------------------------
// Staged system messages
// ---------------------------------------------------------------------------

interface StagedSystemMessage {
  text: string;
  triggerResponse?: boolean;
}

const stagedSystemMessages: StagedSystemMessage[] = [];

// Latest <context> / <topics> segments. These are folded into the agent's
// live instructions via `controller.updateVoiceSession({ instructions })`
// rather than injected as conversation history. Each new `voice context` /
// `voice topics` invocation REPLACES the previous block (latest-wins).
let latestContext: string | null = null;
let latestTopics: string | null = null;

// Set when a /instructions/segment arrives while a response is in flight.
// Drained on `response.completed` alongside `queuedInjections`.
let queuedInstructionsUpdate = false;

function rebuildInstructions(): string {
  let result = instructions;
  if (latestContext !== null) result += `\n\n<context>${latestContext}</context>`;
  if (latestTopics !== null) result += `\n\n<topics>${latestTopics}</topics>`;
  return result;
}

function flushStagedInstructions(): void {
  if (latestContext === null && latestTopics === null) return;
  controller
    .updateVoiceSession({ instructions: rebuildInstructions() })
    .then(() => {
      scheduleResponse();
    })
    .catch((err: unknown) => {
      appendEvent("conversation.error", { error: String(err) });
    });
}

// ---------------------------------------------------------------------------
// Client registry & lifecycle
// ---------------------------------------------------------------------------

interface RegisteredClient {
  clientId: string;
  pid: number;
}

const registeredClients = new Map<string, RegisteredClient>();
let clientIdCounter = 0;
let firstRegisterDeadline: ReturnType<typeof setTimeout> | null = null;
let clientGraceDeadline: ReturnType<typeof setTimeout> | null = null;

function startFirstRegisterTimer(): void {
  firstRegisterDeadline = setTimeout(() => {
    if (registeredClients.size === 0) {
      shutdown();
    }
  }, 30_000);
}

function startClientGraceTimer(): void {
  if (clientGraceDeadline !== null) return;
  clientGraceDeadline = setTimeout(() => {
    if (registeredClients.size === 0) {
      shutdown();
    }
  }, 120_000);
}

function cancelClientGraceTimer(): void {
  if (clientGraceDeadline !== null) {
    clearTimeout(clientGraceDeadline);
    clientGraceDeadline = null;
  }
}

function checkClients(): void {
  for (const [clientId, client] of registeredClients) {
    try {
      process.kill(client.pid, 0);
    } catch {
      registeredClients.delete(clientId);
    }
  }
  if (registeredClients.size === 0 && firstRegisterDeadline === null) {
    startClientGraceTimer();
  }
}

function shutdown(): void {
  controller.stop().finally(() => {
    cleanup();
    process.exit(0);
  });
}

function cleanup(): void {
  try {
    rmSync(pidFile);
  } catch (_err: unknown) {
    void _err; // pid file may not exist — not fatal
  }
}

// ---------------------------------------------------------------------------
// Build controller
// ---------------------------------------------------------------------------

const realtimeConfig = {
  instructions,
  ...(model !== undefined ? { model } : {}),
  ...(voice !== undefined ? { voice } : {}),
};

const uiConfig = title !== undefined ? { title } : {};

let waitingForContext = false;

const waitForContextTool = {
  description:
    "Signal that the user has asked about something not covered by current <context> or <topics>. Call this instead of guessing or saying you don't have enough information.",
  parameters: z.object({}),
  execute: async (): Promise<JsonValue> => {
    appendEvent("wait_for_context", {});
    waitingForContext = true;
    controller.broadcastToBrowser({ type: "wait_for_context.start" });
    if (controller.status.conversation === "active") {
      try {
        await controller.setAutoResponse(false);
      } catch (err: unknown) {
        appendEvent("conversation.error", { error: String(err) });
      }
    }
    return { ok: true };
  },
};

const controller = createVoiceAgentServer({
  port,
  apiKey,
  realtime: realtimeConfig,
  tools: { wait_for_context: waitForContextTool },
  ui: uiConfig,
  browserSession: {
    connectOnPageLoad: true,
  },
});

// ---------------------------------------------------------------------------
// Wire controller events to JSONL
// ---------------------------------------------------------------------------

type KnownEventKey = keyof VoiceAgentServerEvents<VoiceAgentToolMap>;

const knownEvents: KnownEventKey[] = [
  "server.started",
  "server.stopped",
  "browser.client.connected",
  "browser.client.disconnected",
  "browser.client.rejected",
  "browser.audio.error",
  "browser.audio.deviceChange",
  "conversation.started",
  "conversation.paused",
  "conversation.resumed",
  "conversation.ended",
  "conversation.reset",
  "conversation.error",
  "response.completed",
  "voice.session.updated",
  "transcript.delta",
  "transcript.item",
  "tool.call.started",
  "tool.call.completed",
  "tool.call.failed",
  "tool.call.interrupted",
  "log",
];

for (const eventName of knownEvents) {
  controller.on(eventName, (data) => {
    appendEvent(eventName, data as unknown as Record<string, unknown>);
  });
}

process.on("uncaughtException", (err: unknown) => {
  process.stderr.write(`uncaughtException: ${String(err)}\n`);
});

process.on("unhandledRejection", (reason: unknown) => {
  process.stderr.write(`unhandledRejection: ${String(reason)}\n`);
});

// Coalesce response.create calls — when back-to-back system messages are
// injected (e.g. <context> then <topics>), debounce so the model produces a
// single response that incorporates all newly-arrived items.
const RESPONSE_DEBOUNCE_MS = 250;
// Reset-driven opening uses a wider coalescing window than normal
// RESPONSE_DEBOUNCE_MS: each `voice` CLI command is a fresh Node.js
// cold-spawn (~100–400ms startup), so the gap between the reset HTTP
// response and the next `voice context`/`voice topics` HTTP call is
// dominated by Node cold-start, not loopback RTT. 600ms covers worst-case
// startup + shell overhead while remaining imperceptible to the user.
const RESET_RESPONSE_DELAY_MS = 600;
let pendingResponseTimer: NodeJS.Timeout | null = null;

// Reset-opening coalescing state. `resetOpeningPending` is true from the moment
// the `conversation.reset` handler arms a proactive opening until that opening
// is either fired by the fallback timer or *superseded* by a post-reset
// context/topics segment. It makes the single-opening guarantee
// order-independent: the question "did a segment join this reset episode?" is
// answered by inspecting this flag, not by racing a fixed timer window. A
// post-reset segment that calls `scheduleResponse()` while the flag is set
// cancels the reset fallback and drives the one opening from the *post-reset*
// instructions (latest-wins), regardless of whether it arrives before or after
// the fallback would have fired.
let resetOpeningPending = false;
let resetOpeningTimer: NodeJS.Timeout | null = null;

// Post-fallback reset-episode memory. The `resetOpeningPending` flag only
// survives until the fallback timer fires its opening (it then sets the flag
// false and calls requestResponse). A post-reset `voice context`/`voice topics`
// segment that arrives AFTER the fallback fired would otherwise find
// `resetOpeningPending` already false and drive a SECOND opening — directly via
// scheduleResponse(), or via queuedInstructionsUpdate draining on
// response.completed. `resetOpeningInFlight` extends the reset episode across
// the fallback opening: it is set the moment the fallback fires its opening and
// cleared when that opening's response.completed arrives. While set, a
// post-reset segment refreshes the realtime session instructions (latest-wins)
// WITHOUT a second requestResponse(). `resetEpisodeRefreshPending` carries a
// deferred refresh that arrived while the fallback opening was still streaming;
// it is drained — instructions-only, no response — on response.completed.
let resetOpeningInFlight = false;
let resetEpisodeRefreshPending = false;

// Watchdog bounding the lifetime of `resetOpeningInFlight`. The fallback
// opening goes out over a BrowserProxiedVoiceConnection whose send() is
// fire-and-forget: requestResponse() resolves even if the upstream socket
// stalls/dies AFTER the fire-time liveness check, so the opening's
// response.completed may never arrive and none of the normal clear sites
// (response.completed / reset / ended / synchronous .catch) ever run. Without
// a bound, resetOpeningInFlight stays true forever and every later
// scheduleResponse() is downgraded to instructions-only — a session-long
// silent mute. This timer degrades that to a single observable missed
// opening: if the opening's response.completed has not arrived within the
// bound, the episode is force-closed and conversation.opening.skipped is
// emitted so subsequent context/topics can again drive model responses.
let resetOpeningWatchdog: NodeJS.Timeout | null = null;

// 30s. RESET_RESPONSE_DELAY_MS (600ms) is the time to *fire* the opening; a
// normal realtime opening response then streams to completion in at most a
// few seconds. 30s is comfortably longer than any healthy opening (so the
// watchdog can never preempt a normal or coalesced opening — the round-2
// no-double-fire guarantee holds) while still bounding a stalled socket to a
// brief, recoverable mute rather than a permanent one.
const RESET_OPENING_WATCHDOG_MS = 30_000;

function clearResetOpening(): void {
  resetOpeningPending = false;
  if (resetOpeningTimer) {
    clearTimeout(resetOpeningTimer);
    resetOpeningTimer = null;
  }
}

function clearResetEpisode(): void {
  resetOpeningInFlight = false;
  resetEpisodeRefreshPending = false;
  // A segment that arrived while the reset opening streamed set
  // queuedInstructionsUpdate (and resetEpisodeRefreshPending) so it would
  // coalesce on the opening's response.completed. If the episode is torn down
  // mid-flight (error/pause/ended/watchdog) BEFORE that response.completed, a
  // surviving queuedInstructionsUpdate would later drain through the legacy
  // response.completed `if (queuedInstructionsUpdate)` branch into a SECOND
  // requestResponse() — the double-fire this card forbids. The segment's
  // instructions are already folded into rebuildInstructions() (latestContext/
  // latestTopics were set when it arrived); discarding the queued *response*
  // here keeps latest-wins context live without a duplicate opening.
  queuedInstructionsUpdate = false;
  if (resetOpeningWatchdog) {
    clearTimeout(resetOpeningWatchdog);
    resetOpeningWatchdog = null;
  }
  // A deferred fatal-error re-check timer (Finding 2) is scoped to the episode
  // it was armed in. Tearing the episode down (normal completion / reset /
  // ended / pause / watchdog) cancels it so it can never fire a stale skip
  // against a later episode or after the opening was in fact delivered.
  clearResetErrorSkipTimer();
}

// Refresh the realtime session instructions to the latest context/topics
// WITHOUT triggering a model response. Used when a post-reset segment is
// coalesced into the in-flight reset episode: the avatar must not open a
// second time, but the new context must still be live for subsequent turns.
function refreshInstructionsOnly(): void {
  controller
    .updateVoiceSession({ instructions: rebuildInstructions() })
    .then(() => {
      appendEvent("conversation.opening.coalesced", { reason: "post-reset segment folded into reset episode" });
    })
    .catch((err: unknown) => {
      appendEvent("conversation.error", { error: String(err) });
    });
}

// True when a post-reset segment's instructions update is owed but has not yet
// been pushed to the realtime session. The queued branch of
// /instructions/segment sets queuedInstructionsUpdate (and, inside a reset
// episode, resetEpisodeRefreshPending) but defers the actual session.update to
// response.completed. If the episode is torn down mid-flight before that
// completion, the push must still happen on the teardown path — otherwise the
// agent's explicitly-set post-reset context is stranded in latestContext/
// latestTopics and never reaches the session.
function postResetInstructionsOwed(): boolean {
  return queuedInstructionsUpdate || resetEpisodeRefreshPending;
}

// Push the queued post-reset instructions to the realtime session WITHOUT a
// response — separating "drop the duplicate spoken opening" (no second
// requestResponse) from "deliver the queued context" (the agent's steer must
// still take effect). Used on every mid-flight teardown path that discards a
// pending post-reset segment, and as defense-in-depth on conversation.resumed.
// Caller must capture `postResetInstructionsOwed()` BEFORE clearResetEpisode()
// zeroes the flags and pass the result here.
function flushOwedPostResetInstructions(owed: boolean): void {
  if (!owed) return;
  queuedInstructionsUpdate = false;
  controller
    .updateVoiceSession({ instructions: rebuildInstructions() })
    .then(() => {
      appendEvent("conversation.opening.coalesced", {
        reason: "queued post-reset context delivered on episode teardown (no opening)",
      });
    })
    .catch((err: unknown) => {
      appendEvent("conversation.error", { error: String(err) });
    });
}

// Reset-episode variant used by the conversation.resumed defense-in-depth
// path, which (unlike every teardown caller) does NOT run clearResetEpisode()
// first. It must therefore zero the reset-scoped owed flag itself
// (resetEpisodeRefreshPending) in addition to queuedInstructionsUpdate, so the
// resumed handler is idempotent / self-terminating (Finding 3): once flushed,
// resetEpisodeRefreshPending is false, postResetInstructionsOwed() is false,
// and a subsequent conversation.resumed is a strict no-op. Double-clearing on
// a later clearResetEpisode() is a harmless no-op.
function flushOwedResetEpisodeInstructions(): void {
  queuedInstructionsUpdate = false;
  resetEpisodeRefreshPending = false;
  controller
    .updateVoiceSession({ instructions: rebuildInstructions() })
    .then(() => {
      appendEvent("conversation.opening.coalesced", {
        reason: "owed reset-episode context delivered on resume (no opening)",
      });
    })
    .catch((err: unknown) => {
      appendEvent("conversation.error", { error: String(err) });
    });
}

function scheduleResponse(): void {
  // A real context/topics segment is driving a response. If a reset opening is
  // still pending, this segment supersedes it: cancel the reset fallback and
  // let this single debounced response be THE opening, grounded in the
  // post-reset instructions. Order-independent — true whether the segment
  // arrived before or after the reset fallback would have fired.
  if (resetOpeningPending) clearResetOpening();
  // The fallback reset opening already fired and is streaming (or just
  // completed in the same tick). A post-reset segment driving this
  // scheduleResponse() belongs to the SAME reset episode — it must NOT open a
  // second time. Refresh the session instructions (latest-wins) without a
  // response; the in-flight opening already speaks for this episode.
  if (resetOpeningInFlight) {
    refreshInstructionsOnly();
    return;
  }
  if (pendingResponseTimer) clearTimeout(pendingResponseTimer);
  pendingResponseTimer = setTimeout(() => {
    pendingResponseTimer = null;
    const status = controller.status.conversation;
    if (status !== "active" && status !== "paused") return;
    controller.requestResponse().catch((err: unknown) => {
      appendEvent("conversation.error", { error: String(err) });
    });
  }, RESPONSE_DEBOUNCE_MS);
}

function cancelPendingResponse(): void {
  if (pendingResponseTimer) {
    clearTimeout(pendingResponseTimer);
    pendingResponseTimer = null;
  }
}

controller.on("conversation.ended", cancelPendingResponse);
controller.on("conversation.reset", cancelPendingResponse);

// Injections that arrive while a model response is streaming are queued and
// flushed once the response completes — adding items mid-response can confuse
// the model and we want fresh context to influence the *next* turn cleanly.
const queuedInjections: string[] = [];

function clearQueuedInjections(): void {
  queuedInjections.length = 0;
}
controller.on("conversation.ended", clearQueuedInjections);
controller.on("conversation.reset", clearQueuedInjections);

controller.on("conversation.reset", () => {
  queuedInstructionsUpdate = false; // stale after reset; instructions re-sent by #sendSessionUpdate
  // Re-arm cleanly: cancelPendingResponse (registered earlier on this event)
  // has already cleared any stale pre-reset debounce timer; clear any prior
  // reset-opening state too so a rapid double reset cannot stack timers.
  clearResetOpening();
  // A new reset starts a new episode — discard any prior episode memory so a
  // rapid double reset cannot leave a stale in-flight flag suppressing the new
  // episode's opening.
  clearResetEpisode();
  if (latestContext === null && latestTopics === null) return; // bare reset stays silent (mirrors flushStagedInstructions)
  resetOpeningPending = true;
  resetOpeningTimer = setTimeout(() => {
    resetOpeningTimer = null;
    // Superseded by a post-reset segment (scheduleResponse cleared the flag)
    // or by a user pause: that path owns / suppressed the single opening.
    if (!resetOpeningPending) return;
    resetOpeningPending = false;
    const status = controller.status.conversation;
    // Finding 4: a user pause during the deferred window must suppress the
    // proactive opening — only fire into an active conversation.
    if (status !== "active") {
      appendEvent("conversation.opening.skipped", { reason: `conversation ${status}` });
      return;
    }
    // Finding 3: status can read "active" even after the post-reset socket
    // errored (the realtime error handler does not transition status). Gating
    // only on status would `send()` into a dead browser-proxied socket and
    // resolve silently — the avatar would be silent forever, masked as
    // success. Gate on actual connection liveness and surface a distinct
    // observable signal when the opening cannot be delivered.
    if (!controller.realtimeConnected) {
      appendEvent("conversation.opening.skipped", { reason: "realtime connection not live" });
      return;
    }
    appendEvent("conversation.opening.requested", {});
    // The episode now spans this opening. Until its response.completed, any
    // post-reset segment must coalesce (instructions-only) rather than open
    // again. Cleared in the response.completed handler below.
    resetOpeningInFlight = true;
    // Bound the in-flight lifetime: if the opening's response.completed never
    // arrives (fire-and-forget send into a stalled/dead browser-proxied
    // socket), force-close the episode so later scheduleResponse() calls are
    // no longer suppressed. Cleared on the normal completed/reset/ended paths
    // via clearResetEpisode().
    if (resetOpeningWatchdog) clearTimeout(resetOpeningWatchdog);
    resetOpeningWatchdog = setTimeout(() => {
      resetOpeningWatchdog = null;
      if (!resetOpeningInFlight) return;
      const owed = postResetInstructionsOwed();
      clearResetEpisode();
      appendEvent("conversation.opening.skipped", { reason: "reset opening watchdog timeout — no response.completed" });
      flushOwedPostResetInstructions(owed);
    }, RESET_OPENING_WATCHDOG_MS);
    controller.requestResponse().catch((err: unknown) => {
      const owed = postResetInstructionsOwed();
      clearResetEpisode();
      appendEvent("conversation.error", { error: String(err) });
      flushOwedPostResetInstructions(owed);
    });
  }, RESET_RESPONSE_DELAY_MS);
});

// Finding 4: a user-initiated pause (or any pause) during the deferred reset
// window suppresses the proactive opening — the user asked for silence.
controller.on("conversation.paused", () => {
  if (resetOpeningPending) {
    clearResetOpening();
    appendEvent("conversation.opening.skipped", { reason: "conversation paused during reset window" });
  }
  // A pause can land AFTER the fallback already fired its opening, with the
  // episode still in flight (resetOpeningPending is structurally false here —
  // the fallback consumed it before setting resetOpeningInFlight). Clearing
  // the full episode on pause guarantees resetOpeningInFlight can never be
  // left stuck true by a pause, so post-resume scheduleResponse() calls are
  // not permanently downgraded to instructions-only.
  if (resetOpeningInFlight) {
    // Capture whether a post-reset instructions push is owed BEFORE
    // clearResetEpisode() zeroes the flags. The duplicate spoken opening is
    // dropped (no requestResponse), but the agent's steer must still land.
    const owed = postResetInstructionsOwed();
    clearResetEpisode();
    appendEvent("conversation.opening.skipped", { reason: "conversation paused during in-flight reset opening" });
    flushOwedPostResetInstructions(owed);
  }
});

// Realtime failure during an in-flight reset opening. The controller emits
// conversation.error for MANY conditions — only the fatal socket-error path
// (controller.ts ~L869) marks the connection not-live; non-fatal injection
// failures (~L1526/~L1552) emit conversation.error WITHOUT clearing liveness
// and do NOT cancel the in-flight opening, which still streams to completion.
// Force-closing the episode on every error would tear down a healthy in-flight
// opening: a queued post-reset segment would then drain through the legacy
// response.completed path into a SECOND opening, and a spurious
// `opening.skipped` would be emitted for an opening that actually completed.
// So gate the fast force-close on actual connection death — the same liveness
// signal the fire-time gate and round-3 fix use. A truly dead connection
// (realtimeConnected === false) genuinely cannot deliver the opening: clear the
// episode fast and surface it. A non-fatal error that leaves the connection
// live is left to the normal paths — the opening's own response.completed
// coalesces it, and a genuine silent stall is still bounded by the 30s
// RESET_OPENING_WATCHDOG_MS watchdog. (clearResetEpisode() now also clears
// queuedInstructionsUpdate, so even the fatal-path teardown cannot leak a
// second opening.)
// The controller's realtime `error` handler sets #realtimeLive = false for
// EVERY non-`response_cancel_not_active` error (fatal OR transient) and does
// NOT cancel the in-flight response — a transient error's opening may still
// stream to completion. `#realtimeLive` is restored to true ONLY by a fresh
// connection/restart, never on a still-open socket after a transient error,
// so `controller.realtimeConnected` LATCHES false for the rest of the episode
// and cannot distinguish "opening still streaming" from "opening lost". A
// healthy opening streams for seconds (> the 750ms re-check), so gating the
// recovery on `realtimeConnected` would make a false `opening.skipped` (and a
// compound double-fire via mid-stream teardown) the DEFAULT outcome of any
// transient error during a normal-length opening (Finding 1).
//
// Instead, gate recovery on the controller's NON-latching progress signal
// `controller.responseInFlight`: it is set true on the opening's
// `response.created` and false on `response.done` (which also emits the
// `response.completed` that closes the episode). If the opening is still
// streaming when the re-check fires, `responseInFlight` is true → the opening
// is NOT lost; retract the pending skip and leave the episode intact so the
// opening's own `response.completed` coalesces any queued post-reset segment
// (no skip, no second requestResponse). Only when the opening genuinely never
// started/streamed (no `response.created`; `responseInFlight` false) AND the
// episode is still in flight do we emit a single truthful skip + teardown
// (round-3 stuck-mute fast-clear preserved; the 30s watchdog still backstops
// a silent stall that never raises an error).
const FATAL_ERROR_RECHECK_MS = 750;
let resetErrorSkipTimer: NodeJS.Timeout | null = null;

function clearResetErrorSkipTimer(): void {
  if (resetErrorSkipTimer) {
    clearTimeout(resetErrorSkipTimer);
    resetErrorSkipTimer = null;
  }
}

controller.on("conversation.error", () => {
  if (!resetOpeningInFlight || controller.realtimeConnected) return;
  if (resetErrorSkipTimer) return; // already armed for this episode
  resetErrorSkipTimer = setTimeout(() => {
    resetErrorSkipTimer = null;
    // response.completed already closed the episode (opening delivered) —
    // nothing to skip; it retracted this path.
    if (!resetOpeningInFlight) return;
    // The opening's response is still progressing (response.created arrived,
    // response.done has not) — a transient error did NOT lose the opening the
    // user is hearing. Retract the pending skip; the opening's own
    // response.completed will close the episode and coalesce any queued
    // post-reset segment (no skip, no second requestResponse). Also retract if
    // the connection genuinely recovered (a fresh restart relit liveness).
    if (controller.responseInFlight || controller.realtimeConnected) return;
    const owed = postResetInstructionsOwed();
    clearResetEpisode();
    appendEvent("conversation.opening.skipped", {
      reason: "realtime connection failed during in-flight reset opening",
    });
    flushOwedPostResetInstructions(owed);
  }, FATAL_ERROR_RECHECK_MS);
});

// Defense-in-depth (Finding 1): controller.resumeConversation() only flips
// status + emits conversation.resumed; it does NOT re-send the session update.
// If a pause→resume happened while a RESET-EPISODE post-reset instructions
// push was still owed and the teardown flush was somehow bypassed, recover
// here: push the queued context response-lessly.
//
// CRITICAL (Finding 2): gate on the reset-SCOPED owed flag
// (resetEpisodeRefreshPending), NOT the bare global queuedInstructionsUpdate.
// `/instructions/segment` sets queuedInstructionsUpdate for ANY segment that
// arrives while a response streams — including a plain non-reset
// mid-stream `voice context` with no reset episode active. Keying the resume
// recovery on the global flag would response-lessly flush that non-reset
// segment and clear queuedInstructionsUpdate, so the normal
// response.completed spoken drain (updateVoiceSession → scheduleResponse) is
// skipped and the avatar goes silent on the agent's new subject — the exact
// failure this card eliminates, masked by a success-shaped event. A non-reset
// queued segment must keep its normal post-response.completed spoken drain
// across pause/resume; pause/resume must not consume it. resetEpisodeRefreshPending
// is set ONLY by a segment that arrived while resetOpeningInFlight, so it is
// true exclusively inside a genuine reset episode.
//
// Finding 3: flush via the reset-episode variant which also zeroes
// resetEpisodeRefreshPending, so postResetInstructionsOwed()/this handler are
// self-terminating — a subsequent conversation.resumed is a strict no-op
// instead of re-pushing a redundant updateVoiceSession + spurious
// opening.coalesced until an unrelated clearResetEpisode().
controller.on("conversation.resumed", () => {
  if (!resetEpisodeRefreshPending) return;
  flushOwedResetEpisodeInstructions();
});

// A reset-opening that is still pending when the conversation ends is moot.
controller.on("conversation.ended", clearResetOpening);
controller.on("conversation.ended", clearResetEpisode);

controller.on("response.completed", () => {
  const hadInjections = queuedInjections.length > 0;
  if (hadInjections) {
    const drained = queuedInjections.splice(0);
    for (const text of drained) {
      controller.injectSystemMessage({ text, triggerResponse: false }).catch((err: unknown) => {
        appendEvent("conversation.error", { error: String(err) });
      });
    }
  }
  // If this completing response IS the in-flight reset opening, the reset
  // episode is now closing. Any instructions update that was deferred while it
  // streamed (queuedInstructionsUpdate, or resetEpisodeRefreshPending set by a
  // post-reset segment that arrived during the opening) belongs to the SAME
  // episode: refresh instructions, but do NOT scheduleResponse() — that would
  // be the duplicate second opening. Clearing resetOpeningInFlight before the
  // queued-drain block ensures any subsequent (genuinely later) segment is
  // treated normally.
  const wasResetOpening = resetOpeningInFlight;
  const hadEpisodeRefresh = resetEpisodeRefreshPending;
  // Capture BEFORE clearResetEpisode() — it now also clears
  // queuedInstructionsUpdate so a mid-flight episode teardown cannot drain a
  // second opening. On THIS (normal completion) path the queued segment still
  // belongs to the just-finished reset opening and must coalesce.
  const hadQueuedInstructions = queuedInstructionsUpdate;
  clearResetEpisode();
  if (wasResetOpening && (hadQueuedInstructions || hadEpisodeRefresh)) {
    queuedInstructionsUpdate = false;
    refreshInstructionsOnly();
    return;
  }
  if (hadQueuedInstructions) {
    queuedInstructionsUpdate = false;
    controller
      .updateVoiceSession({ instructions: rebuildInstructions() })
      .then(() => {
        scheduleResponse();
      })
      .catch((err: unknown) => {
        appendEvent("conversation.error", { error: String(err) });
      });
  } else if (hadInjections) {
    scheduleResponse();
  }
});

// Flush staged system messages when a conversation becomes active
controller.on("conversation.started", () => {
  const pending = stagedSystemMessages.splice(0);
  let anyTrigger = false;
  for (const msg of pending) {
    if (msg.triggerResponse) anyTrigger = true;
    controller.injectSystemMessage({ text: msg.text, triggerResponse: false }).catch((err: unknown) => {
      appendEvent("conversation.error", { error: String(err) });
    });
  }
  if (anyTrigger) scheduleResponse();
  flushStagedInstructions();
});

// Auto-start a conversation once the browser is ready, if messages are staged.
function tryAutoStartForStaged(): void {
  const hasStagedInstructions = latestContext !== null || latestTopics !== null;
  if (stagedSystemMessages.length === 0 && !hasStagedInstructions) return;
  if (controller.status.conversation !== "none") return;
  controller.startConversation().catch((err: unknown) => {
    appendEvent("conversation.error", { error: String(err) });
  });
}

controller.on("browser.client.connected", () => {
  tryAutoStartForStaged();
});

controller.on("browser.audio.deviceChange", (event) => {
  if (event.audio.ready) tryAutoStartForStaged();
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

mkdirSync(tmpDir, { recursive: true });
writeFileSync(pidFile, String(process.pid), "utf8");
// Reset per-daemon state so a fresh daemon's seq=1 isn't shadowed by a
// stale cursor or stale events from a prior run.
writeFileSync(eventsFile, "", "utf8");
try {
  rmSync(cursorFile);
} catch (err: unknown) {
  void err; // cursor file may not exist
}

controller.on("server.started", (event) => {
  // Emit startup JSON to stdout for the spawning CLI
  const line = JSON.stringify({ port: event.port, url: event.url, createdAt: event.createdAt.toISOString() });
  process.stdout.write(`${line}\n`);
});

controller.start().catch((err: unknown) => {
  process.stderr.write(`${JSON.stringify({ error: String(err) })}\n`);
  cleanup();
  process.exit(1);
});

startFirstRegisterTimer();

// Check client liveness every 5s
setInterval(checkClients, 5_000);

// ---------------------------------------------------------------------------
// Control HTTP server
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function serializeStatus(): unknown {
  return serializeData(controller.status as unknown as Record<string, unknown>);
}

const controlServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://localhost:${controlPort}`);
  const pathname = url.pathname;

  try {
    if (method === "GET" && pathname === "/status") {
      sendJson(res, 200, serializeStatus());
      return;
    }

    if (method === "POST" && pathname === "/server/stop") {
      sendJson(res, 200, { ok: true });
      setImmediate(() => shutdown());
      return;
    }

    if (method === "POST" && pathname === "/conversation/start") {
      await controller.startConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/conversation/pause") {
      await controller.pauseConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/conversation/resume") {
      await controller.resumeConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/conversation/end") {
      await controller.endConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/conversation/reset") {
      await controller.resetConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/inject/user") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { text: string; source?: string; triggerResponse?: boolean };
      const item = await controller.injectUserMessage({
        text: parsed.text,
        source: parsed.source as "textInput" | "system" | undefined,
        triggerResponse: parsed.triggerResponse,
      });
      sendJson(res, 200, serializeData(item as unknown as Record<string, unknown>));
      return;
    }

    if (method === "POST" && pathname === "/inject/assistant") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { text: string; source?: string };
      const item = await controller.injectAssistantMessage({
        text: parsed.text,
        source: parsed.source as "assistantText" | "system" | undefined,
      });
      sendJson(res, 200, serializeData(item as unknown as Record<string, unknown>));
      return;
    }

    if (method === "POST" && pathname === "/inject/system") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { text: string; triggerResponse?: boolean };
      let convStatus = controller.status.conversation;
      const isTopicsOrContext = /^\s*<(topics|context)>/.test(parsed.text);
      if (isTopicsOrContext && convStatus === "none") {
        try {
          await controller.startConversation();
          convStatus = controller.status.conversation;
        } catch (err: unknown) {
          stagedSystemMessages.push({ text: parsed.text, triggerResponse: parsed.triggerResponse });
          sendJson(res, 200, { staged: true, startError: String(err) });
          return;
        }
      }
      if (convStatus !== "active" && convStatus !== "paused") {
        stagedSystemMessages.push({ text: parsed.text, triggerResponse: parsed.triggerResponse });
        sendJson(res, 200, { staged: true });
        return;
      }
      // If the agent invoked `wait_for_context`, fresh context/topics has now
      // arrived, so re-enable auto-response before injecting the system message
      // (injectSystemMessage with triggerResponse:true will fire response.create
      // explicitly regardless of the flag, but VAD-driven responses should
      // resume for any subsequent user speech).
      if (waitingForContext && isTopicsOrContext) {
        waitingForContext = false;
        controller.broadcastToBrowser({ type: "wait_for_context.end" });
        try {
          await controller.setAutoResponse(true);
        } catch (err: unknown) {
          appendEvent("conversation.error", { error: String(err) });
        }
      }
      // If a response is currently streaming, queue this injection so the
      // item lands cleanly after the model finishes — and so any trigger fires
      // against the post-response state, not mid-stream.
      if (controller.responseInFlight) {
        queuedInjections.push(parsed.text);
        sendJson(res, 200, { queued: true });
        return;
      }
      const item = await controller.injectSystemMessage({
        text: parsed.text,
        triggerResponse: false,
      });
      if (parsed.triggerResponse === true) scheduleResponse();
      sendJson(res, 200, serializeData(item as unknown as Record<string, unknown>));
      return;
    }

    if (method === "POST" && pathname === "/html/set") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { html?: string; path?: string; clear?: boolean };
      let injectedError: { code: string; message: string } | undefined;
      const onInjectedError = (evt: { code: string; message: string }): void => {
        injectedError = { code: evt.code, message: evt.message };
      };
      controller.once("injected.error", onInjectedError);
      try {
        await controller.setHtml(
          parsed.path !== undefined
            ? { path: parsed.path }
            : parsed.clear === true
              ? null
              : { html: parsed.html ?? "" },
        );
      } finally {
        controller.off("injected.error", onInjectedError);
      }
      if (injectedError !== undefined) {
        sendJson(res, 200, { ok: false, error: { code: injectedError.code, message: injectedError.message } });
      } else {
        sendJson(res, 200, { ok: true });
      }
      return;
    }

    if (method === "POST" && pathname === "/instructions/segment") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { kind?: string; text?: unknown; triggerResponse?: boolean };
      if (parsed.kind !== "context" && parsed.kind !== "topics") {
        sendJson(res, 400, { error: "invalid kind" });
        return;
      }
      if (typeof parsed.text !== "string") {
        sendJson(res, 400, { error: "text must be a string" });
        return;
      }
      const kind = parsed.kind;
      const trimmed = parsed.text.trim();
      if (trimmed.length === 0) {
        if (kind === "context") latestContext = null;
        else latestTopics = null;
      } else {
        if (kind === "context") latestContext = trimmed;
        else latestTopics = trimmed;
      }

      let convStatus = controller.status.conversation;
      if (convStatus === "none") {
        try {
          await controller.startConversation();
          convStatus = controller.status.conversation;
        } catch (err: unknown) {
          sendJson(res, 200, { staged: true, startError: String(err) });
          return;
        }
      }
      if (convStatus !== "active" && convStatus !== "paused") {
        sendJson(res, 200, { staged: true });
        return;
      }

      // wait_for_context re-entry: fresh context/topics has arrived, so
      // re-enable auto-response for subsequent VAD-driven turns.
      if (waitingForContext && (latestContext !== null || latestTopics !== null)) {
        waitingForContext = false;
        controller.broadcastToBrowser({ type: "wait_for_context.end" });
        try {
          await controller.setAutoResponse(true);
        } catch (err: unknown) {
          appendEvent("conversation.error", { error: String(err) });
        }
      }

      // If a response is currently streaming, defer the session.update so
      // the refreshed instructions take effect against the post-response
      // state, not mid-stream.
      if (controller.responseInFlight) {
        queuedInstructionsUpdate = true;
        // If the in-flight response is the reset-episode opening, mark this
        // segment as an episode refresh so response.completed coalesces it
        // (instructions-only) instead of draining into a second opening.
        if (resetOpeningInFlight) resetEpisodeRefreshPending = true;
        sendJson(res, 200, {
          queued: true,
          kind,
          latestContext: latestContext !== null,
          latestTopics: latestTopics !== null,
        });
        return;
      }

      try {
        await controller.updateVoiceSession({ instructions: rebuildInstructions() });
      } catch (err: unknown) {
        sendJson(res, 500, { error: String(err) });
        return;
      }
      if (parsed.triggerResponse !== false) scheduleResponse();
      sendJson(res, 200, {
        ok: true,
        kind,
        latestContext: latestContext !== null,
        latestTopics: latestTopics !== null,
      });
      return;
    }

    if (method === "POST" && pathname === "/tool/cancel") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { callId: string };
      await controller.cancelToolCall(parsed.callId);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/client/register") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { pid: number };
      const clientId = `client-${++clientIdCounter}`;
      registeredClients.set(clientId, { clientId, pid: parsed.pid });
      if (firstRegisterDeadline !== null) {
        clearTimeout(firstRegisterDeadline);
        firstRegisterDeadline = null;
      }
      cancelClientGraceTimer();
      sendJson(res, 200, { clientId });
      return;
    }

    if (method === "POST" && pathname === "/client/unregister") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { clientId: string };
      registeredClients.delete(parsed.clientId);
      sendJson(res, 200, { ok: true });
      if (registeredClients.size === 0) {
        startClientGraceTimer();
      }
      return;
    }

    if (method === "GET" && pathname === "/watch") {
      const eventsParam = url.searchParams.get("events");
      const afterParam = url.searchParams.get("after");
      const filterEvents = eventsParam ? eventsParam.split(",").filter(Boolean) : [];
      const after = afterParam ? parseInt(afterParam, 10) : 0;

      let content: string;
      try {
        content = readFileSync(eventsFile, "utf8");
      } catch {
        content = "";
      }

      const lines = content.split("\n").filter(Boolean);
      const matching: string[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as { seq: number; event: string; data?: { item?: { source?: string } } };
          if (parsed.seq > after) {
            if (filterEvents.length === 0 || filterEvents.includes(parsed.event)) {
              // Skip system-sourced transcript items — these are Claude's own injections
              if (parsed.event === "transcript.item" && parsed.data?.item?.source === "system") {
                continue;
              }
              matching.push(line);
            }
          }
        } catch (_err: unknown) {
          void _err; // skip malformed lines
        }
      }

      const responseBody = matching.join("\n") + (matching.length > 0 ? "\n" : "");
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Content-Length": Buffer.byteLength(responseBody),
      });
      res.end(responseBody);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err: unknown) {
    sendJson(res, 500, { error: String(err) });
  }
});

controlServer.listen(controlPort, "localhost");

// ---------------------------------------------------------------------------
// Signal handling
// ---------------------------------------------------------------------------

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
