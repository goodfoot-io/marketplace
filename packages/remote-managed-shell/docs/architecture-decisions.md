# Architecture decisions

## API surface

The service implements the specified five-tool API. A Codex-shaped two-tool API is compact but makes discovery, non-destructive observation, and explicit termination harder to express. An action-enum tool reduces names while weakening per-action schemas and annotations. Five tools keep start, observation, input, cleanup, and discovery contracts visible to the model.

## Lifetime and ownership

One composition root owns one `ProcessManager`, authorization service, MCP handler, HTTP listener, and logger. HTTP requests borrow the manager. Request cancellation and transport disposal cancel observation only. Shutdown closes start admission before cleaning active managed groups.

The prepared top-level structure remains: `main.ts` owns CLI signals, `serve.ts` owns HTTP/readiness, `server.ts` registers tools, and `config.ts` validates startup. Focused subdirectories contain recovered adapters, authorization, logging, and utility code.

## Execution and recovery

An `operation_id` is synchronously reserved with a session handle before spawning. Its fingerprint contains normalized execution-affecting arguments and excludes observation budgets. Replays recover the existing record; conflicts never spawn. Used identities remain tombstoned for the live instance after detailed results expire.

Output events keep collector order and their stream label. Opaque cursors bind server instance, session, event position, and partial-event byte offset. Reads are non-destructive and exact UTF-8 byte budgets may stop inside an event without advancing over undisclosed output. Leader exit, stream closure, unread output, and group cleanup are independent facts.

The recovered process-group anchor design is retained because it can observe output held open by descendants after Bash exits and can distinguish a leader outcome from group disappearance. Cleanup is explicitly limited to the managed process group; `setsid`, service managers, and other job-control groups can escape it.

## Authentication

The public URL is a configured, canonical, unverified identity. It is never derived from `Host`, forwarding headers, or peer address. Local mode uses the bound loopback URL. The co-hosted authorization service owns only bounded in-memory auth state and cannot access process control. Every MCP request crosses the bearer boundary first.

Client identity uses Client ID Metadata Documents. Fetching is size-, time-, redirect-, concurrency-, cache-, DNS-, and address-bounded. Public mode rejects loopback, private, link-local, multicast, and special-use destinations. Local mode permits loopback HTTP client documents for local testing only.

## Recovered alternatives

Attempt 2 won for contracts, recovery vocabulary, cursor primitives, and logger shape because it matches the final five-tool schema. Reconstructed attempt 1 won for Bash adapters and process-group ownership because it preserves separate leader and stream lifecycle hooks. Attempt 1's `INVALID_CURSOR` name and both attempts' incomplete URL checks were rejected. Logger accounting follows one attempt-2-style total backlog counter rather than mixing attempt 1's separate in-flight measure.

## Storage boundary

Recent transcript events stay in bounded per-session and global memory while a bounded writer appends newline-delimited records to size- and count-limited segments. Reads merge both tiers through the same opaque cursor. Queue saturation, quota eviction, initialization failure, and segment read failure degrade spool health and expose explicit loss or recovery cursors; they never turn a missing range into an apparently complete transcript. The spool is removed on orderly shutdown and does not claim crash durability. A new instance ID prevents stale retries from silently becoming new execution, but cannot recover commands from a crashed prior server.
