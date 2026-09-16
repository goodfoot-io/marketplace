# Validation ledger

Statuses are recorded only as **passed**, **failed**, or **not run**. A skipped environment-specific gate is never a pass.

Environment recorded for the implementation run:

- Node.js: v24.16.0
- Yarn: 4.12.0
- Bash: 5.2.37
- Platform: Linux aarch64, kernel 7.0.12-linuxkit
- MCP server/node/client packages: 2.0.0
- `tunnel-client`: absent from the validation host; the supervisor check below used a local stand-in implementing only the surface the launcher consumes

| Gate | Status | Evidence |
| --- | --- | --- |
| Local MCP smoke | passed | `smoke:local` built a fresh server, waited for the atomically renamed readiness claim and a live pid, and connected the v2 SDK over real loopback HTTP **with no credential of any kind**, listed exactly five tools, executed Bash, read output, and recovered the exited operation: `PASS: local MCP smoke against http://127.0.0.1:36487/mcp (5 tools, exited)` |
| TypeScript typecheck | passed | `yarn workspace @goodfoot/remote-managed-shell run typecheck`, no diagnostics |
| Production build | passed | `yarn workspace @goodfoot/remote-managed-shell run build` |
| Biome | passed | `yarn workspace @goodfoot/remote-managed-shell run lint`: 23 files checked, no diagnostics and no fixes applied |
| Deterministic Vitest suite | passed | 29 passed, 2 skipped (opt-in). Coverage: configuration including rejection of the retired `--mode`/`--url`, credential-free loopback HTTP including an unvalidated `Host` and `Origin`, the five-tool SDK surface with no security scheme claimed, process management, segmented transcript storage, readiness ownership, and blocked-logger behavior |
| Dependency closure | passed | `scripts/export-dependencies.mjs` exported 353 registry-verified package records and 438 edges with tarball URLs and npm SRI; no registry or required-edge failures; 33 unresolved edges are labeled optional peers |
| Tunnel launcher supervision | passed | `scripts/start-tunnel.mjs` was driven against a local stand-in `tunnel-client` (a 60-line stub outside the checkout, never committed) on five ports. It reported the endpoint only after the server's readiness claim and a `/readyz` 200, and reported nothing at all while `/readyz` stayed `503` — that run failed closed at the 60s deadline and exited `1`. A child exiting on its own ended the run with exit `1` in both directions (client first, then server), and SIGINT retired the server before the client and exited `0`, leaving no claim, no health URL file, and no orphan process behind. Malformed flags exited `2`; a missing binary, a missing key reference, an unset `env:` variable, and a literal `--api-key` value were each refused before anything was spawned. The stub implements only the surface this script consumes, so what this row proves is the supervisor's ordering and gating, not the real client's `/readyz` semantics |
| MCP Inspector 2.6.0 | not run | `smoke:mcp-cli` reported `MCP_INSPECTOR` unset; the exact independent installation and redacted procedure are in `wiki/smoke-test.md` |
| Tunnel hop | not run | Requires an OpenAI organization with a configured tunnel and a `tunnel-client` binary, none of which the validation host has. `start:tunnel` supervises the pair and gates on the client's own readiness, but a healthy `tunnel-client` process is not evidence that a client reached the shell; that proof is external |
| Ten-minute silent process | not run | `tests/duration.opt-in.test.ts` is gated by `REMOTE_SHELL_DURATION=1` and was skipped in the ordinary suite |
| One-hour mixed-workload soak | not run | `tests/soak.opt-in.test.ts` is gated by `REMOTE_SHELL_SOAK=1` and was skipped in the ordinary suite |
| Native PTY | not run | `node-pty` was absent; the PTY-free profile built and passed pipe tests, and runtime capability discovery reports PTY unavailable |
| Hosted ChatGPT connector | not run | Requires an OpenAI organization and a configured tunnel |
| macOS | not run | The validation host was Linux aarch64 |

The ordinary package suite covers the real loopback listener, finite JSON MCP handling, anonymous initialize and SSE behaviors, an arbitrary bearer being ignored, the absence of every discovery route, the five-tool surface with no `securitySchemes`, start and write deduplication, exact cursor paging, waiter responsiveness, result tombstones, stdin EOF, managed-group termination, late descendant output, disk-spool recovery and failure, bounded logging, request size limits, and readiness-file ownership. Hosted-client behavior, the tunnel hop, crash reattachment, escaped `setsid` descendants, native PTY semantics, and durability across process loss remain explicit capability boundaries.

The first full Vitest run of this change reported one failure that the second did not: `tests/process-manager.test.ts > captures fast stdout/stderr and ordinary nonzero exit` exceeded its 20-second budget while the whole suite ran in parallel, then passed alone in 102 ms and passed again in the full suite on re-run. It is recorded here rather than dropped, because a test that only fails under load is a real observation about the suite and not about this change — nothing in the change touches process spawning.

Removing the package's authentication moved the Appendix F authentication class A01–A10 out of this package entirely: their control was the deleted authorization server, and the boundary that replaced it — the tunnel plus the operator's organization membership — is not verifiable from this process. `fmea-traceability.md` records that as an explicit absence rather than a passing control, together with the two accepted consequences (no local guard against DNS rebinding, and no per-user authorization or revocation path this package owns).
