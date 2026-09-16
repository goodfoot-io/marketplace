# Smoke test

The smoke checks exercise the built server, its real loopback HTTP listener,
and an MCP v2 client. They are deliberately outside Vitest: the server is a
child process and all MCP traffic crosses HTTP.

Run the package checks from the package directory, the one that holds the
manifest these scripts belong to:

```bash
yarn run build
yarn run smoke:local
```

`smoke:local` starts `build/dist/src/main.js` with `--port=0` and a unique
readiness path. It waits for the atomically renamed readiness document and a
live pid, then connects `@modelcontextprotocol/client` v2 over real HTTP to the
endpoint the server reports — with no credential of any kind, because the
server it is testing authenticates nobody. The client lists all five tools,
starts `printf`, reads its output, recovers it with `list_processes`, and closes
the server in a `finally` path. The readiness file is removed after an orderly
stop.

The expected successful output is a status line such as:

```text
PASS: local MCP smoke against http://127.0.0.1:38147/mcp (5 tools, exited)
```

## Independent MCP Inspector CLI

The Inspector check is opt-in because the repository intentionally does not
depend on the Inspector. Install the pinned version once in a throwaway
directory outside the repository. The companion SDK dependency avoids the
ambiguous peer dependency used by Inspector's app packages.

```bash
mkdir -p /tmp/mcp-inspector
```

`/tmp/mcp-inspector/package.json`:

```json
{
  "name": "mcp-inspector-tool",
  "private": true,
  "packageManager": "yarn@4.12.0",
  "dependencies": {
    "@modelcontextprotocol/inspector": "2.6.0",
    "@modelcontextprotocol/sdk": "^1.29.0"
  }
}
```

`/tmp/mcp-inspector/.yarnrc.yml`:

```yaml
nodeLinker: node-modules
```

```bash
cd /tmp/mcp-inspector && yarn install
export MCP_INSPECTOR=/tmp/mcp-inspector/node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js
cd /path/to/shell-mcp
yarn run smoke:mcp-cli
```

When `MCP_INSPECTOR` is missing or unreadable, `smoke:mcp-cli` reports
`NOT RUN` and exits successfully. That is the only skip condition. With the
launcher available, it starts the real `dev` server on fixed port `38147`, waits
for its atomic readiness claim, and runs the following gates in memory:

1. An `initialize` that presents no credential must exit `0`. This is the
   boundary the package now intends, asserted directly.
2. `tools/list` must exit `0` and contain `exec_command`, `read_process`,
   `write_stdin`, `terminate_process`, and `list_processes`.
3. `tools/call` requests start `exec_command`, read its output through
   `read_process`, and recover the session through `list_processes`.
4. The child watcher is stopped and its process group is confirmed gone.

The Inspector is never given an `--header` argument, and the script never echoes
command arguments or child output. A failed check reports only the gate and exit
code. The pinned version is `2.6.0`; a mutable `latest` install is not
equivalent evidence.

For a manual run against an already running development server, obtain the port
from the readiness file. The Inspector calls have this shape:

```bash
node "$MCP_INSPECTOR" --cli --transport http \
  --server-url http://127.0.0.1:38147/mcp --method initialize \
  --connect-timeout 5000 --format json

node "$MCP_INSPECTOR" --cli --transport http \
  --server-url http://127.0.0.1:38147/mcp --method tools/list --format json
```

Use exit codes as evidence: `0` is success, `4` unreachable, and `5` a tool
error. A transport failure must never be recorded as a passed tool call.

## Tunnel endpoint check

Nothing in this package creates, probes, or reimplements a tunnel. `start:openai`
(README: Secure MCP Tunnel) supervises the operator's `tunnel-client` alongside
the server, and reports ready only after three gates: the server's readiness
claim, `/readyz` on the client reading exactly `ready`, and a control-plane poll
the client's metrics record as accepted. The second gate is stricter than the
client's own verdict, which also calls a probe that never reached the server
readiness-compatible; the third exists because control-plane connectivity is
deliberately not part of that client's readiness.

The hop a client actually crosses — the tunnel's own MCP endpoint — cannot be
exercised without an OpenAI organization and a configured tunnel, so it stays an
explicit external verification boundary: this package's evidence stops at the
loopback endpoint it serves. Record it as not run rather than inferring it from
a healthy `tunnel-client` process.

## Lifecycle and cleanup

Readiness is the machine-readable file, not a startup log line. A valid claim
has `stage: "ready"`, a live `pid`, and an `/mcp` endpoint. The local smoke uses
an ephemeral port; the Inspector procedure uses `38147`. Do not edit source
while the watched `dev` server is running because `tsx watch` intentionally
replaces the process and drops the connection.

Every scripted check stops its own child in a `finally` path. On a normal stop,
the listener closes, managed work is asked to terminate, and the server removes
the readiness claim it owns. If a forced task stop leaves a file behind, check
that its pid is dead before removing the stale claim; never remove a file that
names a live replacement instance.
