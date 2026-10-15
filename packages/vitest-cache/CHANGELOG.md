# @goodfoot/vitest-cache npm package changelog

## 1.0.3

- Fixed release linting by building the linked jsdoczoom workspace before validation.

## 1.0.2

- Fixed immutable dependency installation by synchronizing the CLI path in the Yarn lockfile.
- Fixed package validation to allow the changelog included in release tarballs.

## 1.0.1

- Added content-based caching of passing Vitest results, with output checks and automatic invalidation when test inputs change.
- Improved fingerprint performance with parallel workers, asynchronous filesystem checks, bounded streaming reads, and persistent digest inventories.
- Fixed cache reuse across Git worktrees sharing an installed runtime while preserving invalidation when provider files change.
- Fixed installed-package hashing to include root permissions and distinguish file-content boundaries.
- Added a public package with plain Node imports, TypeScript declarations, a Vitest executable, and a native metadata checker compiled during installation.
