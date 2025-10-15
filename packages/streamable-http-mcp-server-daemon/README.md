# Streamable HTTP MCP Server Daemon

A daemon manager for HTTP-based MCP (Model Context Protocol) servers that enables process coordination and resource sharing.

## Features

- **Process Coordination**: Multiple client processes can share a single HTTP server
- **PID File Management**: Tracks the main server process using filesystem-based coordination
- **Client Registry**: Maintains a registry of all connected client processes
- **Automatic Cleanup**: Gracefully shuts down the server when all clients disconnect
- **Port Reuse**: Detects existing servers and connects to them instead of failing
- **Signal Handling**: Properly handles SIGINT, SIGTERM, and SIGHUP signals

## Installation

```bash
yarn add @goodfoot/streamable-http-mcp-server-daemon
```

## Usage

```typescript
import express from 'express';
import { StreamableHttpDaemon } from '@goodfoot/streamable-http-mcp-server-daemon';

const app = express();
// Configure your Express app here...

const daemon = new StreamableHttpDaemon({
  port: 47127,
  host: '127.0.0.1',
  debug: true
});

const result = await daemon.start(app);

if (result.isMainProcess) {
  console.log(`Started HTTP server on port ${result.info.port}`);
  console.log(`PID: ${result.info.pid}`);
  console.log(`Client count: ${result.info.clientCount}`);
} else {
  console.log(`Connected to existing server`);
  console.log(`Main PID: ${result.info.pid}`);
  console.log(`Client count: ${result.info.clientCount}`);
}
```

## Configuration

```typescript
interface DaemonServerConfig {
  port: number;          // Port to listen on
  host?: string;         // Host to bind to (default: '127.0.0.1')
  daemonDir?: string;    // Directory for daemon files (default: '/tmp/mcp-daemon')
  debug?: boolean;       // Enable debug logging (default: false)
}
```

## How It Works

1. **Client Registration**: When a client starts, it registers itself in a shared client registry file
2. **Port Detection**: The daemon checks if the port is already in use
3. **Server Decision**:
   - If port is free: Start a new HTTP server and become the main process
   - If port is in use: Connect to the existing server as a client
4. **Cleanup**: When clients exit, they unregister themselves. The last client shuts down the server

## Example

See [example-http-server.ts](./src/example-http-server.ts) for a complete example of an MCP server using the daemon.

## Testing

```bash
yarn test
```

## License

MIT
