#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'typescript-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'dependencies',
      description:
        'Analyzes file dependency trees using TypeScript module resolution. ' +
        'Accepts glob patterns (e.g., "packages/api/src/**/*.ts") or specific file paths. ' +
        'Returns array of all files that the target files depend on.',
      inputSchema: {
        type: 'object',
        properties: {
          targetGlobs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of file paths or glob patterns (e.g., ["packages/api/src/index.ts", "src/**/*.ts"])'
          }
        },
        required: ['targetGlobs']
      }
    },
    {
      name: 'inverse-dependencies',
      description:
        'Finds all files that depend on the specified target files. ' +
        'Useful for impact analysis when changing shared modules. ' +
        'Accepts glob patterns or specific file paths.',
      inputSchema: {
        type: 'object',
        properties: {
          targetGlobs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of file paths or glob patterns to find dependents for'
          },
          projectPath: {
            type: 'string',
            description: 'Optional path to tsconfig.json (auto-detected if not provided)'
          }
        },
        required: ['targetGlobs']
      }
    },
    {
      name: 'analysis',
      description:
        'Extracts comprehensive type information and complexity metrics from TypeScript files. ' +
        'Analyzes interfaces, types, classes, enums, functions, and calculates cyclomatic complexity. ' +
        'Returns YAML-formatted results grouped by file.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of file paths or glob patterns to analyze'
          }
        },
        required: ['files']
      }
    },
    {
      name: 'types',
      description:
        'Exports TypeScript type definitions with simplified representations. ' +
        'Works with file paths or npm package names. ' +
        'Provides both full declaration and simplified forms for readability.',
      inputSchema: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of file paths or npm package names to extract types from'
          },
          pwd: {
            type: 'string',
            description: 'Optional working directory for relative paths'
          },
          typeFilters: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional array of type names to filter output'
          }
        },
        required: ['paths']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  // Placeholder for async operations
  await Promise.resolve();

  switch (toolName) {
    case 'dependencies':
      throw new McpError(ErrorCode.InternalError, 'dependencies tool not yet implemented');

    case 'inverse-dependencies':
      throw new McpError(ErrorCode.InternalError, 'inverse-dependencies tool not yet implemented');

    case 'analysis':
      throw new McpError(ErrorCode.InternalError, 'analysis tool not yet implemented');

    case 'types':
      throw new McpError(ErrorCode.InternalError, 'types tool not yet implemented');

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
  }
});

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

// Start the server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
