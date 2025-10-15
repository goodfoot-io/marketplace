# Deployment Guide

## Overview

This guide covers deploying MCP servers with Cloudflare Durable Objects to production, including configuration, security, monitoring, and best practices.

## Prerequisites

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com/sign-up
2. **Wrangler CLI**: Already installed via `npm install wrangler`
3. **Git Repository**: For CI/CD integration (optional but recommended)

## Initial Setup

### 1. Authenticate Wrangler

```bash
npx wrangler login
```

This opens a browser for OAuth authentication with Cloudflare.

### 2. Verify Configuration

```bash
# Check your account details
npx wrangler whoami

# Test configuration
npx wrangler dev
```

## Deployment Methods

### Method 1: Manual Deployment (Quick Start)

```bash
# Deploy to production
npx wrangler deploy

# Deploy with specific environment
npx wrangler deploy --env production

# Deploy with verbose output
npx wrangler deploy --verbose
```

After deployment, Wrangler outputs your worker URL:
```
Published my-mcp-server (1.23 sec)
  https://my-mcp-server.your-subdomain.workers.dev
```

### Method 2: GitHub Actions (Recommended for Production)

#### .github/workflows/deploy.yml

```yaml
name: Deploy MCP Server

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
        continue-on-error: false

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production

      - name: Comment PR with deployment URL
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ Deployed to https://my-mcp-server.workers.dev'
            })
```

#### Setup GitHub Secrets

```bash
# Generate API token at: https://dash.cloudflare.com/profile/api-tokens
# Permissions needed:
# - Account: Cloudflare Workers Scripts: Edit
# - Account: Durable Objects: Edit

# Add to GitHub repo secrets:
# CLOUDFLARE_API_TOKEN
# CLOUDFLARE_ACCOUNT_ID (found in Cloudflare dashboard)
```

### Method 3: Preview Deployments

For testing before production:

```bash
# Deploy to preview environment
npx wrangler deploy --env preview

# Deploy with specific version tag
npx wrangler deploy --tag v1.2.3
```

## Environment Configuration

### Multi-Environment Setup

#### wrangler.toml

```toml
name = "my-mcp-server"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Default (development)
[env.development]
vars = { ENVIRONMENT = "development" }

[[env.development.durable_objects.bindings]]
name = "MCP_SESSION"
class_name = "McpSessionDO"

# Preview environment
[env.preview]
name = "my-mcp-server-preview"
vars = { ENVIRONMENT = "preview" }

[[env.preview.durable_objects.bindings]]
name = "MCP_SESSION"
class_name = "McpSessionDO"

# Production environment
[env.production]
name = "my-mcp-server-prod"
vars = { ENVIRONMENT = "production" }

[[env.production.durable_objects.bindings]]
name = "MCP_SESSION"
class_name = "McpSessionDO"

# Shared migrations
[[migrations]]
tag = "v1"
new_classes = ["McpSessionDO"]
```

### Environment Variables

```bash
# Development (wrangler.toml)
vars = { LOG_LEVEL = "debug" }

# Production secrets (stored encrypted)
npx wrangler secret put GITHUB_CLIENT_ID --env production
npx wrangler secret put GITHUB_CLIENT_SECRET --env production
npx wrangler secret put API_KEY --env production
```

Access in code:
```typescript
interface Env {
  ENVIRONMENT: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  API_KEY: string;
  MCP_SESSION: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env) {
    if (env.ENVIRONMENT === 'production') {
      // Production-specific logic
    }
  }
};
```

## Custom Domains

### Option 1: Workers.dev Subdomain (Free)

Automatically provided:
```
https://my-mcp-server.your-subdomain.workers.dev
```

### Option 2: Custom Domain (Recommended)

#### Prerequisites
- Domain managed by Cloudflare DNS
- Cloudflare zone (free or paid plan)

#### wrangler.toml
```toml
name = "my-mcp-server"

# Route to custom domain
routes = [
  { pattern = "mcp.example.com", custom_domain = true }
]

# Or multiple routes
routes = [
  { pattern = "mcp.example.com/v1/*", custom_domain = true },
  { pattern = "api.example.com/mcp/*", custom_domain = true }
]
```

#### Setup Steps

1. **Add domain to Cloudflare**: Dashboard → Websites → Add a Site
2. **Configure DNS**: Cloudflare will provide nameservers
3. **Update wrangler.toml**: Add routes as above
4. **Deploy**: `npx wrangler deploy --env production`
5. **Verify**: Visit `https://mcp.example.com/health`

### Option 3: Path-Based Routing

Host multiple services on one domain:

```toml
routes = [
  { pattern = "api.example.com/mcp/*", custom_domain = true }
]
```

MCP endpoint: `https://api.example.com/mcp/mcp`

## Security Configuration

### 1. CORS Headers

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Configure CORS
app.use(
  '/mcp/*',
  cors({
    origin: [
      'https://claude.ai',
      'https://playground.your-domain.com',
    ],
    allowHeaders: ['Content-Type', 'Mcp-Session-Id', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    credentials: true,
  })
);
```

### 2. Rate Limiting

```typescript
// In Durable Object
export class McpSessionDO extends DurableObject {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly RATE_LIMIT = 100; // requests per minute

  async fetch(request: Request): Promise<Response> {
    // Reset window if needed
    const now = Date.now();
    if (now - this.windowStart > 60000) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Check rate limit
    if (this.requestCount++ > this.RATE_LIMIT) {
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(this.RATE_LIMIT),
          'X-RateLimit-Remaining': '0',
        },
      });
    }

    // Process request...
  }
}
```

### 3. Authentication

```typescript
import { OAuthProvider } from '@cloudflare/agents';
import { MyMcpAgent } from './agent';

export default new OAuthProvider({
  apiHandlers: {
    '/mcp': MyMcpAgent.serve('/mcp'),
  },
  oauthProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      scopes: ['read:user'],
    },
  },
  // Custom authorization logic
  authorize: async (user, request) => {
    // Only allow specific GitHub orgs
    if (!user.orgs?.includes('your-org')) {
      throw new Error('Unauthorized organization');
    }

    // Check allowed email domains
    if (!user.email?.endsWith('@example.com')) {
      throw new Error('Unauthorized email domain');
    }

    return true;
  },
});
```

### 4. API Key Authentication

```typescript
const app = new Hono<{ Bindings: Env }>();

// API key middleware
app.use('/mcp/*', async (c, next) => {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json({ error: 'API key required' }, 401);
  }

  // Validate against stored keys (use KV or DO)
  const isValid = await validateApiKey(apiKey, c.env);

  if (!isValid) {
    return c.json({ error: 'Invalid API key' }, 403);
  }

  await next();
});
```

## Monitoring and Observability

### 1. Built-in Analytics

View in Cloudflare Dashboard:
- Workers & Pages → Your Worker → Analytics
- Metrics: Requests, Errors, CPU Time, Duration

### 2. Custom Logging

```typescript
export class McpSessionDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      console.log(JSON.stringify({
        requestId,
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        sessionId: this.ctx.id.toString(),
      }));

      const response = await this.handleRequest(request);

      console.log(JSON.stringify({
        requestId,
        status: response.status,
        duration: Date.now() - startTime,
      }));

      return response;
    } catch (error) {
      console.error(JSON.stringify({
        requestId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      }));

      throw error;
    }
  }
}
```

View logs:
```bash
# Stream live logs
npx wrangler tail

# Filter by status
npx wrangler tail --status error

# Filter by method
npx wrangler tail --method POST
```

### 3. External Monitoring (Sentry, DataDog, etc.)

```typescript
import * as Sentry from '@sentry/browser';

// Initialize in worker
Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.ENVIRONMENT,
  tracesSampleRate: 1.0,
});

// Capture errors
try {
  await handleRequest(request);
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

### 4. Health Checks

```typescript
app.get('/health', async (c) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {} as Record<string, string>,
  };

  // Check Durable Objects
  try {
    const testId = c.env.MCP_SESSION.newUniqueId();
    const stub = c.env.MCP_SESSION.get(testId);
    await stub.fetch(new Request('http://internal/health'));
    checks.checks.durableObjects = 'ok';
  } catch {
    checks.checks.durableObjects = 'error';
    checks.status = 'degraded';
  }

  // Check external dependencies
  try {
    const response = await fetch('https://api.example.com/health');
    checks.checks.externalApi = response.ok ? 'ok' : 'error';
  } catch {
    checks.checks.externalApi = 'error';
    checks.status = 'degraded';
  }

  return c.json(checks, checks.status === 'healthy' ? 200 : 503);
});
```

## Performance Optimization

### 1. Durable Object Alarms (Scheduled Tasks)

```typescript
export class McpSessionDO extends DurableObject {
  async alarm() {
    // Run cleanup every hour
    await this.cleanupOldData();

    // Schedule next alarm
    await this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);
  }

  private async cleanupOldData() {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    await this.ctx.storage.sql.exec(
      'DELETE FROM history WHERE timestamp < ?',
      [cutoff]
    );
  }
}
```

### 2. Response Caching

```typescript
app.get('/mcp/tools', async (c) => {
  // Cache tool list for 1 hour
  const cached = await c.env.CACHE.get('tools');
  if (cached) {
    return c.json(JSON.parse(cached));
  }

  const tools = await fetchTools();
  await c.env.CACHE.put('tools', JSON.stringify(tools), {
    expirationTtl: 3600,
  });

  return c.json(tools);
});
```

### 3. SQLite Optimization

```typescript
// Create indexes for frequently queried columns
await this.ctx.storage.sql.exec(`
  CREATE INDEX IF NOT EXISTS idx_timestamp
  ON calculations(timestamp)
`);

// Use transactions for bulk operations
await this.ctx.storage.sql.exec('BEGIN TRANSACTION');
try {
  for (const item of items) {
    await this.ctx.storage.sql.exec(
      'INSERT INTO items (data) VALUES (?)',
      [item]
    );
  }
  await this.ctx.storage.sql.exec('COMMIT');
} catch (error) {
  await this.ctx.storage.sql.exec('ROLLBACK');
  throw error;
}
```

## Troubleshooting

### Common Issues

#### 1. "Durable Object not found"
```bash
# Check migrations
npx wrangler deployments list

# Re-run migrations
npx wrangler deployments create
```

#### 2. "Module not found"
```bash
# Check package.json type
"type": "module"

# Update wrangler.toml compatibility
compatibility_date = "2024-01-01"
```

#### 3. "Session ID invalid"
```typescript
// Validate session ID format
if (!/^[a-zA-Z0-9]{64}$/.test(sessionId)) {
  return c.json({ error: 'Invalid session ID' }, 400);
}
```

### Debug Mode

```bash
# Run with inspector
npx wrangler dev --inspector

# Enable verbose logging
npx wrangler dev --verbose

# Test with specific port
npx wrangler dev --port 8788
```

## Cost Optimization

### Cloudflare Workers Pricing (as of 2024)

**Free Tier:**
- 100,000 requests/day
- 10ms CPU time per request
- Sufficient for development and small projects

**Paid Plan ($5/month):**
- 10 million requests/month included
- $0.50 per additional million
- 50ms CPU time per request
- Durable Objects: $0.15 per million reads, $1.00 per million writes

### Cost Optimization Tips

1. **Use WebSocket Hibernation**: Reduces compute time
2. **Cache frequently accessed data**: Reduce DO reads
3. **Batch SQL operations**: Reduce write operations
4. **Set appropriate alarm intervals**: Avoid excessive scheduled runs
5. **Use conditional writes**: Only persist when state changes

```typescript
// Only persist if state changed
if (JSON.stringify(this.state) !== this.lastPersistedState) {
  await this.ctx.storage.put('state', this.state);
  this.lastPersistedState = JSON.stringify(this.state);
}
```

## Rollback Strategy

### Version Tags

```bash
# Deploy with version tag
npx wrangler deploy --tag v1.2.3

# View deployments
npx wrangler deployments list

# Rollback to specific version
npx wrangler rollback --message "Rollback to v1.2.2"
```

### Blue-Green Deployment

```toml
# wrangler.toml
[env.blue]
name = "my-mcp-server-blue"

[env.green]
name = "my-mcp-server-green"
```

Deploy to green, test, then switch traffic:
```bash
npx wrangler deploy --env green
# Test...
# Switch DNS or routes to green environment
```

## Production Checklist

- [ ] Custom domain configured
- [ ] HTTPS enforced (automatic with Cloudflare)
- [ ] CORS configured for allowed origins
- [ ] Rate limiting implemented
- [ ] Authentication/authorization configured
- [ ] API keys or OAuth set up
- [ ] Error logging configured
- [ ] Health check endpoint implemented
- [ ] Monitoring dashboards set up
- [ ] Alerting configured (Sentry, PagerDuty, etc.)
- [ ] Backup strategy for critical data
- [ ] CI/CD pipeline configured
- [ ] Rollback plan documented
- [ ] Load testing performed
- [ ] Security audit completed
- [ ] Documentation updated

## Next Steps

After deployment:
1. Monitor logs and metrics for the first 24 hours
2. Set up alerts for error rates and latency
3. Test all tools from production client
4. Document the deployment process for your team
5. Plan regular maintenance windows for updates

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [MCP Specification](https://modelcontextprotocol.io/specification/)
