# Changelog

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
