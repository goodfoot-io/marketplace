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

Only use this empty fallback when every unlisted test has no additional non-import inputs. For live services or uncontrolled inputs, pass `{ uncached: 'reason' }` instead of declaring reuse.

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

Static test/setup graphs, the configuration's host graph, local manifest/tsconfig chains and reached installed package closures are automatic inputs. Declare only the additional reads the graph cannot see. Avoid package-wide globs that unnecessarily invalidate unrelated tests.

For audits in this repository, run from its root:

```sh
node packages/vitest-cache/scripts/list-unlisted.ts <package>/vitest.config.ts
node packages/vitest-cache/scripts/audit-unlisted.ts <package>/vitest.config.ts --all
node packages/vitest-cache/scripts/read-sites.ts <package>/vitest.config.ts --all
```

These utilities require a concrete object-form config with a cached contract; function configs, promised projects and explicit uncached suites are unsupported. Review reported IO call paths and unresolved edges manually. A syntactic read can be unused or target temporary files; the audit does not certify safe reuse.

Keep declarations near their config and update them with any new filesystem read, generated entry point or dynamic import. Confirm invalidation by changing the actual input and running the affected test.
