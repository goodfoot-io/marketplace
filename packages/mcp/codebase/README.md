# @goodfoot/codebase-mcp-server

MCP server for codebase analysis and code search using Claude Code SDK.

## Features

This MCP server provides intelligent codebase analysis capabilities:

- **Code Search**: Find definitions, references, and usage patterns across your codebase
- **Symbol Analysis**: Understand function/class/type definitions and their relationships
- **Dependency Mapping**: Trace imports and dependencies between modules
- **Error Investigation**: Analyze TypeScript errors and runtime issues with context
- **Tool Selection Guide**: Comprehensive system instructions for optimal tool usage

## Installation

```bash
yarn install
```

## Build

```bash
yarn build
```

## Test

```bash
yarn test
```

## Usage

The server exposes a single tool: `ask`

### Tool: ask

Searches and analyzes codebases to answer technical questions. Best for focused questions about specific files, errors, or code flow.

**Parameters:**

- `question` (string, required): Your codebase question. Should include full file paths in monorepos.

**Examples:**

```typescript
// Find TypeScript error root cause
{
  question: 'TypeScript error TS2322 at packages/api/src/user.ts:45: Why is email required?';
}

// Trace dependencies
{
  question: 'What files import from packages/shared/src/types/user.ts?';
}

// Analyze code flow
{
  question: 'How does packages/api/src/services/user.ts depend on database types?';
}
```

## Tool Selection Guide

The server includes comprehensive system instructions that guide the analysis agent to:

1. **Use VSCode LSP** for TypeScript/JavaScript symbol searches
2. **Use ast-grep** for structural code patterns (class extends, implements)
3. **Use Grep** for text patterns (console.log, TODO, strings)
4. **Use dependency tools** for module analysis (print-dependencies, print-inverse-dependencies)
5. **Read files directly** for file:line references

## Logging

All questions and analysis transcripts are logged to:

```
reports/.codebase-questions/{timestamp}.md
```

Each log includes:

- The original question
- Complete tool execution trace
- Final analysis answer

## Architecture

The server uses:

- **Claude Code SDK** (`@anthropic-ai/claude-code`) for intelligent analysis
- **MCP SDK** (`@modelcontextprotocol/sdk`) for tool protocol
- **System instructions** with comprehensive tool selection guide
- **Structured output** with file:line references and code snippets

## Abort Support

The server handles request cancellation gracefully:

- Propagates abort signals to Claude Code SDK
- Cleans up resources on cancellation
- Returns proper error messages to clients
