# voice

Realtime voice-agent tooling for Claude Code. The plugin ships two ways to drive a voice conversation:

- **`cli` skill** — the `voice` CLI (`bin/voice`) that spawns a detached daemon and is steered with shell commands.
- **`voice` MCP server** — an in-process server (`bin/voice-mcp-server.mjs`) exposing the same capabilities as MCP tools, configured in [`.mcp.json`](./.mcp.json).

## MCP server

Configured as a local **stdio** server in `.mcp.json`. Claude Code launches it automatically when the plugin is enabled; run `/mcp` to confirm `voice` appears. Tools are exposed as `mcp__plugin_voice_voice__<tool>`:

| Tool | Purpose |
|------|---------|
| `conversation` | Adjust a running conversation: `pause` / `resume` / `reset` / `status`. Start/end are automatic with the browser page (load → start, close → end). |
| `set` | Steer the live session with `topics` / `context` (and, rarely, the base `instructions`). |
| `inject` | Add a `user` / `assistant` / `system` message to the transcript. |
| `html` | Render a full-viewport HTML **file** as the stage behind the voice UI (path-only; no `path` clears it). |

Voice-conversation events are pushed to the agent over the `claude/channel` notification channel (the same stream as the CLI's `voice watch`).

### API key configuration

The xAI API key is resolved in order: the `XAI_API_KEY` environment variable, then the secrets file (`VOICE_SERVER_SECRETS_PATH`, default `~/.voice/secrets.json`, shape `{"XAI_API_KEY": "..."}`).

When **neither** is set, the server runs inert (no tools, no channel) and the web page shows a **key-entry form**: enter a key and it is validated against xAI, written to the secrets file (`0600`), and the server restarts to apply it — alongside instructions for setting the `XAI_API_KEY` env var instead. When the key was loaded from the secrets file, the voice UI's settings menu shows a **"Clear xAI API key"** button (with confirmation) that deletes it and restarts.

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `XAI_API_KEY` | Yes* | — | xAI API key for the realtime session. *Optional if a key is stored in the secrets file (see above); if neither is present the web page offers a key-entry form. |
| `VOICE` | No | enabled | Set to a falsy value (`0`, `no`, `off`, `false`) to **disable** the server entirely — it connects but exposes no tools, channel, or web page. Any other value (or unset) enables it. |
| `VOICE_SERVER_SECRETS_PATH` | No | `~/.voice/secrets.json` | Path to the JSON secrets file holding `{"XAI_API_KEY": "..."}`. |
| `VOICE_SERVER_HTTP_PORT` | No | `3000` | Port for the browser-facing web/UI + WebSocket server. |
| `VOICE_SERVER_LOG_PATH` | No | — | If set, append JSONL diagnostic records (events + errors, excluding `transcript.delta`) to this path. |
| `VOICE_SERVER_WATCH_TYPES` | No | `transcript.item conversation.error browser.audio.error` | Space-separated event names delivered as `claude/channel` notifications. |

`.mcp.json` forwards all of these from the environment that launches Claude Code, using `${VAR:-}` (empty-default) placeholders so an unset variable doesn't fail config parsing; unset ones fall back to the defaults above. Changing one requires reloading the plugin / restarting Claude Code so the server re-spawns with the new value.
