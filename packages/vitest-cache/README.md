# Vitest result cache

`withTestOutput(config, contract, sequence?)` installs this package's Vitest
sequencer and reporter. Run `yarn test` in this package;
`yarn test <file> -t <name>` invokes Vitest with native selectors.

## Usage

Use a Git checkout, Yarn's `node-modules` linker with root
`node_modules/.yarn-state.yml`, POSIX `flock`, and Node 24 or newer.
Linux and macOS installations require a C11 compiler (`cc`, or the executable
selected by `CC`) and enabled package install scripts. The install script builds
the required Node-API metadata checker locally using bundled, licensed Node
headers; Python, make and downloaded Node headers are unnecessary. Install fails
if compilation fails; fresh installations with scripts disabled leave the checker
unavailable and cache imports fail. macOS requires the Xcode command line tools.
Vitest and Vite are required peers; supported ranges are in
[package.json](./package.json). Install the published package with:

```sh
yarn add -D @goodfoot/vitest-cache vitest@^5.0.4 vite@^8.3.4
```

Exports and the executable use compiled ESM in `dist`; consumers need no
TypeScript loader or local Vitest patch. Resolve install warnings, including
compatible Node types, esbuild and matching coverage providers.

In this repository, add `"@goodfoot/vitest-cache": "workspace:*"` to the
consumer's devDependencies, install with Yarn, then run
`yarn workspace @goodfoot/vitest-cache build` before consumer checks.
Wrap the existing config once.
Preserve selectors, pools, projects, setup, isolation, plugins and reporters;
inline projects and config factories are handled by the wrapper:

```ts
import { defineConfig } from 'vitest/config';
import { loadCacheContract, withTestOutput } from '@goodfoot/vitest-cache/policy';

export default withTestOutput(defineConfig({ test: {} }), loadCacheContract(new URL('./vitest.cache.json', import.meta.url)));
```

| Entry point | Contents |
| --- | --- |
| `@goodfoot/vitest-cache/plan` | `setupNeeded` for global setup functions |
| `@goodfoot/vitest-cache/policy` | `withTestOutput`, `loadCacheContract`, `loadTestSequence` |
| `@goodfoot/vitest-cache/native` | `frameExpectedNativeError` for test-fixture fault sites |
| `@goodfoot/vitest-cache/verbose` | `testVerbose`, the `GOODFOOT_TEST_VERBOSE` parser |
| `goodfoot-vitest` (bin) | Vitest entry for workerd-pool suites: `goodfoot-vitest run` captures child output and commits cache results only after the capture check passes |

[OUTPUT.md](./OUTPUT.md) describes the output policy these entry points enforce.

### Adopt and verify

Audit non-import reads in both tests and their implementation defaults. This
includes fixtures, subprocess entry points, persisted application caches and
ancestor config/ignore files. For partial adoption, list reviewed `files` in
`vitest.cache.json` and omit `fallback`: other files execute uncached. Inputs
outside the repository cannot be declared; preserve their test coverage rather
than mocking them for eligibility. See [Contracts](#contracts).
The read-site CLI recognizes bare and `node:` filesystem/subprocess imports,
including default, namespace and renamed named bindings. It remains syntactic:
inspect transitive/subprocess calls, arguments and import-time initializers.
Unused definitions alone do not establish executed IO.
Conditional ambient reads require uncached execution whenever their environment
selectors enable them; a hashed path does not capture external file contents.
Fixed-path test isolation can be repaired with unique owned paths and cleanup while
retaining real IO; this preserves coverage and avoids cross-run contamination. The inventory's
`fallback: null` denotes omission; `[]` denotes an explicit empty declaration.
Test-owned subprocesses, loopback services and PID records can be cacheable;
distinguish them from ambient daemon state and arbitrary PID probes. Preserve
the real lifecycle checks.
Classify the API actually executed: supplied-string parsing/rendering can be
narrower than a compiler program or file renderer. Inspect template includes,
layouts and callbacks. Compiler programs and module/config resolution can scan
ambient types and ancestors outside fixture trees. Declare those inputs or leave
their consumers uncached. Disabling Vite config loading does not bound real
server/project startup: it still discovers ancestor package/workspace markers
and derives default module-cache state from the discovered workspace.
An owned child cwd does not bound a loader’s automatic
ancestor configuration discovery. A missing path can be a real input: an unmatched declaration needs review, and creation
of an intentionally absent input must invalidate its consumer.
Audit module counts omit subprocess closures. For forked fixtures/helpers, declare
runtime entrypoints in scoped `roots`, loaders in `toolchain`, and observed absent
compiled selectors in `files`. Inspect inherited child variables selecting files,
sockets or services; isolate unintended destinations with real owned resources.
CLI config/cache flags can apply after inherited preloads initialize. Trace
startup order and control unintended preloads only in the test child, preserving
host loader policy. Own loader IPC/temp directories and clean up after assertions
and child completion. Declare the executable actually invoked; a PATH declaration
does not automatically cover a different absolute executable.
Hashing a destination's path does not capture its filesystem state. Keep unresolved
optional imports uncached until their targets or meaningful absence are covered.

Use an absolute package workdir on every exec call, or `yarn workspace <name> …`;
cwd does not persist. Confirm each dependency edit and install succeeds before continuing.
Generated Yarn consumers need an explicit version selector, owned lockfile
boundary and linker config. Inspect the current launcher; it may be an executable
wrapper. Install actual built publication files from a stable owned snapshot
so parallel cleanup cannot race with package copying. Keep uncontrolled network
or installation inputs uncached.

Include `vitest.config.ts` in the package's normal typecheck. Yarn peer contexts
can give identical Vite/Vitest versions incompatible types; the policy's public
signature preserves the consuming config's types. Keep `defineConfig` checking
and resolve integration errors rather than casting. Exclude generated outputs
from lint and verify lint still passes after build. Check ignores from the package
workdir: a root `.prettierignore` may not apply. Inspect with
`yarn exec prettier --file-info <artifact>`; `yarn prettier` invokes a same-named script.
Audit test/config compiler roots separately from source-only artifact entrypoints.
Newly checked tests can expose stale SDK fixtures; supply required fields and assert
precise output structures. Keep build inputs unchanged when broadening typechecks.
Include the UI compiler/lint roots when relevant. Review unsafe autofixes for lost
reactive dependencies, focusability or event handlers; repair behavior without
suppressing rules. Preserve asset-transform plugins and declare both generated
opaque artifact bytes and their real build inputs.

Before the full suite, review deliberate warnings/errors. Own them with scoped
console or `process.stderr.write` spies with exact payload/count assertions and
restoration in `finally`. Specify expected payloads independently per case,
defaulting to empty; comparing captured calls against captured text does not own
diagnostics. For runtime-created errors, validate type, message and phase before
asserting the original stack. Synchronous subprocesses need their
own timeout: Vitest's timer cannot interrupt a blocking call. Use a direct executable
and set its bound below the outer test budget when fixing slow CLI tests.

For Vitest 5 migrations, review public `Matchers` augmentation, `provide`/`inject`
transport and `task.fullTestName` teardown keys. Assert real cleanup state between
tests and after the last. Imported native services can register exit hooks that
overwrite failure status or emit errors after the test summary; a bounded child
regression should verify the requested failure status and empty stderr. Remove
only inappropriate library hooks when awaited teardown owns cleanup, keeping signals.
Keep cache-planning gates in package-local test plumbing. Dependencies used by
emitted public helpers belong in runtime dependencies.
Inline projects inherit root policy plugins by default or with `extends: true`;
independent or different-base projects receive their own. Preserve inheritance.
Vitest 5 reporters belong at the root, outside `defineProject`.

Run the package's actual test command with stable selection, environment
(including `TMPDIR`) and installation:

1. Require a clean cold run with coverage, miss counts and diagnostics. Derive
   counts from executed per-file reporter output: list metadata can undercount
   generated tests. Only then repeat and require positive reuse counts.
2. Change a declared non-import input when one exists; otherwise change an imported
   source and identify this as import-graph invalidation. Confirm its consumer executes
   while an unrelated file remains reusable, then restore it. Preserve existing tests;
   do not create fixtures solely to manufacture a probe.
   Report unrelated reuse as N/A when no eligible nonconsumer exists, including
   shared inputs consumed by every eligible file. A failing-test probe can
   independently demonstrate unrelated reuse; do not manufacture another input.
3. Add a temporary failing assertion and run twice: both must execute and return nonzero;
   restore the test. Run scoped lint, typecheck and build.

For live effects, assert owned state and actual invocation evidence. A denied
command should leave its owned marker absent and record the attempted invocation;
model prose can repeat command tokens. Preserve successful CLI status and denial
reason assertions.

Explicit `{ uncached }` runs may omit summaries and reasons. Verify the supplied
contract and repeated full execution, including conditional branches.

Build before the baseline and rebuild after restoring probe edits. Compare runtime
artifact bytes when claiming declaration-only invalidation. Standard bare Node
imports are supported; investigate walker errors rather than rewriting imports.
Runner toolchain packages resolve from the consuming project's root, including
nested Yarn installations; do not mask lookup errors with extra root dependencies.

A fully reused run can print `No test files found, exiting with code 0`.
Confirm the cache summary reports reused files; exit code 0 alone is insufficient.
Report both executed and reused tests so partial runs account for total coverage.
An install change need not invalidate result keys: reached installed closures
participate in result keys, while installation state keys the separate module cache.

If resource contention makes cold timing suspect, repeat the actual command with
a fresh isolated `TMPDIR` for result/digest caches and require `miss: new` counts.
Run warm with that same environment and installation; report wall and fingerprint
times. Preserve the shared module cache. FORCE executes tests but does not make
existing digest records cold.

## Keys

A file's key has five components:

| Component | Contents |
| --- | --- |
| invocation | Node and Vitest versions, platform, Node `execArgv`, parsed semantic CLI options, the root config path, and the environment contract |
| execution | project, file, pool, isolation, effective Vite/`test.env` worker environment, line/name/ID/tag filters, and (for non-isolated projects without a hygiene gate) the project's selected files |
| inputs | the test file's module graph, setup-file graphs, the host graph (runner config, its build-time imports, global setup, declared host roots), nearest `package.json` and `tsconfig.json` chains of every local graph file, and declared non-import inputs |
| packages | installed package closures reached by any graph plus the runner toolchain (`vitest`, `vite`, the Cloudflare pool, test environments, `tsx` when loaded) |
| executables | declared PATH executables, by content |

Record contents include these component digests. A miss reports which
components changed since the file's last recorded pass, `new` for a file with
no recorded pass, `unrecorded` when the components match but the record was
revoked, or `forced`. Files whose key cannot be computed (an undeclared
dynamic import, a file outside the contract) run and are counted as
uncacheable, with the reason printed before the run.

The per-file options come from `parseCLI`. Arguments that only select files,
projects, shards, or output (`--project`, `--shard`, positional filters,
`--silent`, `--bail`, …) are excluded, so `vitest run`, `vitest run a.test.ts`
and `vitest run a.test.ts b.test.ts` share A's result. `-t` stays in the key;
a name-filtered pass is never reused for an unfiltered run.

### Environment contract

The execution component hashes the worker environment Vitest serializes: Vite
resolved values followed by `test.env` overrides. The cache uses those resolved
values without reopening `.env` files or logging their contents. Inspect framework
loader and serialization code when auditing host inputs.

`src/environment.ts` lists the reviewed exclusions. Agent session, trace and
terminal/editor metadata (`CODEX_*`, `CLAUDE_*`, `ANTIGRAVITY_*`, `TRACEPARENT`,
`TERM_PROGRAM`, …), plus Turborepo's task hash (`TURBO_HASH`), UI mode
(`TURBO_IS_TUI`) and invocation directory (`TURBO_INVOCATION_DIR`, the absolute
directory `turbo` ran from), is removed from both the key and the environment cached
suites execute with. Other `TURBO_*` variables remain significant, including
the application port in `TURBO_IS_MFE`. Launcher and cache-control variables (`npm_*`, `YARN_*`,
`GOODFOOT_VITEST_*`, …) stay in the environment but not the key. `PATH` entries
are literal except Yarn launcher folders and `node_modules/.bin` folders inside
the active worktree. Every other variable is significant.

## Contracts

The second argument of `withTestOutput` is required.

- `{ uncached: '<reason>' }` — live-system and measurement suites. No reuse,
  no publication.
- An object contract names inputs read outside the import graph:

| Field | Meaning |
| --- | --- |
| `all`, `projects`, `files` | repository-relative globs for every file, a project, or one file |
| `fallback` | optional inputs for files not listed in `files`; omission keeps those files uncached |
| `opaqueImports` | generated modules the import graph does not enter, such as a Rust Worker build; their build inputs must be declared |
| `roots` | extra modules executed in the test runtime, such as a Wrangler `main` |
| `hostRoots` | modules executed or bundled on the host, such as esbuild entrypoints |
| `wrangler` | Wrangler configs loaded by the Cloudflare pool; adds sibling `.dev.vars*` and `.env*`. Required for Cloudflare pool projects |
| `toolchain` | installed packages used outside imports (for example through a subprocess) |
| `executables` | PATH executables |
| `dynamicImports` | module → globs covering its non-literal `import()`/`require()` targets |
| `hostImportAliases` | `{ importer, from, to }` entries redirecting one host graph import edge, mirroring a host-side Vite plugin's own `resolveId` redirect (absolute or repository-relative `importer`/`to`; `from` is the literal specifier being replaced) |
| `sharedStateHygiene` | non-isolated project → the setup file that resets or rejects shared state per file |

Large per-file tables live in a JSON file loaded with `loadCacheContract`, so
editing one file's declaration does not change the runner configuration's
digest for every other file.

Non-literal dynamic imports and `require`/`createRequire` calls without a
declared domain make that file run uncached. An empty domain (`[]`) declares
that the targets are not repository files, such as `data:` URLs.

## Scheduling

`ContentCacheSequencer.sort` follows Vitest's `BaseSequencer.sort`: group
order, project, isolation, then failed-first and longest recorded duration
when Vitest's `results.json` has both files. Where that history is missing,
Vitest compares file sizes. A project can instead declare its heaviest files,
heaviest first, as `withTestOutput`'s third argument:

```js
withTestOutput(config, contract, loadTestSequence(new URL('./vitest.sequence.json', import.meta.url)));
```

Declared files then run first in that order and undeclared files follow
alphabetically. Recorded durations still win when both files have them. A
declared file that no longer exists fails config load. The declaration changes
dispatch order only, not which files run or their cache keys.

## Phases

1. Before global setup, the reporter takes the package test lock, keys every
   selected file (after sharding), and publishes the execution plan.
   Global setup functions call `setupNeeded(project, predicate)` from
   `@goodfoot/vitest-cache/plan` and skip work no pending file needs.
2. After global setup, the sequencer re-keys every file. Only a record for
   this post-setup key is reused.
3. After the run, the reporter re-keys each passing executed file. Records
   are staged only when this key equals the phase-2 key.

Symlink target resolution treats only `ENOENT` and `ENOTDIR` as dangling or missing. Permission, I/O and other unexpected filesystem failures propagate; they cannot produce a reusable missing-input marker.

Each phase revalidates input graph and filesystem observations. Repeated digest
requests share phase-local memoized results; file and tree requests have distinct
memoization keys. Installed package and executable digests can reuse disk records
when every member's metadata (device, inode, size, mode, mtime, ctime) matches and
no member changed within two seconds of the recorded digest. Changed metadata or
recent timestamps require hashing the bytes again. This does not guarantee one
physical read or stat per path across every kind of request.

## Publication

Staged records are committed after Vitest finishes global teardown and every
pool worker has stopped. A global-teardown failure, a pool worker that fails to
stop within `teardownTimeout`, an unhandled error, or an interruption vetoes the
whole stage. A project with a custom `poolRunner` (the Cloudflare pool) must be
covered by the worker-teardown ledger that `src/test-worker-teardown.mjs`
installs through `withTestOutput()`; without it nothing is recorded.
A command that checks output after Vitest exits (the Worker suite's native
diagnostic capture) sets `GOODFOOT_VITEST_CACHE_ACK`; Vitest then writes the
stage to that path and the command commits it with `commitStage` only after
its own check passes.

Files that pass in a run where other files fail assertions are recorded: each
file's key already covers its inputs and, for shared-state projects, its
selection.

A file that fails revokes any record for its key.

`GOODFOOT_VITEST_FORCE=1` executes every selected file and publishes passing
results. `DISABLE_TEST_CACHE=true`, `GOODFOOT_TEST_VERBOSE=1`, watch,
coverage, snapshot update, inspector, UI/browser, typecheck mode, output
files, non-console reporters, Node preloads/loaders other than `--import tsx`,
`NODE_V8_COVERAGE`, `NODE_PATH`, `TS_NODE_*` and `TSX_*` neither reuse nor
publish.

Records live under `$TMPDIR/goodfoot-vitest-cache/<common Git directory
hash>/`, shared by the repository's worktrees.

## Execution lock

Each run takes `tests:<package>` in the worktree's `goodfoot-vitest-locks`
directory, unless an ancestor process already holds it. Watch mode takes no lock.

## Module cache

Vitest's module cache, configured through `fsModuleCache`, lives under
`node_modules/.experimental-vitest-cache/<install hash>/`, keyed by
`node_modules/.yarn-state.yml` and shared by every run that resolves this
package against that install. Vitest deletes a cache directory whenever its
own lockfile check disagrees with the directory's metadata, so a run whose
nearest install state differs from the one that keys the directory runs
without the module cache instead of sharing it.

Keep the key to the install alone. Shared caching between worktrees is the
goal, so never add the checkout, package or process to the key to stop one run
from deleting another's directory. Doing so fragments the cache and hides the
cause. Fix a deletion by finding the run whose lockfile check disagrees, and
keep that run off the shared directory.

## Validation and release

Run `yarn lint`, `yarn typecheck`, `yarn test`, `yarn build` and
`yarn test:package` in this directory. The last check packs and installs the
actual tarball into a separate Git/Yarn consumer using public, unpatched
Vitest/Vite. It verifies plain Node imports and the executable, strict consumer
types, cold/warm reuse, input/provider invalidation, failure twice and restored
reuse. The release workflow requires this check before publishing.

The package typecheck runs two compiler programs. `tsconfig.json` checks source,
tests, scripts and `vitest.config.ts`. `tsconfig.implementation.json` additionally
checks runtime JavaScript and TypeScript with stricter settings. Its explicit
JavaScript roots prevent adjacent declaration files from hiding implementation
bodies. The build cleans `dist`, emits checked TypeScript and JavaScript,
retains public declarations/context augmentation, and rewrites declaration
module specifiers to emitted extensions. `prepack` rebuilds; the tarball contains
only `dist`, package metadata and the README/output guide.

Compilation uses TypeScript 7. Build/audit scripts and the isolated consumer
use Microsoft's `@typescript/typescript6` compiler API/compatibility package.
The local Vitest declaration patch lets implementation checks express the
teardown hook's runtime-supported `post` order. Public consumers do not need
that patch; remove it locally when Vitest corrects the declaration.

`yarn release:dry-run` previews the shared repository release script;
`yarn release` runs it for this package.
