# shell-mcp

Remote managed Bash MCP server over Streamable HTTP — a Yarn 4 workspace member
at `/workspace`. It exposes exactly five tools through one
server-instance-scoped process manager: `exec_command`, `read_process`,
`write_stdin`, `terminate_process`, and `list_processes`.

**Run it and drive it with a third-party MCP client: [wiki/smoke-test.md](./wiki/smoke-test.md).**

## Unusual configuration

- **It authenticates nobody, on purpose.** The server binds loopback and serves
  whoever reaches it: no credential, no `Host` check, no `Origin` check, no
  discovery route, no challenge, no startup secret. Reaching the port is the
  OpenAI Secure MCP Tunnel's job, together with the operator's organization
  membership; deciding who may call is not this package's job, and it is
  infrastructure rather than a gatekeeper. The deliberate consequence is that
  nothing local stands between a caller and the shell — a web page the operator
  visits can reach the loopback port through DNS rebinding. That is accepted for
  a sandboxed, single-user environment, and a `Host` the design did not
  anticipate can no longer break the tunnel hop.
- **`dev` restarts on source change.** It runs `tsx watch`, so saving a source
  file stops the server and starts it again on the same port, rewriting the
  readiness file with the new pid. A smoke run in progress loses its connection
  if you edit a source file while it runs.
- **Readiness is the file, not the log.** It is written atomically (temp file
  plus rename), so it is never half-read. A file left behind by a killed process
  is a stale claim — check its `pid` and `serverInstanceId`; the next start
  overwrites it, and an old instance never unlinks its replacement's claim.
- **Observation does not own execution.** Request cancellation, transport
  disposal, cursor reads, and yield expiry do not terminate accepted commands.
  Reuse caller-chosen operation and write IDs when recovering a lost response.
