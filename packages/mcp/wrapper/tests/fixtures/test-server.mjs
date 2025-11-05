#!/usr/bin/env node
/**
 * Simple test MCP server for discovery tests
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'test-server', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'test_tool',
      description: 'A test tool for discovery',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        }
      }
    }
  ]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
