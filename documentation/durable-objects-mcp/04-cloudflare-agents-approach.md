# Implementation with Cloudflare Agents SDK

## Overview

The Cloudflare Agents SDK (`@cloudflare/agents`) provides the highest-level abstraction for building MCP servers on Cloudflare. It automatically handles:
- Durable Object integration
- Session management
- WebSocket hibernation
- Both SSE and Streamable HTTP transports
- SQLite storage access

## Installation

```bash
npm install @cloudflare/agents hono
```

## Basic Structure

### 1. Define Your MCP Agent (Durable Object)

```typescript
// src/agent.ts
import { McpAgent } from '@cloudflare/agents';

export class MyMcpAgent extends McpAgent {
  async onToolCall(name: string, args: any) {
    switch (name) {
      case 'add':
        return {
          content: [
            {
              type: 'text',
              text: `Result: ${args.a + args.b}`
            }
          ]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async getTools() {
    return [
      {
        name: 'add',
        description: 'Add two numbers together',
        inputSchema: {
          type: 'object',
          properties: {
            a: {
              type: 'number',
              description: 'First number to add'
            },
            b: {
              type: 'number',
              description: 'Second number to add'
            }
          },
          required: ['a', 'b']
        }
      }
    ];
  }
}
```

### 2. Set Up Hono Router

```typescript
// src/index.ts
import { Hono } from 'hono';
import { MyMcpAgent } from './agent';

const app = new Hono();

// Mount both transport endpoints
app.mount('/mcp', MyMcpAgent.serve('/mcp').fetch);
app.mount('/sse', MyMcpAgent.serveSSE('/sse').fetch);

export default app;

// Export the Durable Object class
export { MyMcpAgent };
```

### 3. Configure Wrangler

```toml
# wrangler.toml
name = "my-mcp-server"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[durable_objects.bindings]]
name = "MY_MCP_AGENT"
class_name = "MyMcpAgent"

[[migrations]]
tag = "v1"
new_classes = ["MyMcpAgent"]
```

## Complete Working Example: Calculator Agent

### agent.ts

```typescript
import { McpAgent } from '@cloudflare/agents';

interface CalculatorState {
  lastResult: number | null;
  history: string[];
}

export class CalculatorAgent extends McpAgent {
  private state: CalculatorState = {
    lastResult: null,
    history: []
  };

  async onToolCall(name: string, args: any) {
    switch (name) {
      case 'add':
        return this.add(args.a, args.b);

      case 'subtract':
        return this.subtract(args.a, args.b);

      case 'multiply':
        return this.multiply(args.a, args.b);

      case 'divide':
        return this.divide(args.a, args.b);

      case 'get_last_result':
        return this.getLastResult();

      case 'get_history':
        return this.getHistory();

      case 'clear_history':
        return this.clearHistory();

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private add(a: number, b: number) {
    const result = a + b;
    this.saveResult(`${a} + ${b} = ${result}`, result);
    return {
      content: [
        { type: 'text', text: `${a} + ${b} = ${result}` }
      ]
    };
  }

  private subtract(a: number, b: number) {
    const result = a - b;
    this.saveResult(`${a} - ${b} = ${result}`, result);
    return {
      content: [
        { type: 'text', text: `${a} - ${b} = ${result}` }
      ]
    };
  }

  private multiply(a: number, b: number) {
    const result = a * b;
    this.saveResult(`${a} × ${b} = ${result}`, result);
    return {
      content: [
        { type: 'text', text: `${a} × ${b} = ${result}` }
      ]
    };
  }

  private divide(a: number, b: number) {
    if (b === 0) {
      return {
        content: [
          { type: 'text', text: 'Error: Division by zero' }
        ],
        isError: true
      };
    }
    const result = a / b;
    this.saveResult(`${a} ÷ ${b} = ${result}`, result);
    return {
      content: [
        { type: 'text', text: `${a} ÷ ${b} = ${result}` }
      ]
    };
  }

  private getLastResult() {
    if (this.state.lastResult === null) {
      return {
        content: [
          { type: 'text', text: 'No calculations performed yet' }
        ]
      };
    }
    return {
      content: [
        { type: 'text', text: `Last result: ${this.state.lastResult}` }
      ]
    };
  }

  private getHistory() {
    if (this.state.history.length === 0) {
      return {
        content: [
          { type: 'text', text: 'No calculation history' }
        ]
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Calculation History:\n${this.state.history.join('\n')}`
        }
      ]
    };
  }

  private clearHistory() {
    this.state.history = [];
    this.state.lastResult = null;
    return {
      content: [
        { type: 'text', text: 'History cleared' }
      ]
    };
  }

  private saveResult(calculation: string, result: number) {
    this.state.lastResult = result;
    this.state.history.push(`${new Date().toISOString()}: ${calculation}`);
    // Keep only last 100 calculations
    if (this.state.history.length > 100) {
      this.state.history.shift();
    }
  }

  async getTools() {
    return [
      {
        name: 'add',
        description: 'Add two numbers together',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        }
      },
      {
        name: 'subtract',
        description: 'Subtract second number from first',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'Number to subtract from' },
            b: { type: 'number', description: 'Number to subtract' }
          },
          required: ['a', 'b']
        }
      },
      {
        name: 'multiply',
        description: 'Multiply two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        }
      },
      {
        name: 'divide',
        description: 'Divide first number by second',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'Dividend' },
            b: { type: 'number', description: 'Divisor' }
          },
          required: ['a', 'b']
        }
      },
      {
        name: 'get_last_result',
        description: 'Get the result of the last calculation',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_history',
        description: 'Get calculation history',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'clear_history',
        description: 'Clear calculation history',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }
}
```

### index.ts

```typescript
import { Hono } from 'hono';
import { CalculatorAgent } from './agent';

const app = new Hono();

// Serve both transport types
app.mount('/mcp', CalculatorAgent.serve('/mcp').fetch);
app.mount('/sse', CalculatorAgent.serveSSE('/sse').fetch);

// Optional: Health check endpoint
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
export { CalculatorAgent };
```

### wrangler.toml

```toml
name = "calculator-mcp-server"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[durable_objects.bindings]]
name = "CALCULATOR_AGENT"
class_name = "CalculatorAgent"

[[migrations]]
tag = "v1"
new_classes = ["CalculatorAgent"]
```

### package.json

```json
{
  "name": "calculator-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@cloudflare/agents": "latest",
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240000.0",
    "wrangler": "^3.0.0"
  }
}
```

## Advanced Features

### 1. Using SQLite Storage

```typescript
export class PersistentCalculatorAgent extends McpAgent {
  async onInitialize() {
    // Initialize database schema
    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS calculations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        result REAL NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
  }

  async onToolCall(name: string, args: any) {
    if (name === 'add') {
      const result = args.a + args.b;

      // Persist to SQLite
      await this.ctx.storage.sql.exec(
        'INSERT INTO calculations (operation, result, timestamp) VALUES (?, ?, ?)',
        [`${args.a} + ${args.b}`, result, Date.now()]
      );

      return {
        content: [
          { type: 'text', text: `Result: ${result}` }
        ]
      };
    }

    if (name === 'get_history') {
      const rows = await this.ctx.storage.sql.exec(
        'SELECT operation, result, timestamp FROM calculations ORDER BY timestamp DESC LIMIT 50'
      );

      const history = rows.toArray().map((row: any) =>
        `${new Date(row.timestamp).toISOString()}: ${row.operation} = ${row.result}`
      );

      return {
        content: [
          { type: 'text', text: history.join('\n') }
        ]
      };
    }
  }
}
```

### 2. Sending Progress Notifications

```typescript
export class LongRunningAgent extends McpAgent {
  async onToolCall(name: string, args: any) {
    if (name === 'process_batch') {
      const items = args.items;

      for (let i = 0; i < items.length; i++) {
        // Send progress notification to client
        await this.sendNotification({
          method: 'notifications/progress',
          params: {
            progress: Math.round((i / items.length) * 100),
            progressToken: args._meta?.progressToken
          }
        });

        await processItem(items[i]);
      }

      return {
        content: [
          { type: 'text', text: `Processed ${items.length} items` }
        ]
      };
    }
  }
}
```

### 3. Authentication with OAuth

```typescript
// src/index.ts
import { OAuthProvider } from '@cloudflare/agents';
import { CalculatorAgent } from './agent';

export default new OAuthProvider({
  apiHandlers: {
    '/mcp': CalculatorAgent.serve('/mcp'),
    '/sse': CalculatorAgent.serveSSE('/sse')
  },
  oauthProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      scopes: ['read:user']
    }
  },
  // Optional: Customize authorization
  authorize: async (user, request) => {
    // Check if user is allowed
    return user.email.endsWith('@example.com');
  }
});

export { CalculatorAgent };
```

Set secrets:
```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

### 4. Multi-User Shared State

```typescript
// Shared counter across all users
export class SharedCounterAgent extends McpAgent {
  private globalCounter = 0;

  async onToolCall(name: string, args: any) {
    if (name === 'increment_shared') {
      this.globalCounter++;

      // Notify all connected sessions about the change
      await this.broadcastNotification({
        method: 'notifications/counter_changed',
        params: { newValue: this.globalCounter }
      });

      return {
        content: [
          { type: 'text', text: `Counter: ${this.globalCounter}` }
        ]
      };
    }
  }
}

// In worker, route to shared instance
const sharedId = env.SHARED_COUNTER.idFromName('global');
const stub = env.SHARED_COUNTER.get(sharedId);
```

## Testing Locally

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Test with MCP Inspector
```bash
npx @modelcontextprotocol/inspector http://localhost:8787/mcp
```

### 3. Test with cURL

**Initialize:**
```bash
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "curl", "version": "1.0" }
    },
    "id": 1
  }'
```

**Call Tool:**
```bash
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id-from-initialize>" \
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

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Your MCP server is now live at:
# https://your-worker.your-subdomain.workers.dev/mcp
```

## Best Practices

### 1. Error Handling
```typescript
async onToolCall(name: string, args: any) {
  try {
    // Tool logic
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
}
```

### 2. Input Validation
```typescript
async onToolCall(name: string, args: any) {
  if (name === 'divide') {
    if (typeof args.a !== 'number' || typeof args.b !== 'number') {
      throw new Error('Both arguments must be numbers');
    }
    if (args.b === 0) {
      throw new Error('Division by zero');
    }
    // Process...
  }
}
```

### 3. State Management
```typescript
// Use SQLite for important data
await this.ctx.storage.sql.exec(
  'INSERT INTO important_data (key, value) VALUES (?, ?)',
  [key, value]
);

// Use in-memory for temporary/cached data
this.cache.set(key, value);
```

## Advantages of Cloudflare Agents Approach

✅ **Automatic Durable Object integration**
✅ **Built-in session management**
✅ **WebSocket hibernation support**
✅ **Both transport types (SSE + Streamable HTTP)**
✅ **OAuth authentication built-in**
✅ **SQLite storage access**
✅ **Less boilerplate code**
✅ **Cloudflare-optimized**

## Limitations

❌ **Cloudflare-specific** (not portable)
❌ **Less control over transport layer**
❌ **Opinionated architecture**
❌ **Newer/less documentation**

## Next Steps

- **05-raw-mcp-sdk-approach.md**: Implementation with raw MCP SDK for more control
- **06-complete-example.md**: Side-by-side comparison with complete examples
- **07-deployment.md**: Production deployment guide
