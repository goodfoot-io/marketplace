# MCP Server with Cloudflare Durable Objects - Complete Guide

This documentation provides a comprehensive guide to implementing Model Context Protocol (MCP) servers using Cloudflare Durable Objects with Streamable HTTP transport.

## Documentation Structure

### Core Concepts
1. **[Overview](./01-overview.md)** - Introduction to MCP, Durable Objects, and why they work great together
2. **[Architecture](./02-architecture.md)** - Deep dive into system architecture and design patterns
3. **[Streamable HTTP Protocol](./03-streamable-http-protocol.md)** - Technical specification of the transport layer

### Implementation Guides
4. **[Cloudflare Agents Approach](./04-cloudflare-agents-approach.md)** - High-level SDK for rapid development
5. **[Raw MCP SDK Approach](./05-raw-mcp-sdk-approach.md)** - Low-level implementation for maximum control
6. **[Complete Example](./06-complete-example.md)** - Full working implementations with "add" tool

### Operations
7. **[Deployment Guide](./07-deployment.md)** - Production deployment, monitoring, and best practices

## Quick Start

### Choose Your Approach

**Option 1: Cloudflare Agents SDK (Recommended for beginners)**
```bash
npm install @cloudflare/agents hono
```
- Less code
- Automatic Durable Object integration
- Built-in session management
- Perfect for Cloudflare-first projects

**Option 2: Raw MCP SDK (For advanced users)**
```bash
npm install @modelcontextprotocol/sdk hono
```
- Full control
- Portable to other platforms
- Custom transport implementation
- Better for complex requirements

### Minimal Example (Agents SDK)

```typescript
// agent.ts
import { McpAgent } from '@cloudflare/agents';

export class MyAgent extends McpAgent {
  async onToolCall(name: string, args: any) {
    if (name === 'add') {
      return {
        content: [{
          type: 'text',
          text: `Result: ${args.a + args.b}`
        }]
      };
    }
  }

  async getTools() {
    return [{
      name: 'add',
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      }
    }];
  }
}

// index.ts
import { Hono } from 'hono';
import { MyAgent } from './agent';

const app = new Hono();
app.mount('/mcp', MyAgent.serve('/mcp').fetch);
export default app;
export { MyAgent };
```

### Deploy
```bash
npx wrangler deploy
```

Your MCP server is now live at `https://your-worker.workers.dev/mcp`

## Key Features

### ✅ Streamable HTTP Transport
- Single `/mcp` endpoint for all communication
- Dynamic upgrade to SSE for streaming
- Backward compatible with legacy SSE clients
- Simpler than old multi-endpoint approach

### ✅ Durable Objects
- Persistent per-session state
- Built-in SQLite database (10GB per object)
- WebSocket hibernation for cost efficiency
- Automatic scaling and distribution

### ✅ Production-Ready
- CORS and security configuration
- Rate limiting built-in
- OAuth authentication support
- Comprehensive error handling

## Architecture Overview

```
AI Client (Claude, etc.)
    ↓
Cloudflare Worker (/mcp endpoint)
    ↓
Durable Object (per session)
    ↓
MCP Server + Tools
    ↓
SQLite Storage (persistent state)
```

## When to Use This

### Perfect For:
- Building AI-powered tools and integrations
- Creating custom APIs for Claude or other AI assistants
- Stateful AI agents that need to remember context
- Rapid prototyping of MCP servers
- Global, low-latency AI tool deployment

### Not Ideal For:
- Simple stateless APIs (use regular Workers)
- CPU-intensive operations (10-50ms limit per request)
- Large file storage (use R2 instead)
- Real-time streaming of large datasets

## Comparison Table

| Feature | Agents SDK | Raw MCP SDK |
|---------|-----------|-------------|
| Code Complexity | Low | Medium-High |
| Setup Time | <1 hour | 2-4 hours |
| Portability | Cloudflare only | Any platform |
| Control Level | High-level | Low-level |
| Durable Objects | Automatic | Manual setup |
| Session Management | Built-in | Custom |
| Learning Curve | Gentle | Steep |
| Best For | Rapid prototyping | Custom requirements |

## Common Use Cases

### 1. Calculator Agent
Simple stateful calculator that remembers last result
- **Complexity**: Beginner
- **Guide**: [Complete Example](./06-complete-example.md)

### 2. Database Query Tool
AI agent that can query your database
- **Complexity**: Intermediate
- **Pattern**: Stateless tools with external API calls

### 3. Workflow Automation
Multi-step tasks with state persistence
- **Complexity**: Advanced
- **Pattern**: Long-running operations with notifications

### 4. Multi-User Collaboration
Shared state across multiple AI sessions
- **Complexity**: Advanced
- **Pattern**: Coordinated Durable Objects

## Development Workflow

```bash
# 1. Create project
mkdir my-mcp-server && cd my-mcp-server
npm init -y

# 2. Install dependencies
npm install @cloudflare/agents hono wrangler

# 3. Create files (see examples in docs)

# 4. Run locally
npx wrangler dev

# 5. Test with MCP Inspector
npx @modelcontextprotocol/inspector http://localhost:8787/mcp

# 6. Deploy to production
npx wrangler deploy
```

## Testing

### Local Testing
```bash
# Start dev server
npx wrangler dev

# Test with cURL
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'
```

### Using MCP Inspector
```bash
npx @modelcontextprotocol/inspector http://localhost:8787/mcp
```

### Automated Testing
```typescript
// tests/agent.test.ts
import { describe, it, expect } from 'vitest';

describe('Calculator Agent', () => {
  it('should add two numbers', async () => {
    const result = await agent.onToolCall('add', { a: 5, b: 3 });
    expect(result.content[0].text).toContain('8');
  });
});
```

## Resources

### Official Documentation
- [MCP Specification](https://modelcontextprotocol.io/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)

### Example Repositories
- [mcp-server-do by irvinebroque](https://github.com/irvinebroque/mcp-server-do)
- [mcp-hono-stateless by mhart](https://github.com/mhart/mcp-hono-stateless)

### Blog Posts
- [Building AI Agents with MCP on Cloudflare](https://blog.cloudflare.com/building-ai-agents-with-mcp-authn-authz-and-durable-objects/)
- [Streamable HTTP Transport for MCP](https://blog.cloudflare.com/streamable-http-mcp-servers-python/)

## Troubleshooting

### Common Issues

**Problem**: "Durable Object not found"
**Solution**: Check `wrangler.toml` migrations and re-deploy

**Problem**: Module import errors
**Solution**: Ensure `"type": "module"` in `package.json`

**Problem**: Session ID invalid
**Solution**: Validate format and implement proper session management

See [Deployment Guide](./07-deployment.md) for comprehensive troubleshooting.

## Contributing

Found an issue or have a suggestion? Please:
1. Check existing documentation for answers
2. Review related GitHub repositories
3. Consult Cloudflare and MCP official docs

## License

This documentation is provided as-is for educational purposes. Refer to individual project licenses for code examples.

---

**Ready to build?** Start with [01-overview.md](./01-overview.md) for concepts or jump to [06-complete-example.md](./06-complete-example.md) for working code!
