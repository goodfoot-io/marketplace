# Changelog

## 1.1.0

- Added `afterAllInstalled` hook to re-symlink per-workspace `node_modules` into the worktree's own root `node_modules` after install completes
- Added `createInternalSymlink` utility function

## 1.0.1

- Initial release of the worktree isolation plugin
- Added automatic detection and removal of external symlinks in git worktrees
- Added support for monorepo workspaces with multiple node_modules directories
- Added environment variable controls: `WORKTREE_ISOLATION_DISABLE` and `WORKTREE_ISOLATION_VERBOSE`
