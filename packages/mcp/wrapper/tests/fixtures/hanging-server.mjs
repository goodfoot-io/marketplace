#!/usr/bin/env node
/**
 * Test server that hangs on listTools (for timeout testing)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'hanging-server', version: '1.0.0' }, { capabilities: { tools: {} } });

// Never respond to listTools - will timeout
server.setRequestHandler(ListToolsRequestSchema, async () => {
  await new Promise(() => {}); // Never resolves
});

const transport = new StdioServerTransport();
await server.connect(transport);
