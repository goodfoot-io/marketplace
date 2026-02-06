# Changelog

## 1.0.19
- Improved build stability with reproducible hook compilation across different environments

## 1.0.18
- Improved stability of compiled hook content hashes across different build environments
- Updated Claude Agent SDK compatibility to v0.2.31

## 1.0.17
- Fixed build output to be reproducible across different environments and machines

## 1.0.16
- Added documentation update script (`yarn update:docs`) for automated doc maintenance
- Enhanced dependency upgrade script to auto-detect and implement new SDK functionality
- Updated documentation to include Setup hook (13 hook types total)

## 1.0.16
- Added documentation update script (`yarn update:docs`) for automated doc maintenance
- Enhanced dependency upgrade script to auto-detect and implement new SDK functionality
- Updated documentation to include Setup hook (13 hook types total)

## 1.0.15
- Upgraded GitHub Actions workflow to use latest action versions (checkout@v6, setup-node@v6)
- Upgraded to Node.js 24.x for npm 11.5+ OIDC trusted publishing support

## 1.0.14
- Updated GitHub Actions workflow to use npm trusted publishing with OIDC authentication
- Added provenance attestation for improved supply chain security

## 1.0.13
- Minor improvements and bug fixes

## 1.0.12
- Added Setup hook support for handling initialization and maintenance events
- Updated to Claude Agent SDK 0.2.22 with new `agent_type` and `model` parameters for subagent hooks

## 1.0.11
- Minor improvements and bug fixes

## 1.0.10

- Improved scaffolded TypeScript configuration to include test files in type checking

## 1.0.9

- Updated scaffolded project dependencies to latest versions (Biome 2.x, TypeScript 5.9, Vitest 4.x, Node types 22)
- Migrated scaffold Biome configuration to v2 format with new organizeImports and file includes patterns

## 1.0.8

- Added repository metadata to package.json (homepage, git repository URL)

## 1.0.7

- Improved timestamp preservation when regenerating hooks.json to prevent unnecessary metadata updates
- Standardized TypeScript definition file formatting for consistency

## 1.0.6

- Minor improvements and bug fixes

## 1.0.5

- Improved build process to be deterministic and concurrent-safe, enabling better caching and parallel builds of the same source files

## 1.0.4

- Updated documentation examples to use structured logging API with `logger.info()` and `logger.debug()` calls
- Added plugin uninstall example to README
- Simplified CLI scaffold command syntax by removing `-p` flag requirement

## 1.0.3

- Changed compiled hooks output directory from `build/` to `bin/` for consistency with standard binary conventions
- Standardized TypeScript type declaration formatting for improved IDE readability

## 1.0.2

- Improved README documentation with clearer formatting and command examples
- Reduced package bundle size through optimized type definitions

## 1.0.1

- Minor improvements and bug fixes

## 1.0.0

- Initial release of the Claude Code hooks SDK with type-safe hook handlers for all 12 hook events
- Added scaffold command (`--scaffold`) to generate new hook projects with TypeScript configuration
- Added typed tool inputs with type guards (isWriteTool, isEditTool, isBashTool, etc.) for safe type narrowing
- Added utility helpers for common patterns: getFilePath, isJsTsFile, checkContentForPattern
- Added typed factory function overloads that automatically narrow toolInput type based on matcher
- Added output builders for constructing hook responses with proper typing
- Added Logger API with event subscriptions and file output configuration
- Added automatic hook context detection for agent and plugin directory structures
- Added environment variable persistence via persistEnvVar for SessionStart hooks
- Added comprehensive TypeScript type definitions for IDE autocompletion

## [1.0.0] - 2025-01-03

### Added

- Initial production release
- 12 hook factory functions with full type safety
- 12 output builder functions for constructing hook responses
- CLI build tool for compiling TypeScript hooks to standalone ESM modules
- Structured logging system with file output support
- Environment variable utilities for project configuration
- CamelCase type transformations from SDK snake_case

### Hook Types

- PreToolUse: Validate and modify tool execution before it runs
- PostToolUse: Process tool results after successful execution
- PostToolUseFailure: Handle tool execution failures
- PermissionRequest: Auto-approve or deny permission prompts
- Notification: Forward and process notifications
- UserPromptSubmit: Add context to user prompts
- SessionStart: Initialize session state
- SessionEnd: Clean up session resources
- Stop: Block or allow session stops
- SubagentStart: Configure subagent launches
- SubagentStop: Control subagent completion
- PreCompact: Preserve context before compaction

### Documentation

- Comprehensive README with examples
- Full API reference in JSDoc comments
- MIT License
