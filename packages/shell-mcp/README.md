# Shell MCP

`@goodfoot/shell-mcp` exposes one managed Bash service through five MCP tools: `exec_command`, `read_process`, `write_stdin`, `terminate_process`, and `list_processes`. Commands run as the Unix account that starts the server. This is direct shell access; only publish it to clients and machines you trust.

The server binds `127.0.0.1` and nowhere else, and it authenticates nobody: no credential, no `Host` check, no `Origin` check, no discovery route, no challenge, and no startup secret, because it has no external identity to advertise. Whoever can reach that port has the shell, so the boundary is whatever publishes the port — normally the operator's OpenAI Secure MCP Tunnel, where the tunnel and the operator's organization membership are the entire gate. `npx @goodfoot/shell-mcp openai` — or the `start:openai` script in a checkout — puts that tunnel in front of this server.

## Run

The published package is the whole server, so running it needs no checkout and no build step — Node 22 or newer is the only prerequisite:

```bash
npx @goodfoot/shell-mcp                    # loopback server on the default port, authenticating nobody
npx @goodfoot/shell-mcp --port=38147
npx @goodfoot/shell-mcp --help             # every option, including the openai subcommand below
```

`yarn dlx @goodfoot/shell-mcp` runs the same thing for Yarn users. From a checkout, the same composition root runs as:

```bash
yarn install
yarn run build
yarn run start --port=38147
```

The console shows a short ready message and a shell-access warning. The machine-readable readiness file, not a log line, tells a supervisor the server is up; it contains the full server instance and endpoint. Set `--ready-file=<path>` to choose its location.

## Console and diagnostic logging

The console follows a Bash session rather than a log-record format:

```text
shell-mcp ready on 127.0.0.1:38147
Warning: anyone reaching this endpoint has full shell access.

/workspace $ ./ask-name.sh
Name: John
Hello, John
Warning: using the default profile
/workspace $
```

Commands have a working-directory prompt. Stdout and stderr appear without labels,
numbers, timestamps, or success footers; partial output is displayed immediately,
so a prompt without a newline remains beside its answer. A failed command shows
`[exit 1]`, a signal, or `[timed out]` instead of a successful-looking prompt.
The next idle prompt appears only after the command has exited **and** its output
streams have closed. Redirected console output omits empty idle prompts.

Overlapping commands remain concurrent. A subdued divider with the command label
(or command text) and directory identifies changes of output source; ordinary
single-command output has no dividers. Prompt colors and application SGR colors
are enabled only on a terminal, unless `NO_COLOR` is set or `TERM=dumb`.
Screen-clearing, cursor-moving, clipboard, and other escape commands from child
output are filtered from the local display. The original MCP output and transcript
are not changed by presentation or color filtering.

Pipe-mode stdin is echoed when submitted for delivery, not as proof that the
program consumed it. PTY mode relies entirely on the terminal's own echo, which
avoids duplicate input and respects hidden-input settings. Pipe mode has no
terminal echo setting: **submitted pipe input is visible**, including secrets.
A failed or indeterminate handoff gets a concise console warning. Echoing input
does not change its delivery or the deduplication of retried writes.

This is an observer's display, not a locally interactive or persistent shell.
Each `exec_command` still starts a fresh Bash context; directory or environment
changes inside one command are not carried into the next. The directory in the
prompt is the command's configured starting directory.

To keep diagnostic detail outside the console:

```bash
SHELL_MCP_LOG=/tmp/shell-mcp.jsonl yarn workspace @goodfoot/shell-mcp run start
# The same setting applies to the supervised tunnel launcher:
SHELL_MCP_LOG=/tmp/shell-mcp.jsonl yarn workspace @goodfoot/shell-mcp run start:openai
```

`SHELL_MCP_LOG` is a file path. Unset or empty disables diagnostic file logging;
relative paths resolve from the launch directory, before the tunnel launcher
changes its child's working directory. The file is append-only, with one JSON
record per line, and new files have owner-only permissions (`0600`). Its parent
directory must already exist; an unusable path, symlink, or non-regular destination
fails startup before the server listens.

Records contain an ISO timestamp, level, logger, event, and available full server,
session, operation, and write identities. Process diagnostics contain byte counts
and lifecycle/delivery information, **not command, stdin, or stdout/stderr bodies**.
Server and SDK diagnostics, startup details, and tunnel-client messages go here as
well. Treat the file as sensitive: third-party diagnostics and error messages can
contain sensitive information even though process payloads are not duplicated.
The file is not a complete or durable shell transcript, and it is not automatically
rotated; manage its retention externally.

The console and optional file each have an isolated writer and a bounded queue.
A blocked destination cannot stall command execution or the other writer. Queue
overflow is counted in logger health and reported when the destination can write
again; a failed file writer produces an actionable console warning. The supervisor
relays its diagnostics through bounded, acknowledged IPC to the server, so each
supervised run has one diagnostic-file writer rather than competing appenders.

## Secure MCP Tunnel

`openai` — the package's one subcommand — supervises two children as one unit: the built server on loopback, and `tunnel-client` holding the operator's tunnel identity. The `start:openai` script runs the same launcher from a checkout.

```bash
npx @goodfoot/shell-mcp openai
npx @goodfoot/shell-mcp openai --port=38147 -- --workdir=/srv
yarn run start:openai
yarn run start:openai --port=38147 -- --workdir=/srv
```

`tunnel-client` is not bundled with the package: put it on `PATH` or name it with `--tunnel-client=<path>`. The operator creates the tunnel in the OpenAI Platform, then supplies its id and a runtime key — `CONTROL_PLANE_TUNNEL_ID` and `CONTROL_PLANE_API_KEY`, or the explicit flags described by `openai --help`. The run reports ready only when three things hold: the server published its readiness claim, `tunnel-client`'s `/readyz` reads exactly `ready` — the client calls two further outcomes readiness-compatible when its startup MCP probe did not actually reach the server, and this launcher refuses those — and the client's metrics show a poll the control plane accepted, because control-plane connectivity is deliberately not part of the client's readiness, so a key the tunnel rejects otherwise looks healthy forever. Either child exiting on its own stops the run, and Ctrl+C retires the server before the tunnel. The connection is outbound-only: no public DNS record, no certificate, and no inbound port is needed.

## Connect from ChatGPT

1. Create a tunnel in the OpenAI Platform.
2. Mint a runtime key permitted to read, write, and use that tunnel.
3. Start `openai` — `npx @goodfoot/shell-mcp openai`, or `start:openai` from a checkout — with that tunnel id and key. It reports ready only after the three checks above, so a mistyped id or an under-permissioned key fails there instead of at the connector.
4. Attach the tunnel to a custom MCP connector by selecting it or pasting its id: the connector UI takes a tunnel id, not a URL. Underneath, the product targets `<control-plane base>/v1/mcp/<tunnel_id>`, which is recorded in the optional diagnostic log; the console shows the tunnel id. There is no authorization step to complete: this server serves no discovery document and issues no challenge, so the connector does not enter an OAuth flow.

Restarting the server needs no re-link and no secret to transcribe. The tunnel identity is the whole connection, and re-connecting is the Platform's business rather than this package's.

## Tool workflow

Call `list_processes` first to obtain `server_instance_id`. Choose an `operation_id` before `exec_command`; retry that same ID and execution arguments after a lost reply. Every accepted start returns a `session_id`, including immediate exits and failed spawns. Read output with the returned opaque cursor. Cursors are non-destructive, so a retry replays retained data. Deduplicate input with a caller-chosen `write_id` and never assume that a timed-out write was unapplied.

Process lifetime is unlimited unless `timeout_ms` is set. Observation deadlines only bound the request. `terminate_process` requests TERM and then bounded KILL cleanup of the managed process group; inspect its cleanup state because sending a signal is not proof that cleanup completed. Daemonized or re-sessioned descendants can escape that scope.

## Development and validation

```bash
yarn run typecheck
yarn run lint
yarn run test
yarn run smoke:local
```

`dev` runs the same composition root under `tsx watch`. See [wiki/smoke-test.md](wiki/smoke-test.md) for the independent Inspector workflow. Long-duration, soak, tunnel-hop, hosted ChatGPT, PTY, and macOS checks are opt-in and must be reported as not run when their environment is unavailable.

Packaging: `yarn pack` runs `prepack`, which wipes `build/` before rebuilding so the archive can never carry output that a deleted source file left behind, and writes the tarball the registry would receive. Verify it the way a consumer meets it — `npx <tarball> --help` for the server, `npx <tarball> openai --help` for the tunnel — then `yarn npm publish` (`publishConfig.access` is `public`, so the scoped package publishes openly).

Design rationale and the validation ledger live in [docs/architecture-decisions.md](docs/architecture-decisions.md) and [docs/validation.md](docs/validation.md); the registry-verified dependency closure is recorded in [docs/dependencies.md](docs/dependencies.md).
