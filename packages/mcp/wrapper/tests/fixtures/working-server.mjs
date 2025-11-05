#!/usr/bin/env node
/**
 * Working test server for failure recovery tests
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'working-server', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'working_tool',
      description: 'This works',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
