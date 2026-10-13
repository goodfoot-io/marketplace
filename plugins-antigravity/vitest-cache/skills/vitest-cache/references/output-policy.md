# Output policy

`withTestOutput` installs the result sequencer, cache reporter, diagnostic reporter and custom-pool teardown guard. Quiet mode uses Vitest's `silent: 'passed-only'`; preserve the original reporters and structured diagnostic assertions.

Unclaimed stderr fails the run and blocks a reusable pass. An existing `onConsoleLog` filter is honored; do not add a blanket filter to make warnings disappear. Failed/import/setup/unhandled errors retain bounded console evidence. Teardown timeouts or rejected worker stops veto publication even when assertions passed.

## Native Worker capture

Use `goodfoot-vitest run` for quiet workerd suites whose native diagnostics need ownership checks. The launcher captures child stdout/stderr, sets `GOODFOOT_TEST_OUTPUT_RESULT` and `GOODFOOT_VITEST_CACHE_ACK`, and commits staged cache records only after capture accepts the run. Leave those two environment variables launcher-owned. Watch and verbose invocations pass through without capture.

Fixture fault sites may call `frameExpectedNativeError(error, token)` from `@goodfoot/vitest-cache/native`. The token is fresh per expectation and matches the 36-character lowercase hex/hyphen shape. The helper preserves Error identity/message and frames the stack with `__GOODFOOT_EXPECTED_NATIVE__`; never frame production errors.

The owning Vitest test registers `task.meta.goodfootExpectedNative = [{ token, message }]` and sends the token with its fixture request. Each record must match exactly one passed-test expectation; absent, duplicated, unmatched or failed-test claims fail capture. Do not infer ownership from a passing assertion, nearby test name, severity or message substring.

Worker tests read host policy through Vitest `inject('goodfootTestVerbose')` and `inject('goodfootNativeCapture')`. Only frame fixtures when a capture boundary is present; do not read the host environment from an auxiliary Worker.

Workerd's own unframed diagnostics use `task.meta.goodfootExpectedWorkerd = [{ shape, message, count }]`. Supported shapes are `promise-rejection`, `io-context-rejection`, `reader-canceled`, `pump-canceled`, `request-hung`, `wasm-trap`, `stale-wasm-rejection` and `rpc-rejection`. Match the exact runtime message, required stack/trace and per-run count against the installed package's catalogue; use no wildcard claim. A floating promise rejected outside the called method's awaited chain is a defect to fix.

## Investigate failures

Read the reported private artifact directory under the OS temporary directory, `goodfoot-test-output-<worktree/package-hash>-<unique-run>/`. Native evidence is in `expected-native.log` and `test-verdicts.jsonl`; supplemental console evidence is in `unhandled-console.log`.

Frames are bounded to 32768 decoded bytes; lines/input buffering to 65536 bytes; record metadata to 4096 entries; verdict inventory to 1048576 bytes. Terminal replay retains the last 8192 bytes. Consult the complete artifact when output says it was truncated; fix overflow, malformed claims or IO failures rather than treating them as a pass.

Reproduce the actual failing diagnostic or teardown path and verify its nonzero exit. Then rerun the normal quiet command to verify cache publication. Verbose runs neither read nor publish result records.
