# Wake Word Session Timeout & "Alexa" Re-activation

> **Feature summary** – After 30 s of user-silence the browser-side voice agent should automatically disconnect its `RealtimeSession`.  Once the session is closed, saying *"Alexa"* (detected locally with the OpenWakeWord **alexa_v0.1.onnx** model already shipped in `packages/autobio/public/models`) must immediately re-connect the agent and start streaming audio again.

---

## 1  Goals

1. Add an **inactivity-timer** (30 000 ms) to the voice agent that:
   • resets every time microphone audio is sent to OpenAI, **or** the assistant returns a text / audio event;
   • on expiry calls `session.disconnect()` / `session.dispose()` and sets an internal `state = "asleep"`.
2. Integrate **@openwakeword/openwakeword** in the browser bundle so that the **"Alexa"** model can be used to wake the agent when `state === "asleep"`.
3. Re-use the existing microphone pipeline; no new permissions prompts after first grant.
4. Provide minimal UI feedback (muted mic icon ==> wake-word icon, etc.) but keep UI work out-of-scope for this plan.

## 2  Non-Goals

* Server-side wake-word processing – must remain 100 % client-side.
* Adding support for multiple wake words or "Hey Focus" (doc sample) – only **Alexa** for now.
* Persistence across page reloads – a hard refresh restarts everything.

## 3  Key Constraints & Rules

* Must use **Yarn 4.5.0** workspaces; update *`packages/autobio`* `package.json` only.
* Follow the TypeScript conventions from **.cursor/rules/typescript.mdc** (functional style, no positional params, etc.).
* ESLint rules cannot be disabled.
* All `model`/server handler functions must accept a single destructured params object [[memory:405341]].

## 4  High-Level Architecture Changes

```mermaid
sequenceDiagram
    participant Mic as Microphone (48 kHz)
    participant Res as AudioWorklet Resampler
    participant OWW as WakeWordDetector (16 kHz)
    participant Ring as 0.8 s RingBuffer (24 kHz i16)
    participant Agent as RealtimeSession

    Mic->>Res: Audio frames
    Res->>OWW: 16 kHz f32 chunks
    Res->>Ring: 24 kHz i16 chunks (live + circular)
    Note over Agent: state = "awake"
    Res->>Agent: appendInputAudio()
    deactivate Res
    alt 30 s silence
        Agent-->>Agent: disconnect() & dispose()
        Note over Agent: state = "asleep"
    end
    alt Wake word "Alexa"
        OWW-->>Agent: onWake → reconnect()
        Ring-->>Agent: flush preroll
        Res-->>Agent: resume live streaming
        Note over Agent: state = "awake" (timer reset)
    end
```

## 5  Detailed Task List

### 5.1  Dependencies

1. **Add** `@openwakeword/openwakeword` and its peer dep `onnxruntime-web` to *`packages/autobio/package.json`*.
2. Run `yarn install` at repo root.

### 5.2  Shared Types

* Create `packages/autobio/src/app/agents/voice/types.ts` with:
  ```ts
  export interface VoiceSessionController {
    state: 'awake' | 'asleep';
    resetTimer(): void;
    dispose(): void; // manual teardown e.g. page unload
  }
  ```

### 5.3  AudioWorklet Augmentation (if required)

* The demo in `documentation/openwakeword-integration/instructions.md` already implements a dual-resampler worklet that simultaneously feeds OWW (16 kHz) and OpenAI (24 kHz).
* **Action** – copy this implementation as `dualResampler.worklet.ts` inside `packages/autobio/src/app/agents/voice/audio/`.
* **Gating CPU usage** – expose a boolean `AudioParam processingActive` on the processor.  When `0`, the 24 kHz branch (ring-buffer + OpenAI chunks) **must be skipped**, leaving only the cheap 16 kHz path for wake-word detection.  Default `0` (asleep); set to `1` once the agent wakes.
* **Build step** – add a rule in `packages/autobio/next.config.ts` to emit `*.worklet.ts` files as standalone ES modules (e.g., `type: 'asset/resource'`) or copy the compiled artifact to `/public/dual-resampler-processor.js`.

### 5.4  Wake-word Detector Wrapper

* Create `wakeWord.ts` in same folder exporting:
  ```ts
  export async function initWakeWordDetector(onWake: () => void) {...}
  ```
  – loads **alexa_v0.1.onnx** plus embedding & melSpectrogram models from `/models`.
* Provide `.processChunk(chunk16k: Float32Array)` that pipes data from worklet.

### 5.5  Session Controller (Timer Logic)

* New file `sessionController.ts`:
  ```ts
  export function createVoiceSessionController({ agent, ringBuffer, processingActiveParam }): VoiceSessionController {
    // Encapsulated mutable state kept inside closure per FP-style guidelines
    let current = {
      state: 'asleep' as const,
      session: null as RealtimeSession | null,
      inactivityId: null as ReturnType<typeof setTimeout> | null,
      backoffMs: 0, // exponential back-off after false positives
    };

    const resetTimer = () => {
      if (current.inactivityId) clearTimeout(current.inactivityId);
      current.inactivityId = setTimeout(async () => {
        if (current.session) {
          await current.session.disconnect();
          await current.session.dispose();
          current.session = null;
          current.state = 'asleep';
          processingActiveParam.value = 0; // disable 24 kHz path
        }
      }, 30_000);
    };

    const wake = async () => {
      if (current.state === 'awake') return;

      // optional pre-connect latency optimisation
      current.session = current.session ?? new RealtimeSession(agent, {/* config same as before */});
      if (current.session.state !== 'connected') {
        await current.session.connect();
      }
      // flush ring buffer as in integration sample
      current.state = 'awake';
      current.backoffMs = 0; // reset back-off after successful wake
      processingActiveParam.value = 1; // re-enable 24 kHz path
      resetTimer();
    };

    const handleFalsePositive = () => {
      current.backoffMs = current.backoffMs === 0 ? 5_000 : Math.min(current.backoffMs * 3, 60_000);
      setTimeout(() => detector.arm(), current.backoffMs);
    };

    return { state: () => current.state, resetTimer, dispose: /* ... */ };
  }
  ```
* `resetTimer()` will be called each time:
  - `liveChunk` is appended;
  - `session.on('audio'|'text')` yields an event.

### 5.6  Glue Code in Voice Agent Bootstrap

* In `packages/autobio/src/app/agents/voice/client.ts` (or new bootstrap file):
  1. Initialize `AudioContext` + worklet
  2. Initialize `WakeWordDetector` (`initWakeWordDetector(wake)`).
  3. Create `createVoiceSessionController()` passing the worklet's `processingActiveParam`.
  4. On wake-word detection → `controller.wake()`.
  5. Inside worklet `onmessage('liveChunk')` append to session **ONLY IF** `controller.state==='awake'`.
  6. Each successful `appendInputAudio()` or incoming assistant event → `controller.resetTimer()`.

### 5.7  UI Feedback (minimal)

* Emit `customEvent('voiceagentstatechange', { detail: { state }})` from controller so React components can swap icons / instruct the user to say *"Alexa"*.

### 5.8  Tests & Lint

1. **Unit** – mock timers: assert disconnect at 30 s; confirm `processingActive` toggles; exponential back-off increments.
2. **Integration (Playwright)** – simulate mic chunks to verify socket closes after 30 s silence, re-opens on wake-word, and CPU baseline differs between awake/asleep.
3. `yarn lint` & `yarn test packages/autobio/**/*.{test,spec}.ts`.

### 5.9  Documentation Updates

* Update `README.md` under *autobio* with new wake-word section.
* Ensure `public/models/` contains `alexa_v0.1.onnx`, `embedding_model.onnx`, `melspectrogram.onnx` (already present).

### 5.10  Deployment / Prod Notes

* Service workers / Next.js asset caching – set `Cache-Control: public, max-age=31536000, immutable` for `.onnx`.
* Consider iOS autoplay restrictions – might need user gesture to resume `AudioContext` after wake.

## 6  Rollback Strategy

This feature is purely client-side. If post-deploy issues arise, roll back by reverting the bundle (or ship a hot-fix that short-circuits the wake-word bootstrap). No runtime environment flag is required.

## 7  Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Wake-word false positives | Unwanted reconnections | Tune threshold (default 0.5) & review background noise in QA |
| Excessive CPU on low-end devices | Battery drain | WebGL→WASM fallback already provided; allow users to opt-out via settings |
| 30 s too short/long | UX frustration | Make timeout configurable via env `NEXT_PUBLIC_VOICE_INACTIVITY_MS` |
| Reconnect loop due to false positives | Battery drain & quota overage | Exponential back-off and threshold tuning; expose a user-visible toggle in UI settings |

---

**Estimated effort:** ~1.5 dev-days (including cross-browser testing). 