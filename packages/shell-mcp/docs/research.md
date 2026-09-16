# Primary-source research

Reviewed 2026-09-16. Source observations are separated here from the decisions in `architecture-decisions.md`.

## OpenAI Codex

Revision `50d77959bf927293c4b5ddcca81d05331ae582ea` from `openai/codex` was the inspected `main` head. The current unified-exec handler keeps a process manager outside individual tool calls, returns a resumable process identity, and separates initial yield from later input/observation. The exec-server protocol exposes start, buffered read with a byte budget and wait, raw input, and termination as distinct operations. These are observations, not a claim that every Codex transport has identical disconnect behavior.

- https://github.com/openai/codex/blob/50d77959bf927293c4b5ddcca81d05331ae582ea/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs
- https://github.com/openai/codex/blob/50d77959bf927293c4b5ddcca81d05331ae582ea/codex-rs/exec-server/README.md

## localmcpcoder

Revision `6d8c0f939d93bfdf903ba31e50fc7460327e2433` was the inspected head. It demonstrates a loopback Streamable HTTP MCP server, finite tool responses, OAuth discovery, and a console consent secret. Its tunnel lifecycle, persistent `.env` passphrase, dynamic registration, direct bearer compatibility, broad tool suite, and execution engine are deliberately not adopted; of the OAuth surface, only the loopback Streamable HTTP server and finite tool responses survive the adoption of the Secure MCP Tunnel.

- https://github.com/JuanseGZZ/localmcpcoder/tree/6d8c0f939d93bfdf903ba31e50fc7460327e2433

## MCP transport

The installed `@modelcontextprotocol/server@2.0.0` source was treated as authoritative for integration details. `createMcpHandler` supports finite JSON through `responseMode: "json"`. Its stateless legacy path answers a GET on the MCP route with `405`, which this package replaces with an empty `text/event-stream` response for the reason recorded at `sseKeepaliveResponse()` in `src/serve.ts`.

The package implements no part of the MCP authorization profile: no protected-resource metadata, no `WWW-Authenticate` challenge, no Client ID Metadata Documents, and no security scheme on any tool. The profile was read and deliberately not implemented — see `rejected-approaches` in the change that removed it, and `architecture-decisions.md` for the boundary that replaced it.

## OpenAI Secure MCP Tunnel

The 2026-09 evaluation behind this change read the public Secure MCP Tunnel guide and the `openai/tunnel-client` source at commit `3917788`. Its `docs/security/` holds only release-artifact scan boundaries; there is no threat model, no rate-limit statement, and no revocation story.

The finding the package turns on is that the tunnel is a transport, not an authenticator:

| Question | Finding |
| --- | --- |
| Does anything authenticate a caller to `/v1/mcp/{tunnel_id}`? | No first-party source states it does; the path is never named in the public guide. |
| What arrives at the MCP server per request? | A polled command carrying only `request_id`, `shard_token`, `command_type`, `channel`, `created_at`, `headers`, and `response_timeout` — **no caller identity field** (`pkg/controlplane/wiretypes/wire.go:91-110`). |
| Is there an authorization layer above the daemon? | tunnel-client strips `x-openai-authorization` and `x-openai-actor-authorization`, implying one; nothing documents what it verifies against. |
| Does the daemon's credential reach the server? | No: `CONTROL_PLANE_API_KEY` authenticates tunnel-client to OpenAI for poll, response, and metadata calls and is never forwarded to the MCP server. |
| Can auth artifacts stay local? | "Strict-local-auth is not supported by Tunnel." |

The five auth modes the tunnel does offer all attach identity to the *connector* or to the *daemon*, never to the person invoking a tool, and the ChatGPT connector model holds one authorization per connector and reuses it for every user. A static header is worse than neutral: tunnel-client injects env- or file-backed `MCP_EXTRA_HEADERS` on every outbound request to the configured MCP origin, so it authenticates the hop rather than the caller. Per-caller authorization is therefore impossible from tunnel metadata, which is why this package makes no authorization decision at all.

- https://github.com/openai/tunnel-client

### Client health and control-plane surface

`start:openai` gates on the client's own surfaces, so those surfaces were read at the same commit. The client's readiness verdict is deliberately looser than a supervisor can accept:

| Question | Finding |
| --- | --- |
| Is a bare `--mcp.server-url` valid? | Yes. `isQualifiedMCPEntry` (`pkg/runtimeconfig/config.go:2293`) treats a URL with no `channel=` qualifier as unqualified, so `NormalizeChannel("")` (`pkg/types/channel.go:19`) returns `DefaultChannel = "main"` (`pkg/types/channel.go:12`). The "main channel is required" error (`pkg/runtimeconfig/config.go:1311-1313`) fires only when entries exist and none of them is main. |
| What does `/readyz` report when all is well? | Exactly `ready`, and only when no gate, discovery, or startup probe is still pending (`readinessStatus`, `pkg/runtimehealth/health.go:385-424`). |
| When is a *failed* probe still reported ready? | Two 200s: `ready (mcp initialize requires auth: …)` when the probe's `initialize` drew HTTP 401, and `ready (mcp startup probe timed out: …)`, which the client treats as readiness-compatible. Each one means the one-shot startup probe never confirmed the configured server, and the client never repeats it. |
| Is control-plane connectivity part of readiness? | No. Poll and delivery health are registered as status components (`pkg/controlplane/fx/fxmodule.go:32-33`), while `/readyz` consults only the gates and probe state (`pkg/runtimehealth/health.go:152`). A runtime key the tunnel rejects therefore leaves `/readyz` green indefinitely. |
| What locally proves a poll succeeded? | Only the client's own gauge `commands_poll_last_successful_timestamp_seconds` (`pkg/controlplane/internal/metrics.go:34`): an observable gauge (`:116`, `:141`) over an atomic stored when a poll cycle is accepted (`pkg/controlplane/internal/poller.go:216`), served at `/metrics` on the same loopback admin mux (`pkg/runtimehealth/health.go:153`). |
| What does `--health.url-file` contain? | The health base URL alone, written atomically as soon as the listener binds (`pkg/runtimehealth/health.go:189-216`, `:240`) — before readiness, and with no trailing newline. |
| Must the runtime key be a reference? | Yes: `--control-plane.api-key` is documented as `env:VARNAME` or `file:/path` (`pkg/runtimeconfig/config.go:528`), and any other value is refused as "value must be prefixed with …" (`:1817`). A literal key on the command line is never accepted. |

The launcher therefore accepts the exact body `ready` and additionally requires a poll the metrics record, because neither gate exists in the client: a probe that never reached the server is still called readiness-compatible, and a rejected key is not a readiness failure at all.

- https://github.com/openai/tunnel-client/blob/3917788/pkg/runtimehealth/health.go

## Target client and deployment

OpenAI's API documentation represents a remote MCP server as a server URL. The operator creates the tunnel in the OpenAI Platform, supplies its id and a runtime key to `tunnel-client`, and configures a custom connector for the tunnel's MCP endpoint. The connector UI takes Tunnel mode plus a selected or pasted tunnel id rather than a URL; underneath, the product targets `<control-plane base>/v1/mcp/<tunnel_id>`. This process binds loopback and knows nothing about any of it: it advertises no URL, and the only thing that reaches it is whatever the tunnel forwards.

- https://platform.openai.com/docs/guides/tools-remote-mcp

Package and protocol versions used by the delivery are recorded in `dependencies.md` and `validation.md`; mutable documentation pages are not treated as release pins.
