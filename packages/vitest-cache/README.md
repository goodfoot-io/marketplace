# Vitest result cache

`withTestOutput(config, contract, sequence?)` installs this package's Vitest
sequencer and reporter. Run `yarn test` in this package;
`yarn test <file> -t <name>` invokes Vitest with native selectors.

## Usage

A package lists `@goodfoot/vitest-cache` as a `workspace:*` dev
dependency and wraps its Vitest configuration:

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

## Keys

A file's key has five components:

| Component | Contents |
| --- | --- |
| invocation | Node and Vitest versions, platform, Node `execArgv`, parsed semantic CLI options, the root config path, and the environment contract |
| execution | project, file, pool, isolation, line/name/ID/tag filters, and (for non-isolated projects without a hygiene gate) the project's selected files |
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
| `fallback` | inputs for files not listed in `files`. Required when any selected file is unlisted; without it that file runs uncached |
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

Run `yarn lint`, `yarn typecheck`, `yarn test` and `yarn build` in this directory.
The scripts in [package.json](./package.json) run the tools directly.

The package typecheck runs two compiler programs. `tsconfig.json` checks source,
tests, scripts and `vitest.config.ts`. `tsconfig.implementation.json` additionally
checks runtime JavaScript and TypeScript with stricter settings. Its explicit
JavaScript roots prevent adjacent declaration files from hiding implementation
bodies. The build configuration emits source TypeScript to `dist`.

Compilation uses stable TypeScript 7. The audit scripts use Microsoft's
`@typescript/typescript6` compatibility package for the earlier compiler API.
The pinned Vitest declaration patch gives `configureVitest` the ordered hook
type its runtime supports, preserving the teardown hook's `post` order. Remove
the patch when Vitest includes that declaration.

`yarn release:dry-run` previews the shared repository release script;
`yarn release` runs it for this package.
