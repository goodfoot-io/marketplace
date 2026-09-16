# Validation ledger

Statuses are recorded only as **passed**, **failed**, or **not run**. A skipped environment-specific gate is never a pass.

Environment recorded for the implementation run:

- Node.js: v24.16.0
- Yarn: 4.12.0
- Bash: 5.2.37
- Platform: Linux aarch64, kernel 7.0.12-linuxkit
- MCP server/node/client packages: 2.0.0
- `tunnel-client`: absent from the validation host; the supervisor check below used a local stand-in outside the checkout that implements only the surface the launcher consumes — `/healthz`, `/readyz`, `/metrics`, and a `--health.url-file` written with no trailing newline exactly as the client writes it

| Gate | Status | Evidence |
| --- | --- | --- |
| Local MCP smoke | passed | `smoke:local` built a fresh server, waited for the atomically renamed readiness claim and a live pid, and connected the v2 SDK over real loopback HTTP **with no credential of any kind**, listed exactly five tools, executed Bash, read output, and recovered the exited operation: `PASS: local MCP smoke against http://127.0.0.1:36487/mcp (5 tools, exited)` |
| TypeScript typecheck | passed | `yarn run typecheck`, no diagnostics |
| Production build | passed | `yarn run build` |
| Biome | passed | `yarn run lint`: 23 files checked, no diagnostics and no fixes applied |
| Deterministic Vitest suite | passed | 29 passed, 2 skipped (opt-in). Coverage: configuration including rejection of the retired `--mode`/`--url`, credential-free loopback HTTP including an unvalidated `Host` and `Origin`, the five-tool SDK surface with no security scheme claimed, process management, segmented transcript storage, readiness ownership, and blocked-logger behavior |
| Dependency closure | passed | `scripts/export-dependencies.mjs` exported 353 registry-verified package records and 438 edges with tarball URLs and npm SRI; no registry or required-edge failures; 33 unresolved edges are labeled optional peers |
| Tunnel launcher supervision | passed | `scripts/start-tunnel.mjs` was driven against a local stand-in `tunnel-client` (a stub outside the checkout, never committed) on five ports and six modes. It reported ready only when all three gates held — the server's readiness claim, `/readyz` reading exactly `ready`, and a non-zero `commands_poll_last_successful_timestamp_seconds` in the client's `/metrics` — printing the tunnel id, the connector endpoint, both pids, the control-plane base, and the poll timestamp. Each refusal failed closed with exit `1` and a specific message: a `/readyz` body of `ready (mcp startup probe timed out: context deadline exceeded)`, quoted verbatim, because the client calls an unreached probe readiness-compatible; a gauge of `0` after 60s, because a key the tunnel rejects is not a readiness failure; `/readyz` held at `503` for 60s; and the client exiting on its own (exit code 7). A server exiting on its own also ended the run with exit `1`. SIGINT retired the server before the client and exited `0`, leaving no claim, no health URL file, and no orphan process behind. Malformed flags exited `2`; a missing binary, a missing key reference, an unset `env:` variable, and a literal `--api-key` value were each refused before anything was spawned. The stand-in implements only the surface this script consumes, so what this row proves is the supervisor's ordering and gating; the semantics each gate relies on were read from the client's source at `3917788` rather than inferred from the stub |
| MCP Inspector 2.6.0 | not run | `smoke:mcp-cli` reported `MCP_INSPECTOR` unset; the exact independent installation and redacted procedure are in `wiki/smoke-test.md` |
| Tunnel hop | not run | Requires an OpenAI organization with a configured tunnel and a `tunnel-client` binary, none of which the validation host has. `start:openai` supervises the pair and gates on the client's own readiness, but a healthy `tunnel-client` process is not evidence that a client reached the shell; that proof is external |
| Ten-minute silent process | not run | `tests/duration.opt-in.test.ts` is gated by `REMOTE_SHELL_DURATION=1` and was skipped in the ordinary suite |
| One-hour mixed-workload soak | not run | `tests/soak.opt-in.test.ts` is gated by `REMOTE_SHELL_SOAK=1` and was skipped in the ordinary suite |
| Native PTY | not run | `node-pty` was absent; the PTY-free profile built and passed pipe tests, and runtime capability discovery reports PTY unavailable |
| Hosted ChatGPT connector | not run | Requires an OpenAI organization and a configured tunnel |
| macOS | not run | The validation host was Linux aarch64 |

The ordinary package suite covers the real loopback listener, finite JSON MCP handling, anonymous initialize and SSE behaviors, an arbitrary bearer being ignored, the absence of every discovery route, the five-tool surface with no `securitySchemes`, start and write deduplication, exact cursor paging, waiter responsiveness, result tombstones, stdin EOF, managed-group termination, late descendant output, disk-spool recovery and failure, bounded logging, request size limits, and readiness-file ownership. Hosted-client behavior, the tunnel hop, crash reattachment, escaped `setsid` descendants, native PTY semantics, and durability across process loss remain explicit capability boundaries.

The first full Vitest run of this change reported one failure that the second did not: `tests/process-manager.test.ts > captures fast stdout/stderr and ordinary nonzero exit` exceeded its 20-second budget while the whole suite ran in parallel, then passed alone in 102 ms and passed again in the full suite on re-run. It is recorded here rather than dropped, because a test that only fails under load is a real observation about the suite and not about this change — nothing in the change touches process spawning.

Removing the package's authentication left it with no authentication control at all: its former control was the deleted authorization server, and the boundary that replaced it — the tunnel plus the operator's organization membership — is not verifiable from this process. That is recorded as an explicit absence rather than a passing control, together with the two accepted consequences: no local guard against DNS rebinding, and no per-user authorization or revocation path this package owns.

## Installed package

Second implementation run, same host, with the package taken the way a consumer meets it: packed by `yarn pack`, installed by `npx` into a fresh npm exec cache, and run from there. npm 11.13.0 supplied `npx`; the full-flavor `tunnel-client` 0.0.14 was on `PATH`.

| Gate | Status | Evidence |
| --- | --- | --- |
| TypeScript typecheck | passed | `yarn run typecheck`, no diagnostics |
| Production build | passed | `yarn run build`; the emitted `build/dist/src/main.js` keeps the `#!/usr/bin/env node` shebang the manifest's `bin` depends on |
| Biome | passed | `yarn run lint`: 25 files checked, no diagnostics and no fixes applied |
| Deterministic Vitest suite | passed | 35 passed, 2 skipped (opt-in); six new cases cover the `openai` dispatch and package-root discovery, including a manifest that belongs to another package and one that cannot be parsed |
| Archive contents | passed | `yarn pack` ran `prepack` and produced 23 files — the compiled tree, the four packaged scripts, the manifest, and the README, with no source, test, or declaration output. Two packaging defects were found here and fixed: a `files` entry naming `build/dist` as a plain directory shipped only the `bin` target, because Yarn 4 intersects directory entries with the repository's `.gitignore` rule `*/build/dist/` while explicit globs are enumerated directly, so the entry is now `build/dist/**`; and the stale `build/dist/src/auth/` output of the deleted authentication code would otherwise have been archived, which `prepack`'s `clean` step now prevents |
| npx server path | passed | `npx --package file:<tarball> -- shell-mcp --port=38148` started the installed server, answered an anonymous `initialize` and `tools/list` over real loopback HTTP as `shell-mcp` `0.1.0`, listed exactly the five tools, and stopped on SIGINT with `npx` exit `0`, leaving no readiness claim behind |
| npx tunnel entry point | passed | `shell-mcp openai --help` routed to the installed launcher from inside the npm exec cache and printed its own usage; `openai --definitely-not-a-flag` and the server's `--definitely-not-a-flag` each exited `2` through the wrapper and through `npx` |
| npx tunnel run | passed | `npx … shell-mcp openai --port=38150 --tunnel-id=tunnel_0000000000000000000000000000beef` started the installed server (`server ready at http://127.0.0.1:38150/mcp`), spawned the `PATH` client, saw the metadata read refused (`status_code=400`) and twelve poll refusals (`401 tunnel_use_forbidden`), then failed closed at the 60s poll deadline with exit `1`, retiring both children and leaving no claim, health URL, or process behind. The key crossed only as the launcher's `env:CONTROL_PLANE_API_KEY` reference: the 247-line run log contains the key's value zero times |
| Live tunnel hop from the installed package | not run | The tunnel was held throughout by the operator's own checkout session (`start:openai`, port 38147), and a second client for the same tunnel id would displace it. The hop itself was observed live for the checkout launcher in this session — the ready banner, a control-plane poll accepted at 2026-09-16T20:14:52Z, and two commands forwarded from the OpenAI side — and remains an external boundary this package does not own |

## Release 1.0.0

Third run, same host: the release path itself. The version moved from `0.1.0` — which npm already held, published by the operator before this run — to `1.0.0`, so this run had to prove that the version surfaces move together and that what the workflow installs, builds, and publishes is what this host validated.

| Gate | Status | Evidence |
| --- | --- | --- |
| Version surfaces | passed | `package.json` and `SERVER_VERSION` in [server.ts](../src/server.ts#L8) were both set to `1.0.0`. The packed manifest and the compiled `build/dist/src/server.js` were read back out of the archive and both carry `1.0.0`, so the initialize response cannot advertise a number the package is not |
| Lockfile immutability | passed | `yarn install --immutable` — the workflow's own install step — first failed with `YN0028`, naming the workspace `bin` entry (`shell-mcp: build/dist/src/main.js`) that the new `bin` field requires; `yarn install` wrote it, after which the immutable run completed with no lockfile change. Yarn also normalized the manifest's object form of `bin` to the string form, which derives the same unscoped `shell-mcp` name — confirmed below by what npm linked |
| TypeScript typecheck | passed | `yarn run typecheck`, no diagnostics |
| Production build | passed | `yarn run build` through `prepack`; the emitted `build/dist/src/main.js` keeps its `#!/usr/bin/env node` shebang and its executable mode |
| Biome | passed | `yarn run lint`: 25 files checked, no diagnostics and no fixes applied |
| Deterministic Vitest suite | passed | 35 passed, 2 skipped (opt-in) |
| Archive contents | passed | `yarn pack` ran `prepack` and produced 23 files: the compiled tree, four packaged scripts, the manifest, and the README. `files` now also names `CHANGELOG.md`, which a release generates; the release run below re-packed the archive once it existed |
| Installed package run | passed | The tarball was installed into a scratch project with `npm install /tmp/…/release.tgz`, so the bins were linked the way a consumer's client links them: `node_modules/.bin/shell-mcp` → `node_modules/@goodfoot/shell-mcp/build/dist/src/main.js`. The installed server advertised `shell-mcp` `1.0.0` in its `initialize` response and `tools/list` returned exactly the five tools; `shell-mcp openai --help` routed to the packaged launcher and exited `0`; `shell-mcp openai --no-such-option` exited `2` with `unknown option`; SIGINT stopped the server with exit `0` and left no readiness claim and no process behind |
