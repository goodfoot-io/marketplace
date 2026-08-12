# Changelog

## 1.1.2

- Fixed self-referencing symlinks that could be created during worktree isolation
- Fixed stale state issues when running installs across multiple worktrees

## 1.1.2

- Fixed self-referencing symlink bug in `createInternalSymlink` when symlink parent directory equals root node_modules
- Fixed stale `pendingResymlinks` state leaking across failed installs
- Added guard to skip re-symlinking node_modules paths that are direct children of the root node_modules

## 1.1.1

- Added NPM publishing URL to package metadata

## 1.1.0

- Fixed workspace `node_modules` symlinks in monorepos: after removing external symlinks, the plugin now re-creates per-workspace `node_modules` as internal symlinks pointing to the worktree's own root `node_modules`

## 1.1.0

- Added `afterAllInstalled` hook to re-symlink per-workspace `node_modules` into the worktree's own root `node_modules` after install completes
- Added `createInternalSymlink` utility function

## 1.0.1

- Initial release of the worktree isolation plugin
- Added automatic detection and removal of external symlinks in git worktrees
- Added support for monorepo workspaces with multiple node_modules directories
- Added environment variable controls: `WORKTREE_ISOLATION_DISABLE` and `WORKTREE_ISOLATION_VERBOSE`
