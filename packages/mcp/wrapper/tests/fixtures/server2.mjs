#!/usr/bin/env node
/**
 * Second test server for multi-server tests
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'server2', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'tool2',
      description: 'Second tool',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
