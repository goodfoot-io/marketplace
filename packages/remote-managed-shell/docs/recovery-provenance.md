# Recovery provenance

The implementation deliberately reuses the prior recovery archive.

- `recovered/attempt-2/src/contracts.ts`, `errors.ts`, and cursor/UTF-8 utilities supplied the tool schemas, descriptions, recovery codes, result vocabulary, and authenticated cursor design. They were reformatted for this workspace and reconciled with runtime byte limits.
- `reconstructed/attempt-1/src/adapters/adapter.ts` supplied the pipe/optional-PTY adapter with its TypeScript overload repair. `scope-worker.ts` and `group-probe.ts` supplied the process-group anchor and platform probes. The PTY environment and EOF boundary were corrected during integration.
- Attempt 2's helper-process logger supplied the isolation model. Queue accounting and repeated-failure behavior were made single-source and idempotent.
- The reconstructed component tests were ported into the package test layout and extended with manager, HTTP, OAuth, and retry tests.

Recovery-only npm manifests, package locks, dependency artifacts, `not-a-server.mjs`, and validation manifests were not copied. The workspace uses Yarn 4 and the repository root lockfile.
