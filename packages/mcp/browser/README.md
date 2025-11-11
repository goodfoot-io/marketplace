# @goodfoot/browser-mcp-server

Model Context Protocol (MCP) server providing browser automation capabilities through Chrome DevTools Protocol. This package delivers enterprise-grade browser automation with session management, retry logic, and comprehensive error handling.

## Overview

The browser MCP server acts as an intelligent wrapper around Chrome DevTools MCP server, providing sophisticated browser automation capabilities through natural language instructions. It maintains conversation context, monitors process health, and implements robust error recovery mechanisms.

## Key Features

- **Natural Language Automation**: Control Chrome browser through conversational instructions
- **Session Management**: Persistent conversation sessions with automatic history tracking
- **Progress Notifications**: Real-time updates during tool execution
- **Error Recovery**: Automatic retry logic and hung process detection
- **Process Management**: Heartbeat monitoring and automatic cleanup of unresponsive Chrome processes
- **Configurable Logging**: Optional diagnostic logging for troubleshooting
- **Execution Logs**: Detailed automation logs for debugging and audit purposes

## Installation

```bash
yarn add @goodfoot/browser-mcp-server
```

## Quick Start

### Prerequisites

Chrome must be running with remote debugging enabled:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### Starting the Server

```bash
npx -y @goodfoot/browser-mcp-server --browserUrl http://localhost:9222
```

### MCP Client Configuration

Configure in your MCP client settings:

```json
{
  "mcpServers": {
    "browser": {
      "command": "npx",
      "args": ["-y", "@goodfoot/browser-mcp-server", "--browserUrl", "http://localhost:9222"],
      "env": {
        "BROWSER_SESSION_TTL_MS": "600000",
        "BROWSER_MCP_SERVER_LOGGING": "false"
      }
    }
  }
}
```

## Command-Line Arguments

### Required Arguments

- `--browserUrl` / `-b`: Chrome DevTools Protocol URL
  - Format: `http://host:port`
  - Example: `http://localhost:9222`
  - Default: Auto-detects primary external IP and uses `http://{ip}:9222`

## Available Tools

### `prompt`

Execute browser automation tasks using natural language instructions.

**Parameters:**

| Parameter   | Type   | Required | Description                                               |
| ----------- | ------ | -------- | --------------------------------------------------------- |
| `prompt`    | string | Yes      | Natural language instructions for browser automation task |
| `sessionId` | string | No       | Session identifier for conversation continuity            |

**Example Usage:**

```typescript
// Single automation task
await client.callTool({
  name: 'prompt',
  arguments: {
    prompt: 'Navigate to example.com and extract the page title'
  }
});

// Multi-step automation with session
const response = await client.callTool({
  name: 'prompt',
  arguments: {
    prompt: 'Navigate to example.com and click the login button',
    sessionId: 'my-session-123'
  }
});

// Continue in same session
await client.callTool({
  name: 'prompt',
  arguments: {
    prompt: 'Fill in the username field with "testuser"',
    sessionId: 'my-session-123'
  }
});
```

## Configuration

### Environment Variables

#### BROWSER_SESSION_TTL_MS

Controls session retention duration.

- **Default**: `300000` (5 minutes)
- **Format**: Milliseconds (positive integer)
- **Example**: `600000` (10 minutes), `3600000` (1 hour)

```bash
BROWSER_SESSION_TTL_MS=600000 npx -y @goodfoot/browser-mcp-server --browserUrl http://localhost:9222
```

#### BROWSER_MCP_SERVER_LOGGING

Enables diagnostic logging to stderr.

- **Default**: `false` (logging disabled)
- **Values**: `"true"` or `"false"`
- **Output**: All logs written to stderr with level prefixes

```bash
BROWSER_MCP_SERVER_LOGGING=true npx -y @goodfoot/browser-mcp-server --browserUrl http://localhost:9222
```

**Log Levels:**

- `[DEBUG]` - Detailed debugging information
- `[INFO]` - General informational messages
- `[WARN]` - Warning conditions
- `[ERROR]` - Error conditions

## Session Management

The server implements sophisticated session management:

### Session Lifecycle

1. **Creation**: Automatic UUID generation if sessionId not provided
2. **Activity**: Updates on each prompt execution
3. **Expiration**: Sessions expire after TTL with no activity
4. **Cleanup**: Periodic cleanup every 5 minutes
5. **Eviction**: LRU eviction when exceeding 10 sessions

### Session Features

- **Conversation History**: Maintains last 10 exchanges (20 messages)
- **SDK Session Resumption**: Supports Claude Code SDK session continuity
- **Context Preservation**: Includes conversation context in subsequent requests
- **Automatic Cleanup**: Removes expired and least-recently-used sessions

### Session Response Format

The tool response includes session information:

```
[Automation Result]

**Session ID**: {session-id}

<invoke name="mcp__plugin_browser_browser__prompt">
<parameter name="prompt">your next instruction</parameter>
<parameter name="sessionId">{session-id}</parameter>
</invoke>

**Log**: /workspace/reports/.browser-automation-logs/{timestamp}_{session-id}.md
```

## Chrome Proxy (Optional)

The package includes a Chrome proxy server for automated Chrome lifecycle management, particularly useful in containerised environments.

### Starting the Proxy

```bash
npx -y @goodfoot/browser-mcp-server chrome-proxy
# Or using built binary
node ./build/dist/src/chrome-proxy.js
```

### Proxy Configuration

#### Environment Variables

| Variable                       | Default                  | Description                              |
| ------------------------------ | ------------------------ | ---------------------------------------- |
| `LISTEN_PORT`                  | `9222`                   | Proxy server listening port              |
| `CHROME_DEBUG_PORT`            | `9223`                   | Chrome debugging port                    |
| `CHROME_USER_DATA_DIR`         | `/tmp/chrome-rdp-{port}` | Chrome user data directory               |
| `CHROME_SOCKET_TIMEOUT_MS`     | `10000`                  | Chrome connection timeout in milliseconds|
| `CHROME_PROXY_IDLE_TIMEOUT_MS` | `300000`                 | Idle timeout in milliseconds             |
| `BROWSER_MCP_SERVER_LOGGING`   | `false`                  | Enable diagnostic logging                |

#### Idle Timeout Configuration

The proxy automatically terminates when no activity is detected:

```bash
# 2-minute timeout
CHROME_PROXY_IDLE_TIMEOUT_MS=120000 npx -y @goodfoot/browser-mcp-server chrome-proxy

# 15-minute timeout
CHROME_PROXY_IDLE_TIMEOUT_MS=900000 npx -y @goodfoot/browser-mcp-server chrome-proxy

# With logging enabled
BROWSER_MCP_SERVER_LOGGING=true CHROME_PROXY_IDLE_TIMEOUT_MS=300000 npx -y @goodfoot/browser-mcp-server chrome-proxy
```

### Proxy Operation

1. Listens on `LISTEN_PORT` for client connections
2. Launches Chrome on `CHROME_DEBUG_PORT` if not running
3. Forwards bidirectional traffic between client and Chrome
4. Tracks activity on all socket connections
5. Checks for idle timeout every 30 seconds
6. On timeout expiration:
   - Closes all active connections
   - Terminates Chrome process
   - Shuts down proxy server

This mechanism prevents resource leaks from stale browser sessions.

## Error Handling

The server implements multi-layered error handling:

### Hung Process Detection

- **Heartbeat Timeout**: 60 seconds without progress
- **Detection**: Monitors message flow from Chrome MCP
- **Recovery**: Kills hung processes and retries request

### Automatic Recovery

1. **Navigation Failures**: Single retry for transient network issues
2. **No Page Selected**: Creates initial blank page automatically
3. **Session Resume Errors**: Falls back to new session creation
4. **Stale UIDs**: Tool-level retry with fresh snapshots

### Error Types

- **Timeout Errors**: 10-minute request timeout
- **Process Hung**: Heartbeat watchdog detection
- **Connection Errors**: Chrome disconnection or unavailability
- **Tool Errors**: Chrome DevTools MCP tool failures

## Logging and Monitoring

### Execution Logs

All automation executions are logged to:

```
/workspace/reports/.browser-automation-logs/{timestamp}_{sessionId}.md
```

**Log Contents:**

- Original prompt
- Session identifier
- Complete tool call transcript
- Tool responses and errors
- Recovery attempts

### Diagnostic Logging

Enable with `BROWSER_MCP_SERVER_LOGGING=true`:

- Server startup and shutdown
- Session creation and expiration
- Chrome process management
- Heartbeat monitoring
- Error conditions and recovery

### Log Location

- **Execution Logs**: `/workspace/reports/.browser-automation-logs/`
- **Diagnostic Logs**: stderr (when enabled)

## Progress Notifications

Real-time progress updates during automation execution.

### Enabling Progress Notifications

Include `progressToken` in the `_meta` parameter:

```typescript
await client.callTool({
  name: 'prompt',
  arguments: {
    prompt: 'Navigate to example.com and take a screenshot'
  },
  _meta: {
    progressToken: 'my-progress-token'
  }
});
```

### Progress Message Types

- Navigating to pages
- Clicking elements
- Filling form fields
- Taking screenshots
- Executing JavaScript
- Hovering elements
- Handling dialogs
- And more...

## Timeout Configuration

| Component       | Timeout    | Description                                     |
| --------------- | ---------- | ----------------------------------------------- |
| Request         | 10 minutes | Maximum duration for single automation request  |
| Heartbeat       | 60 seconds | No progress triggers hung process detection     |
| Process Cleanup | 1 second   | Graceful shutdown before force kill             |
| Session TTL     | 5 minutes  | Configurable via `BROWSER_SESSION_TTL_MS`       |
| Proxy Idle      | 5 minutes  | Configurable via `CHROME_PROXY_IDLE_TIMEOUT_MS` |

## Troubleshooting

### Browser Sessions Becoming Unresponsive

**Solution 1: Use Chrome Proxy with Idle Timeout**

```bash
CHROME_PROXY_IDLE_TIMEOUT_MS=300000 npx -y @goodfoot/browser-mcp-server chrome-proxy
```

**Solution 2: Reduce Session TTL**

```bash
BROWSER_SESSION_TTL_MS=300000 npx -y @goodfoot/browser-mcp-server --browserUrl http://localhost:9222
```

**Solution 3: Enable Diagnostic Logging**

```bash
BROWSER_MCP_SERVER_LOGGING=true npx -y @goodfoot/browser-mcp-server --browserUrl http://localhost:9222
```

**Solution 4: Check Chrome Availability**

```bash
curl http://localhost:9222/json/version
```

### Sessions Expiring Prematurely

Increase session and proxy timeouts:

```bash
# 1-hour session TTL
BROWSER_SESSION_TTL_MS=3600000 npx -y @goodfoot/browser-mcp-server --browserUrl http://localhost:9222

# 15-minute proxy timeout
CHROME_PROXY_IDLE_TIMEOUT_MS=900000 npx -y @goodfoot/browser-mcp-server chrome-proxy
```

### "All Sessions Expired" Message

This is normal behaviour when all sessions reach their TTL. New requests automatically create fresh sessions.

### Verifying Server Operation

Check logs at `/workspace/reports/.browser-automation-logs/` for:

- Tool execution traces
- Error messages
- Recovery attempts
- Session activity

## Development

### Building the Package

```bash
yarn build
```

### Running Tests

```bash
yarn test
```

### Linting

```bash
yarn lint
```

## Technical Architecture

### Component Overview

1. **Browser Server**: Main MCP server exposing the `prompt` tool
2. **Chrome Proxy**: Optional proxy for Chrome lifecycle management
3. **Session Manager**: Handles session state and cleanup
4. **Heartbeat Monitor**: Detects and recovers from hung processes
5. **Logger**: Optional diagnostic logging system

### Dependencies

- `@anthropic-ai/claude-agent-sdk`: Claude Code SDK for browser automation
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `zod`: Runtime type validation

### Type Safety

Comprehensive TypeScript types:

- `SessionState`: Session management state
- `ExecuteToolArguments`: Tool invocation arguments with validation
- `MessageContent`: SDK message content type guards
- Runtime validation for all tool arguments

## Browser Compatibility

Tested with:

- Google Chrome 120+
- Chromium-based browsers supporting Chrome DevTools Protocol

## Licence

MIT

## Support

For issues, feature requests, and questions, please refer to the main repository documentation.
