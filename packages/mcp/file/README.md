# @goodfoot/file-mcp-server

MCP server for file operations, providing tools for file manipulation with automatic directory creation and smart content handling.

## Features

- **File append operations** with automatic newline handling
- **Automatic directory creation** for parent paths
- **UTF-8 content support** with accurate byte counting
- **Type-safe implementation** using TypeScript

## Tools

### append

Appends content to a file with intelligent newline handling.

**Parameters:**

- `file_path` (string, required): Absolute path to the file
- `content` (string, required): Text content to append

**Features:**

- Creates the file if it does not exist
- Automatically creates parent directories if needed
- Ensures content starts on a new line if the file does not end with a newline
- Reports accurate byte count of appended content

**Example:**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Connect to the MCP server
const transport = new StdioClientTransport({
  command: 'node',
  args: ['./build/dist/src/append.js']
});

const client = new Client(
  {
    name: 'my-client',
    version: '1.0.0'
  },
  {
    capabilities: {}
  }
);

await client.connect(transport);

// Append to a file
const result = await client.callTool({
  name: 'append',
  arguments: {
    file_path: '/absolute/path/to/file.txt',
    content: 'This is new content\n'
  }
});

console.log(result.content[0].text);
// Output: "Successfully appended 20 bytes to /absolute/path/to/file.txt"
```

## Installation

This package is part of the workspace monorepo. To use it:

1. Build the package:

```bash
cd packages/mcp/file
yarn build
```

2. Run tests:

```bash
yarn test
```

3. Run linting:

```bash
yarn lint
```

## Usage as MCP Server

To run the append server directly:

```bash
node ./build/dist/src/append.js
```

The server will start in stdio mode and be ready to accept MCP requests.

## Development

### Build

```bash
yarn build
```

### Test

```bash
yarn test
```

### Lint

```bash
yarn lint
```

### Type Check

```bash
yarn typecheck
```

## License

Private package for internal use.
