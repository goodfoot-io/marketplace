# Validation ledger

Statuses are recorded only as **passed**, **failed**, or **not run**. A skipped environment-specific gate is never a pass.

Environment recorded for the implementation run:

- Node.js: v24.16.0
- Yarn: 4.12.0
- Bash: 5.2.37
- Platform: Linux aarch64, kernel 7.0.12-linuxkit
- MCP server/node/client packages: 2.0.0
- Cloudflare Instant Tunnel: `cloudflared` 2026.9.1 (account-less quick tunnel, used for the public-route run)

| Gate | Status | Evidence |
| --- | --- | --- |
| Local OAuth/MCP smoke | passed | `smoke:local` built a fresh server, refused a wrong startup secret, completed S256 PKCE, connected the v2 SDK, listed exactly five tools, executed Bash, read output, and recovered the exited operation: `PASS: local OAuth S256 and MCP v2 smoke (5 tools, exited)` |
| TypeScript typecheck | passed | `yarn workspace @goodfoot/remote-managed-shell run typecheck` |
| Production build | passed | `yarn workspace @goodfoot/remote-managed-shell run build` |
| Biome | passed | `yarn workspace @goodfoot/remote-managed-shell run lint`: 26 files checked, no diagnostics and no fixes applied |
| Deterministic Vitest suite | passed | 35 tests passed across configuration, OAuth, real loopback HTTP, process management, segmented transcript storage, readiness ownership, restart invalidation, and blocked-logger behavior |
| Dependency closure | passed | `scripts/export-dependencies.mjs` exported 353 registry-verified package records and 438 edges with tarball URLs and npm SRI; no registry or required-edge failures; 33 unresolved edges are labeled optional peers |
| MCP Inspector 2.6.0 | not run | `smoke:mcp-cli` reported `MCP_INSPECTOR` unset; the exact independent installation and redacted procedure are in `wiki/smoke-test.md` |
| Public reachable endpoint | passed | `start:tunnel` published the loopback port with an account-less Cloudflare Instant Tunnel (`--url http://127.0.0.1:38161`) and reported `<url>/mcp` only after `/healthz`, the protected-resource metadata, and the MCP `401` challenge answered through that hostname; a wrong startup secret was then refused, S256 PKCE completed through the public route with a public HTTPS client metadata document, and the v2 SDK session listed five tools, executed Bash, read output, and recovered the exited operation: `PASS: public-route OAuth S256 and MCP v2 smoke (5 tools, exited)`. `smoke:public` itself was not run against that route; the harness reused the exported client helpers from `scripts/smoke-local.mjs` with the token held in memory |
| Ten-minute silent process | not run | `tests/duration.opt-in.test.ts` is gated by `REMOTE_SHELL_DURATION=1` and was skipped in the ordinary suite |
| One-hour mixed-workload soak | not run | `tests/soak.opt-in.test.ts` is gated by `REMOTE_SHELL_SOAK=1` and was skipped in the ordinary suite |
| Native PTY | not run | `node-pty` was absent; the PTY-free profile built and passed pipe tests, and runtime capability discovery reports PTY unavailable |
| Hosted ChatGPT connector | not run | Requires the operator-owned public HTTPS route and hosted client |
| macOS | not run | The validation host was Linux aarch64 |

The ordinary package suite covers the real loopback listener, finite JSON MCP handling, OAuth discovery and PKCE, missing/unknown/prior-instance bearer challenges, start and write deduplication, exact cursor paging, waiter responsiveness, result tombstones, stdin EOF, managed-group termination, late descendant output, disk-spool recovery and failure, bounded logging, request size limits, and readiness-file ownership. Hosted-client behavior, crash reattachment, escaped `setsid` descendants, native PTY semantics, and durability across process loss remain explicit capability boundaries.

The public-route run needed bounded retries, and every retry is visible in the run log rather than folded into a pass: this container's resolver answered `getaddrinfo ENOTFOUND` for a freshly minted `trycloudflare.com` hostname for several seconds and intermittently afterwards. That run also exposed a real defect — a `client_id` whose hostname failed to resolve escaped the authorization endpoint as an opaque `500` instead of the structured refusal sections 3.3 and 3.7 require — which `src/auth/service.ts` now returns as `invalid_client_metadata` with `iss`, covered by a regression test in `tests/auth.test.ts`. Cloudflare rate-limits account-less tunnels per source address, so back-to-back smoke runs are refused with `429`/`1015`; `start:tunnel` names that cause and stops.

The FMEA classes retained from Appendix F are transport T01-T07, output O01-O09, process P01-P07, input I01-I06, usability/operations U01-U08, and authentication A01-A10. Their per-item evidence and boundaries are recorded in `fmea-traceability.md`.
