# Remote managed shell

`@goodfoot/remote-managed-shell` exposes one managed Bash service through five authenticated MCP tools: `exec_command`, `read_process`, `write_stdin`, `terminate_process`, and `list_processes`. Commands run as the Unix account that starts the server. This is direct shell access; only publish it to clients and machines you trust.

The server always binds `127.0.0.1`. Local mode is useful for development. Public mode advertises an operator-owned HTTPS URL, but never creates or supervises a tunnel or proxy.

## Run

From the repository root:

```bash
yarn install
yarn workspace @goodfoot/remote-managed-shell run build
yarn workspace @goodfoot/remote-managed-shell run start:local --port=38147
yarn workspace @goodfoot/remote-managed-shell run start --url=https://shell.example.net --port=38147
```

The process prints a fresh startup secret and authorization URL once. The secret exists only in memory and terminal output. It is absent from the readiness file, health route, logs, environment, and tool results. Restarting creates a new server instance and invalidates the secret, authorization codes, and tokens.

## Connect from ChatGPT

1. Publish the loopback port with an operator-managed HTTPS route and start public mode with that exact base URL.
2. Configure a custom MCP connector whose URL is `<public-url>/mcp` and authentication is OAuth.
3. When ChatGPT opens the authorization page, enter the startup secret printed by this server.
4. Approve the link. The server validates ChatGPT's Client ID Metadata Document, redirect URI, S256 PKCE challenge, and resource audience before issuing an instance-bound code.
5. If the server restarts, reconnect the account. Old tokens receive a fresh `401` OAuth challenge rather than a process/tool error.

The authorization server supports public clients, authorization-code plus S256 PKCE, and refresh tokens. It has no dynamic registration endpoint, user database, persistent credentials, static bearer bypass, or client secret.

## Tool workflow

Call `list_processes` first to obtain `server_instance_id`. Choose an `operation_id` before `exec_command`; retry that same ID and execution arguments after a lost reply. Every accepted start returns a `session_id`, including immediate exits and failed spawns. Read output with the returned opaque cursor. Cursors are non-destructive, so a retry replays retained data. Deduplicate input with a caller-chosen `write_id` and never assume that a timed-out write was unapplied.

Process lifetime is unlimited unless `timeout_ms` is set. Observation deadlines only bound the request. `terminate_process` requests TERM and then bounded KILL cleanup of the managed process group; inspect its cleanup state because sending a signal is not proof that cleanup completed. Daemonized or re-sessioned descendants can escape that scope.

## Development and validation

```bash
yarn workspace @goodfoot/remote-managed-shell run typecheck
yarn workspace @goodfoot/remote-managed-shell run lint
yarn workspace @goodfoot/remote-managed-shell run test
yarn workspace @goodfoot/remote-managed-shell run smoke:local
```

`dev` runs the same composition root under `tsx watch`. See [wiki/smoke-test.md](wiki/smoke-test.md) for the independent Inspector workflow and credential-handling rules. Long-duration, soak, public-route, hosted ChatGPT, PTY, and macOS checks are opt-in and must be reported as not run when their environment is unavailable.

Design rationale, recovery provenance, and the validation ledger live in [docs/architecture-decisions.md](docs/architecture-decisions.md), [docs/recovery-provenance.md](docs/recovery-provenance.md), and [docs/validation.md](docs/validation.md).
Primary-source revisions, FMEA coverage, and the registry-verified dependency closure are recorded in [docs/research.md](docs/research.md), [docs/fmea-traceability.md](docs/fmea-traceability.md), and [docs/dependencies.md](docs/dependencies.md).
