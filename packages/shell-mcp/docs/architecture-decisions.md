# Architecture decisions

## API surface

The service implements the specified five-tool API. A Codex-shaped two-tool API is compact but makes discovery, non-destructive observation, and explicit termination harder to express. An action-enum tool reduces names while weakening per-action schemas and annotations. Five tools keep start, observation, input, cleanup, and discovery contracts visible to the model.

## Lifetime and ownership

One composition root owns one `ProcessManager`, MCP handler, HTTP listener, and logger. HTTP requests borrow the manager. Request cancellation and transport disposal cancel observation only. Shutdown closes start admission before cleaning active managed groups.

The top-level structure is: `main.ts` owns CLI signals, `serve.ts` owns HTTP/readiness, `server.ts` registers tools, and `config.ts` validates startup. Focused subdirectories contain the adapters, logging, output, and utility code.

## Execution and recovery

An `operation_id` is synchronously reserved with a session handle before spawning. Its fingerprint contains normalized execution-affecting arguments and excludes observation budgets. Replays recover the existing record; conflicts never spawn. Used identities remain tombstoned for the live instance after detailed results expire.

Output events keep collector order and their stream label. Opaque cursors bind server instance, session, event position, and partial-event byte offset. Reads are non-destructive and exact UTF-8 byte budgets may stop inside an event without advancing over undisclosed output. Leader exit, stream closure, unread output, and group cleanup are independent facts.

The process-group anchor design is retained because it can observe output held open by descendants after Bash exits and can distinguish a leader outcome from group disappearance. Cleanup is explicitly limited to the managed process group; `setsid`, service managers, and other job-control groups can escape it.

## Boundary

The package performs no authentication and validates no request identity. The server binds loopback and serves whoever reaches it; it advertises no public URL, serves no discovery document, and issues no challenge, because it has no external identity to advertise. Neither `Host` nor `Origin` is inspected. The tunnel and the operator's organization membership are the entire boundary, and both live outside this process: reaching the port is the OpenAI Secure MCP Tunnel's job, and this package is infrastructure rather than a gatekeeper.

That is a deliberate choice for a sandboxed, single-user environment, and its consequence is accepted rather than mitigated. With no `Host` check, a web page the operator visits can reach the loopback port through DNS rebinding. Removing the guard also removes the one assumption nothing local could verify, so the tunnel hop can no longer break on a `Host` the design did not anticipate.

## Storage boundary

Recent transcript events stay in bounded per-session and global memory while a bounded writer appends newline-delimited records to size- and count-limited segments. Reads merge both tiers through the same opaque cursor. Queue saturation, quota eviction, initialization failure, and segment read failure degrade spool health and expose explicit loss or recovery cursors; they never turn a missing range into an apparently complete transcript. The spool is removed on orderly shutdown and does not claim crash durability. A new instance ID prevents stale retries from silently becoming new execution, but cannot recover commands from a crashed prior server.
