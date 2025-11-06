#!/usr/bin/env node
/**
 * Test server with multiple tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'multi-tool-server', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'create_task',
      description: 'Create a new task',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'list_tasks',
      description: 'List all tasks',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
