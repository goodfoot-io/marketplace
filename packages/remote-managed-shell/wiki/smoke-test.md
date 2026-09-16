# Smoke test

The smoke checks exercise the built server, its real loopback HTTP listener,
OAuth 2.1 authorization-code flow, and an MCP v2 client. They are deliberately
outside Vitest: the server is a child process and all MCP traffic crosses HTTP.

Run the package checks from the package directory or use the equivalent scoped
Yarn command from `/workspace`:

```bash
yarn workspace @goodfoot/remote-managed-shell run build
yarn workspace @goodfoot/remote-managed-shell run smoke:local
```

`smoke:local` starts `build/dist/src/main.js` with `--port=0` and a unique
readiness path. It waits for the atomically renamed readiness document and a
live pid, captures the startup secret from the child console in memory, and
never prints the captured output. It serves a temporary loopback Client ID
Metadata Document and callback, first checks that a wrong secret is refused,
then completes S256 PKCE with the real secret. The resulting bearer token is
kept in memory while `@modelcontextprotocol/client` v2 connects over real HTTP.
The client lists all five tools, starts `printf`, reads its output, recovers it
with `list_processes`, and closes the server in a `finally` path. The readiness
file contains no secret, code, or token and is removed after an orderly stop.

The expected successful output is a redacted status line such as:

```text
PASS: local OAuth S256 and MCP v2 smoke (5 tools, exited)
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
cd /workspace
yarn workspace @goodfoot/remote-managed-shell run smoke:mcp-cli
```

When `MCP_INSPECTOR` is missing or unreadable, `smoke:mcp-cli` reports
`NOT RUN` and exits successfully. That is the only skip condition. With the
launcher available, it starts the real `dev` server in local mode on fixed
port `38147`, waits for its atomic readiness claim, and performs the same
loopback PKCE exchange as `smoke:local`. It then runs the following gates in
memory:

1. An unauthenticated `initialize` with `--stored-auth-only` must exit `3` and
   return an authentication-required envelope.
2. Authenticated `initialize` and `tools/list` must exit `0`; `tools/list` must
   contain `exec_command`, `read_process`, `write_stdin`, `terminate_process`,
   and `list_processes`.
3. Authenticated `tools/call` requests start `exec_command`, read its output
   through `read_process`, and recover the session through `list_processes`.
4. The child watcher is stopped and its process group is confirmed gone.

The Inspector receives the bearer value through its `--header` argument, but
the script never echoes command arguments, child output, authorization codes,
startup secrets, or tokens. A failed check reports only the gate and exit code,
not captured JSON that could contain credentials. The pinned version is
`2.6.0`; a mutable `latest` install is not equivalent evidence.

For a manual run against an already running development server, preserve the
same rules: obtain the port from the readiness file, keep the token in a shell
variable, and do not paste or echo the command containing its value. The
Inspector calls have this shape:

```bash
node "$MCP_INSPECTOR" --cli --transport http \
  --server-url http://127.0.0.1:38147/mcp --method initialize \
  --stored-auth-only --connect-timeout 5000 --format json

node "$MCP_INSPECTOR" --cli --transport http \
  --server-url http://127.0.0.1:38147/mcp --method tools/list \
  --header "Authorization: Bearer $MCP_TOKEN" --format json
```

Use exit codes as evidence: `0` is success, `3` authentication required, `4`
unreachable, and `5` a tool error. A transport failure must never be recorded
as a passed tool call.

## Public endpoint check

Public mode only advertises an operator-managed HTTPS route; the server neither
launches nor probes a tunnel. `start:tunnel` (README: Instant Tunnel) does both
for a quick `*.trycloudflare.com` route. If an operator has a reachable route
and a short-lived OAuth token, run:

```bash
REMOTE_MANAGED_SHELL_PUBLIC_URL=https://shell.example.net \
REMOTE_MANAGED_SHELL_PUBLIC_TOKEN="$MCP_TOKEN" \
yarn workspace @goodfoot/remote-managed-shell run smoke:public
```

`smoke:public` uses the v2 Streamable HTTP client and bearer authentication to
initialize and list all five tools. If either explicit environment variable is
absent, it reports `NOT RUN` and exits successfully. It never invents a public
URL, creates a tunnel, or prints the token.

## Lifecycle and cleanup

Readiness is the machine-readable file, not a startup log line. A valid claim
has `stage: "ready"`, a live `pid`, `mode: "local"`, and an `/mcp` endpoint.
The local smoke uses an ephemeral port; the Inspector procedure uses
`38147`. Do not edit source while the watched `dev` server is running because
`tsx watch` intentionally replaces the process and drops the connection.

Every scripted check stops its own child in a `finally` path. On a normal stop,
the listener closes, managed work is asked to terminate, and the server removes
the readiness claim it owns. If a forced task stop leaves a file behind, check
that its pid is dead before removing the stale claim; never remove a file that
names a live replacement instance.
