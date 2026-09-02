Use when the voice tools or channel never appear, the page won't load, or the server errors.

The server is launched by Claude Code from the plugin's `.mcp.json` as a stdio process; it reads its config from the environment.

## Diagnose

- Run `/mcp` — confirm the `voice` server is listed and connected. If the tools (`conversation`, `set`, `inject`, `html`) aren't available, load them with ToolSearch (`select:conversation,set,inject,html`); if they still aren't there, the server isn't running or is inert.
- Open `http://localhost:<port>` — what the page shows is the fastest signal. The "Voice is not configured" notice means no API key (below).
- `conversation({ action: "status" })` — `server` is `"stopped"` | `"starting"` | `"active"` | `"stopping"` | `"error"`.

## Subroutines

### §MISSING_API_KEY
**When:** the voice tools and channel are absent, or the page shows a "voice is not configured" key-entry form.
The key is resolved from `XAI_API_KEY`, then the secrets file (`VOICE_SERVER_SECRETS_PATH`, default `~/.voice/secrets.json`). With neither present the server starts **inert** (no tools, no channel) and the web page shows a **form**. Two ways forward:
- Tell the user to **enter their xAI key in the form** — it is validated against xAI, saved to the secrets file, and the server restarts to apply it (the page reloads into the voice UI; if it doesn't reconnect, reload the plugin).
- Or set `XAI_API_KEY` (in the `.mcp.json` env or their shell) and reload the plugin / restart the session.

To remove a key stored via the form, use the **"Clear xAI API key"** button in the voice UI's settings menu (shown only when the key came from the file); it deletes the key and restarts.

### §CHANNEL_NOT_LOADED
**When:** the page is open and the conversation works, but no `agent.activate` or other channel events ever arrive.
Channels are a research preview. They require Claude Code ≥ v2.1.80, and a non-allowlisted channel only loads when Claude Code is started with `--dangerously-load-development-channels server:voice`. Ask the user to relaunch with that flag (and to update Claude Code if older).

### §PORT_IN_USE
**When:** `http://localhost:<port>` won't load or another app answers on it.
The web server couldn't bind the port. Tell the user to set `VOICE_SERVER_HTTP_PORT` to a free port (default `3000`) and reload, or to free the conflicting process.

### §SERVER_ERROR
**When:** `conversation.error` events arrive, or `server` status is `"error"`.
Show the error details to the user. Common causes: API key rejected by xAI, an expired/invalid key, or xAI account limits. Apply §MISSING_API_KEY if the key looks wrong, otherwise ask the user to check their xAI account status, then reload.

## Events

### `conversation.error`
```typescript
{ conversationId?: string; error: VoiceAgentServerError; createdAt: string }
```

### `browser.audio.error`
```typescript
{ clientId?: string; error: VoiceAgentServerError; createdAt: string }
```

### `log` (only if added to `VOICE_SERVER_WATCH_TYPES`)
```typescript
{ level: "debug" | "info" | "warn" | "error"; code: string; message: string; details?: unknown; createdAt: string }
```
