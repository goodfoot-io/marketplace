---
name: handbook
description: Troubleshooting and detailed usage for the voice MCP server — browser/audio problems, conversation lifecycle (pause/resume/reset), context management, intervening when the avatar is wrong, the full-viewport HTML stage, ending a session, and startup/channel failures. Load a reference below when a live voice conversation needs deeper handling than the start message covers, or when something is not working.
---

Detailed usage and troubleshooting for the voice MCP server. Match the situation to a reference under [When to load what](#when-to-load-what) and load that file.

## Orientation

The voice MCP tools may arrive deferred — load them by name with ToolSearch (`select:conversation,set,inject,html`) before calling:

- `conversation({ action })` — `pause | resume | reset | status`. Start/end are automatic (below).
- `set({ topics?, context?, personality?, instructions? })` — steer the live session. Use `topics`/`context`/`personality`; leave `instructions` unset (it's the startup persona).
- `inject({ role, message, source?, triggerResponse? })` — low-level transcript insert; prefer `set` for steering.
- `html({ path? })` — render an HTML file on disk as a full-viewport stage; call with no `path` to clear it.

Two facts shape everything below:

1. **The conversation's life is the page's life.** It starts when the user opens `http://localhost:<port>` (and the mic is ready) and ends when they close the page. You cannot start or end it — only `pause`/`resume`/`reset` a running one.
2. **You steer over one channel and observe over another.** Spoken turns and status arrive as channel events; you act with the tools. Don't narrate events back — the user already hears the voice.

`conversation({ action: "status" })` returns `server` and `conversation` lifecycle states plus a `browser` object (connection state and `audio` — mic permission, devices, readiness) and `realtimeConnected` / `responseInFlight`. It does **not** include the transcript — track that from `transcript.item` channel events as they arrive.

## Steering (referenced by the guides)

### §CONTEXT
`set({ context })` — background knowledge, facts, answers the avatar absorbs **silently**. Latest call replaces the prior `<context>` block.

### §TOPICS
`set({ topics })` — what the avatar should talk about next, in its own words. Latest call replaces the prior `<topics>` block. One to three sentences; describe subject matter, not a script.

### §PERSONALITY
`set({ personality })` — the avatar's tone, manner, and persona, i.e. *how* it speaks (distinct from *what* it says via topics, or *what it knows* via context). Latest call replaces the prior `<personality>` block; an empty string resets it to the default ("Speak naturally and directly. Match the user's vocal and conversational style."). The block is always present, defaulting until you set it.

### §RESET
Resetting is routine hygiene for a sustained conversation, not a last resort — reset on a topic change, on avatar drift/repetition, or when the transcript has grown long enough to drag. A bare reset drops continuity, so **always re-seed**, and clear the stage as part of it unless the visual still applies:

```
html({})                                  // clear the stage if one is up
conversation({ action: "reset" })         // atomic end + restart, no audible gap
set({ context: "<tight summary that carries forward>", topics: "<next direction>" })
```

Any `personality`/`context`/`topics`/`instructions` you set are **cleared when the session ends** (reset, reload, or close — `personality` resets to its default) — so re-seeding after a reset is mandatory, not optional. On each session end you'll receive an `agent.deactivate` event reporting what was cleared.

### §STAGE
`html(...)` is **visual-only** — the voice model never sees the staged HTML. Every time you stage something, in the same step describe it with `set({ context })` (and `set({ topics })` if it should steer). Full guidance: [reference/html-stage.md](reference/html-stage.md).

## When to load what

- Browser hasn't connected, or audio isn't ready → [reference/browser-audio.md](reference/browser-audio.md)
- Pausing, resuming, resetting, or understanding conversation state → [reference/conversation-lifecycle.md](reference/conversation-lifecycle.md)
- Conversation is long, the avatar seems confused, or context needs refreshing → [reference/context-management.md](reference/context-management.md)
- The avatar said something wrong, went off-track, or needs redirecting → [reference/intervention.md](reference/intervention.md)
- Rendering an HTML document full-viewport behind the voice UI → [reference/html-stage.md](reference/html-stage.md)
- The user signals they are done and the session should end → [reference/shutdown.md](reference/shutdown.md)
- The voice tools/channel never appear, the page won't load, or the server errors → [reference/startup-failure.md](reference/startup-failure.md)
