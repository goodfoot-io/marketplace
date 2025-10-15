# Complete Working Example: "Add" Tool Implementation

This document provides complete, copy-paste-ready implementations of a simple MCP server with an "add" tool using both approaches.

## Approach 1: Cloudflare Agents SDK

### File Structure
```
my-mcp-agent/
├── src/
│   ├── index.ts
│   └── agent.ts
├── package.json
├── wrangler.toml
└── tsconfig.json
```

### src/agent.ts

```typescript
import { McpAgent } from '@cloudflare/agents';

/**
 * Simple calculator agent that can add two numbers
 * and remember the last result using Durable Object state
 */
export class CalculatorAgent extends McpAgent {
  private lastResult: number | null = null;

  /**
   * Handle tool calls from the AI client
   */
  async onToolCall(name: string, args: any) {
    switch (name) {
      case 'add':
        const result = args.a + args.b;
        this.lastResult = result;

        // Optional: Persist to SQLite for durability across DO restarts
        await this.ctx.storage.sql.exec(`
          CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY,
            value REAL NOT NULL,
            timestamp INTEGER NOT NULL
          )
        `);

        await this.ctx.storage.sql.exec(
          'INSERT INTO results (id, value, timestamp) VALUES (1, ?, ?) ' +
            'ON CONFLICT(id) DO UPDATE SET value=excluded.value, timestamp=excluded.timestamp',
          [result, Date.now()]
        );

        return {
          content: [
            {
              type: 'text',
              text: `The sum of ${args.a} and ${args.b} is ${result}`,
            },
          ],
        };

      case 'get_last_result':
        if (this.lastResult === null) {
          return {
            content: [
              {
                type: 'text',
                text: 'No calculations performed yet',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `The last result was ${this.lastResult}`,
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Define available tools
   */
  async getTools() {
    return [
      {
        name: 'add',
        description: 'Add two numbers together and remember the result',
        inputSchema: {
          type: 'object',
          properties: {
            a: {
              type: 'number',
              description: 'The first number to add',
            },
            b: {
              type: 'number',
              description: 'The second number to add',
            },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'get_last_result',
        description: 'Retrieve the result of the last addition operation',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * Optional: Called when agent is first initialized
   */
  async onInitialize() {
    console.log('Calculator agent initialized');

    // Load last result from SQLite storage
    const result = await this.ctx.storage.sql.exec(
      'SELECT value FROM results WHERE id = 1'
    );

    const rows = result.toArray();
    if (rows.length > 0) {
      this.lastResult = rows[0].value as number;
      console.log('Restored last result:', this.lastResult);
    }
  }
}
```

### src/index.ts

```typescript
import { Hono } from 'hono';
import { CalculatorAgent } from './agent';

const app = new Hono();

// Mount Streamable HTTP transport (modern)
app.mount('/mcp', CalculatorAgent.serve('/mcp').fetch);

// Mount SSE transport (backward compatibility)
app.mount('/sse', CalculatorAgent.serveSSE('/sse').fetch);

// Health check endpoint
app.get('/', (c) =>
  c.json({
    name: 'Calculator MCP Server',
    version: '1.0.0',
    endpoints: {
      streamableHttp: '/mcp',
      sse: '/sse',
    },
  })
);

app.get('/health', (c) => c.json({ status: 'healthy' }));

export default app;

// Export Durable Object class
export { CalculatorAgent };
```

### package.json

```json
{
  "name": "calculator-mcp-agent",
  "version": "1.0.0",
  "description": "Simple MCP calculator using Cloudflare Agents SDK",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "wrangler dev --test-scheduled"
  },
  "dependencies": {
    "@cloudflare/agents": "^0.0.16",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240000.0",
    "typescript": "^5.6.0",
    "wrangler": "^3.80.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### wrangler.toml

```toml
name = "calculator-mcp-agent"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Durable Object binding
[[durable_objects.bindings]]
name = "CALCULATOR_AGENT"
class_name = "CalculatorAgent"

# Durable Object migration
[[migrations]]
tag = "v1"
new_classes = ["CalculatorAgent"]

# Optional: Add a custom domain
# routes = [
#   { pattern = "calculator.example.com", custom_domain = true }
# ]
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "types": ["@cloudflare/workers-types"],
    "jsx": "react",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Setup Commands

```bash
# Create project
mkdir calculator-mcp-agent
cd calculator-mcp-agent

# Copy the files above, then:
npm install

# Run locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

### Testing

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector http://localhost:8787/mcp

# Or test with curl
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    },
    "id": 1
  }'

# Then call the add tool (use session ID from above)
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <SESSION_ID>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 42, "b": 58}
    },
    "id": 2
  }'
```

---

## Approach 2: Raw MCP SDK + Hono

### File Structure
```
mcp-server-raw/
├── src/
│   ├── index.ts
│   ├── server.ts
│   └── session-do.ts
├── package.json
├── wrangler.toml
└── tsconfig.json
```

### src/server.ts

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export interface ServerState {
  lastResult: number | null;
}

/**
 * Create a new MCP server instance with add tool
 */
export function createCalculatorServer(
  state: ServerState = { lastResult: null }
): { server: Server; state: ServerState } {
  const server = new Server(
    {
      name: 'calculator-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'add',
        description: 'Add two numbers together and remember the result',
        inputSchema: {
          type: 'object',
          properties: {
            a: {
              type: 'number',
              description: 'The first number to add',
            },
            b: {
              type: 'number',
              description: 'The second number to add',
            },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'get_last_result',
        description: 'Retrieve the result of the last addition operation',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'add': {
        const result = (args.a as number) + (args.b as number);
        state.lastResult = result;

        return {
          content: [
            {
              type: 'text',
              text: `The sum of ${args.a} and ${args.b} is ${result}`,
            },
          ],
        };
      }

      case 'get_last_result': {
        if (state.lastResult === null) {
          return {
            content: [
              {
                type: 'text',
                text: 'No calculations performed yet',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `The last result was ${state.lastResult}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return { server, state };
}
```

### src/session-do.ts

```typescript
import { DurableObject } from 'cloudflare:workers';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createCalculatorServer, ServerState } from './server.js';

/**
 * Durable Object that maintains per-session MCP server state
 */
export class McpSessionDO extends DurableObject {
  private serverInstance: ReturnType<typeof createCalculatorServer> | null =
    null;

  async fetch(request: Request): Promise<Response> {
    try {
      // Initialize server if needed
      if (!this.serverInstance) {
        // Restore state from storage
        const storedState = await this.ctx.storage.get<ServerState>('state');
        const state: ServerState = storedState || { lastResult: null };

        this.serverInstance = createCalculatorServer(state);
      }

      const body = await request.json();

      // Create transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      // Response accumulator
      let statusCode = 200;
      const responseHeaders = new Map<string, string>();
      let responseBody = '';
      let isSSE = false;

      // Mock Node.js response for transport
      const res = {
        statusCode: 200,
        status: function (code: number) {
          statusCode = code;
          return this;
        },
        setHeader: function (name: string, value: string) {
          responseHeaders.set(name.toLowerCase(), value);
          if (
            name.toLowerCase() === 'content-type' &&
            value === 'text/event-stream'
          ) {
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
      await this.serverInstance.server.connect(transport);
      await transport.handleRequest(
        {
          method: 'POST',
          url: '/mcp',
          headers: request.headers,
          body,
        } as any,
        res as any,
        body
      );

      await transport.close();

      // Persist state after request
      await this.ctx.storage.put('state', this.serverInstance.state);

      // Build response
      const headers: Record<string, string> = {
        ...Object.fromEntries(responseHeaders),
      };

      if (isSSE) {
        headers['Cache-Control'] = 'no-cache';
        headers['Connection'] = 'keep-alive';
      }

      return new Response(responseBody, {
        status: statusCode,
        headers,
      });
    } catch (error) {
      console.error('Error in Durable Object:', error);
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
            data: error instanceof Error ? error.message : String(error),
          },
          id: null,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
}
```

### src/index.ts

```typescript
import { Hono } from 'hono';

interface Env {
  MCP_SESSION: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * Main MCP endpoint - routes to appropriate Durable Object
 */
app.all('/mcp', async (c) => {
  const sessionId = c.req.header('Mcp-Session-Id');

  let doId: DurableObjectId;
  let isNewSession = false;

  if (sessionId) {
    // Existing session
    try {
      doId = c.env.MCP_SESSION.idFromString(sessionId);
    } catch {
      // Invalid session ID format, create new
      doId = c.env.MCP_SESSION.newUniqueId();
      isNewSession = true;
    }
  } else {
    // New session
    doId = c.env.MCP_SESSION.newUniqueId();
    isNewSession = true;
  }

  // Get Durable Object stub and forward request
  const stub = c.env.MCP_SESSION.get(doId);
  const response = await stub.fetch(c.req.raw);

  // Add session ID header for new sessions
  if (isNewSession) {
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Mcp-Session-Id', doId.toString());
    return newResponse;
  }

  return response;
});

// Health check
app.get('/', (c) =>
  c.json({
    name: 'Calculator MCP Server',
    version: '1.0.0',
    endpoints: {
      streamableHttp: '/mcp',
    },
  })
);

app.get('/health', (c) => c.json({ status: 'healthy' }));

export default app;

// Export Durable Object
export { McpSessionDO } from './session-do.js';
```

### package.json

```json
{
  "name": "mcp-server-raw",
  "version": "1.0.0",
  "description": "Simple MCP calculator using raw SDK",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240000.0",
    "typescript": "^5.6.0",
    "wrangler": "^3.80.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### wrangler.toml

```toml
name = "mcp-server-raw"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Durable Object binding
[[durable_objects.bindings]]
name = "MCP_SESSION"
class_name = "McpSessionDO"

# Durable Object migration
[[migrations]]
tag = "v1"
new_classes = ["McpSessionDO"]
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Setup Commands

```bash
# Create project
mkdir mcp-server-raw
cd mcp-server-raw

# Copy the files above, then:
npm install

# Run locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

---

## Side-by-Side Comparison

| Feature | Cloudflare Agents SDK | Raw MCP SDK |
|---------|----------------------|-------------|
| **Lines of Code** | ~80 (agent.ts + index.ts) | ~200 (all files) |
| **Setup Complexity** | Low | Medium |
| **Durable Object Integration** | Automatic | Manual |
| **Session Management** | Automatic | Manual |
| **Transport Setup** | One-liner | Custom implementation |
| **State Persistence** | Built-in SQLite access | Manual storage API |
| **Backward Compatibility** | Both transports with 1 line each | Must implement separately |
| **Portability** | Cloudflare-only | Portable to any platform |
| **Control** | Less control | Full control |
| **Learning Curve** | Gentle | Steep |
| **Best For** | Rapid prototyping on Cloudflare | Custom requirements, other platforms |

## Testing Both Implementations

### Test Script (test.sh)

```bash
#!/bin/bash

BASE_URL="http://localhost:8787"
SESSION_ID=""

# Initialize
echo "=== Initializing ==="
INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    },
    "id": 1
  }')

echo "$INIT_RESPONSE" | jq .

# Extract session ID
SESSION_ID=$(echo "$INIT_RESPONSE" | grep -o 'Mcp-Session-Id: [^"]*' || echo "")
echo "Session ID: $SESSION_ID"

# List tools
echo -e "\n=== Listing Tools ==="
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "$SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }' | jq .

# Call add tool
echo -e "\n=== Calling add(10, 32) ==="
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "$SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 10, "b": 32}
    },
    "id": 3
  }' | jq .

# Get last result
echo -e "\n=== Getting Last Result ==="
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "$SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_last_result",
      "arguments": {}
    },
    "id": 4
  }' | jq .
```

Make it executable and run:
```bash
chmod +x test.sh
./test.sh
```

## Next Steps

- **07-deployment.md**: Production deployment strategies and best practices
