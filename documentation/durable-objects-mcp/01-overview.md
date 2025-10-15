# MCP Server with Cloudflare Durable Objects - Overview

## What is Model Context Protocol (MCP)?

Model Context Protocol (MCP) is a standardized protocol that allows AI applications (like Claude, ChatGPT, etc.) to interact with external tools, data sources, and services. Think of it as a way for AI to call APIs, access databases, and perform actions in the real world.

## What are Cloudflare Durable Objects?

Durable Objects are Cloudflare's solution for stateful, serverless computing:

- **Stateful**: Each object maintains its own persistent state with zero-latency SQLite storage (up to 10 GB)
- **Serverless**: No infrastructure management required
- **Global**: Automatically deployed across Cloudflare's edge network
- **Isolated**: Each object instance has its own memory and storage
- **Cost-efficient**: WebSocket Hibernation allows objects to sleep during inactivity

## Why Combine MCP with Durable Objects?

1. **Persistent Sessions**: Each MCP client session gets its own Durable Object, maintaining state across requests
2. **Scalability**: Automatic scaling without managing servers
3. **Edge Computing**: Low latency by running close to users globally
4. **Built-in State**: SQLite database per object for tool state, user data, etc.
5. **WebSocket Support**: Native support for long-lived connections with hibernation

## Transport Evolution: SSE → Streamable HTTP

### Legacy: Server-Sent Events (SSE)
- **Two endpoints**: One for requests, one for streaming responses
- **Complexity**: Required managing separate connection lifecycles
- **Status**: Deprecated as of March 2025

### Modern: Streamable HTTP
- **Single endpoint**: All communication through one `/mcp` endpoint
- **Dynamic upgrade**: Can upgrade to SSE for long-running operations
- **Simpler**: Single connection manages both directions
- **Efficient**: Better performance and connection stability
- **Backward compatible**: Can support both transports simultaneously

## Key Components

### 1. MCP Server
The core server implementing the Model Context Protocol:
- Handles tool registration
- Processes requests from AI clients
- Manages protocol compliance

### 2. Transport Layer
How messages are sent between client and server:
- **Streamable HTTP**: POST requests with optional SSE upgrade
- Handles serialization/deserialization
- Manages session state

### 3. Durable Object
Cloudflare's stateful container:
- Stores per-session state
- Maintains SQLite database
- Handles WebSocket hibernation

### 4. Tools
Functions that AI can invoke:
- Defined with JSON Schema parameters
- Return structured results
- Can be async and long-running

## Architecture Patterns

### Pattern 1: Cloudflare Agents SDK (Recommended)
```
AI Client → /mcp endpoint → McpAgent (Durable Object) → Tools
                                ↓
                          SQLite Storage
```
- Use `@cloudflare/agents` package
- Extend `McpAgent` class
- Automatic Durable Object integration
- Built-in session management

### Pattern 2: Raw MCP SDK + Hono
```
AI Client → /mcp endpoint → Hono Router → StreamableHTTPServerTransport → MCP Server → Tools
                                              ↓
                                      Durable Object Storage
```
- Use `@modelcontextprotocol/sdk` directly
- More control over transport
- Custom session management
- Framework flexibility (Hono, Express, etc.)

## When to Use Which Approach?

### Use Cloudflare Agents SDK When:
- Building on Cloudflare Workers exclusively
- Want automatic Durable Object integration
- Need built-in authentication (OAuth)
- Prefer convention over configuration
- Want WebSocket Hibernation out of the box

### Use Raw MCP SDK When:
- Need full control over transport layer
- Want to use custom frameworks (Hono, etc.)
- Building portable servers (not Cloudflare-specific)
- Have complex custom session management
- Need to integrate with existing infrastructure

## Core Concepts

### Session Management
Each AI client connection gets a unique session ID:
- Generated on first request (during `initialize`)
- Sent in `Mcp-Session-Id` HTTP header
- Maps to a specific Durable Object instance
- Maintains state across multiple requests

### Request Flow
1. AI client sends POST to `/mcp`
2. Server processes JSON-RPC request
3. For quick responses: Return JSON immediately
4. For streaming: Upgrade to SSE and stream events
5. Session state persisted in Durable Object

### Tool Invocation
1. AI decides to use a tool based on its description
2. Client sends `tools/call` request with tool name and parameters
3. Server validates parameters against JSON Schema
4. Tool function executes (can be async)
5. Result returned to AI client
6. State changes persisted in Durable Object

## Next Steps

Continue to:
- **02-architecture.md**: Deep dive into architecture patterns
- **03-streamable-http-protocol.md**: Technical protocol specification
- **04-cloudflare-agents-approach.md**: Implementation with Cloudflare SDK
- **05-raw-mcp-sdk-approach.md**: Implementation with raw MCP SDK
- **06-complete-example.md**: Complete working example with "add" tool
- **07-deployment.md**: Deployment and configuration guide
