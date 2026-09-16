# remote-managed-shell

Remote managed Bash MCP server over Streamable HTTP — a Yarn 4 workspace member
at `/workspace`. Today it is a skeleton: one `echo` tool on the v2 SDK, both
startup modes, an atomic readiness file, and the dev/CLI lifecycle the
five-tool surface is built on.

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
  is a stale claim — check the `pid` in it; the next start overwrites it.
- **Secrets never touch disk, a log, or a command line.** When the authorization
  server lands, the startup secret, authorization codes, and tokens stay in
  memory and in redacted evidence, and no test-only authentication path is added
  to make a client work.
