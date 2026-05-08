# Server Management

## On load

Check whether the server is running with `voice status`. If not running, ask the user for instructions (the assistant system prompt), then start it.

## Binary and port

Binary: `rvs`. Default port: `3000`. All commands accept `--port N`.

## Key behaviors

- The daemon stops automatically when all processes that called `voice start` have exited.
- `voice open` triggers conversation start — the browser connects and microphone readiness start the conversation automatically.
- All output is JSON.

## Commands

### Start

```bash
echo "<instructions>" | voice start [--port N]
```

Instructions are piped via stdin, not a flag.

```typescript
{ port: number; url: string; createdAt: string }
```

### Status

```bash
voice status [--port N]
```

```typescript
{
  server: "stopped" | "starting" | "active" | "stopping" | "error";
  browserClient: "none" | "connected";
  conversation: "none" | "starting" | "active" | "paused" | "ending" | "resetting" | "error";
}
```

### Stop

```bash
voice stop [--port N]
```

```typescript
{ port: number; createdAt: string }
```

### Open

```bash
voice open [--port N]
```

```typescript
{ url: string }
```

## Events

### `server.started`

```typescript
{ port: number; url: string; createdAt: string }
```

### `server.stopped`

```typescript
{ port: number; createdAt: string }
```

### `browser.client.connected`

```typescript
{ clientId: string; connectedAt: string }
```

### `browser.client.disconnected`

```typescript
{ clientId: string; disconnectedAt: string }
```

### `browser.client.rejected`

```typescript
{ attemptedClientId: string; activeClientId: string; error: RealtimeVoiceServerError; createdAt: string }
```

### `browser.audio.deviceChange`

```typescript
{
  clientId: string;
  audio: {
    permission: "unknown" | "prompt" | "granted" | "denied";
    devices: { deviceId: string; label: string }[];
    selectedDeviceId?: string;
    ready: boolean;
  };
  createdAt: string;
}
```

### `browser.audio.error`

```typescript
{ clientId?: string; error: RealtimeVoiceServerError; createdAt: string }
```

### `realtime.updated`

```typescript
{ instructionsUpdated: boolean; toolsUpdated: string[]; createdAt: string }
```

### `log`

```typescript
{
  level: "debug" | "info" | "warn" | "error";
  code: string;
  message: string;
  details?: unknown;
  createdAt: string;
}
```
