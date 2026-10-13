# Cache input audit utilities

Run these from the repository root with a path to a Vitest config whose cache contract is an object:

```sh
node packages/vitest-cache/scripts/list-unlisted.ts <package>/vitest.config.ts
node packages/vitest-cache/scripts/audit-unlisted.ts <package>/vitest.config.ts
node packages/vitest-cache/scripts/audit-unlisted.ts <package>/vitest.config.ts --all
node packages/vitest-cache/scripts/read-sites.ts <package>/vitest.config.ts --all
```

The inventory reports selected, unlisted, stale, and unmatched input paths. The import audit follows local TypeScript imports and flags modules that use filesystem, subprocess, SQLite, or TypeScript compiler I/O. `read-sites` reports likely filesystem and subprocess call sites with line numbers. Review each reported call path to determine its actual input: an import can be present without being called, and some reads use temporary files. The scripts do not infer a safe cache declaration automatically.
