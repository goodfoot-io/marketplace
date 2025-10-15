# Tool Function Overview

This document provides a complete reference for all available tools, their descriptions, and parameters.

## 1. Task
**Purpose:** Launch a new agent to handle complex, multi-step tasks autonomously.

**Available Agent Types:**
- `general-purpose`: For researching complex questions, searching for code, and executing multi-step tasks
- `assumption-tester`: Only use when requested by name
- `codebase-researcher`: For codebase exploration tasks
- `project-implementer`: Only use when requested by name
- `project-plan-assessor`: Only use when requested by name
- `test-analysis`: For test-related analysis
- `implementation-evaluator`: Only use when requested by name

**Parameters:**
- `description` (required, string): A short (3-5 word) description of the task
- `prompt` (required, string): The task for the agent to perform
- `subagent_type` (required, string): The type of specialized agent to use

## 2. Bash
**Purpose:** Execute bash commands in a persistent shell session with optional timeout.

**Key Features:**
- Persistent shell session
- Optional timeout (up to 10 minutes)
- Automatic output truncation at 30,000 characters
- Special handling for git commits and pull requests

**Parameters:**
- `command` (required, string): The command to execute
- `description` (optional, string): Clear, concise description (5-10 words)
- `timeout` (optional, number): Timeout in milliseconds (max 600000)

## 3. Glob
**Purpose:** Fast file pattern matching tool for finding files by name patterns.

**Features:**
- Supports patterns like `**/*.js` or `src/**/*.ts`
- Returns paths sorted by modification time
- Works with any codebase size

**Parameters:**
- `pattern` (required, string): The glob pattern to match files against
- `path` (optional, string): Directory to search in (defaults to current directory)

## 4. Grep
**Purpose:** Powerful search tool built on ripgrep for searching file contents.

**Features:**
- Full regex syntax support
- Multiple output modes: content, files_with_matches, count
- Context lines support (-A, -B, -C)
- Multiline pattern matching
- File type and glob filtering

**Parameters:**
- `pattern` (required, string): Regular expression pattern to search for
- `-A` (optional, number): Lines after match (requires output_mode: "content")
- `-B` (optional, number): Lines before match (requires output_mode: "content")
- `-C` (optional, number): Lines before and after match (requires output_mode: "content")
- `-i` (optional, boolean): Case insensitive search
- `-n` (optional, boolean): Show line numbers (requires output_mode: "content")
- `glob` (optional, string): Glob pattern to filter files
- `head_limit` (optional, number): Limit output to first N lines/entries
- `multiline` (optional, boolean): Enable multiline mode (default: false)
- `output_mode` (optional, string): "content", "files_with_matches", or "count"
- `path` (optional, string): File or directory to search in
- `type` (optional, string): File type to search (js, py, rust, go, java, etc.)

## 5. LS
**Purpose:** List files and directories in a given path.

**Requirements:**
- Path must be absolute, not relative
- Supports glob pattern ignoring

**Parameters:**
- `path` (required, string): Absolute path to the directory
- `ignore` (optional, array of strings): Glob patterns to ignore

## 6. ExitPlanMode
**Purpose:** Exit plan mode when finished planning implementation steps.

**Usage:** Only use for tasks requiring code implementation planning, not for research or information gathering.

**Parameters:**
- `plan` (required, string): The implementation plan (supports markdown)

## 7. Read
**Purpose:** Read files from the local filesystem.

**Features:**
- Reads up to 2000 lines by default
- Supports images (PNG, JPG, etc.) with visual presentation
- Supports PDF files with text and visual extraction
- Line numbering in cat -n format
- Handles temporary file paths

**Parameters:**
- `file_path` (required, string): Absolute path to the file
- `limit` (optional, number): Number of lines to read
- `offset` (optional, number): Line number to start reading from

## 8. Edit
**Purpose:** Perform exact string replacements in files.

**Requirements:**
- Must read file first using Read tool
- Preserves exact indentation
- Fails if old_string is not unique (unless replace_all is true)

**Parameters:**
- `file_path` (required, string): Absolute path to the file
- `old_string` (required, string): Text to replace
- `new_string` (required, string): Replacement text
- `replace_all` (optional, boolean): Replace all occurrences (default: false)

## 9. MultiEdit
**Purpose:** Make multiple edits to a single file in one atomic operation.

**Features:**
- All edits applied sequentially
- Atomic operation (all succeed or none applied)
- Can create new files with empty old_string

**Parameters:**
- `file_path` (required, string): Absolute path to the file
- `edits` (required, array): Array of edit operations
  - `old_string` (required, string): Text to replace
  - `new_string` (required, string): Replacement text
  - `replace_all` (optional, boolean): Replace all occurrences

## 10. Write
**Purpose:** Write a file to the local filesystem.

**Important:**
- Overwrites existing files
- Must read existing files first
- Prefer editing over writing new files

**Parameters:**
- `file_path` (required, string): Absolute path to the file
- `content` (required, string): Content to write

## 11. WebFetch
**Purpose:** Fetch and analyze web content using AI.

**Features:**
- Converts HTML to markdown
- Processes content with custom prompts
- 15-minute cache for repeated URLs
- Handles redirects

**Parameters:**
- `url` (required, string): URL to fetch content from
- `prompt` (required, string): Prompt to run on fetched content

## 12. TodoWrite
**Purpose:** Create and manage structured task lists for coding sessions.

**When to Use:**
- Complex multi-step tasks (3+ steps)
- Non-trivial tasks requiring planning
- User explicitly requests todo list
- Multiple tasks provided by user
- After receiving new instructions

**Task States:**
- `pending`: Not yet started
- `in_progress`: Currently working (limit one at a time)
- `completed`: Finished successfully

**Parameters:**
- `todos` (required, array): Updated todo list
  - `content` (required, string): Task description
  - `status` (required, string): pending/in_progress/completed
  - `priority` (required, string): high/medium/low
  - `id` (required, string): Unique identifier

## 13. WebSearch
**Purpose:** Search the web for current information.

**Features:**
- Returns search results as formatted blocks
- Domain filtering support
- US availability only
- Accounts for current date from environment

**Parameters:**
- `query` (required, string): Search query (min 2 characters)
- `allowed_domains` (optional, array): Include only these domains
- `blocked_domains` (optional, array): Exclude these domains

## 14. mcp__context7__resolve-library-id
**Purpose:** Resolve package names to Context7-compatible library IDs.

**Usage:** Must call before get-library-docs unless user provides library ID format.

**Selection Criteria:**
- Name similarity
- Description relevance
- Documentation coverage
- Trust score (7-10 preferred)

**Parameters:**
- `libraryName` (required, string): Library name to search for

## 15. mcp__context7__get-library-docs
**Purpose:** Fetch up-to-date library documentation.

**Requirements:** Call resolve-library-id first unless user provides library ID.

**Parameters:**
- `context7CompatibleLibraryID` (required, string): Library ID format
- `tokens` (optional, number): Max documentation tokens (default: 10000)
- `topic` (optional, string): Focus topic (e.g., 'hooks', 'routing')

## Tool Usage Best Practices

1. **Batch Operations**: Call multiple tools in parallel when possible
2. **Search Strategy**: Use Task for open-ended searches, Grep/Glob for specific patterns
3. **File Operations**: Always read before editing, prefer Edit over Write
4. **Task Management**: Use TodoWrite proactively for complex tasks
5. **Web Operations**: Prefer MCP tools (mcp__*) when available
6. **Error Handling**: Check for redirects, handle failures gracefully