# Validation ledger

Statuses are recorded only as **passed**, **failed**, or **not run**. A skipped environment-specific gate is never a pass.

Environment recorded for the implementation run:

- Node.js: v24.16.0
- Yarn: 4.12.0
- Bash: 5.2.37
- Platform: Linux aarch64, kernel 7.0.12-linuxkit
- MCP server/node/client packages: 2.0.0

| Gate | Status | Evidence |
| --- | --- | --- |
| Local OAuth/MCP smoke | passed | `smoke:local` built a fresh server, refused a wrong startup secret, completed S256 PKCE, connected the v2 SDK, listed exactly five tools, executed Bash, read output, and recovered the exited operation: `PASS: local OAuth S256 and MCP v2 smoke (5 tools, exited)` |
| TypeScript typecheck | passed | `yarn workspace @goodfoot/remote-managed-shell run typecheck` |
| Production build | passed | `yarn workspace @goodfoot/remote-managed-shell run build` |
| Biome | passed | `yarn workspace @goodfoot/remote-managed-shell run lint`: 26 files checked, no diagnostics and no fixes applied |
| Deterministic Vitest suite | passed | 34 tests passed across configuration, OAuth, real loopback HTTP, process management, segmented transcript storage, readiness ownership, restart invalidation, and blocked-logger behavior |
| Dependency closure | passed | `scripts/export-dependencies.mjs` exported 353 registry-verified package records and 438 edges with tarball URLs and npm SRI; no registry or required-edge failures; 33 unresolved edges are labeled optional peers |
| MCP Inspector 2.6.0 | not run | `smoke:mcp-cli` reported `MCP_INSPECTOR` unset; the exact independent installation and redacted procedure are in `wiki/smoke-test.md` |
| Public reachable endpoint | not run | `test:public` reported `REMOTE_MANAGED_SHELL_PUBLIC_URL` unset; no operator-owned HTTPS publisher was available |
| Ten-minute silent process | not run | `tests/duration.opt-in.test.ts` is gated by `REMOTE_SHELL_DURATION=1` and was skipped in the ordinary suite |
| One-hour mixed-workload soak | not run | `tests/soak.opt-in.test.ts` is gated by `REMOTE_SHELL_SOAK=1` and was skipped in the ordinary suite |
| Native PTY | not run | `node-pty` was absent; the PTY-free profile built and passed pipe tests, and runtime capability discovery reports PTY unavailable |
| Hosted ChatGPT connector | not run | Requires the operator-owned public HTTPS route and hosted client |
| macOS | not run | The validation host was Linux aarch64 |

The ordinary package suite covers the real loopback listener, finite JSON MCP handling, OAuth discovery and PKCE, missing/unknown/prior-instance bearer challenges, start and write deduplication, exact cursor paging, waiter responsiveness, result tombstones, stdin EOF, managed-group termination, late descendant output, disk-spool recovery and failure, bounded logging, request size limits, and readiness-file ownership. Public routing, hosted-client behavior, crash reattachment, escaped `setsid` descendants, native PTY semantics, and durability across process loss remain explicit capability boundaries.

The FMEA classes retained from Appendix F are transport T01-T07, output O01-O09, process P01-P07, input I01-I06, usability/operations U01-U08, and authentication A01-A10. Their per-item evidence and boundaries are recorded in `fmea-traceability.md`.
