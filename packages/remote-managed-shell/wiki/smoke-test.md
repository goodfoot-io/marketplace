# Smoke test

The package's end-to-end check: a real MCP client, over real HTTP, against a
server started the way development starts it. Run it after any change to the
transport, the HTTP composition, or the tool surface.

It exists because the Vitest suite talks to the server in-process: it proves the
server answers the SDK client this package wrote, not that a third-party MCP
client can use it. The MCP Inspector CLI is that third party.

**Scope today: the `echo` skeleton.** The OAuth steps the specification requires
— the PKCE exchange, the bearer `--header` calls, and the `--stored-auth-only`
challenge probe that must fail with exit `3` — are marked *not yet applicable*
below and become steps here as soon as the authorization server lands.

## 1. Start it as a background task

Use the Bash tool's background mode (`run_in_background: true`) — not a
foreground command, and not `&` inside a foreground shell command, either of
which leaves the turn blocked on a process that never exits.

Start from a known state: nothing listening, and no earlier run's claim left on
disk. The readiness signal in step 2 is only meaningful if the file is written by
the instance you are about to start.

```bash
(ss -ltn || netstat -ltn) | grep 38147 || echo "port 38147 free"
rm -f /tmp/remote-managed-shell/ready.json
```

```
Bash(command: "yarn workspace @goodfoot/remote-managed-shell run dev --port=38147 --ready-file=/tmp/remote-managed-shell/ready.json",
     run_in_background: true)
```

`dev` runs `tsx watch`, so it restarts on every source change: the port stays the
same, the pid changes, and the readiness file is rewritten by the new instance.
That is convenient while editing and disruptive while testing — **do not edit a
source file during a smoke run**, because the restart drops the Inspector's
connection mid-call. The transition is clean either way: the outgoing instance
closes its listener before the incoming one binds, and both share one readiness
path without either deleting the other's claim.

### Watching a restart

A save is visible in two independent places, and it is worth knowing both before
relying on either:

- **The task output** — tsx prints `Restarting...` and sends `SIGTERM` to the
  outgoing process, then the incoming instance prints its startup line. On this
  machine a restart takes about two seconds; the port never changes.
- **The readiness file** — the incoming instance rewrites it with its own pid and
  a new `startedAt`, which is what step 2 waits for.

To exercise the reload deliberately, add a read-only tool to `src/server.ts`
beside `echo` (same shape: `title`, `description`, an input schema, an output
schema, and the three annotation hints), save the file, and repeat `tools/list`
from step 3 — the new tool appears with no manual restart. Keep the module
docstring in `src/server.ts` in agreement as you go: it names the tool surface,
so adding a tool makes that line stale.

## 2. Wait for readiness, then read the port

The server writes its readiness file **atomically** (temp file plus rename) once
the port is bound, so the file never exists in a half-written state. Because step
1 removed any earlier claim, its *existence* is a correct readiness signal here —
polling the port is not. Bound the wait anyway, and require the claim to be
*live*, so a server that died at startup fails the procedure instead of hanging
it:

```bash
READY=/tmp/remote-managed-shell/ready.json

pid_of() { node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).pid' "$READY" 2>/dev/null; }
ready() { [ -f "$READY" ] || return 1; local p; p=$(pid_of) || return 1; [ -n "$p" ] && kill -0 "$p" 2>/dev/null; }

for _ in $(seq 1 60); do ready && break; sleep 0.3; done
ready || { echo "FAILED: no live readiness claim after ~18s — read the dev task output for the startup error"; exit 1; }
cat "$READY"
```

The Bash tool starts a fresh shell for every call, so `READY` and these functions
do not survive into the next call — re-declare them, or inline the `node -p`
line.

Do not anchor freshness on the pid the path holds before the start: a restart, or
a `yarn`/`tsx` start that was already up before you looked, can make that pid the
live one, and a "must differ" rule then rejects a healthy server. The path starts
clean instead (step 1), and the liveness check rejects a claim left by a dead
process.

When this fails, the answer is in the background task's output, not in the file:
the server prints a startup error and exits `1` (a port already in use, for
example). Read that output before re-running.

```json
{
  "pid": 19934,
  "mode": "local",
  "host": "127.0.0.1",
  "port": 38147,
  "endpoint": "http://127.0.0.1:38147/mcp",
  "startedAt": "2026-09-16T07:09:23.634Z"
}
```

`--ready-file` is optional. Without it the server writes
`$TMPDIR/remote-managed-shell/ready-<port>.json`; with `--port=0` (an ephemeral
port chosen by the OS) the flag is required, since the file is the only way to
learn the port. The ephemeral name carries the port, so step 1 cannot pre-remove
it; a leftover claim from an earlier run is then rejected by the liveness check
rather than by the pre-clean.

## 3. Connect with the MCP Inspector CLI

One-time setup. The repository intentionally does not depend on the Inspector, so
install it into a throwaway project outside the repo:

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
```

The explicit `@modelcontextprotocol/sdk` looks redundant but is not:
`@modelcontextprotocol/ext-apps` (an Inspector dependency) imports it as a peer,
and neither `yarn dlx` (which resolves under PnP and refuses the ambiguous peer)
nor `npx` (which failed here with `ECOMPROMISED: Lock compromised`) gets past it.

The commands below carry the launcher's absolute path. The Bash tool resets shell
state between calls, so a `INSPECTOR=…` assignment does not survive into the next
call; re-declare it, or paste the full path:

```
/tmp/mcp-inspector/node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js
```

List the tools:

```bash
node /tmp/mcp-inspector/node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js \
  --cli --transport http --server-url http://127.0.0.1:38147/mcp \
  --method tools/list --format json
```

```json
{
  "result": {
    "tools": [
      {
        "name": "echo",
        "title": "Echo",
        "description": "Return the supplied text unchanged. …",
        "inputSchema": {
          "type": "object",
          "properties": { "text": { "type": "string", "description": "Text to return unchanged." } },
          "required": ["text"],
          "$schema": "https://json-schema.org/draft/2020-12/schema"
        },
        "outputSchema": {
          "type": "object",
          "properties": { "text": { "type": "string" } },
          "required": ["text"],
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false
        },
        "annotations": { "readOnlyHint": true, "idempotentHint": true, "openWorldHint": false }
      }
    ]
  }
}
```

Call it:

```bash
node /tmp/mcp-inspector/node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js \
  --cli --transport http --server-url http://127.0.0.1:38147/mcp \
  --method tools/call --tool-name echo \
  --tool-args-json '{"text":"hello from the MCP Inspector CLI"}' --format json
```

```json
{
  "result": {
    "content": [{ "type": "text", "text": "hello from the MCP Inspector CLI" }],
    "structuredContent": { "text": "hello from the MCP Inspector CLI" }
  }
}
```

Both exit `0`. The CLI's exit codes are: `0` success, `3` authentication
required, `4` server unreachable, `5` tool error, `6` schema-portability failure
— assert on the code as well as the JSON, so a connection failure cannot read as
a passing call.

Names the server does not know, and extra arguments the tool's schema does not
declare, are worth one probe each: an unknown tool name exits `5` with an error
envelope (not a transport failure), and undeclared call arguments are ignored
rather than rejected:

```json
{ "error": { "code": "tool_not_found", "message": "…" } }
```

## 4. Stop it and confirm it is gone

Stop the background task with `TaskStop` (or send the process `SIGTERM`). On an
orderly shutdown the server closes the listener, closes its connections, removes
the readiness file it owns, and exits `0`:

```bash
(ss -ltnp || netstat -ltnp) | grep 38147 || echo "port free"
pgrep -af 'src/main.ts' || echo "no stray server processes"
```

`TaskStop` kills the watcher, which can cut the server short before it unlinks
the file, so the directory may still hold `ready.json` afterwards. That is a
stale claim, not a running server — the port is free and no process outlived it.
The next start overwrites the path atomically; step 1 removes whatever is left
before it starts, so step 2 never has to tell a fresh claim from an old one.

## Not yet applicable

Until the authorization server exists, these required steps have nothing to run
against — record them as *not run*, never as passed:

- the `--stored-auth-only` probe that must fail with exit `3` and an
  `auth_required` envelope rather than `4` or `1`;
- the scripted PKCE exchange through `GET /authorize` with the startup secret
  and `POST /token`, with the resulting token kept in a shell variable and
  referenced by `--header "Authorization: Bearer $MCP_TOKEN"`;
- the same `initialize` / `tools/list` / `tools/call` calls repeated with that
  header, plus `read_process` and `list_processes` against the state the call
  returned.

When they do run: the startup secret, the authorization code, and the access
token must never be written to a file, a log, or an echoed command line, and
recorded evidence must be redacted. There is no test-only authentication path —
no bypass flag, no static token — to make a CLI call work.
