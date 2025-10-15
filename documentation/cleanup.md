# Cleanup Guide for Production Release

This document lists all directories and files that should be removed before production release. All dot directories (`.claude`, `.vscode`, etc.) are kept as they may contain important configuration.

## Directories to Remove

### Documentation (entire directory)
- `/workspace/documentation/` - Contains internal development documentation, test agent docs, and Claude Code configuration guides that are not needed for production

### Build Artifacts
- `/workspace/build/` - Contains TypeScript build artifacts (`.tsbuildinfo-hook`)

### Environment Configuration
- `/workspace/environment/` - Contains development environment files (`.env.branch.main`)

## Root-level Files to Remove

### Analysis and Investigation Documents
- `/workspace/codex-summary.md` - Internal development summary
- `/workspace/decoration-clear-analysis.md` - Internal analysis document
- `/workspace/duplicate-id-root-cause-analysis.md` - Bug investigation documentation
- `/workspace/fix-summary.md` - Internal fix tracking
- `/workspace/optimization-investigation-summary.md` - Performance investigation notes
- `/workspace/optimization-plan-v2.md` - Internal optimization planning
- `/workspace/REFACTORING_REPORT.md` - Internal refactoring documentation

### Test and Measurement Scripts
- `/workspace/measure-extension-startup.js` - Development performance testing script
- `/workspace/measure-git-discovery.js` - Development testing script
- `/workspace/test-decoration-issue.js` - Development debugging script

### Configuration Files to Remove
- `/workspace/.claude-next-command` - Claude Code internal state file
- `/workspace/knip.config.json` - Unused dependency detection (development only)

## Files to Keep

### Essential Configuration
- `/workspace/package.json` - Project manifest (REQUIRED)
- `/workspace/tsconfig.json` - TypeScript configuration (REQUIRED)
- `/workspace/yarn.lock` - Dependency lock file (REQUIRED)
- `/workspace/.yarnrc.yml` - Yarn configuration (REQUIRED)
- `/workspace/eslint.config.mjs` - Linting configuration
- `/workspace/prettier.config.mjs` - Code formatting configuration
- `/workspace/.prettierignore` - Prettier ignore rules
- `/workspace/.gitignore` - Git ignore rules
- `/workspace/CLAUDE.md` - Project instructions (may be useful for future development)

### Directories to Keep
- `/workspace/packages/` - Contains the actual extension code (compare-branch-extension-v3)
- `/workspace/.git/` - Git repository metadata
- `/workspace/.githooks/` - Git hooks
- `/workspace/.claude/` - Claude Code configuration
- `/workspace/.cursor/` - Cursor IDE configuration
- `/workspace/.devcontainer/` - Development container configuration
- `/workspace/.vscode/` - VS Code workspace settings
- `/workspace/.yarn/` - Yarn package manager files
- `/workspace/node_modules/` - Dependencies (managed by package manager)

## Cleanup Command

To remove all unnecessary files and directories for production:

```bash
# Remove documentation directory (but keep this file first if needed)
rm -rf /workspace/build
rm -rf /workspace/environment

# Remove root-level markdown documentation
rm -f /workspace/codex-summary.md
rm -f /workspace/decoration-clear-analysis.md
rm -f /workspace/duplicate-id-root-cause-analysis.md
rm -f /workspace/fix-summary.md
rm -f /workspace/optimization-investigation-summary.md
rm -f /workspace/optimization-plan-v2.md
rm -f /workspace/REFACTORING_REPORT.md

# Remove test/measurement scripts
rm -f /workspace/measure-extension-startup.js
rm -f /workspace/measure-git-discovery.js
rm -f /workspace/test-decoration-issue.js

# Remove development-only config
rm -f /workspace/.claude-next-command
rm -f /workspace/knip.config.json

# Finally, remove documentation directory
# WARNING: This will remove this file too!
# Copy this file elsewhere first if you need to reference it
rm -rf /workspace/documentation
```

## Notes

1. **Git Repository**: The `.git` directory contains the full repository history. Consider whether this should be kept or if you want to create a fresh repository for the production release.

2. **Node Modules**: The `node_modules` directory is large but required. It will be reinstalled via `yarn install` when deploying.

3. **Dot Directories**: All dot directories (`.claude`, `.vscode`, `.devcontainer`, etc.) are preserved as they contain project configuration that may be useful for future development.

4. **CLAUDE.md**: This file contains project-specific instructions for Claude Code. Keep it if you plan to continue development with Claude Code, otherwise it can be removed.

## Production Package Structure

After cleanup, the production-ready structure should be:

```
/workspace/
├── .claude/           (configuration - optional)
├── .cursor/           (configuration - optional)
├── .devcontainer/     (configuration - optional)
├── .git/              (version control - optional)
├── .githooks/         (git hooks - optional)
├── .vscode/           (workspace settings - optional)
├── .yarn/             (yarn files)
├── node_modules/      (dependencies)
├── packages/
│   └── compare-branch-extension-v3/  (THE EXTENSION)
├── .cursorignore
├── .gitignore
├── .prettierignore
├── .yarnrc.yml
├── CLAUDE.md          (optional)
├── eslint.config.mjs
├── package.json
├── prettier.config.mjs
├── tsconfig.json
└── yarn.lock
```

## Alternative: Clean Git Repository

If you want a completely clean production release:

```bash
# Create a new branch for production
git checkout -b production-release

# Remove all development files
git rm -rf build/ documentation/ environment/
git rm -f codex-summary.md decoration-clear-analysis.md duplicate-id-root-cause-analysis.md
git rm -f fix-summary.md optimization-investigation-summary.md optimization-plan-v2.md
git rm -f REFACTORING_REPORT.md measure-extension-startup.js measure-git-discovery.js
git rm -f test-decoration-issue.js .claude-next-command knip.config.json

# Commit the cleanup
git commit -m "Clean up development files for production release"

# Tag the release
git tag -a v1.0.0 -m "Production release v1.0.0"
```
