# Appendix F — FMEA traceability

This ledger maps every Appendix F risk to the implementation currently in the
package and to the evidence that exists in this worktree. `passed` means the
named check directly exercised the stated control. `known boundary` means the
implementation has an explicit limit, or the check covered only a smaller
part of the Appendix F scenario. `not run` means there is no execution
evidence for that scenario.

The current package baseline is `yarn workspace @goodfoot/remote-managed-shell
typecheck`, `build`, and `test`: typecheck and build passed; Vitest reported 29
passed and two skipped opt-in tests (the ten-minute duration and one-hour soak).
The baseline ran on Node.js v24.16.0, Yarn 4.12.0, Bash 5.2.37, Linux aarch64
(kernel 7.0.12-linuxkit), with MCP server/node/client 2.0.0. The tunnel hop,
hosted ChatGPT, MCP Inspector, native PTY behavior, crash/restart behavior,
and the opt-in duration/soak tests were not run.

| ID | Implementation | Current evidence | Status | Residual boundary |
|---|---|---|---|---|
| T01 | `src/serve.ts`, `src/server.ts`, `src/contracts.ts` | `tests/http.test.ts` runs the real local Streamable HTTP endpoint, finite JSON responses, and all five tools | known boundary | The tunnel hop and an intended client host were not exercised; they are outside this package, which binds loopback and is reached only by whatever forwards to it |
| T02 | `src/server.ts`, `src/serve.ts`, `package.json` | `tests/http.test.ts` uses the pinned v2 SDK client and verifies the five-tool surface; package build/typecheck passed | passed | Independent target-host contract testing and reconnect/error coverage were not run |
| T03 | `src/serve.ts`, `src/process-manager.ts`, `src/adapters/adapter.ts` | Manager-owned scope and shutdown paths are present | not run | No dropped-response, transport-disposal, disconnect, or reconnect test proves that accepted work survives observation cancellation |
| T04 | `src/process-manager.ts`, `src/contracts.ts`, `src/errors.ts` | `tests/process-manager.test.ts` verifies operation replay and conflicting payload rejection | known boundary | The test does not lose a real HTTP response or race serial and concurrent retries |
| T05 | `src/process-manager.ts`, `src/util/time.ts`, `src/contracts.ts` | `read_process` and `exec_command` enforce the configured wait cap in source | known boundary | No short-client-deadline, silent-job, or observer-cancellation gate was run |
| T06 | `src/config.ts`, `src/serve.ts` | `tests/config.test.ts` covers unknown, repeated, malformed, and out-of-range options and the rejection of the retired `--mode`/`--url`; `tests/http.test.ts` proves atomic readiness facts and that an older instance cannot unlink a replacement claim | known boundary | The full Appendix F malformed-value matrix was not run, and no `Host` or `Origin` is inspected by design, so an unanticipated header is served rather than refused |
| T07 | `src/config.ts`, `src/serve.ts`, `src/process-manager.ts` | Readiness and health describe only the loopback endpoint and the server instance; there is no public identity to label and no self-probe path | known boundary | A tunnel outage during an accepted job cannot be tested by this package and was not simulated |
| O01 | `src/process-manager.ts`, `src/util/opaque.ts`, `src/contracts.ts` | Cursor reads are implemented as non-destructive snapshots; `tests/process-manager.test.ts` retries a cursor indirectly through paging | known boundary | Two independent readers and a deliberately lost read response were not run |
| O02 | `src/process-manager.ts`, `src/util/opaque.ts`, `src/util/utf8.ts` | `tests/process-manager.test.ts` reconstructs a newline-free multibyte event with four-byte pages | passed | The minimum-budget and alternating-stream matrix was not run |
| O03 | `src/process-manager.ts` | Fast completion retains a session and output; `tests/process-manager.test.ts` covers fast output and completion | known boundary | No immediate verbose command exceeding one response page was run |
| O04 | `src/output/transcript-store.ts`, `src/process-manager.ts`, `src/contracts.ts` | `tests/transcript-store.test.ts` retrieves disk-spooled history after memory eviction and verifies explicit degradation/loss for quota and spool-root failure | known boundary | ENOSPC, external transcript deletion, and a long-running quota wrap were not run |
| O05 | `src/process-manager.ts`, `src/adapters/adapter.ts` | `tests/process-manager.test.ts` verifies output arriving after leader exit while a descendant holds the pipe | passed | A descriptor held indefinitely without later output was not run |
| O06 | `src/output/transcript-store.ts`, `src/process-manager.ts`, `src/logging/logger.ts` | Per-session/global memory, disk, pending-spool, event, and logger limits are implemented; transcript and logger tests exercise bounded failure | known boundary | No noisy concurrent slow-consumer soak ran |
| O07 | `src/util/utf8.ts`, `src/process-manager.ts`, `src/output/transcript-store.ts` | Process paging covers multibyte UTF-8 and the store test pages an invalid-byte replacement within its byte budget; raw stream bytes are retained in spool records | known boundary | NUL/binary streams, carriage returns, ANSI sequences, and raw-spool export were not run |
| O08 | `src/process-manager.ts`, `src/contracts.ts` | `tests/process-manager.test.ts` observes separate stdout/stderr events with stream labels | known boundary | The test does not assert a deterministic interleaving under concurrent writes |
| O09 | `src/process-manager.ts`, `src/contracts.ts` | Ordered paging and backlog fields are implemented | not run | Flooded output, fatal stderr reachability, and an explicit tail/skip workflow were not run |
| P01 | `src/process-manager.ts`, `src/adapters/adapter.ts`, `src/errors.ts` | `tests/process-manager.test.ts` covers immediate successful/nonzero exit and retained accepted identity | known boundary | Invalid cwd, missing Bash, command-not-found, and injected spawn races were not run |
| P02 | `src/process-manager.ts`, `src/util/time.ts`, `src/contracts.ts` | Source distinguishes `timeout_ms: null` and finite deadlines and uses monotonic timing | not run | No deadline validation, very-long timer, or wall-clock-adjustment test was run; the duration test was skipped |
| P03 | `src/process-manager.ts`, `src/adapters/adapter.ts`, `src/contracts.ts` | `tests/process-manager.test.ts` checks a bounded termination response and `stop_reason` | known boundary | Natural-exit/timeout/termination races and confirmed exit outcome during escalation were not run |
| P04 | `src/adapters/adapter.ts`, `src/adapters/group-probe.ts`, `src/adapters/scope-worker.ts` | `tests/process-manager.test.ts` exercises bounded managed-group termination | known boundary | Coverage is an ordinary process group only; setsid descendants, PTY trees, and externally managed workloads were not run |
| P05 | `src/adapters/adapter.ts`, `src/adapters/scope-worker.ts` | Runtime PTY loading and a shared scope abstraction exist | not run | No PTY installation, interaction, resize, signal, trailing-output, or termination test ran |
| P06 | `src/process-manager.ts`, `src/contracts.ts`, `src/errors.ts`, `src/serve.ts` | Instance IDs and mismatch errors are implemented in source and returned by listing/results | not run | No abrupt kill/restart test proves old handles and operation IDs are refused without replay |
| P07 | `src/process-manager.ts`, `src/serve.ts`, `src/adapters/adapter.ts` | Reentrant shutdown guards and bounded cleanup calls exist in source | not run | Shutdown during spawn, blocked input, output flood, partial startup, and repeated signals were not run |
| I01 | `src/contracts.ts`, `src/process-manager.ts`, `src/adapters/adapter.ts` | Piped stdin and PTY selection are represented in the contract | not run | No flushed no-newline prompt, piped interaction, or terminal-dependent prompt test ran |
| I02 | `src/process-manager.ts`, `src/adapters/adapter.ts`, `src/contracts.ts` | `tests/process-manager.test.ts` delivers bytes followed by `close_stdin` and verifies later writes get `STDIN_CLOSED` | passed | The 0x04-versus-pipe-EOF distinction was not run, and PTY Ctrl-D semantics remain unverified |
| I03 | `src/process-manager.ts`, `src/contracts.ts`, `src/errors.ts` | `tests/process-manager.test.ts` verifies write replay and closed-stdin rejection for a `write_id` | known boundary | Lost acknowledgment, concurrent writes, and exit during handoff were not run |
| I04 | `src/process-manager.ts`, `src/contracts.ts` | Per-session/global input queues and waiter cleanup are implemented | not run | Backpressure with unrelated list/read/terminate calls and canceled-poll listener bounds were not run |
| I05 | `src/process-manager.ts`, `src/adapters/adapter.ts`, `src/contracts.ts` | `interrupt` is a separate input field and adapter path | not run | Foreground PTY interrupt, pipe control bytes, and distinction from group termination were not run |
| I06 | `src/process-manager.ts`, `src/contracts.ts` | Snapshots report observed status, elapsed time, output timestamps, and state version | not run | Silent computation, buffered output, misleading prompts, and a live-but-not-listening server were not run |
| U01 | `src/process-manager.ts`, `src/adapters/adapter.ts`, `src/contracts.ts` | Per-spawn cwd/env and login flags are passed to Bash in source | not run | Concurrent cwd isolation, profile side effects, and cross-call `cd`/`export` checks were not run |
| U02 | `src/adapters/adapter.ts`, `src/process-manager.ts` | Bash receives the command as one argv element (`-c`/`-lc`); stdin is passed as supplied | not run | Quotes, heredocs, backslashes, dollar signs, emoji, and spaced paths were not round-tripped in a test |
| U03 | `src/contracts.ts`, `src/errors.ts`, `src/server.ts`, `src/process-manager.ts` | `tests/http.test.ts` verifies model-visible five-tool structured results and a nonzero exit; schemas and recovery codes are present | known boundary | Every result/error variant through an intended host and missing-handle recovery guidance were not exercised |
| U04 | `src/process-manager.ts`, `src/contracts.ts` | `list_processes` includes operation IDs, summaries, timestamps, outcome, cursors, retention, and pagination | not run | Client-memory loss, similar labels, completion-before-reconnect, and full pagination recovery were not run |
| U05 | `src/logging/logger.ts`, `src/logging/helper.ts`, `src/process-manager.ts` | `tests/logger.test.ts` demonstrates responsive IPC and bounded queue/drop accounting with blocked stdout | passed | EPIPE, helper exit, slow terminal, and a flooded live session were not run |
| U06 | `src/process-manager.ts`, `src/contracts.ts` | Atomic-looking admission checks and active/input/output/identity limits are implemented | not run | Raced starts, each capacity limit, retained-completion pressure, and reserved control headroom were not run |
| U07 | `src/adapters/adapter.ts`, `src/process-manager.ts`, `src/contracts.ts` | The ordinary suite runs without `node-pty`; listing reports the actual disabled/unavailable/available state and pipe-mode tests pass | known boundary | Native PTY installation and behavior were not run |
| U08 | `src/server.ts`, `src/contracts.ts`, `src/process-manager.ts` | Tool descriptions label reads/listing as non-destructive; HTTP test calls `list_processes` before and after execution | known boundary | Multi-poll mutation checks and intended-host annotation/confirmation behavior were not run |

## Authentication risks (A01–A10)

Appendix F's authentication class has no implementation in this package and no
evidence here. Every one of A01–A10 named the authorization server as its
control, and that subsystem — together with the public identity it existed to
gate — has been removed. The package performs no authentication, inspects no
`Host` and no `Origin`, serves no discovery document, and issues no challenge;
it is infrastructure, and deciding who may call is not its job.

The boundary that replaced it is the OpenAI Secure MCP Tunnel plus the
operator's organization membership, and neither is verifiable from this
process: the polled command payload carries no caller identity, so the server
could not make a per-caller authorization decision even if it kept one
(`docs/research.md`). Two consequences are accepted rather than mitigated, and
are recorded in the change's Risks section rather than assumed away:

- **No local guard against DNS rebinding.** A web page the operator visits can
  reach the loopback port and drive the shell. The design target is a sandboxed,
  single-user environment in which any process in the container can already
  reach that port.
- **No per-user authorization, and no revocation path this package owns.**
  ChatGPT holds one authorization per connector and reuses it for every user, so
  even the removed OAuth surface supplied no per-user granularity.

The skipped opt-in tests are intentionally not evidence for P02 or O06:
`tests/duration.opt-in.test.ts` requires ten minutes of wall time and
`tests/soak.opt-in.test.ts` requires one hour. The tunnel-hop and hosted-client
claims remain external verification boundaries because this process neither
owns nor probes the operator's tunnel.
