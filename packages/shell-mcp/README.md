# Shell MCP

`@goodfoot/shell-mcp` exposes one managed Bash service through five MCP tools: `exec_command`, `read_process`, `write_stdin`, `terminate_process`, and `list_processes`. Commands run as the Unix account that starts the server. This is direct shell access; only publish it to clients and machines you trust.

The server binds `127.0.0.1` and nowhere else, and it authenticates nobody: no credential, no `Host` check, no `Origin` check, no discovery route, no challenge, and no startup secret, because it has no external identity to advertise. Whoever can reach that port has the shell, so the boundary is whatever publishes the port — normally the operator's OpenAI Secure MCP Tunnel, where the tunnel and the operator's organization membership are the entire gate. The `start:openai` script below puts that tunnel in front of this server.

## Run

From the repository root:

```bash
yarn install
yarn workspace @goodfoot/shell-mcp run build
yarn workspace @goodfoot/shell-mcp run start --port=38147
```

`--help` lists every option. The process prints its loopback endpoint, its server instance, and the readiness file it owns.

## Secure MCP Tunnel

`start:openai` supervises two children as one unit: the built server on loopback, and `tunnel-client` holding the operator's tunnel identity.

```bash
yarn workspace @goodfoot/shell-mcp run start:openai
yarn workspace @goodfoot/shell-mcp run start:openai --port=38147 -- --workdir=/srv
```

The operator creates the tunnel in the OpenAI Platform, then supplies its id and a runtime key — `CONTROL_PLANE_TUNNEL_ID` and `CONTROL_PLANE_API_KEY`, or the explicit flags described by `start:openai --help`. `tunnel-client` must be on `PATH` or passed as `--tunnel-client=<path>`. The script reports ready only when three things hold: the server published its readiness claim, `tunnel-client`'s `/readyz` reads exactly `ready` — the client calls two further outcomes readiness-compatible when its startup MCP probe did not actually reach the server, and this script refuses those — and the client's metrics show a poll the control plane accepted, because control-plane connectivity is deliberately not part of the client's readiness, so a key the tunnel rejects otherwise looks healthy forever. Either child exiting on its own stops the run, and Ctrl+C retires the server before the tunnel. The connection is outbound-only: no public DNS record, no certificate, and no inbound port is needed.

## Connect from ChatGPT

1. Create a tunnel in the OpenAI Platform.
2. Mint a runtime key permitted to read, write, and use that tunnel.
3. Start `start:openai` with that tunnel id and key. It reports ready only after the three checks above, so a mistyped id or an under-permissioned key fails there instead of at the connector.
4. Attach the tunnel to a custom MCP connector by selecting it or pasting its id: the connector UI takes a tunnel id, not a URL. Underneath, the product targets `<control-plane base>/v1/mcp/<tunnel_id>`, which is the endpoint the script prints. There is no authorization step to complete: this server serves no discovery document and issues no challenge, so the connector does not enter an OAuth flow.

Restarting the server needs no re-link and no secret to transcribe. The tunnel identity is the whole connection, and re-connecting is the Platform's business rather than this package's.

## Tool workflow

Call `list_processes` first to obtain `server_instance_id`. Choose an `operation_id` before `exec_command`; retry that same ID and execution arguments after a lost reply. Every accepted start returns a `session_id`, including immediate exits and failed spawns. Read output with the returned opaque cursor. Cursors are non-destructive, so a retry replays retained data. Deduplicate input with a caller-chosen `write_id` and never assume that a timed-out write was unapplied.

Process lifetime is unlimited unless `timeout_ms` is set. Observation deadlines only bound the request. `terminate_process` requests TERM and then bounded KILL cleanup of the managed process group; inspect its cleanup state because sending a signal is not proof that cleanup completed. Daemonized or re-sessioned descendants can escape that scope.

## Development and validation

```bash
yarn workspace @goodfoot/shell-mcp run typecheck
yarn workspace @goodfoot/shell-mcp run lint
yarn workspace @goodfoot/shell-mcp run test
yarn workspace @goodfoot/shell-mcp run smoke:local
```

`dev` runs the same composition root under `tsx watch`. See [wiki/smoke-test.md](wiki/smoke-test.md) for the independent Inspector workflow. Long-duration, soak, tunnel-hop, hosted ChatGPT, PTY, and macOS checks are opt-in and must be reported as not run when their environment is unavailable.

Design rationale, recovery provenance, and the validation ledger live in [docs/architecture-decisions.md](docs/architecture-decisions.md), [docs/recovery-provenance.md](docs/recovery-provenance.md), and [docs/validation.md](docs/validation.md).
Primary-source revisions, FMEA coverage, and the registry-verified dependency closure are recorded in [docs/research.md](docs/research.md), [docs/fmea-traceability.md](docs/fmea-traceability.md), and [docs/dependencies.md](docs/dependencies.md).
