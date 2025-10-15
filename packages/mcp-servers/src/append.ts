#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'append-server',
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
      name: 'append',
      description:
        'Appends content to a file. Creates the file if it does not exist. ' +
        'Automatically creates parent directories if needed. ' +
        'Ensures content starts on a new line if the file does not end with a newline.',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Absolute path to the file'
          },
          content: {
            type: 'string',
            description: 'Text content to append'
          }
        },
        required: ['file_path', 'content']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'append') {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }

  const { file_path, content } = request.params.arguments as {
    file_path: string;
    content: string;
  };

  if (!file_path) {
    throw new McpError(ErrorCode.InvalidParams, 'file_path is required');
  }

  if (content === undefined || content === null) {
    throw new McpError(ErrorCode.InvalidParams, 'content is required');
  }

  if (!path.isAbsolute(file_path)) {
    throw new McpError(ErrorCode.InvalidParams, 'file_path must be an absolute path');
  }

  try {
    // Create parent directories if they don't exist
    const dir = path.dirname(file_path);
    await fs.mkdir(dir, { recursive: true });

    // Check if file exists and read its last character if it does
    let needsNewline = false;
    try {
      const stats = await fs.stat(file_path);
      if (stats.size > 0) {
        // Read the last byte to check if it's a newline
        const handle = await fs.open(file_path, 'r');
        try {
          const buffer = Buffer.alloc(1);
          await handle.read(buffer, 0, 1, stats.size - 1);
          const lastChar = buffer.toString('utf8');
          needsNewline = lastChar !== '\n';
        } finally {
          await handle.close();
        }
      }
    } catch {
      // File doesn't exist, no need for newline
      needsNewline = false;
    }

    // Prepare content with newline if needed
    const contentToAppend = needsNewline ? '\n' + content : content;

    // Append the content
    await fs.appendFile(file_path, contentToAppend, 'utf8');

    return {
      content: [
        {
          type: 'text',
          text: `Successfully appended ${Buffer.byteLength(contentToAppend, 'utf8')} bytes to ${file_path}`
        }
      ]
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new McpError(ErrorCode.InternalError, `Failed to append to file: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, 'Failed to append to file: Unknown error');
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
