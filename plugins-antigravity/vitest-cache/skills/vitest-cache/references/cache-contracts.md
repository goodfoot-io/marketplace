# Cache contracts

Declare inputs read outside static imports: fixtures, config/data files, directory listings, generated artifacts, subprocess tools and runtime entry points. Test-file keys and path globs are repository-relative. Shape validation does not prove that a contract covers actual reads.

```json
{
  "all": ["config/test-defaults.json"],
  "files": {
    "packages/example/test/parser.test.ts": ["packages/example/test/fixtures/**"]
  },
  "fallback": []
}
```

For partial adoption, list reviewed `files` and omit `fallback`; unlisted diagnostics are expected. Empty fallback requires auditing every unlisted test. Trace actual calls/defaults, including persisted caches and ancestor config. Keep outside-repository reads uncached; never mock for eligibility. Repair fixed-path isolation with unique owned resources/cleanup. Test-created state derived from keyed code is not pre-existing input. Distinguish executed initializers/calls from unused definitions. Vite config disabling does not stop startup workspace/package discovery or default module-cache state outside owned fixtures. Conditional ambient reads require uncached execution whenever their selectors enable them.

| Field | Declare |
| --- | --- |
| `all` | Extra input globs for every selected test. |
| `projects` | Exact project name → extra input globs. |
| `files` | Exact repository-relative test path → extra input globs. |
| `fallback` | Extra inputs for unlisted test files; omission makes them uncached. |
| `opaqueImports` | Generated module globs the import walker must not enter; declare their build inputs separately. |
| `dynamicImports` | Importer path → globs covering non-literal `import()` and `require()` targets. `[]` means targets are not repository files; verify that claim. |
| `roots` | Additional modules executed in the test runtime. |
| `hostRoots` | Additional modules executed or bundled on the host. |
| `wrangler` | Cloudflare pool Wrangler configs; includes sibling `.dev.vars*` and `.env*`. Required for cached Cloudflare pool projects. |
| `toolchain` | Installed package names used outside imports, including subprocess tools. |
| `executables` | PATH executable names, hashed by content. |
| `hostImportAliases` | `{ importer, from, to }` redirects matching the actual host plugin's `resolveId` edge. `from` is the literal specifier; importer/target may be absolute or repository-relative. |
| `sharedStateHygiene` | Non-isolated project name → setup file that resets or rejects shared state for each file. Without it, selected files participate in the key. |

`roots`, `hostRoots`, `wrangler`, `toolchain` and `executables` each use a scoped object: `{ all?: string[], projects?: Record<string, string[]>, files?: Record<string, string[]> }`. Do not supply bare arrays for these fields.

Static test/setup/host graphs, local manifest/tsconfig chains and reached installed closures are automatic inputs. Node builtins are runtime inputs; toolchains resolve from the project root, including nested installations. The worker key hashes Vite-resolved environment values overridden by `test.env`. Inspect loader/serialization code; never open `.env` files or dump secrets. Declare additional reads only; avoid package-wide globs.

Default/true inline projects inherit root policy plugins; false/string-base projects receive their own. Preserve inheritance; fix wrapper duplication rather than adding consumer workarounds. Vitest 5 reporters belong at the root, outside `defineProject`. Keep `setupNeeded` gates in test plumbing; emitted public helpers need runtime dependencies. Native startup may read ambient locale/user/system-library state despite owned resources.

Audit executed APIs, not module names: string parsing/rendering differs from compiler programs/file loaders. Trace template includes/layouts/callbacks. Config/module resolution can scan ambient types and ancestors beyond fixtures, including above an owned subprocess cwd. Declare actual resolved inputs or leave those consumers uncached. Missing paths are inputs too: preserve declarations whose absence is observed. `unmatchedInputs` requests review; an intentional absent path is valid and its creation must invalidate reuse.

For audits in this repository, run from its root:

```sh
node packages/vitest-cache/scripts/list-unlisted.ts <package>/vitest.config.ts
node packages/vitest-cache/scripts/audit-unlisted.ts <package>/vitest.config.ts --all
node packages/vitest-cache/scripts/read-sites.ts <package>/vitest.config.ts --all
```

Audits require concrete object-form cached configs; factories, promised projects and explicit uncached suites are unsupported. Read-site reports recognize bare/node: fs and subprocess default/namespace/renamed bindings but remain syntactic; inspect transitive/subprocess calls and mocks. Inventory `fallback: null` means omitted; `[]` means explicitly empty. Explicit uncached runs may omit summaries/reasons; verify their contract and repeated full execution, including conditional branches.

Audits omit subprocess closures: declare fixtures/helpers in scoped `roots`, loaders in `toolchain`, absent selectors in `files`. Isolate unintended child destinations; hashing paths does not capture their state. Keep unresolved optional imports uncached; never silence them with empty domains. Real IO can be cacheable when directories, loopback services and probed PIDs belong to test-created resources; preserve lifecycle coverage.

Control incidental loader inputs with explicit config/cache/binary selection and declared roots. Preloads can initialize before CLI flags; control only unintended child preloads, preserving host policy. Own loader IPC/temp directories through child completion, then cleanup after assertions. Declare the executable actually invoked; PATH names do not cover different absolute binaries. For dead-process tests, spawn a real owned child, capture identity and confirm exit before reclamation. Generate foreign hosts distinct from hostname(). For generated Yarn consumers, set the intended version, owned lock boundary and linker. Inspect launcher form; install built publication files from a stable owned snapshot to avoid concurrent cleanup races. Uncontrolled network/install inputs remain uncached.

Preserve asset-transform plugins. For opaque generated imports, declare artifact bytes and actual build inputs; review runtime plugin handling when the TypeScript audit cannot resolve an asset.

Update declarations with new reads, generated entrypoints or dynamic imports.
