#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { StreamableHttpDaemon } from './streamable-http-daemon.js';

const server = new Server({ name: 'example-http-server', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'greet',
      description: 'Returns a greeting message',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Name to greet' } },
        required: ['name']
      }
    },
    {
      name: 'add',
      description: 'Adds two numbers together',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' }
        },
        required: ['a', 'b']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args } = request.params;
  if (name === 'greet') {
    const { name: greetName } = args as { name: string };
    if (!greetName) {
      throw new McpError(ErrorCode.InvalidParams, 'name is required');
    }
    return { content: [{ type: 'text', text: `Hello, ${greetName}! Welcome to the example MCP server.` }] };
  }
  if (name === 'add') {
    const { a, b } = args as { a: number; b: number };
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'a and b must be numbers');
    }
    return { content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }] };
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function startServer() {
  const app = express();
  app.use(express.json());
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  app.post('/mcp', async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  });
  // The default port is a machine-global resource shared by every checkout
  // and session on this host — concurrent test runs in parallel worktrees
  // would otherwise race each other's daemons on it. MCP_DAEMON_PORT lets a
  // caller isolate its daemon (e.g. a per-session port chosen by a test).
  const daemonPort = Number(process.env.MCP_DAEMON_PORT ?? '47127');
  const daemon = new StreamableHttpDaemon({
    port: daemonPort,
    host: '127.0.0.1',
    debug: process.env.DEBUG === 'true'
  });
  const result = await daemon.start(app);
  if (result.isMainProcess) {
    console.log(`[Example Server] Started HTTP server on port ${daemonPort}`);
    console.log(`[Example Server] PID: ${result.info.pid}`);
    console.log(`[Example Server] Client count: ${result.info.clientCount}`);
    console.log(`[Example Server] Ready to accept connections at http://127.0.0.1:${daemonPort}/mcp`);
  } else {
    console.log(`[Example Server] Connected to existing server`);
    console.log(`[Example Server] Main PID: ${result.info.pid}`);
    console.log(`[Example Server] Client count: ${result.info.clientCount}`);
  }
  process.stdin.resume();
}

// Direct-run guard. Comparing `import.meta.url` against the raw argv path is
// fragile: Node keys the module's identity to its real path, while argv[1]
// keeps the path as given — the two differ whenever the checkout is reached
// through a symlink or bind mount (e.g. a worktree mounted into /workspace),
// which silently skips startup. Compare realpaths instead.
const isMainModule =
  process.argv[1] !== undefined &&
  existsSync(process.argv[1]) &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (isMainModule) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { startServer };
