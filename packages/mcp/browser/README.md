# @goodfoot/browser-mcp-server

MCP server for browser automation using Chrome DevTools Protocol. This package provides a sophisticated browser automation tool with session management, retry logic, and comprehensive error handling.

## Features

- **Browser Automation**: Full control over Chrome browser via Chrome DevTools MCP server
- **Session Management**: Persistent conversation sessions with history tracking
- **Progress Notifications**: Real-time updates during tool execution
- **Error Recovery**: Automatic retry logic for transient failures
- **Chrome Process Management**: Detection and cleanup of hung Chrome processes
- **Comprehensive Logging**: Detailed execution logs for debugging

## Architecture

This server acts as a wrapper around the Chrome DevTools MCP server, providing:

1. **Session Continuity**: Maintains conversation context across multiple automation requests
2. **Claude Code SDK Integration**: Uses the query() function for browser automation
3. **Heartbeat Monitoring**: Detects and recovers from hung Chrome processes
4. **Chrome DevTools System Instructions**: Optimized prompts for effective browser automation

## Installation

```bash
yarn add @goodfoot/browser-mcp-server
```

## Usage

### Starting the Server

```bash
node ./build/dist/src/browser.js --browserUrl http://localhost:9222
```

### Configuration in MCP Client

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": [
        "/path/to/@goodfoot/browser-mcp-server/build/dist/src/browser.js",
        "--browserUrl",
        "http://localhost:9222"
      ]
    }
  }
}
```

### Command-Line Arguments

- `--browserUrl` / `-b`: Chrome DevTools Protocol URL (required)
  - Example: `http://localhost:9222`
  - This should point to a running Chrome instance with remote debugging enabled

### Starting Chrome with Remote Debugging

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### Chrome Proxy (Optional)

The package includes a Chrome proxy server (`chrome-proxy`) that automatically launches and manages Chrome instances. This is particularly useful in containerized environments or when you want automatic Chrome lifecycle management.

**Starting the proxy:**

```bash
npx chrome-proxy
# Or with the built binary
node ./build/dist/src/chrome-proxy.js
```

**Configuration:**

- `LISTEN_PORT`: Proxy server port (default: `9222`)
- `CHROME_DEBUG_PORT`: Chrome debugging port (default: `9223`)
- `CHROME_USER_DATA_DIR`: Chrome user data directory (default: `/tmp/chrome-rdp-{port}`)
- `CHROME_PROXY_IDLE_TIMEOUT_MS`: Idle timeout in milliseconds (default: `300000` = 5 minutes)

**Idle Timeout:**

The proxy automatically shuts down when no activity is detected for the configured timeout period. This prevents resource leaks from stale browser sessions.

```bash
# Set idle timeout to 2 minutes
CHROME_PROXY_IDLE_TIMEOUT_MS=120000 npx chrome-proxy

# Set idle timeout to 10 minutes
CHROME_PROXY_IDLE_TIMEOUT_MS=600000 npx chrome-proxy
```

**How it works:**

1. Proxy listens on `LISTEN_PORT` and forwards connections to Chrome on `CHROME_DEBUG_PORT`
2. Tracks activity on all socket connections (both client → Chrome and Chrome → client)
3. Checks for idle timeout every 30 seconds
4. When timeout is reached with no activity:
   - Closes all active connections
   - Kills the Chrome process
   - Shuts down the proxy server

This feature helps address browser session freezing issues by ensuring stale connections are cleaned up automatically.

## Available Tools

### `prompt`

Execute browser automation tasks with natural language instructions.

**Arguments:**

- `prompt` (string, required): Instructions for the browser automation task
- `sessionId` (string, optional): Session ID for conversation continuity

**Example:**

```typescript
await client.callTool({
  name: 'prompt',
  arguments: {
    prompt: 'Navigate to example.com and extract the page title',
    sessionId: 'my-session-123'
  }
});
```

## Session Management

The server maintains conversation sessions with:

- **Automatic Session Creation**: Generates UUID if no sessionId provided
- **History Tracking**: Maintains last 10 exchanges (20 messages)
- **Configurable TTL**: Session time-to-live (default: 5 minutes, configurable via `BROWSER_SESSION_TTL_MS`)
- **Automatic Cleanup**: Removes sessions after TTL expires or inactive period
- **LRU Eviction**: Keeps maximum 10 sessions at a time
- **SDK Session Resumption**: Supports resuming Claude Code SDK sessions

### Session TTL Configuration

Control how long inactive sessions are retained:

```bash
# Set session TTL to 10 minutes (600000 ms)
BROWSER_SESSION_TTL_MS=600000 node ./build/dist/src/browser.js --browserUrl http://localhost:9222

# Set session TTL to 1 hour (3600000 ms)
BROWSER_SESSION_TTL_MS=3600000 node ./build/dist/src/browser.js --browserUrl http://localhost:9222
```

**Environment Variable:**

- `BROWSER_SESSION_TTL_MS`: Session time-to-live in milliseconds
  - Default: `300000` (5 minutes)
  - Must be a positive integer
  - Invalid values fall back to default

## Chrome DevTools System Instructions

The server includes comprehensive system instructions optimized for Chrome DevTools MCP, covering:

- **Core Patterns**: Snapshot → action → refresh workflow
- **Critical Gotchas**: Dialog handling, scrolling, screenshots, navigation
- **Data Extraction**: Best practices for extracting data from pages
- **Error Recovery**: Handling stale UIDs, navigation failures, timeouts
- **Common Workflows**: Form filling, data extraction, hover menus, infinite scroll

## Error Handling

The server implements robust error handling:

1. **Hung Process Detection**: 60-second heartbeat timeout
2. **Automatic Process Cleanup**: Kills hung Chrome processes
3. **Retry Logic**: Single retry for transient failures
4. **Session Recovery**: Falls back to new session on resume errors
5. **No Page Selected Recovery**: Creates initial page if Chrome has zero pages

## Logging

All browser automation executions are logged to:

```
/workspace/reports/.browser-automation-logs/
```

Log format includes:

- Timestamp and session ID in filename
- Original prompt
- Full transcript of tool calls and responses
- Errors and recovery attempts

## Progress Notifications

When a progress token is provided in the `_meta` parameter, the server sends real-time progress notifications for each tool call:

```typescript
await client.callTool({
  name: 'prompt',
  arguments: { prompt: 'Navigate to example.com' },
  _meta: { progressToken: 'my-progress-token' }
});
```

Progress messages include:

- Navigating to pages
- Clicking elements
- Filling forms
- Taking screenshots
- Executing JavaScript
- And more...

## Timeout Configuration

- **Request Timeout**: 10 minutes per automation request
- **Heartbeat Timeout**: 60 seconds of no progress triggers hung process detection
- **Process Cleanup**: 1 second graceful shutdown before force kill
- **Session TTL**: 5 minutes (configurable via `BROWSER_SESSION_TTL_MS`)
- **Proxy Idle Timeout**: 5 minutes (configurable via `CHROME_PROXY_IDLE_TIMEOUT_MS`)

## Troubleshooting

### Browser Sessions Freezing

If you're experiencing browser sessions that freeze or become unresponsive:

1. **Use the Chrome Proxy with Idle Timeout**: The chrome-proxy automatically detects idle connections and cleans them up

   ```bash
   CHROME_PROXY_IDLE_TIMEOUT_MS=300000 npx chrome-proxy
   ```

2. **Adjust Session TTL**: Reduce the session TTL to clean up inactive sessions more frequently

   ```bash
   BROWSER_SESSION_TTL_MS=600000 node ./build/dist/src/browser.js
   ```

3. **Monitor Logs**: Check the browser automation logs in `/workspace/reports/.browser-automation-logs/` for errors

4. **Check Chrome Process**: Verify Chrome is running and accessible on the debugging port
   ```bash
   curl http://localhost:9222/json/version
   ```

### Sessions Expiring Too Quickly

If sessions are expiring before you finish your work:

```bash
# Increase session TTL to 1 hour
BROWSER_SESSION_TTL_MS=3600000 node ./build/dist/src/browser.js

# Increase proxy idle timeout to 15 minutes
CHROME_PROXY_IDLE_TIMEOUT_MS=900000 npx chrome-proxy
```

### No Active Sessions Warning

If you see "All sessions expired - no active browser sessions" in logs, this means all sessions have reached their TTL. This is normal behavior when sessions are inactive. New requests will create new sessions automatically.

## Development

### Building

```bash
yarn build
```

### Testing

```bash
yarn test
```

### Linting

```bash
yarn lint
```

## Type Safety

The package includes comprehensive TypeScript types:

- `SessionState`: Session management state
- `ExecuteToolArguments`: Tool invocation arguments
- `MessageContent`: SDK message content types
- Runtime validation for all arguments

## Browser Compatibility

Tested with:

- Chrome 120+
- Chromium-based browsers with Chrome DevTools Protocol support

## Dependencies

- `@anthropic-ai/claude-code`: Claude Code SDK for browser automation
- `@modelcontextprotocol/sdk`: MCP protocol implementation

## License

MIT

## Support

For issues and questions, please refer to the main repository documentation.
