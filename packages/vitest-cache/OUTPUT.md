# Test output ownership

`src/test-verbose.mjs` supplies the strict `GOODFOOT_TEST_VERBOSE` parser, with no
Vitest dependency, for configuration policy and the Worker entry.
`@goodfoot/vitest-cache/policy` supplies the `withTestOutput()` configuration
wrapper. Apply it to the suites that need output policy, including inline
projects. It preserves their runner, worker count, isolation, selectors,
reporters, and test-scoped spies.

Quiet mode uses Vitest `silent: 'passed-only'`, not console stubs. The diagnostic
plugin appends a reporter after CLI reporter resolution, so successful-test-cache
evidence reporters still execute. The supplemental
reporter passes unattributed console records through immediately. On failed
modules or unhandled run errors, it saves logs attached to nonfailed tasks and
prints an 8192-byte tail. Vitest already replays failed-task console logs itself.
This also covers teardown logs attached to a test that had already passed.

Runner output is retained: test names, assertions, progress, pass/fail summaries,
and configured or CLI-selected reporters are unchanged. Unclaimed Vitest stderr
is printed with its owning file/test and registered as an unhandled diagnostic,
so a passing assertion cannot hide a warning or error or publish a reusable
passing result. Product tests that expect diagnostics continue to own their
existing structured captures and assertions.

## Teardown failures

Vitest only logs teardown problems, and the run keeps its tests' exit status.
Two hooks make them fail the run:

- The reporter's `onProcessTimeout` handler runs when the process is still
  alive `teardownTimeout` after Vitest closes. It sets exit code 1 and prints
  the open libuv resource classes and any pool worker that has not stopped.
- `src/test-worker-teardown.mjs` wraps every project's custom `poolRunner` (the
  Cloudflare pool). Each pool worker's `stop()` is bounded by
  `teardownTimeout`. A timeout or rejection sets exit code 1 and reports the
  project, worker, last test files, stage, elapsed time, and open resources.
  When Vitest closes, the ledger calls `stop()` itself on any started worker
  that Vitest has not stopped in time. This covers a runner stop handshake
  that times out, where Vitest never calls `stop()` and would leave workerd
  running. The result cache records nothing when any pool worker failed to
  stop.

## Native Worker records

Keep the installed Cloudflare pool's native verbosity enabled. Native INFO
records include both expected RPC rejections and unexpected `waitUntil()`
failures; disabling runtime verbosity removes both without necessarily changing
the HTTP result. Neither a message substring, nearby test header, elapsed time,
severity, nor a passing suite establishes ownership.

Direct Miniflare instances constructed inside Node tests route native records
through Miniflare's supported `handleStructuredLogs` option. Their native records bypass
Vitest's application-console capture and retain their original stdout/stderr
severity routing. The Cloudflare pool's own host logging and standalone child
processes remain visible through their existing boundaries.

The Worker Vitest entry (`src/vitest-entry.mjs`, the `goodfoot-vitest` binary) owns child stdout/stderr pipes in quiet Worker runs.
`src/test-output-capture.mjs` streams unmarked bytes through unchanged, with
backpressure. It defers only complete, length-checked, canonical-base64 records
created by `frameExpectedNativeError()` at an explicitly armed **test-fixture**
fault site. The frame preserves the original stack on disk; it does not change
the error object, name, message, or thrown result. Do not frame production errors.

The owning test registers a fresh token and exact expected error message in its
Vitest task metadata. Its explicit fixture request carries that token. At process
completion, capture verifies that every deferred record matches a registered,
passed test and every registered token was observed. Unknown, malformed,
missing, duplicate, or failed-test ownership cannot become a successful silent
run. A failing process replays a bounded native excerpt even when the individual
owning test passed. Unregistered native diagnostics stay visible throughout.
An unclaimed exception with the native protocol's exact exception prefix also
fails capture. Each registered token must be observed exactly once; a duplicate
record is not accepted merely because both copies match one passed test.

workerd also prints exception records of its own that no fixture can frame: a
response body that errors after its headers, or a producer whose reader was
deliberately cancelled. Capture defers every line that begins with
`uncaught exception;` or `exception = ` and classifies it against the closed
shape catalogue in [test-output-workerd.mjs](./src/test-output-workerd.mjs)
(`promise-rejection`, `io-context-rejection`, `reader-canceled`, `pump-canceled`,
`request-hung`, `wasm-trap`, `stale-wasm-rejection`, `rpc-rejection`), together with
the `stack:` line or the `    at <frame>` trace lines a shape requires. The test
that causes the records declares them through a test-side helper such as
`expectWorkerdDiagnostic(context, message, counts)`, naming each shape, the exact exception message, and how many records
one execution prints. These records carry no owner, so capture compares exact
per-run totals by shape and message: a record matching no shape, an observed
total that differs from the passed tests' declared total, a declaration whose
records never appear, and a declaration owned by a failed or skipped test all
fail the run. There is no wildcard shape.

`rpc-rejection` is a Durable Object RPC method's own rejection: workerd reports an
error thrown inside the called method as `uncaught exception; source = Uncaught (in
promise); stack = Name: message` and then the JavaScript frames. The claimed
message is that `Name: message` text, class name included. A record belongs to the
method only when its first frame is inside the called method's chain; a rejection
of a promise the method started and did not await is a product defect to fix, not
a record to claim. Claimed records go to the artifact;
the judgement is made once, by the process that executed the test.

The host provides `goodfootTestVerbose` and `goodfootNativeCapture` booleans through
Vitest `provide`; Worker tests use `inject`. Do not read the host environment from
an auxiliary Worker. Without an owning launcher, the fixture does not frame
errors. Verbose mode disables the introduced console policy and native capture,
leaving the original stack and inherited streams intact.

## Artifacts and limits

Captures live under the operating system temporary directory in
`goodfoot-test-output-<worktree/package-hash>-<unique-run>/`. Native captures include
`owner.txt`, `expected-native.log` (framed and workerd records), and
`test-verdicts.jsonl`; supplemental console
captures include `unhandled-console.log`. Failure output identifies the complete
artifact. Files are created privately; empty successful native-capture directories
are removed. Nonempty evidence is retained until temporary-directory cleanup.

Native frames are bounded to 32768 decoded bytes and 65536 buffered input bytes,
and so are workerd record lines. A run accepts at most 4096 deferred record
metadata entries (framed and workerd records together) and a 1048576-byte
verdict file. Complete diagnostic text streams to disk; only the last 8192 bytes
are retained for terminal replay. Overflow, malformed ownership, write/read errors,
and pipe failures remain visible and fail closed. Truncated excerpts are labelled.

## Acceptance

Exercise existing product negatives through their package commands. Reversible
checks should cover an assertion with emitted logs, import/setup/teardown failures,
a test-isolate unhandled error, an unexpected auxiliary Worker error, a child
process failure, and bounded capture replay. Check actual emitted lines, not
sentinels appearing only inside assertion source excerpts. Restore test files.

Compare quiet and verbose root/package/workspace runs and their executed counts.
Warm a Vitest result, verify that verbose invocations execute without reading
or publishing it, then verify that quiet mode still reuses the original record.
