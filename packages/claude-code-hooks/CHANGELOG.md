# Changelog

## 1.3.1
- Fixed hook handlers to accept `null` as a valid return value

## 1.3.0
- Added `PermissionDenied` hook type for handling permission denial events
- Updated Anthropic SDK compatibility to version 0.2.109

## 1.2.9
- Added asset loader support, enabling hooks to bundle and reference static assets (e.g., prompt files) at build time
- Fixed changelog update skipping support for more reliable release workflows

## 1.2.9
- Added explicit esbuild loader support to the hook compiler via repeated `--loader .ext=type` flags
- Enabled `.md=text` by default so markdown prompt assets can be imported directly in hooks
- Documented bundled text-asset behavior and the need to mirror loader handling in Vitest/Vite test config

## 1.2.8
- Added support for `TaskCreated` hook type
- Removed minify whitespace option from output formatting

## 1.2.8
- Added `TaskCreated` hook type for responding to new task creation events (SDK 0.2.86)
- Added `taskCreatedHook` factory and `taskCreatedOutput` builder
- Added `TaskCreatedInput` type with `task_id`, `task_subject`, `task_description`, `teammate_name`, and `team_name` fields

## 1.2.7
- Minor improvements and bug fixes

## 1.2.6
- Added `CwdChanged` and `FileChanged` hook types for responding to working directory and file change events
- Added `--log-env-var` CLI option to configure logging via environment variable
- Unified log configuration across hook invocations for consistent logging behavior

## 1.2.3
- Added `StopFailure` hook type for handling errors that occur when Claude Code stops (API errors, rate limits, auth failures)
- Added `PostCompact` hook type for reacting after context compaction completes

## 1.2.2
- Reduced bundle size via tree shaking support

## 1.2.1
- Updated `isTaskTool` type guard and `KnownToolName`/`ToolInputMap` types to reflect the Agent tool rename (previously "Task")

## 1.2.0
- Added 6 new hook types: `Elicitation`, `ElicitationResult`, `ConfigChange`, `InstructionsLoaded`, `WorktreeCreate`, and `WorktreeRemove` — each with input types, output builders, and factory functions
- Added `agent_id` and `agent_type` fields to `BaseHookInput` (available in all hooks)
- Added `last_assistant_message` field to `StopInput` and `SubagentStopInput`
- Fixed CLI to exit with code 1 when no input hook files are found

## 1.2.0
- Added 6 new hook types from Claude Agent SDK 0.2.69: `Elicitation`, `ElicitationResult`, `ConfigChange`, `InstructionsLoaded`, `WorktreeCreate`, `WorktreeRemove`
- Added corresponding input types: `ElicitationInput`, `ElicitationResultInput`, `ConfigChangeInput`, `InstructionsLoadedInput`, `WorktreeCreateInput`, `WorktreeRemoveInput`
- Added output builders: `elicitationOutput`, `elicitationResultOutput`, `configChangeOutput`, `instructionsLoadedOutput`, `worktreeCreateOutput`, `worktreeRemoveOutput`
- Added hook factory functions: `elicitationHook`, `elicitationResultHook`, `configChangeHook`, `instructionsLoadedHook`, `worktreeCreateHook`, `worktreeRemoveHook`
- All existing hook input types now include new optional `agent_id` and `agent_type` fields from `BaseHookInput`
- `StopInput` and `SubagentStopInput` now include new optional `last_assistant_message` field
- Updated `HOOK_EVENT_NAMES` constant and `HookInput` union to include all 21 hook types
- Updated SDK type snapshot baseline to `@anthropic-ai/claude-agent-sdk@0.2.69`

## 1.1.0
- Added exit-code-based output builders for `TeammateIdle` and `TaskCompleted` hooks, enabling hooks to block these events by writing to stderr
- Added `stderr` support to hook outputs, allowing handlers to signal blocking behavior with a custom message alongside structured JSON output

## 1.0.23
- Added `bypass_permissions_disabled` to `SessionEndReason` type for detecting when sessions end due to bypass permissions being disabled
- Fixed compiled hooks failing when bundled dependencies use CommonJS globals (`require`, `__filename`, `__dirname`) in ESM output
- Added `NotificationHookSpecificOutput` type export, now derived from the official SDK for better type accuracy
- Updated underlying Claude Agent SDK to 0.2.42

## 1.0.21
- Improved IDE hover tooltips to show expanded type properties for better discoverability
- Added type guards for MCP tools: `isListMcpResourcesTool`, `isMcpTool`, `isReadMcpResourceTool`
- Added `isConfigTool` type guard for Config tool inputs
- Renamed typed hook input types for clarity (`TypedPreToolUseHookInput`, `TypedPostToolUseHookInput`, `TypedPostToolUseFailureHookInput`)

## 1.0.20
- Added `teammateIdleHook` and `taskCompletedHook` factory functions for new hook types
- Added `teammateIdleOutput` and `taskCompletedOutput` output builders
- Fixed reproducible builds when compiling hooks from different directories

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
