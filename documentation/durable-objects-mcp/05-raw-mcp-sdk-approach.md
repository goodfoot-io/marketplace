# Implementation with Raw MCP SDK + Hono

## Overview

Using the raw `@modelcontextprotocol/sdk` gives you full control over the MCP server implementation. This approach is more portable and flexible, but requires more manual setup.

**Use this when:**
- You need full control over the transport layer
- You want a portable solution (not Cloudflare-specific)
- You need custom session management
- You want to integrate with existing infrastructure

## Installation

```bash
npm install @modelcontextprotocol/sdk hono
```

## Basic Structure

### 1. Create MCP Server

```typescript
// src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export function createMcpServer() {
  const server = new Server(
    {
      name: 'my-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'add',
        description: 'Add two numbers together',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
    ],
  }));

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'add') {
      const result = args.a + args.b;
      return {
        content: [
          {
            type: 'text',
            text: `Result: ${result}`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}
```

### 2. Set Up Streamable HTTP Transport with Hono

```typescript
// src/index.ts
import { Hono } from 'hono';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';

const app = new Hono();

app.all('/mcp', async (c) => {
  // Create new server instance per request
  const server = createMcpServer();

  // Create transport (stateless - no session management)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    // Connect server to transport
    await server.connect(transport);

    // Handle the request
    const body = await c.req.json();

    // Create a simplified response handler
    let responseData: any;
    let isSSE = false;

    const res = {
      status: (code: number) => ({ code }),
      setHeader: (name: string, value: string) => {
        if (name.toLowerCase() === 'content-type' && value === 'text/event-stream') {
          isSSE = true;
        }
        c.header(name, value);
      },
      write: (data: string) => {
        // Accumulate SSE data
        if (!responseData) responseData = '';
        responseData += data;
      },
      end: (data?: string) => {
        if (data) {
          if (isSSE) {
            responseData = (responseData || '') + data;
          } else {
            responseData = data;
          }
        }
      },
    };

    await transport.handleRequest(
      { body, headers: c.req.raw.headers },
      res as any,
      body
    );

    // Return the response
    if (isSSE) {
      return new Response(responseData, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      return c.json(JSON.parse(responseData || '{}'));
    }
  } catch (error) {
    console.error('Error handling MCP request:', error);
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error.message,
        },
        id: null,
      },
      500
    );
  } finally {
    await transport.close();
  }
});

export default app;
```

## Complete Working Example: Add Tool with State

### server.ts (Stateful Server)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

interface ServerState {
  lastResult: number | null;
  history: Array<{ operation: string; result: number; timestamp: number }>;
}

export class StatefulMcpServer {
  private server: Server;
  private state: ServerState;

  constructor() {
    this.state = {
      lastResult: null,
      history: [],
    };

    this.server = new Server(
      {
        name: 'calculator-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'add',
          description: 'Add two numbers together and remember the result',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number', description: 'First number' },
              b: { type: 'number', description: 'Second number' },
            },
            required: ['a', 'b'],
          },
        },
        {
          name: 'subtract',
          description: 'Subtract second number from first',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number', description: 'First number' },
              b: { type: 'number', description: 'Second number' },
            },
            required: ['a', 'b'],
          },
        },
        {
          name: 'get_last_result',
          description: 'Get the last calculation result',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_history',
          description: 'Get calculation history',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 10,
              },
            },
          },
        },
      ],
    }));

    // Call tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'add':
          return this.handleAdd(args.a, args.b);
        case 'subtract':
          return this.handleSubtract(args.a, args.b);
        case 'get_last_result':
          return this.handleGetLastResult();
        case 'get_history':
          return this.handleGetHistory(args.limit || 10);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: 'calculation_summary',
          description: 'Generate a summary of recent calculations',
        },
      ],
    }));
  }

  private handleAdd(a: number, b: number) {
    const result = a + b;
    this.saveResult(`${a} + ${b}`, result);

    return {
      content: [
        {
          type: 'text',
          text: `${a} + ${b} = ${result}`,
        },
      ],
    };
  }

  private handleSubtract(a: number, b: number) {
    const result = a - b;
    this.saveResult(`${a} - ${b}`, result);

    return {
      content: [
        {
          type: 'text',
          text: `${a} - ${b} = ${result}`,
        },
      ],
    };
  }

  private handleGetLastResult() {
    if (this.state.lastResult === null) {
      return {
        content: [
          {
            type: 'text',
            text: 'No calculations have been performed yet.',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Last result: ${this.state.lastResult}`,
        },
      ],
    };
  }

  private handleGetHistory(limit: number) {
    const recentHistory = this.state.history.slice(-limit).reverse();

    if (recentHistory.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No calculation history available.',
          },
        ],
      };
    }

    const historyText = recentHistory
      .map(
        (entry) =>
          `${new Date(entry.timestamp).toISOString()}: ${entry.operation} = ${
            entry.result
          }`
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Calculation History:\n${historyText}`,
        },
      ],
    };
  }

  private saveResult(operation: string, result: number) {
    this.state.lastResult = result;
    this.state.history.push({
      operation,
      result,
      timestamp: Date.now(),
    });

    // Keep only last 100 entries
    if (this.state.history.length > 100) {
      this.state.history = this.state.history.slice(-100);
    }
  }

  getServer() {
    return this.server;
  }

  getState() {
    return this.state;
  }

  setState(state: ServerState) {
    this.state = state;
  }
}
```

### index.ts (Hono Router with Session Management)

```typescript
import { Hono } from 'hono';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StatefulMcpServer } from './server.js';
import { randomBytes } from 'crypto';

const app = new Hono();

// In-memory session storage (use Durable Objects in production)
const sessions = new Map<string, StatefulMcpServer>();

// Generate secure session ID
function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

// Get or create session
function getSession(sessionId: string | null): { id: string; server: StatefulMcpServer; isNew: boolean } {
  if (sessionId && sessions.has(sessionId)) {
    return {
      id: sessionId,
      server: sessions.get(sessionId)!,
      isNew: false,
    };
  }

  // Create new session
  const newId = generateSessionId();
  const newServer = new StatefulMcpServer();
  sessions.set(newId, newServer);

  return {
    id: newId,
    server: newServer,
    isNew: true,
  };
}

app.all('/mcp', async (c) => {
  try {
    const body = await c.req.json();
    const sessionId = c.req.header('Mcp-Session-Id') || null;

    // Get or create session
    const { id, server, isNew } = getSession(sessionId);

    // Create transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // We manage sessions ourselves
    });

    // Response accumulator
    let statusCode = 200;
    let responseHeaders = new Map<string, string>();
    let responseBody = '';
    let isSSE = false;

    // Mock response object for transport
    const res = {
      statusCode: 200,
      status: function (code: number) {
        statusCode = code;
        return this;
      },
      setHeader: function (name: string, value: string) {
        responseHeaders.set(name.toLowerCase(), value);
        if (name.toLowerCase() === 'content-type' && value === 'text/event-stream') {
          isSSE = true;
        }
        return this;
      },
      write: function (data: string) {
        responseBody += data;
        return true;
      },
      end: function (data?: string) {
        if (data) responseBody += data;
      },
      on: function () {},
    };

    // Connect and handle request
    await server.getServer().connect(transport);
    await transport.handleRequest(
      {
        method: 'POST',
        url: '/mcp',
        headers: c.req.raw.headers,
        body,
      } as any,
      res as any,
      body
    );

    // Build response
    const response = new Response(responseBody, {
      status: statusCode,
      headers: Object.fromEntries(responseHeaders),
    });

    // Add session ID header for new sessions or initialize requests
    if (isNew || body.method === 'initialize') {
      response.headers.set('Mcp-Session-Id', id);
    }

    await transport.close();

    return response;
  } catch (error) {
    console.error('Error handling MCP request:', error);
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error),
        },
        id: null,
      },
      500
    );
  }
});

// Session management endpoints
app.get('/sessions', (c) => {
  return c.json({
    count: sessions.size,
    sessions: Array.from(sessions.keys()),
  });
});

app.delete('/sessions/:id', (c) => {
  const id = c.req.param('id');
  const existed = sessions.delete(id);
  return c.json({ deleted: existed });
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
```

### package.json

```json
{
  "name": "mcp-server-raw-sdk",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240000.0",
    "wrangler": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

### wrangler.toml

```toml
name = "mcp-server-raw-sdk"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# No Durable Objects needed for basic in-memory sessions
# For production, integrate with Durable Objects for persistence
```

## Adding Durable Objects for Persistence

### durable-object.ts

```typescript
import { DurableObject } from 'cloudflare:workers';
import { StatefulMcpServer } from './server.js';

export class McpSessionDO extends DurableObject {
  private server: StatefulMcpServer | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    // Initialize server if not already done
    if (!this.server) {
      this.server = new StatefulMcpServer();

      // Restore state from storage
      const stored = await this.ctx.storage.get<any>('state');
      if (stored) {
        this.server.setState(stored);
      }
    }

    // Handle MCP request
    const body = await request.json();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // ... handle request as before ...

    // Persist state after each request
    await this.ctx.storage.put('state', this.server.getState());

    return response;
  }
}
```

### Update index.ts to use Durable Objects

```typescript
import { Hono } from 'hono';

interface Env {
  MCP_SESSION: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

app.all('/mcp', async (c) => {
  const sessionId = c.req.header('Mcp-Session-Id');

  let doId: DurableObjectId;
  if (sessionId) {
    doId = c.env.MCP_SESSION.idFromString(sessionId);
  } else {
    doId = c.env.MCP_SESSION.newUniqueId();
  }

  const stub = c.env.MCP_SESSION.get(doId);
  const response = await stub.fetch(c.req.raw);

  // Add session ID for new sessions
  if (!sessionId) {
    response.headers.set('Mcp-Session-Id', doId.toString());
  }

  return response;
});

export default app;
export { McpSessionDO } from './durable-object.js';
```

### Update wrangler.toml

```toml
name = "mcp-server-with-do"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[durable_objects.bindings]]
name = "MCP_SESSION"
class_name = "McpSessionDO"

[[migrations]]
tag = "v1"
new_classes = ["McpSessionDO"]
```

## Testing

### Using cURL

```bash
# Initialize
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "test", "version": "1.0" }
    },
    "id": 1
  }'

# Use the Mcp-Session-Id from response

# Call add tool
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": { "a": 5, "b": 3 }
    },
    "id": 2
  }'
```

## Advantages of Raw SDK Approach

✅ **Full control over implementation**
✅ **Portable across platforms**
✅ **Framework flexibility**
✅ **Custom session management**
✅ **Better understanding of MCP internals**
✅ **Can integrate with existing code**

## Limitations

❌ **More boilerplate code**
❌ **Manual session management**
❌ **No automatic hibernation**
❌ **Need to handle transport details**
❌ **More complex setup**

## Next Steps

- **06-complete-example.md**: Side-by-side comparison of both approaches
- **07-deployment.md**: Production deployment strategies
