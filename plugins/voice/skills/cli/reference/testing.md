# Testing

## Commands

### Cancel tool call

```bash
voice cancel-tool <callId> [--port N]
```

`callId` is the `callId` field from a `tool.call.started` event.

```typescript
{ callId: string }
```

