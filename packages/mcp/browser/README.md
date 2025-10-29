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
      "args": ["/path/to/@goodfoot/browser-mcp-server/build/dist/src/browser.js", "--browserUrl", "http://localhost:9222"]
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
- **Automatic Cleanup**: Removes sessions inactive for 30+ minutes
- **LRU Eviction**: Keeps maximum 10 sessions at a time
- **SDK Session Resumption**: Supports resuming Claude Code SDK sessions

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
