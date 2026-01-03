# Changelog

All notable changes to this project will be documented in this file.

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
