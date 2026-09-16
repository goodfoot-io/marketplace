# remote-managed-shell

Remote managed Bash MCP server over Streamable HTTP — a Yarn 4 workspace member
at `/workspace`. It exposes exactly five OAuth-protected tools through one
server-instance-scoped process manager: `exec_command`, `read_process`,
`write_stdin`, `terminate_process`, and `list_processes`.

**Run it and drive it with a third-party MCP client: [wiki/smoke-test.md](./wiki/smoke-test.md).**

## Unusual configuration

- **`dev` restarts on source change.** It runs `tsx watch`, so saving a source
  file stops the server and starts it again on the same port, rewriting the
  readiness file with the new pid. A smoke run in progress loses its connection
  if you edit a source file while it runs.
- **Loopback guards are mode-specific, on purpose.** Local mode rejects a
  non-loopback `Host` or `Origin`; public mode does not, because the operator's
  publishing mechanism rewrites `Host`.
- **Readiness is the file, not the log.** It is written atomically (temp file
  plus rename), so it is never half-read. A file left behind by a killed process
  is a stale claim — check its `pid` and `serverInstanceId`; the next start
  overwrites it, and an old instance never unlinks its replacement's claim.
- **Secrets never touch disk, a log, or a command line.** The startup secret,
  authorization codes, and tokens stay in memory and in redacted evidence.
  There is no test-only authentication path.
- **Observation does not own execution.** Request cancellation, transport
  disposal, cursor reads, and yield expiry do not terminate accepted commands.
  Reuse caller-chosen operation and write IDs when recovering a lost response.
