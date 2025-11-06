# @goodfoot/codebase-mcp-server

Model Context Protocol (MCP) server providing intelligent codebase analysis and code search capabilities using Claude Code SDK. This package enables natural language queries to understand, navigate, and analyse codebases effectively.

## Overview

The codebase MCP server delivers sophisticated code analysis through an intelligent agent that selects and orchestrates the appropriate tools for each query. It provides comprehensive codebase understanding through symbol analysis, dependency mapping, error investigation, and flow tracing.

## Key Features

- **Natural Language Queries**: Ask questions about your codebase in plain English
- **Intelligent Tool Selection**: Automatic selection of optimal tools (VSCode LSP, Grep, ast-grep, etc.)
- **Symbol Analysis**: Understand functions, classes, types, and their relationships
- **Dependency Mapping**: Trace imports, exports, and module dependencies
- **Error Investigation**: Analyse TypeScript errors and runtime issues with full context
- **Flow Analysis**: Understand data flow and execution paths through code
- **Configurable Logging**: Optional diagnostic logging for troubleshooting
- **Query Logs**: Complete transcripts of analysis for review and debugging

## Installation

```bash
yarn add @goodfoot/codebase-mcp-server
```

## Quick Start

### Starting the Server

```bash
node ./build/dist/src/codebase.js
```

The server automatically uses the current working directory as the workspace path.

### MCP Client Configuration

Configure in your MCP client settings:

```json
{
  "mcpServers": {
    "codebase": {
      "command": "node",
      "args": [
        "/path/to/@goodfoot/codebase-mcp-server/build/dist/src/codebase.js"
      ],
      "env": {
        "CODEBASE_MCP_SERVER_LOGGING": "false"
      }
    }
  }
}
```

## Available Tools

### `ask`

Searches and analyses codebases to answer technical questions. Optimised for focused questions about specific files, symbols, errors, or code flow.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question` | string | Yes | Technical question about the codebase with full file paths in monorepos |

**Example Usage:**

```typescript
// Investigate TypeScript error
await client.callTool({
  name: 'ask',
  arguments: {
    question: 'TypeScript error TS2322 at packages/api/src/user.ts:45: Why is email required?'
  }
});

// Trace dependencies
await client.callTool({
  name: 'ask',
  arguments: {
    question: 'What files import from packages/shared/src/types/user.ts?'
  }
});

// Analyse code flow
await client.callTool({
  name: 'ask',
  arguments: {
    question: 'How does the authentication system process login requests?'
  }
});

// Find symbol definition and usage
await client.callTool({
  name: 'ask',
  arguments: {
    question: 'Find the definition and all usages of UserService class'
  }
});
```

## Configuration

### Environment Variables

#### CODEBASE_MCP_SERVER_LOGGING

Enables diagnostic logging to stderr.

- **Default**: `false` (logging disabled)
- **Values**: `"true"` or `"false"`
- **Output**: All logs written to stderr with level prefixes

```bash
CODEBASE_MCP_SERVER_LOGGING=true node ./build/dist/src/codebase.js
```

**Log Levels:**

- `[DEBUG]` - Detailed debugging information
- `[INFO]` - General informational messages
- `[WARN]` - Warning conditions
- `[ERROR]` - Error conditions

## Tool Selection Guide

The server includes comprehensive system instructions that guide the analysis agent to select optimal tools:

### Symbol Searches (Functions/Classes/Types)

**Primary Approach: VSCode LSP**

1. Use Grep to find where symbol is defined
2. Use `get_symbol_lsp_info` with definition file path
3. Use `get_references` for all usage locations

**Example Flow:**

```
Question: "Find all references to updateGitAvailability"
→ Grep for "updateGitAvailability" to find definition
→ get_symbol_lsp_info at definition file
→ get_references to find all usages
```

### Structural Patterns (Inheritance/Implementation)

Use ast-grep for code structure patterns:

- Class inheritance (`class X extends Y`)
- Interface implementation (`class X implements Y`)
- Type constraints
- Decorator patterns

### Text Patterns (Comments/Strings/Literals)

Use Grep for:

- console.log statements
- TODO comments
- String literals
- Regular expression patterns

### TypeScript Errors

1. Use `get_diagnostics` to see all errors
2. Use `get_symbol_lsp_info` to investigate specific types
3. Analyse type definitions and relationships

### Module Dependencies

- `print-dependencies`: Show what a file imports
- `print-inverse-dependencies`: Show what imports a file (impact analysis)
- `print-typescript-types`: Analyse exported types
- `print-type-analysis`: Get complexity metrics

## Query Best Practices

### Effective Questions

**Good:**
- "TypeScript error TS2322 at packages/api/src/user.ts:45: Why is email required?"
- "What files import from packages/shared/src/types/user.ts?"
- "How does packages/api/src/services/user.ts depend on database types?"
- "Find all implementations of the UserRepository interface"

**Less Effective:**
- "How does useTranscriptSync work?" (missing full path)
- "Find all bugs" (too vague)
- "Analyse the codebase" (too broad)

### Path Specifications

Always provide full paths in monorepos:

```
✓ packages/api/src/user.ts
✓ apps/web/src/components/UserProfile.tsx
✗ user.ts
✗ src/user.ts
```

## Logging and Monitoring

### Query Logs

All questions and analysis transcripts are logged to:

```
/workspace/reports/.codebase-questions/{timestamp}.md
```

**Log Contents:**

- Original question (quoted)
- Complete tool execution trace
- Tool call parameters
- Tool responses
- Final analysis answer

**Log Format:**

```markdown
> What files import from packages/shared/src/types/user.ts?

---

```tool-call
Grep(
  pattern="...",
  glob="**/*.ts"
)
```

```tool-response
[Tool output]
```

[Final analysis answer]
```

### Diagnostic Logging

Enable with `CODEBASE_MCP_SERVER_LOGGING=true`:

- Server startup and shutdown
- Tool execution details
- Error conditions
- Request cancellations

### Log Location

- **Query Logs**: `/workspace/reports/.codebase-questions/`
- **Diagnostic Logs**: stderr (when enabled)

## Abort Support

The server handles request cancellation gracefully:

### Cancellation Handling

- Propagates abort signals to Claude Code SDK
- Cleans up resources on cancellation
- Returns proper error messages to clients
- Logs cancellation events (when diagnostic logging enabled)

### Implementation

```typescript
// Client can cancel requests
const controller = new AbortController();

const promise = client.callTool({
  name: 'ask',
  arguments: {
    question: 'Analyse entire codebase'
  }
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);
```

## System Instructions

The server includes comprehensive system instructions covering:

### Tool Selection Rules

- When to use VSCode LSP vs Grep vs ast-grep
- Proper workflow for symbol lookups
- Fallback strategies when primary tools fail
- Parallel vs sequential tool execution

### Output Formatting

- Direct answers with no preamble
- Structured sections with headers
- Code snippets with file:line references
- Evidence-based conclusions

### Error Handling

- Zero results documentation
- Tool failure recovery
- Alternative search strategies

### Result Size Handling

| Result Count | Action |
|--------------|--------|
| 0 results | State "No results found" with search details |
| 1-5 results | Show all with full context |
| 6-20 results | Show all with brief context |
| 21-50 results | Show first 10 with summary |
| 50+ results | Show first 5 with count and pattern analysis |

## Troubleshooting

### Long Response Times

**Cause**: Complex queries requiring many tool invocations

**Solution**: Be more specific in questions

```bash
# Less specific (slower)
"How does authentication work?"

# More specific (faster)
"How does packages/api/src/auth/login.ts validate passwords?"
```

### No Results Found

**Common Causes:**

1. **Incorrect file paths**: Use full paths in monorepos
2. **Symbol not in indexed files**: Check file extensions and patterns
3. **Private/internal symbols**: May not be exported or referenced

**Verification:**

```bash
# Check file exists
ls packages/api/src/user.ts

# Check symbol exists in file
grep -r "UserService" packages/
```

### "Operation was aborted" Errors

Normal when client cancels long-running requests. Check diagnostic logs for details:

```bash
CODEBASE_MCP_SERVER_LOGGING=true node ./build/dist/src/codebase.js
```

### Incomplete Analysis

If analysis seems incomplete:

1. Check query logs for tool execution traces
2. Verify all required files are accessible
3. Ensure VSCode language server is running (for LSP features)
4. Try more specific questions

## Development

### Building the Package

```bash
yarn build
```

### Running Tests

```bash
yarn test
```

### Linting

```bash
yarn lint
```

## Technical Architecture

### Component Overview

1. **Codebase Server**: Main MCP server exposing the `ask` tool
2. **Query Handler**: Processes questions and invokes Claude Code SDK
3. **System Instructions**: Comprehensive tool selection guide
4. **Logger**: Optional diagnostic logging system
5. **Transcript Writer**: Logs all queries and responses

### Analysis Flow

1. Client sends question via `ask` tool
2. Server constructs system instructions with tool guide
3. Claude Code SDK processes query with available tools
4. Tools execute (Grep, VSCode LSP, ast-grep, etc.)
5. Agent synthesises findings into structured answer
6. Response returned to client
7. Full transcript logged to disk

### Available Tools

The analysis agent has access to:

- **Grep**: Text and regex search
- **Glob**: File pattern matching
- **Read**: File reading
- **Bash**: Command execution (git, print-dependencies, etc.)
- **VSCode LSP Tools**:
  - `get_symbol_lsp_info`: Symbol definitions and types
  - `get_references`: Find all symbol usages
  - `get_diagnostics`: TypeScript/ESLint errors
  - `rename_symbol`: Rename with reference updates

### Disallowed Tools

For security and focus:

- `ExitPlanMode`: Not applicable for analysis
- `KillBash`/`BashOutput`: Background process management
- `mcp__codebase__ask`: Prevents recursive calls

### Dependencies

- `@anthropic-ai/claude-agent-sdk`: Claude Code SDK for intelligent analysis
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `zod`: Runtime type validation

### Type Safety

Comprehensive TypeScript types with runtime validation for all parameters.

## Performance Characteristics

### Query Response Time

- **Simple symbol lookups**: 2-5 seconds
- **Dependency analysis**: 5-10 seconds
- **Flow tracing**: 10-30 seconds
- **Comprehensive analysis**: 30-60 seconds

### Resource Usage

- **Memory**: Scales with codebase size and query complexity
- **CPU**: Bursts during tool execution, idle between queries
- **Disk**: Query logs accumulate over time

### Optimisation Tips

1. Use specific file paths to reduce search scope
2. Ask focused questions rather than broad analysis requests
3. Use monorepo paths (packages/api/src/file.ts) not relative paths
4. Clean up old query logs periodically

## Limitations

### Current Limitations

1. **Language Support**: Optimised for TypeScript/JavaScript (other languages supported but less optimised)
2. **VSCode Dependency**: LSP features require VSCode language server
3. **Monorepo Paths**: Best results with full paths in monorepos
4. **Query Complexity**: Very broad questions may time out or produce incomplete results

### Future Enhancements

- Multi-language support optimisation
- Caching for frequently accessed symbols
- Incremental analysis for large codebases
- Query result pagination

## Use Cases

### Code Review

```typescript
await client.callTool({
  name: 'ask',
  arguments: {
    question: 'What would break if I change the User interface in packages/types/user.ts?'
  }
});
```

### Onboarding

```typescript
await client.callTool({
  name: 'ask',
  arguments: {
    question: 'How does the authentication flow work from login to session creation?'
  }
});
```

### Debugging

```typescript
await client.callTool({
  name: 'ask',
  arguments: {
    question: 'Why does packages/api/tests/user.test.ts fail with TypeError: Cannot read property "id"?'
  }
});
```

### Refactoring

```typescript
await client.callTool({
  name: 'ask',
  arguments: {
    question: 'Find all usages of the deprecated getUserById function'
  }
});
```

## Security Considerations

### Safe Operations

- Read-only filesystem access
- No file modifications
- No external network requests (except for SDK)
- Process execution limited to analysis tools

### Workspace Isolation

- Server operates only within workspace directory
- No access to parent directories
- Log files contained in workspace

## Licence

MIT

## Support

For issues, feature requests, and questions, please refer to the main repository documentation.
