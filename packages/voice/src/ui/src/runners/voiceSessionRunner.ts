import type { XAIClientEvent, XAISessionConfig } from "../../../xai-realtime-api.js";
import type { VoiceToken } from "../actions.js";
import { watchMicTrack } from "./deviceRunner.js";
import { recordRawXaiFrame, sendToHost } from "./hostSocketRunner.js";
import type { RunnerDeps } from "./types.js";

/**
 * voiceSessionRunner owns every audio-system native ref and the xAI WebSocket.
 * It is a faithful port of the vanilla SPA's voice pipeline:
 * `refreshAudio`/getUserMedia, `acquireMicStream`, `startMeters`,
 * `startConversation`, `establishVoiceSession`, `startMicEncoder`,
 * `playPcmDelta`, `forwardVoiceSend`, drain detection, barge-in cut,
 * pause/resume, `switchMicDevice`, and `teardownVoice`.
 *
 * Runner-private refs (NOT in the store): pendingSends, preOpenAudio,
 * deferredSends, all native refs, pauseCutTimer, drainCheckTimer,
 * mintRetryCount, levelsRef.
 *
 * The store mirrors only outcome state via dispatched actions.
 */

// 5-bar equalizer levels — read by EqBars' RAF loop. NEVER dispatched (Q26).
export const levelsRef = new Float32Array(5);

// session.update (carrying the 48 kHz PCM format) MUST precede any
// input_audio_buffer.append, otherwise xAI interprets audio at the 24 kHz
// default and the input is garbled (Q17).
const PCM16_WORKLET_SRC = `
  class Pcm16Encoder extends AudioWorkletProcessor {
    constructor() { super(); this.buf = []; this.target = 4800; }
    process(inputs) {
      const ch = inputs[0] && inputs[0][0];
      if (!ch) return true;
      this.buf.push(new Float32Array(ch));
      let total = 0;
      for (const b of this.buf) total += b.length;
      while (total >= this.target) {
        const out = new Int16Array(this.target);
        let written = 0;
        while (written < this.target) {
          const head = this.buf[0];
          const take = Math.min(head.length, this.target - written);
          for (let i = 0; i < take; i++) {
            const s = Math.max(-1, Math.min(1, head[i]));
            out[written + i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          if (take === head.length) this.buf.shift();
          else this.buf[0] = head.subarray(take);
          written += take;
        }
        total -= this.target;
        this.port.postMessage(out.buffer, [out.buffer]);
      }
      return true;
    }
  }
  registerProcessor("pcm16-encoder", Pcm16Encoder);
`;

const PRE_OPEN_AUDIO_CAP = 50;
const PAUSE_CUT_MS = 500;
const TOKEN_PRE_EXPIRY_MS = 5000;
const MAX_MINT_RETRIES = 3;
const DRAIN_SAFETY_MARGIN = 0.01;

interface VoiceRefs {
  xaiWs?: WebSocket;
  micStream?: MediaStream;
  micTrack?: MediaStreamTrack;
  micSourceNode?: MediaStreamAudioSourceNode;
  workletNode?: AudioWorkletNode;
  inputCtx?: AudioContext;
  outputCtx?: AudioContext;
  analyser?: AnalyserNode;
  analyserCtx?: AudioContext;
  nextPlaybackTime: number;
  playbackEndsAt: number;
  scheduledSources: AudioBufferSourceNode[];
  pendingSends: string[];
  preOpenAudio: string[];
  deferredSends: XAIClientEvent[];
  connectedSent: boolean;
  // Q17: the daemon's session.update (declaring the 48 kHz PCM input format +
  // server_vad turn detection) MUST reach xAI before any
  // input_audio_buffer.append, or xAI interprets the mic at its 24 kHz default
  // with no VAD — no speech detection, no transcription, no barge-in. The
  // worklet only releases buffered mic frames once this is true, and it is set
  // the moment a session.update is actually forwarded to the socket. Lives on
  // refs so teardown/reset re-gates a rebuilt session via freshRefs().
  sessionConfigured: boolean;
  // True while a session.update sits in pendingSends awaiting WS open. Lets the
  // open handler distinguish "session already configured, flush mic audio now"
  // from "no session.update queued yet, keep buffering until one arrives via
  // forwardVoiceSend".
  pendingSessionUpdate: boolean;
  tokenExpiresAt: number;
  paused: boolean;
}

function freshRefs(): VoiceRefs {
  return {
    nextPlaybackTime: 0,
    playbackEndsAt: 0,
    scheduledSources: [],
    pendingSends: [],
    preOpenAudio: [],
    deferredSends: [],
    connectedSent: false,
    sessionConfigured: false,
    pendingSessionUpdate: false,
    tokenExpiresAt: 0,
    paused: false,
  };
}

function errStr(error: unknown): string {
  return String(error instanceof Error ? error.message : error);
}

export function createVoiceSessionRunner({ dispatch, subscribeToActions, getState }: RunnerDeps): () => void {
  let refs = freshRefs();
  let metersStarted = false;
  let metersRaf = 0;
  let pauseCutTimer: ReturnType<typeof setTimeout> | undefined;
  let drainCheckTimer: ReturnType<typeof setTimeout> | undefined;
  let mintRetryCount = 0;
  // Fires getUserMedia at most once when the server reports connectOnPageLoad,
  // surfacing the browser mic-permission prompt without waiting for a click.
  // The autoplay probe still gates the click-driven start path; this only
  // bypasses the gate for the server-driven page-load connect.
  let connectOnPageLoadPrompted = false;
  // Detaches the close/error listeners from the live xAI socket so a clean
  // teardown of a CONNECTED session does not re-enter failVoice via the
  // close handler reading the (already reset) refs (spurious
  // voice.session.failed). Reset on every fresh socket.
  let detachXaiWsListeners: (() => void) | undefined;
  // Monotonic establish epoch. teardownVoice() bumps this so an
  // establishVoiceSession() that was suspended across a teardown (token /
  // worklet load racing reset) detects it is stale and aborts instead of
  // silently re-owning the fresh refs with a dead socket (Test 1).
  let establishEpoch = 0;
  // Bounded post-reset rebuild watchdog. Armed by ui/click/reset; if the
  // pipeline is not live again within the window the runner surfaces an
  // observable mic-disconnected signal instead of staying silent forever
  // (Test 2). Cleared on a successful rebuild and on teardown/unsubscribe so
  // a normal session never sees a spurious signal.
  let resetWatchdog: ReturnType<typeof setTimeout> | undefined;
  const RESET_REBUILD_WATCHDOG_MS = 8000;
  // True between a ui/click/reset and the next successful rebuild (xai/ws
  // open). Scopes the post-reset rebuild diagnostics to the genuinely-reset
  // case so a normal session/establish stays quiet.
  let awaitingResetRebuild = false;

  const clearResetWatchdog = (): void => {
    if (resetWatchdog !== undefined) {
      clearTimeout(resetWatchdog);
      resetWatchdog = undefined;
    }
  };

  const reportAudioError = (code: string, message: string, suggestedAction: string): void => {
    sendToHost("browser.audio.error", { code, message, suggestedAction });
    dispatch({
      type: "browser/mic/stream-failed",
      error: { code, message },
    });
  };

  // ── Mic acquisition (ports refreshAudio + acquireMicStream) ──────────────

  const acquireMicStream = (deviceId: string | null): Promise<MediaStream> => {
    const audio: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    if (deviceId) audio.deviceId = { exact: deviceId };
    return navigator.mediaDevices.getUserMedia({ audio });
  };

  /**
   * Ports the vanilla SPA's `refreshAudio`: probe getUserMedia, enumerate
   * input devices, broadcast `audio.device.state`, mark permission granted.
   * Returns true on success.
   */
  const getUserMedia = async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      // Probe with the persisted/selected device when one exists, so a page
      // load never briefly opens the OS-default mic (e.g. an iPhone Continuity
      // mic) before the real session switches. An unconstrained probe always
      // grabs the system default, which is what made reloads "reconnect" to
      // the wrong device despite a correctly persisted selection. Fall back to
      // the default probe only when nothing was chosen, or the chosen device
      // is currently unavailable (its absence must not clobber the selection).
      const persisted = getState().audio.selectedDeviceId;
      let probe: MediaStream;
      try {
        probe = await acquireMicStream(persisted);
      } catch (probeError) {
        if (!persisted) throw probeError;
        probe = await acquireMicStream(null);
      }
      for (const track of probe.getTracks()) track.stop();
      const devices = (await navigator.mediaDevices.enumerateDevices())
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || "Microphone",
          groupId: device.groupId,
        }));
      const previous = getState().audio.selectedDeviceId;
      // Preserve a persisted selection even when its device is momentarily
      // absent (dock asleep, USB/Bluetooth still enumerating, device-id salt
      // not yet warmed). Only auto-pick the first device on genuine first run,
      // when the user never chose one. Falling back to devices[0] for an
      // absent-but-persisted device would overwrite the saved choice — and,
      // because that choice is itself persisted, "stick" the picker on the
      // first enumerated mic. The devicechange re-enumerate path restores the
      // real device once it reappears.
      const selected = previous ?? devices[0]?.deviceId ?? null;
      dispatch({ type: "browser/devices/enumerated", devices });
      if (selected && selected !== previous) dispatch({ type: "ui/select/mic-device", deviceId: selected });
      dispatch({ type: "browser/permission/granted" });
      sendToHost("audio.device.state", {
        permission: "granted",
        devices,
        selectedDeviceId: selected ?? undefined,
        ready: true,
      });
      return true;
    } catch (error) {
      reportAudioError(
        "MICROPHONE_DEVICE_ERROR",
        "Could not access the selected microphone.",
        "Allow microphone access and try again.",
      );
      dispatch({ type: "browser/permission/denied" });
      void error;
      return false;
    }
  };

  // ── Meters (ports startMeters) ───────────────────────────────────────────

  const startMeters = (stream: MediaStream): void => {
    if (refs.analyserCtx) {
      try {
        void refs.analyserCtx.close();
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `startMeters.analyserCtx.close.failed: ${errStr(error)}`,
        });
      }
    }
    const audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") {
      audioCtx
        .resume()
        .then(() => {
          // resume() resolving does NOT guarantee the context started — with
          // no user gesture it can stay "suspended", leaving the analyser
          // frozen and the equalizer flat with no error. Surface that so the
          // UI can recover instead of forcing a page reload (Test 3).
          if (audioCtx.state === "suspended") {
            dispatch({
              type: "browser/window/error",
              message:
                "startMeters.audioCtx.resume.noop: AudioContext stayed suspended after resume(); metering is not live (mic pipeline detached)",
            });
          }
        })
        .catch((error: unknown) => {
          dispatch({
            type: "browser/window/error",
            message: `startMeters.audioCtx.resume.failed: ${errStr(error)}`,
          });
        });
    }
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    refs.analyser = analyser;
    refs.analyserCtx = audioCtx;
    if (metersStarted) return;
    metersStarted = true;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const updateBars = (): void => {
      const current = refs.analyser;
      if (current) {
        current.getByteFrequencyData(data);
        for (let i = 0; i < levelsRef.length; i += 1) {
          // Q26: write meter levels straight to the shared ref. Never dispatch.
          levelsRef[i] = Math.max(0.1, (data[i * 10] ?? 0) / 255);
        }
      }
      metersRaf = requestAnimationFrame(updateBars);
    };
    updateBars();
  };

  // ── PCM playback (ports playPcmDelta) ────────────────────────────────────

  const pcm16Base64ToFloat32 = (b64: string): Float32Array => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const samples = new Float32Array(bytes.length / 2);
    for (let i = 0; i < samples.length; i += 1) {
      const s = view.getInt16(i * 2, true);
      samples[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
    }
    return samples;
  };

  const bytesToBase64 = (uint8: Uint8Array): string => {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  };

  const isPlaybackDrained = (): boolean => {
    const ctx = refs.outputCtx;
    const endsAt = refs.playbackEndsAt;
    if (!endsAt) return true;
    if (!ctx) return true;
    return ctx.currentTime >= endsAt - DRAIN_SAFETY_MARGIN;
  };

  // Q16: after playback completes, flush deferred (playback-gated) sends.
  const flushDeferredIfDrained = (): void => {
    if (!isPlaybackDrained()) {
      // Reschedule a one-shot probe near the predicted drain time.
      if (refs.deferredSends.length === 0) return;
      const ctx = refs.outputCtx;
      const delayMs = ctx ? Math.max(0, (refs.playbackEndsAt - ctx.currentTime + 0.015) * 1000) : 50;
      if (drainCheckTimer !== undefined) clearTimeout(drainCheckTimer);
      drainCheckTimer = setTimeout(flushDeferredIfDrained, delayMs);
      return;
    }
    if (drainCheckTimer !== undefined) {
      clearTimeout(drainCheckTimer);
      drainCheckTimer = undefined;
    }
    if (refs.deferredSends.length === 0) return;
    // Reducer clears deferredSendsPending; the runner's drained listener
    // flushes the private payloads.
    dispatch({ type: "voice/playback/drained" });
  };

  const playPcmDelta = (b64: string): void => {
    try {
      const samples = pcm16Base64ToFloat32(b64);
      if (samples.length === 0) return;
      let ctx = refs.outputCtx;
      if (!ctx) {
        ctx = new AudioContext({ sampleRate: 48000 });
        refs.outputCtx = ctx;
      }
      if (ctx.state === "suspended") {
        ctx.resume().catch((error: unknown) => {
          dispatch({
            type: "browser/window/error",
            message: `outputCtx.resume.failed: ${errStr(error)}`,
          });
        });
      }
      const buffer = ctx.createBuffer(1, samples.length, 48000);
      buffer.getChannelData(0).set(samples);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const now = ctx.currentTime;
      const startAt = Math.max(now, refs.nextPlaybackTime);
      source.start(startAt);
      const endsAt = startAt + buffer.duration;
      refs.nextPlaybackTime = endsAt;
      refs.playbackEndsAt = Math.max(refs.playbackEndsAt || 0, endsAt);
      refs.scheduledSources.push(source);
      dispatch({
        type: "voice/playback/cursor",
        nextPlaybackTime: refs.nextPlaybackTime,
        playbackEndsAt: refs.playbackEndsAt,
      });
      source.addEventListener("ended", () => {
        const idx = refs.scheduledSources.indexOf(source);
        if (idx !== -1) refs.scheduledSources.splice(idx, 1);
        flushDeferredIfDrained();
      });
      // Q16: schedule a drain probe after each delta if deferred sends wait.
      if (refs.deferredSends.length > 0) {
        const delayMs = Math.max(0, (refs.playbackEndsAt - ctx.currentTime + 0.015) * 1000);
        if (drainCheckTimer !== undefined) clearTimeout(drainCheckTimer);
        drainCheckTimer = setTimeout(flushDeferredIfDrained, delayMs);
      }
    } catch (error) {
      reportAudioError(
        "AUDIO_DECODE_FAILED",
        errStr(error),
        "Refresh the page; if the problem persists check audio device permissions.",
      );
    }
  };

  // Q18: idempotent on an already-empty array.
  const stopScheduledPlayback = (): void => {
    for (const source of refs.scheduledSources.splice(0)) {
      try {
        source.stop();
      } catch {
        // already ended — expected; not an error condition.
        void 0;
      }
      try {
        source.disconnect();
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `stopScheduledPlayback.disconnect.failed: ${errStr(error)}`,
        });
      }
    }
    refs.nextPlaybackTime = 0;
    refs.playbackEndsAt = 0;
  };

  // ── Mic encoder (ports startMicEncoder) ──────────────────────────────────

  const startMicEncoder = async (stream: MediaStream): Promise<void> => {
    try {
      const ctx = new AudioContext({ sampleRate: 48000 });
      refs.inputCtx = ctx;
      if (ctx.state === "suspended") {
        ctx.resume().catch((error: unknown) =>
          dispatch({
            type: "browser/window/error",
            message: `inputCtx.resume.failed: ${errStr(error)}`,
          }),
        );
      }
      const source = ctx.createMediaStreamSource(stream);
      refs.micSourceNode = source;
      const blob = new Blob([PCM16_WORKLET_SRC], {
        type: "application/javascript",
      });
      const url = URL.createObjectURL(blob);
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const node = new AudioWorkletNode(ctx, "pcm16-encoder");
      refs.workletNode = node;
      node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (refs.paused) return;
        try {
          const b64 = bytesToBase64(new Uint8Array(event.data));
          const ws = refs.xaiWs;
          // Q17: release mic frames directly only once the socket is OPEN AND
          // the session has been configured (session.update forwarded). Before
          // that — including the window between WS open and the session.update
          // reaching the socket on initial connect — keep buffering so no
          // input_audio_buffer.append outruns the format/VAD declaration.
          if (ws && ws.readyState === WebSocket.OPEN && refs.sessionConfigured) {
            ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
          } else {
            // Q20: pre-open FIFO with a bounded cap.
            refs.preOpenAudio.push(b64);
            if (refs.preOpenAudio.length > PRE_OPEN_AUDIO_CAP) {
              refs.preOpenAudio.shift();
              dispatch({ type: "voice/queue/pre-open-cap-hit" });
            }
          }
        } catch (error) {
          reportAudioError(
            "AUDIO_ENCODE_FAILED",
            errStr(error),
            "Refresh the page; if the problem persists check microphone permissions.",
          );
        }
      };
      // Intentional: do NOT connect node → ctx.destination (pure tap).
      source.connect(node);
    } catch (error) {
      reportAudioError("AUDIO_ENCODER_INIT_FAILED", errStr(error), "Try a different browser or device.");
    }
  };

  // ── Session lifecycle ────────────────────────────────────────────────────

  const failVoice = (code: string, message: string): void => {
    sendToHost("voice.session.failed", { error: { code, message } });
    teardownVoice();
  };

  const startSessionRequest = (): void => {
    dispatch({ type: "voice/session/in-flight", inFlight: true });
    sendToHost("conversation.start");
    sendToHost("voice.session.requested");
  };

  /**
   * Ports the vanilla SPA's `voice.session.start` message handler: when the
   * daemon asks the browser to start a voice session (e.g. connectOnPageLoad
   * or a fresh conversation) and one is not already in flight, reply with
   * `voice.session.requested` so the daemon mints a token. Vanilla did NOT
   * send `conversation.start` here and did NOT gate on autoplay — the daemon
   * already owns the conversation; this is purely the token handshake.
   *
   * Q22 coexistence: `host/voice/session/start` is ALSO dispatched by the
   * probe-pending click sub-case (autoplayAllowed === null), where the intent
   * is only to capture pendingSessionStart, not to start. Distinguish the two:
   * the server-driven start is only honored once the xAI WS is not already
   * open and a session is not already in flight — matching vanilla's single
   * `!sessionInFlight` guard while not double-starting the click path.
   */
  const onServerSessionStart = (): void => {
    const { voice, audio } = getState();
    // The probe-pending click sub-case (Q22) dispatches the SAME action while
    // autoplayAllowed === null purely to capture pendingSessionStart; the
    // autoplayRunner replays the click once the probe resolves. Do not treat
    // that as a server-driven start — wait until the probe has resolved (which
    // also means the boot probe has had a chance to mark audio ready, exactly
    // as the vanilla SPA required before its voice.session.start handshake).
    if (audio.autoplayAllowed === null) return;
    if (voice.sessionInFlight || voice.xaiOpen || refs.xaiWs) return;
    dispatch({ type: "voice/session/in-flight", inFlight: true });
    sendToHost("voice.session.requested");
  };

  // Q12 / Q22 / Q45: interpret the primary click against voice + audio slices.
  const onPrimaryClick = (): void => {
    const { voice, audio } = getState();

    // Start branch.
    if (!voice.xaiOpen && !voice.sessionInFlight) {
      if (audio.autoplayAllowed === null) {
        // Probe pending: capture intent (Q22 null sub-case). The reducer's
        // host/voice/session/start case sets pendingSessionStart.
        dispatch({ type: "host/voice/session/start" });
        return;
      }
      if (audio.autoplayAllowed === false) {
        // Blocked: the click is the user gesture — getUserMedia unblocks
        // autoplay and the session starts in the SAME click (Q45).
        void getUserMedia().then((ok) => {
          if (ok) startSessionRequest();
        });
        return;
      }
      // Allowed (or permission already granted): start directly.
      if (!audio.ready) {
        void getUserMedia().then((ok) => {
          if (ok) startSessionRequest();
        });
        return;
      }
      startSessionRequest();
      return;
    }

    // Pause branch. Vanilla sent conversation.pause on the click so the
    // daemon's conversation.status round-trip drives server-side
    // conversation.paused events; the rebuild ALSO applies the local cut.
    if (voice.xaiOpen && !voice.paused) {
      sendToHost("conversation.pause");
      applyPause();
      return;
    }

    // Resume branch. Vanilla sent conversation.resume on the click.
    if (voice.xaiOpen && voice.paused) {
      sendToHost("conversation.resume");
      applyResume();
    }
  };

  const startConversationGuard = (): boolean => {
    // Ports startConversation()'s guards.
    if (refs.xaiWs) return false;
    const { voice, audio } = getState();
    if (voice.sessionInFlight && voice.xaiOpen) return false;
    if (!audio.ready) {
      reportAudioError("MICROPHONE_NOT_READY", "Microphone is not ready.", "Grant microphone access and try again.");
      return false;
    }
    return true;
  };

  /**
   * Q17: mark the session configured and release the buffered mic frames to
   * the (open) socket exactly once, the moment a session.update has been
   * forwarded. Ordering is preserved because the session.update is sent to the
   * socket immediately before this runs (open-handler pendingSends loop, or the
   * forwardVoiceSend direct send). Idempotent: a no-op once already configured.
   */
  const markSessionConfiguredAndFlush = (ws: WebSocket): void => {
    if (refs.sessionConfigured) return;
    refs.sessionConfigured = true;
    refs.pendingSessionUpdate = false;
    for (const b64 of refs.preOpenAudio) {
      try {
        ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `xaiWs.send.preOpenAudio.failed: ${errStr(error)}`,
        });
      }
    }
    refs.preOpenAudio = [];
  };

  const establishVoiceSession = async (token: VoiceToken): Promise<void> => {
    if (!token?.clientSecret || !token?.model) {
      failVoice("VOICE_TOKEN_INVALID", "Missing client secret or model.");
      return;
    }
    if (refs.xaiWs) {
      // A live socket already owns refs. This fires for benign concurrent-
      // establish dedup too, so only surface a signal when the socket is
      // actually a stale leftover that raced a teardown (never reached OPEN
      // and the store does not believe the session is live). In that case the
      // post-reset rebuild was silently skipped — make it observable and
      // re-enable recovery instead of leaving a flat equalizer.
      const { voice } = getState();
      const staleSocket = !refs.connectedSent && !voice.xaiOpen && refs.xaiWs.readyState !== WebSocket.OPEN;
      if (staleSocket) {
        dispatch({
          type: "browser/window/error",
          message:
            "voice.reset.rebuild.skipped: a stale xAI socket from an establish that raced reset is still owning the audio refs; rebuild aborted",
        });
        dispatch({ type: "voice/session/in-flight", inFlight: false });
      }
      return;
    }

    if (awaitingResetRebuild) {
      // A post-reset rebuild is genuinely underway (scoped to the reset case,
      // not benign concurrent establishes). Surface it so the UI reflects the
      // rebuild instead of a silent flat equalizer; the watchdog still guards
      // the case where this attempt never reaches a live socket.
      dispatch({ type: "voice/session/in-flight", inFlight: true });
    }

    // Bind this establish attempt to the current epoch. If teardownVoice()
    // runs before this async chain reassigns refs, the epoch advances and
    // this attempt must abort rather than re-own the fresh refs.
    const epoch = establishEpoch;
    const isStale = (): boolean => epoch !== establishEpoch;

    // Q21: pre-expiry re-mint. Keep sessionInFlight=true (no idle flicker).
    if (typeof token.expiresAt === "number" && Date.now() > token.expiresAt * 1000 - TOKEN_PRE_EXPIRY_MS) {
      mintRetryCount += 1;
      if (mintRetryCount > MAX_MINT_RETRIES) {
        // Bounded-retry guard: surface the hang, re-enable the play button.
        mintRetryCount = 0;
        dispatch({ type: "connection/status", status: "error" });
        dispatch({ type: "voice/session/in-flight", inFlight: false });
        return;
      }
      sendToHost("voice.session.requested");
      return;
    }
    mintRetryCount = 0;
    refs.tokenExpiresAt = token.expiresAt ?? 0;

    if (!startConversationGuard() && !getState().voice.sessionInFlight) {
      return;
    }

    try {
      const stream = await acquireMicStream(getState().audio.selectedDeviceId);
      if (isStale()) {
        // A teardown (reset) ran while we awaited the mic. Do not re-own the
        // fresh refs with this attempt's socket/stream; stop the just-acquired
        // tracks and abort. The post-reset token will drive a clean rebuild.
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      refs.micStream = stream;
      const track = stream.getAudioTracks()[0];
      refs.micTrack = track;
      watchMicTrack(track, dispatch);
      if (track) {
        dispatch({
          type: "browser/mic/stream-acquired",
          deviceId: getState().audio.selectedDeviceId ?? "",
          trackId: track.id,
        });
      }
      startMeters(stream);

      // Start mic encoder immediately (parallel with WS connect) so the
      // opening utterance is never missed. Frames buffer in preOpenAudio.
      refs.preOpenAudio = [];
      await startMicEncoder(stream);
      if (isStale()) {
        // Reset raced the worklet load. Abort before creating the socket so a
        // stale xaiWs can never re-own the post-teardown refs (Test 1 root
        // cause). The fresh post-reset token rebuilds cleanly.
        return;
      }

      const safeToken = sanitizeSubprotocolToken(token.clientSecret, dispatch);
      dispatch({ type: "xai/ws/connecting" });
      const ws = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(token.model)}`, [
        `xai-client-secret.${safeToken}`,
      ]);
      refs.xaiWs = ws;

      let lastCloseCode: number | undefined;
      let lastCloseReason = "";

      ws.addEventListener("open", () => {
        // The pipeline is live again — disarm the post-reset watchdog so a
        // successfully rebuilt session never sees a spurious timeout signal.
        awaitingResetRebuild = false;
        clearResetWatchdog();
        dispatch({ type: "xai/ws/open" });
        // Q17: flush pendingSends FIRST so the daemon's session.update (48 kHz
        // PCM format + server_vad) reaches the socket before any mic audio.
        for (const payload of refs.pendingSends) {
          try {
            ws.send(payload);
          } catch (error) {
            dispatch({
              type: "browser/window/error",
              message: `xaiWs.send.pending.failed: ${errStr(error)}`,
            });
          }
        }
        refs.pendingSends = [];
        // Only release the buffered mic frames once a session.update has
        // actually been forwarded. On a reset/reattach the controller's
        // session.update was already queued (pendingSessionUpdate), so flush
        // now. On the initial page-load connect the controller does not send
        // session.update until AFTER it observes voice.session.connected, so
        // pendingSends carries no session.update yet — keep buffering and let
        // forwardVoiceSend release the frames when the session.update arrives.
        if (refs.pendingSessionUpdate) {
          markSessionConfiguredAndFlush(ws);
        }
        if (!refs.connectedSent) {
          refs.connectedSent = true;
          dispatch({ type: "voice/session/in-flight", inFlight: false });
          sendToHost("voice.session.connected");
        }
      });

      ws.addEventListener("message", (event) => {
        let parsed: { type?: string; delta?: unknown; item_id?: unknown; event_id?: unknown };
        try {
          parsed = JSON.parse(String(event.data));
        } catch (error) {
          dispatch({
            type: "browser/window/error",
            message: `xaiWs.in.parseError: ${errStr(error)}`,
          });
          return;
        }
        // xAI sends an application-level `{type:"ping",event_id}` heartbeat
        // every 10s. It MUST be answered with a `pong` echoing the event_id;
        // unanswered, xAI keeps the socket open but stops servicing the
        // session (no VAD/transcription/responses) — observed as a zombie
        // session that only receives pings. Reply immediately and short-
        // circuit (no xai/* action — it is pure transport bookkeeping).
        if (parsed?.type === "ping") {
          try {
            const eventId = typeof parsed.event_id === "string" ? parsed.event_id : undefined;
            ws.send(JSON.stringify(eventId ? { type: "pong", event_id: eventId } : { type: "pong" }));
          } catch (error) {
            dispatch({
              type: "browser/window/error",
              message: `xaiWs.send.pong.failed: ${errStr(error)}`,
            });
          }
          return;
        }
        // Record the raw frame so hostSocketRunner can forward it as
        // voice.event when it sees the synthesized xai/* action (Q28).
        recordRawXaiFrame(parsed);
        dispatchXaiServerEvent(parsed, dispatch);
        // Single authoritative playback path (Q15): decode + play PCM deltas
        // directly here; the daemon's audio.output.delta relay is ignored.
        if (parsed?.type === "response.output_audio.delta" && typeof parsed.delta === "string" && !refs.paused) {
          playPcmDelta(parsed.delta);
        }
      });

      const onWsClose = (event: CloseEvent): void => {
        lastCloseCode = event.code;
        lastCloseReason = event.reason;
        dispatch({
          type: "xai/ws/close",
          code: event.code,
          reason: event.reason,
        });
        if (!refs.connectedSent) {
          failVoice("VOICE_WS_REJECTED", `xAI WS closed before open: code=${event.code} reason=${event.reason}`);
        } else {
          sendToHost("voice.session.failed", {
            error: {
              code: "VOICE_WS_CLOSED",
              message: `xAI WS closed: code=${event.code}`,
            },
          });
          teardownVoice();
        }
      };

      const onWsError = (): void => {
        dispatch({ type: "xai/ws/error" });
        if (!refs.connectedSent) {
          const closeInfo =
            lastCloseCode !== undefined
              ? ` WS close code=${lastCloseCode}${lastCloseReason ? ` reason="${lastCloseReason}"` : ""}.`
              : " No close frame received before error.";
          failVoice(
            "VOICE_WS_REJECTED",
            `xAI WebSocket handshake failed. Attempted: wss://api.x.ai/v1/realtime with subprotocol prefix "xai-client-secret" (token not logged).${closeInfo} Possible causes: CORS policy, invalid/expired token, wrong subprotocol format, or origin not allowlisted.`,
          );
        }
      };

      ws.addEventListener("close", onWsClose);
      ws.addEventListener("error", onWsError);
      // Bind the lifetime guard to THIS socket. teardownVoice() reassigns
      // `refs = freshRefs()` (connectedSent → false); without detaching, the
      // close handler of a cleanly torn-down CONNECTED session would read the
      // reset refs, see !connectedSent, and emit a spurious
      // voice.session.failed (VOICE_WS_REJECTED) + recursive teardown. Detach
      // before close so a clean teardown is silent on the wire.
      detachXaiWsListeners = () => {
        ws.removeEventListener("close", onWsClose);
        ws.removeEventListener("error", onWsError);
      };
    } catch (error) {
      failVoice("VOICE_SETUP_FAILED", errStr(error));
    }
  };

  // ── Deferred / pending sends (ports forwardVoiceSend) ────────────────────

  const forwardVoiceSend = (event: XAIClientEvent, gate?: "playback-drained"): void => {
    if (!event) return;
    if (gate === "playback-drained" && !isPlaybackDrained()) {
      // Q16: payload stays in the private ref; reducer holds only the flag.
      refs.deferredSends.push(event);
      return;
    }
    const isSessionUpdate = event.type === "session.update";
    // Apply the user's persisted voice choice browser-side: rewrite the
    // daemon's session.update so the daemon never has to know (or be told)
    // which voice is selected. When no voice is chosen the daemon's configured
    // voice passes through untouched.
    let outgoing = event;
    if (event.type === "session.update") {
      const selectedVoice = getState().voice.selectedVoice;
      if (selectedVoice) {
        // The catch-all XAIClientEvent member widens `event.session` to
        // `unknown` after narrowing, so re-assert the session config shape.
        const session = event.session as XAISessionConfig;
        outgoing = { ...event, session: { ...session, voice: selectedVoice } };
      }
    }
    const payload = JSON.stringify(outgoing);
    const ws = refs.xaiWs;
    if (ws && getState().voice.xaiOpen) {
      try {
        ws.send(payload);
        // Q17: the session is now configured. Release any mic frames buffered
        // since WS open — they were held precisely until this session.update
        // reached the socket (initial page-load connect ordering).
        if (isSessionUpdate) markSessionConfiguredAndFlush(ws);
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `xaiWs.send.failed.requeue: ${errStr(error)}`,
        });
        refs.pendingSends.push(payload);
        if (isSessionUpdate) refs.pendingSessionUpdate = true;
      }
      return;
    }
    refs.pendingSends.push(payload);
    // A session.update queued before WS open: the open handler flushes
    // pendingSends then releases the buffered mic frames in the correct order.
    if (isSessionUpdate) refs.pendingSessionUpdate = true;
  };

  // ── Pause / resume (ports applyPauseState + applyPauseAudioCut) ───────────

  const applyPauseAudioCut = (): void => {
    refs.paused = true;
    if (refs.micTrack) refs.micTrack.enabled = false;
    if (refs.outputCtx?.state === "running") {
      refs.outputCtx.suspend().catch((error: unknown) =>
        dispatch({
          type: "browser/window/error",
          message: `outputCtx.suspend.failed: ${errStr(error)}`,
        }),
      );
    }
    if (refs.xaiWs && getState().voice.xaiOpen && getState().voice.responseActive) {
      try {
        refs.xaiWs.send(JSON.stringify({ type: "response.cancel" }));
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `xaiWs.send.responseCancel.failed: ${errStr(error)}`,
        });
      }
    }
  };

  const applyPause = (): void => {
    refs.paused = true;
    if (refs.micTrack) refs.micTrack.enabled = false;
    dispatch({ type: "voice/paused", paused: true });
    // Q19: if a response is being spoken, defer the audio cut by a bounded
    // timer (output_audio_buffer.stopped never fires on the WS path).
    if (getState().voice.responseActive) {
      if (pauseCutTimer !== undefined) clearTimeout(pauseCutTimer);
      pauseCutTimer = setTimeout(() => {
        if (pauseCutTimer !== undefined) {
          pauseCutTimer = undefined;
          applyPauseAudioCut();
        }
      }, PAUSE_CUT_MS);
      return;
    }
    applyPauseAudioCut();
  };

  const applyResume = (): void => {
    if (pauseCutTimer !== undefined) {
      clearTimeout(pauseCutTimer);
      pauseCutTimer = undefined;
    }
    refs.paused = false;
    if (refs.micTrack) refs.micTrack.enabled = true;
    if (refs.outputCtx?.state === "suspended") {
      refs.outputCtx.resume().catch((error: unknown) =>
        dispatch({
          type: "browser/window/error",
          message: `outputCtx.resume.failed: ${errStr(error)}`,
        }),
      );
    }
    dispatch({ type: "voice/paused", paused: false });
  };

  // ── Device switching (ports switchMicDevice) ─────────────────────────────

  const switchMicDevice = async (deviceId: string): Promise<void> => {
    sendToHost("audio.device.select", { deviceId });
    if (!refs.xaiWs) return;
    try {
      const stream = await acquireMicStream(deviceId);
      if (refs.workletNode) {
        try {
          refs.workletNode.port.onmessage = null;
          refs.workletNode.disconnect();
        } catch (error) {
          dispatch({
            type: "browser/window/error",
            message: `switchMic.worklet.disconnect.failed: ${errStr(error)}`,
          });
        }
        refs.workletNode = undefined;
      }
      if (refs.micSourceNode) {
        try {
          refs.micSourceNode.disconnect();
        } catch (error) {
          dispatch({
            type: "browser/window/error",
            message: `switchMic.micSource.disconnect.failed: ${errStr(error)}`,
          });
        }
      }
      if (refs.inputCtx) {
        try {
          void refs.inputCtx.close();
        } catch (error) {
          dispatch({
            type: "browser/window/error",
            message: `switchMic.inputCtx.close.failed: ${errStr(error)}`,
          });
        }
        refs.inputCtx = undefined;
      }
      if (refs.micStream) {
        for (const existing of refs.micStream.getTracks()) existing.stop();
      }
      refs.micStream = stream;
      refs.micTrack = stream.getAudioTracks()[0];
      watchMicTrack(refs.micTrack, dispatch);
      await startMicEncoder(stream);
      startMeters(stream);
    } catch (error) {
      reportAudioError(
        "MICROPHONE_SWITCH_FAILED",
        errStr(error) || "Could not switch microphone.",
        "Try a different device.",
      );
    }
  };

  // ── Teardown (ports teardownVoice — Q11 / Q47) ───────────────────────────

  function teardownVoice(): void {
    const { xaiWs, micStream, analyserCtx, workletNode, micSourceNode, inputCtx, outputCtx } = refs;
    // Detach the per-socket close/error guards BEFORE closing so a clean
    // teardown of a connected session does not re-enter failVoice.
    if (detachXaiWsListeners) {
      detachXaiWsListeners();
      detachXaiWsListeners = undefined;
    }
    if (xaiWs) {
      try {
        xaiWs.close();
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `teardown.xaiWs.close.failed: ${errStr(error)}`,
        });
      }
    }
    if (workletNode) {
      try {
        workletNode.port.onmessage = null;
        workletNode.disconnect();
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `teardown.worklet.disconnect.failed: ${errStr(error)}`,
        });
      }
    }
    if (micSourceNode) {
      try {
        micSourceNode.disconnect();
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `teardown.micSource.disconnect.failed: ${errStr(error)}`,
        });
      }
    }
    if (inputCtx) {
      try {
        void inputCtx.close();
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `teardown.inputCtx.close.failed: ${errStr(error)}`,
        });
      }
    }
    if (outputCtx) {
      try {
        void outputCtx.close();
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `teardown.outputCtx.close.failed: ${errStr(error)}`,
        });
      }
    }
    if (micStream) {
      for (const track of micStream.getTracks()) track.stop();
    }
    if (analyserCtx) {
      try {
        void analyserCtx.close();
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `teardown.analyserCtx.close.failed: ${errStr(error)}`,
        });
      }
    }
    if (drainCheckTimer !== undefined) {
      clearTimeout(drainCheckTimer);
      drainCheckTimer = undefined;
    }
    if (pauseCutTimer !== undefined) {
      clearTimeout(pauseCutTimer);
      pauseCutTimer = undefined;
    }
    if (metersRaf) {
      cancelAnimationFrame(metersRaf);
      metersRaf = 0;
    }
    metersStarted = false;
    // Clear a stale post-reset watchdog. The ui/click/reset handler re-arms a
    // fresh one *after* calling teardownVoice(), so the active reset's
    // watchdog survives; this only cancels a watchdog from a prior reset and
    // ensures unsubscribe()'s teardown leaves no timer behind.
    clearResetWatchdog();
    // Invalidate any establishVoiceSession() suspended across this teardown so
    // a resumed attempt aborts instead of re-owning the fresh refs with a
    // stale socket.
    establishEpoch += 1;
    watchMicTrack(undefined, dispatch);
    refs = freshRefs();
    levelsRef.fill(0);
  }

  // ── Action subscription ──────────────────────────────────────────────────

  const unsubscribe = subscribeToActions((action) => {
    switch (action.type) {
      case "ui/click/primary":
        onPrimaryClick();
        break;
      case "host/voice/session/start":
        // Server-driven start handshake (ports vanilla's voice.session.start
        // message handler). The audioReducer independently consumes this
        // action for the Q22 pendingSessionStart capture; these two are
        // disjoint by onServerSessionStart's autoplay/in-flight guards.
        onServerSessionStart();
        break;
      case "browser/autoplay/probed":
        // Vanilla connect()'s open handler: when autoplay is allowed it
        // immediately ran refreshAudio() (getUserMedia + enumerate +
        // audio.device.state{ready:true}) WITHOUT starting a voice session,
        // so the daemon's connectOnPageLoad gate could fire and the mic list
        // was populated at boot. Blocked autoplay still waits for the click.
        if (action.allowed) void getUserMedia();
        break;
      case "ui/click/reset": {
        // Teardown + tell the daemon to reset its server-side conversation.
        sendToHost("conversation.reset");
        teardownVoice();
        dispatch({ type: "voice/session/in-flight", inFlight: false });
        // The only rebuild trigger is an inbound host/voice/session/token. If
        // it never arrives (or the rebuild silently fails) the mic stays
        // detached forever with no indication. Arm a bounded watchdog: if the
        // pipeline is not live again within the window, surface an observable
        // mic-disconnected signal so the UI can recover instead of requiring a
        // page reload. teardownVoice() bumped establishEpoch, so this is the
        // current pending teardown; the watchdog is cleared on a successful
        // rebuild (xai/ws/open) and on the next teardown / unsubscribe.
        awaitingResetRebuild = true;
        clearResetWatchdog();
        resetWatchdog = setTimeout(() => {
          resetWatchdog = undefined;
          if (refs.xaiWs && getState().voice.xaiOpen) return;
          dispatch({
            type: "browser/window/error",
            message:
              "voice.reset.rebuild.timeout: no live voice session was rebuilt after reset; the microphone is detached from the audio pipeline",
          });
          dispatch({ type: "voice/session/in-flight", inFlight: false });
        }, RESET_REBUILD_WATCHDOG_MS);
        break;
      }
      case "ui/select/mic-device":
        void switchMicDevice(action.deviceId);
        break;
      case "ui/select/voice":
        // Apply the new voice to a live session immediately via a minimal
        // session.update (a merge patch — only the voice field changes). xAI
        // may ignore a mid-stream voice swap; if so it still takes on the next
        // start/reset. When not connected, nothing is sent here — the persisted
        // choice is applied by forwardVoiceSend on the next session.update.
        if (action.voice && getState().voice.xaiOpen) {
          forwardVoiceSend({ type: "session.update", session: { voice: action.voice } });
        }
        break;
      case "host/voice/session/token":
        void establishVoiceSession(action.token).catch((error: unknown) => {
          failVoice("VOICE_SETUP_FAILED", errStr(error));
        });
        break;
      case "host/voice/send":
        forwardVoiceSend(action.event, action.gate);
        break;
      case "host/voice/session/close":
        teardownVoice();
        break;
      case "host/duplicate-client":
        // Q11: full synchronous audio teardown BEFORE React swaps the screen.
        teardownVoice();
        break;
      case "host/state": {
        const status = action.data.conversationStatus;
        if ((status === "none" || status === "ending") && getState().voice.xaiOpen) {
          teardownVoice();
        }
        // Honor a server-initiated pause/resume (the pause_conversation tool,
        // `voice` CLI, or any non-click source). The click path already cuts
        // audio locally before the round-trip; this makes a purely
        // server-driven status change cut/restore the browser mic + output
        // too. Idempotent — guarded on the local paused flag so the click
        // path and echoes are no-ops.
        if (status === "paused" && getState().voice.xaiOpen && !getState().voice.paused) {
          applyPause();
        } else if (status === "active" && getState().voice.xaiOpen && getState().voice.paused) {
          applyResume();
        }
        // Browser-side auto-prompt: when the server is configured to connect on
        // page load, acquire the mic immediately so the browser permission
        // prompt appears without a user gesture. Vanilla deferred this behind
        // the autoplay gate / play click, which left connectOnPageLoad +
        // topics/context start attempts flooding MICROPHONE_DEVICE_UNAVAILABLE
        // during the entire pre-gesture window. Fire once; if denied the user
        // can still retry via the play button (onPrimaryClick). The resulting
        // audio.device.state{ready:true} lets the controller's connectOnPageLoad
        // gate auto-start the conversation.
        if (action.data.connectOnPageLoad && !connectOnPageLoadPrompted) {
          const { audio, voice } = getState();
          if (!audio.ready && audio.permission !== "denied" && !voice.xaiOpen && !voice.sessionInFlight) {
            connectOnPageLoadPrompted = true;
            void getUserMedia();
          }
        }
        break;
      }
      // wait_for_context start/end are reduced into `ui.waitingForContext`
      // (drives the connection-indicator comet); the runner needs no audio cue.
      // Q18: barge-in. The raw xAI action is dispatched first by the WS
      // handler; this listener then enqueues voice/playback/cut, which the
      // queue drains after all raw-action listeners (incl. voice.event
      // forwarding) complete — daemon sees the cause before the effect.
      case "xai/input-audio-buffer/speech-started":
      case "xai/response/cancelled":
        dispatch({ type: "voice/playback/cut" });
        break;
      case "voice/playback/cut":
        // Idempotent: stop playback, cancel the drain timer, clear deferred.
        stopScheduledPlayback();
        if (drainCheckTimer !== undefined) {
          clearTimeout(drainCheckTimer);
          drainCheckTimer = undefined;
        }
        refs.deferredSends = [];
        break;
      case "voice/playback/drained": {
        // Q16: flush the private deferred sends now that playback is done.
        const ws = refs.xaiWs;
        if (ws && getState().voice.xaiOpen) {
          for (const event of refs.deferredSends) {
            try {
              ws.send(JSON.stringify(event));
            } catch (error) {
              dispatch({
                type: "browser/window/error",
                message: `xaiWs.send.deferred.failed: ${errStr(error)}`,
              });
            }
          }
        }
        refs.deferredSends = [];
        break;
      }
      default:
        break;
    }
  });

  return () => {
    unsubscribe();
    teardownVoice();
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

// RFC 6455 §4.1: Sec-WebSocket-Protocol values must be RFC 7230 token chars.
const SUBPROTOCOL_SAFE = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/;

function sanitizeSubprotocolToken(token: string, dispatch: RunnerDeps["dispatch"]): string {
  if (SUBPROTOCOL_SAFE.test(token)) return token;
  const unsafe = [...new Set(token.split("").filter((c) => !SUBPROTOCOL_SAFE.test(c)))].join("");
  dispatch({
    type: "browser/window/error",
    message: `voice.session.token.sanitized: unsafeChars=${unsafe}`,
  });
  return btoa(token).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Map a raw xAI server frame to its `xai/*` action(s). */
function dispatchXaiServerEvent(parsed: { type?: string; item_id?: unknown }, dispatch: RunnerDeps["dispatch"]): void {
  const type = parsed?.type;
  if (typeof type !== "string") {
    dispatch({ type: "xai/unknown", raw: parsed });
    return;
  }
  const itemId = typeof parsed.item_id === "string" ? parsed.item_id : "";
  switch (type) {
    case "session.created":
      dispatch({ type: "xai/session/created" });
      return;
    case "session.updated":
      dispatch({ type: "xai/session/updated" });
      return;
    case "conversation.created":
      dispatch({ type: "xai/conversation/created" });
      return;
    case "conversation.item.added": {
      // Vanilla cleared speakingItemId on conversation.item.added; the
      // reducer keys off this action.
      const rawItem = (parsed as { item?: { role?: unknown } }).item;
      const role = typeof rawItem?.role === "string" ? rawItem.role : "";
      dispatch({ type: "xai/conversation/item/added", itemId, role });
      return;
    }
    case "input_audio_buffer.speech_started":
      dispatch({ type: "xai/input-audio-buffer/speech-started", itemId });
      return;
    case "input_audio_buffer.speech_stopped":
      dispatch({ type: "xai/input-audio-buffer/speech-stopped" });
      return;
    case "input_audio_buffer.committed":
      dispatch({ type: "xai/input-audio-buffer/committed" });
      return;
    case "input_audio_buffer.cleared":
      dispatch({ type: "xai/input-audio-buffer/cleared" });
      return;
    case "response.created":
      dispatch({ type: "xai/response/created" });
      return;
    case "response.done":
      dispatch({ type: "xai/response/done" });
      return;
    case "response.cancelled":
      dispatch({ type: "xai/response/cancelled" });
      return;
    case "response.failed":
      dispatch({ type: "xai/response/failed" });
      return;
    case "response.output_audio.delta":
      // The actual b64 lives on the raw frame; the reducer ignores this
      // action's payload (playback is the runner's job). Pass through for
      // the wire-log/forwarding contract.
      dispatch({ type: "xai/response/output-audio/delta", b64: "" });
      return;
    case "response.output_audio.done":
      dispatch({ type: "xai/response/output-audio/done" });
      return;
    case "response.output_audio_transcript.delta":
      dispatch({
        type: "xai/response/output-audio-transcript/delta",
        delta: "",
      });
      return;
    case "response.output_audio_transcript.done":
      dispatch({ type: "xai/response/output-audio-transcript/done" });
      return;
    case "response.text.delta":
      dispatch({ type: "xai/response/text/delta", delta: "" });
      return;
    case "response.text.done":
      dispatch({ type: "xai/response/text/done" });
      return;
    case "error":
      dispatch({ type: "xai/error", code: "", message: "" });
      return;
    default:
      dispatch({ type: "xai/unknown", raw: parsed });
  }
}
