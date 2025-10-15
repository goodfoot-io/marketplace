# MCP Servers

This package contains Model Context Protocol (MCP) servers that provide various tools for Claude Code and other MCP-compatible clients.

## Available Servers

### 1. Test Agent Server (`test-agent`)

Executes custom agents with specific system instructions loaded from files.

**Tool:** `task`

- **system_instructions_file**: Absolute path to a markdown file containing agent instructions
- **description**: Short description of the task (3-5 words)
- **prompt**: The task for the agent to perform

**Example:**

```bash
./dist/test-agent-server.js
```

### 2. Codebase Server (`codebase`)

Provides comprehensive codebase analysis using AI-powered investigation.

**Tool:** `answer-question`

- **question**: Natural language question about the codebase

**Example:**

```bash
./dist/codebase-server.js
```

### 3. Append Server (`append`)

Appends content to files with automatic directory creation.

**Tool:** `append`

- **file_path**: Absolute path to the file
- **content**: Text content to append

**Example:**

```bash
./dist/append-server.js
```

## Building

```bash
# Install dependencies
yarn install

# Build TypeScript and bundle servers
yarn build
```

This will:

1. Compile TypeScript files to `build/`
2. Bundle each server into standalone executables in `dist/`
3. Copy the codebase server to devcontainer utilities

## Testing

```bash
# Run all tests
yarn test

# Run specific test
yarn test test-agent.test.ts
```

## Development

### Adding a New Server

1. Create your server in `src/your-server.ts`
2. Add it to `bundle-scripts.ts`
3. Create tests in `tests/your-server.test.ts`
4. Run `yarn build` to bundle

### Server Structure

Each MCP server should:

- Import from `@modelcontextprotocol/sdk`
- Create a `Server` instance
- Register tool handlers with `setRequestHandler`
- Connect via `StdioServerTransport`
- Export a `startServer` function

Example:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'my-server', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    /* your tools */
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Handle tool calls
});

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
```

## Integration with Claude Code

Add to your Claude Code configuration:

```json
{
  "mcpServers": {
    "test-agent": {
      "type": "stdio",
      "command": "/workspace/packages/mcp-servers/dist/test-agent-server.js"
    },
    "codebase": {
      "type": "stdio",
      "command": "/workspace/packages/mcp-servers/dist/codebase-server.js"
    }
  }
}
```

Then use in Claude Code:

```javascript
mcp__test_agent__task({
  system_instructions_file: '/path/to/agent.md',
  description: 'Task',
  prompt: 'Do something...'
});
```

## Logging

- **Test Agent**: Logs to `/workspace/reports/.test-agent-logs/` with tool calls and responses
- **Codebase**: Logs to `/workspace/reports/.codebase-questions/` with tool calls and responses

## License

Private
