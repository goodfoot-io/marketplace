# Architecture and Design Patterns

## High-Level Architecture

```
┌─────────────────┐
│   AI Client     │  (Claude Desktop, Custom Client, etc.)
│  (MCP Client)   │
└────────┬────────┘
         │ HTTP POST/GET
         │ /mcp endpoint
         ▼
┌─────────────────────────────────────────────────────────┐
│            Cloudflare Workers Runtime                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │              HTTP Router (Hono)                    │  │
│  │  ┌─────────────┐         ┌──────────────┐        │  │
│  │  │  /mcp       │         │  /sse        │        │  │
│  │  │ (Streamable)│         │  (Legacy)    │        │  │
│  │  └──────┬──────┘         └──────┬───────┘        │  │
│  └─────────┼────────────────────────┼────────────────┘  │
│            │                        │                    │
│            ▼                        ▼                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Transport Layer                         │   │
│  │  ┌───────────────────┐  ┌──────────────────┐  │   │
│  │  │ Streamable HTTP   │  │  SSE Transport   │  │   │
│  │  │    Transport      │  │   (Deprecated)   │  │   │
│  │  └─────────┬─────────┘  └──────────────────┘  │   │
│  └────────────┼─────────────────────────────────────┘   │
│               │                                          │
│               ▼                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │           MCP Server Instance                   │   │
│  │                                                 │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │         Tool Handlers                    │  │   │
│  │  │  • calculator                            │  │   │
│  │  │  • database query                        │  │   │
│  │  │  • external API                          │  │   │
│  │  │  • custom business logic                 │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └─────────────────┬───────────────────────────────┘   │
│                    │                                    │
│                    ▼                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │      Durable Object (Per Session)               │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │  Session State                            │  │   │
│  │  │  • User preferences                       │  │   │
│  │  │  • Conversation context                   │  │   │
│  │  │  • Tool state (counters, caches, etc.)    │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │  SQLite Database (10 GB max)              │  │   │
│  │  │  • Persistent storage                     │  │   │
│  │  │  • Zero-latency queries                   │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. AI Client (MCP Client)
**Responsibilities:**
- Initiates connections to MCP server
- Sends JSON-RPC formatted requests
- Manages `Mcp-Session-Id` header
- Handles responses (JSON or SSE stream)

**Examples:**
- Claude Desktop
- MCP Inspector (development tool)
- Custom JavaScript/Python clients
- AI Playground

### 2. HTTP Router (Hono Framework)
**Responsibilities:**
- Route requests to appropriate handlers
- Mount transport endpoints (`/mcp`, `/sse`)
- Handle middleware (auth, CORS, etc.)
- Parse request bodies

**Example Code:**
```typescript
import { Hono } from 'hono';

const app = new Hono();

// Streamable HTTP endpoint (modern)
app.mount('/mcp', MyMCP.serve('/mcp').fetch);

// SSE endpoint (backward compatibility)
app.mount('/sse', MyMCP.serveSSE('/sse').fetch);

export default app;
```

### 3. Transport Layer

#### Streamable HTTP Transport
**How it works:**
1. Client sends POST to `/mcp` with JSON-RPC payload
2. Server can:
   - Return JSON immediately (202 Accepted for notifications)
   - Return JSON-RPC response (200 OK)
   - Upgrade to SSE for streaming (200 OK with `text/event-stream`)

**Session Management:**
```typescript
// First request (initialize)
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": { "protocolVersion": "2024-11-05" },
  "id": 1
}

// Response includes session ID
HTTP/1.1 200 OK
Mcp-Session-Id: abc123def456
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "result": { "protocolVersion": "2024-11-05", ... },
  "id": 1
}

// Subsequent requests include session ID
POST /mcp
Mcp-Session-Id: abc123def456
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "add", "arguments": { "a": 5, "b": 3 } },
  "id": 2
}
```

#### SSE Upgrade Pattern
For long-running operations:
```typescript
POST /mcp
Accept: application/json, text/event-stream

// Server upgrades to SSE
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"jsonrpc":"2.0","result":{"status":"processing"},"id":2}

data: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":50}}

data: {"jsonrpc":"2.0","result":{"value":8},"id":2}
```

### 4. MCP Server Instance
**Responsibilities:**
- Implement MCP protocol (JSON-RPC 2.0)
- Register tools with schemas
- Handle tool invocations
- Manage server capabilities
- Send notifications

**Tool Registration:**
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "add",
      description: "Add two numbers together",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number", description: "First number" },
          b: { type: "number", description: "Second number" }
        },
        required: ["a", "b"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "add") {
    const { a, b } = request.params.arguments;
    return {
      content: [
        { type: "text", text: `Result: ${a + b}` }
      ]
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});
```

### 5. Durable Object
**Responsibilities:**
- Store per-session state
- Provide SQLite database access
- Handle WebSocket hibernation
- Persist tool state across requests

**State Management Patterns:**

#### In-Memory State
```typescript
class MyMcpAgent extends McpAgent {
  private counter: number = 0;

  async onToolCall(name: string, args: any) {
    if (name === "increment") {
      this.counter++;
      return { value: this.counter };
    }
  }
}
```

#### SQLite Persistence
```typescript
class MyMcpAgent extends McpAgent {
  async onToolCall(name: string, args: any) {
    if (name === "get_counter") {
      const result = await this.ctx.storage.sql.exec(
        "SELECT value FROM counters WHERE id = ?",
        [args.counterId]
      );
      return { value: result.rows[0].value };
    }

    if (name === "increment_counter") {
      await this.ctx.storage.sql.exec(
        "UPDATE counters SET value = value + 1 WHERE id = ?",
        [args.counterId]
      );
      return { success: true };
    }
  }
}
```

## Design Patterns

### Pattern 1: Stateless Tools
Best for: Calculations, API calls, read-only operations

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "calculate_tax":
      const { amount, rate } = request.params.arguments;
      return {
        content: [
          { type: "text", text: `Tax: ${amount * rate}` }
        ]
      };

    case "fetch_weather":
      const weather = await fetch(`https://api.weather.com/...`);
      return {
        content: [
          { type: "text", text: await weather.text() }
        ]
      };
  }
});
```

### Pattern 2: Stateful Tools with Durable Objects
Best for: User preferences, conversation context, multi-step workflows

```typescript
class ChatMcpAgent extends McpAgent {
  private conversationHistory: Message[] = [];

  async onToolCall(name: string, args: any) {
    if (name === "add_message") {
      this.conversationHistory.push(args.message);

      // Persist to SQLite for durability
      await this.ctx.storage.sql.exec(
        "INSERT INTO messages (content, timestamp) VALUES (?, ?)",
        [args.message.content, Date.now()]
      );

      return { messageCount: this.conversationHistory.length };
    }

    if (name === "get_history") {
      return { messages: this.conversationHistory };
    }
  }
}
```

### Pattern 3: Long-Running Operations with Notifications
Best for: File processing, batch operations, background tasks

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "process_large_file") {
    const chunks = splitIntoChunks(request.params.arguments.data);

    for (let i = 0; i < chunks.length; i++) {
      // Send progress notification
      await server.notification({
        method: "notifications/progress",
        params: {
          progress: (i / chunks.length) * 100,
          progressToken: request.params.arguments.progressToken
        }
      });

      await processChunk(chunks[i]);
    }

    return {
      content: [
        { type: "text", text: "Processing complete" }
      ]
    };
  }
});
```

### Pattern 4: Multi-Session Coordination
Best for: Shared state across users, collaborative tools

```typescript
// Use Durable Object namespace to coordinate across sessions
export class SharedStateDO extends McpAgent {
  private globalCounter: number = 0;

  async onToolCall(name: string, args: any) {
    if (name === "increment_global") {
      this.globalCounter++;

      // Notify all connected clients
      await this.broadcastToAllSessions({
        method: "notifications/state_changed",
        params: { counter: this.globalCounter }
      });

      return { newValue: this.globalCounter };
    }
  }
}

// In worker, route to shared DO instance
const doId = env.SHARED_STATE.idFromName("global");
const stub = env.SHARED_STATE.get(doId);
```

## Security Considerations

### 1. Session Validation
```typescript
// Validate session ID exists and is valid
if (!sessionId || !isValidSession(sessionId)) {
  return new Response("Invalid session", { status: 404 });
}
```

### 2. Origin Validation
```typescript
const origin = request.headers.get("Origin");
if (!ALLOWED_ORIGINS.includes(origin)) {
  return new Response("Forbidden", { status: 403 });
}
```

### 3. Authentication
```typescript
// Using Cloudflare's OAuth integration
import { OAuthProvider } from '@cloudflare/agents';

export default new OAuthProvider({
  apiHandlers: {
    '/mcp': MyMCP.serve('/mcp'),
  },
  oauthProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }
  }
});
```

### 4. Rate Limiting
```typescript
// Use Durable Objects for per-session rate limiting
class RateLimitedMcpAgent extends McpAgent {
  private requestCount = 0;
  private windowStart = Date.now();

  async onRequest(request: Request) {
    const now = Date.now();
    if (now - this.windowStart > 60000) {
      // Reset window
      this.requestCount = 0;
      this.windowStart = now;
    }

    if (this.requestCount++ > 100) {
      return new Response("Rate limit exceeded", { status: 429 });
    }

    return super.onRequest(request);
  }
}
```

## Performance Optimization

### 1. WebSocket Hibernation
```typescript
// Cloudflare Agents SDK handles this automatically
class MyMcpAgent extends McpAgent {
  // Agent automatically hibernates during inactivity
  // State is preserved
  // Only consumes compute when processing requests
}
```

### 2. Lazy Loading
```typescript
class OptimizedMcpAgent extends McpAgent {
  private cachedData: any = null;

  async onToolCall(name: string, args: any) {
    if (name === "get_large_dataset") {
      if (!this.cachedData) {
        // Only load data when first needed
        this.cachedData = await loadLargeDataset();
      }
      return this.cachedData;
    }
  }
}
```

### 3. Batch Operations
```typescript
// Batch multiple tool calls into single operations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "batch_update") {
    const updates = request.params.arguments.updates;

    // Single SQLite transaction for all updates
    await this.ctx.storage.sql.exec(
      "BEGIN TRANSACTION"
    );

    for (const update of updates) {
      await this.ctx.storage.sql.exec(
        "UPDATE items SET value = ? WHERE id = ?",
        [update.value, update.id]
      );
    }

    await this.ctx.storage.sql.exec("COMMIT");

    return { updated: updates.length };
  }
});
```

## Next Steps

- **03-streamable-http-protocol.md**: Detailed protocol specification
- **04-cloudflare-agents-approach.md**: Implementation with Cloudflare SDK
- **05-raw-mcp-sdk-approach.md**: Implementation with raw MCP SDK
