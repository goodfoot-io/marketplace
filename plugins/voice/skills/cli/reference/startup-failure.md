Use when the server fails to start, becomes unresponsive, or the daemon crashes after starting.

## Diagnose

Check whether the server is still running:

```xml
<invoke name="Bash">
<parameter name="command">voice status</parameter>
</invoke>
```

`server.status` values: `"stopped"` | `"starting"` | `"active"` | `"stopping"` | `"error"`.

ECONNREFUSED means the daemon is not running at all.

## Subroutines

### §MISSING_API_KEY
**When:** startup fails with an API key error, or no API key is set in the environment.
Tell the user to set `XAI_API_KEY` (or `VOICE_API_KEY`) and reload the skill. The key is read automatically on start.

### §PORT_IN_USE
**When:** startup output indicates the port is already bound.
The daemon may already be running — `voice status` will respond if so. If healthy, use it. If not, identify the conflicting process and ask the user whether to kill it before retrying.

### §DAEMON_DIED
**When:** `voice status` returns ECONNREFUSED after a previously successful start.
The daemon exited unexpectedly. Common causes: API key rejected by xAI, port conflict resolved mid-run, Node version below 20.11.0. Fix the cause, then reload the skill.

### §SERVER_ERROR
**When:** `server.status` is `"error"`, or a `log` event with `level: "error"` appears.
Show the error details to the user. Apply §MISSING_API_KEY or §DAEMON_DIED as appropriate, or ask the user to check their xAI account status.

## Events

### `server.started`
```typescript
{ port: number; url: string; createdAt: string }
```

### `server.stopped`
```typescript
{ port: number; createdAt: string }
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
