Use when the user wants to end the session completely — conversation and server.

## Subroutines

### §DETECT_DONE
**When:** the user signals they are done — via transcript ("goodbye", "that's all", "we're done", "stop") or by telling Claude directly.
Confirm before shutting down if the signal is ambiguous.

### §END_CONVERSATION
**When:** a conversation is still active at shutdown time.
End it first to archive the transcript cleanly.

```xml
<invoke name="Bash">
<parameter name="command">voice conversation end</parameter>
</invoke>
```

### §STOP_SERVER
**When:** the conversation is ended (or there is none) and shutdown is confirmed.

```xml
<invoke name="Bash">
<parameter name="command">voice stop</parameter>
</invoke>
```

Stop watching after this. The session is over.

## Events

### `conversation.ended`
```typescript
{ conversation: ConversationSnapshot; createdAt: string }
```

### `server.stopped`
```typescript
{ port: number; createdAt: string }
```

### `ConversationSnapshot`
```typescript
{
  id: string;
  status: "starting" | "active" | "paused" | "ending" | "ended" | "resetting" | "error";
  startedAt: string;
  endedAt?: string;
  transcript: TranscriptItem[];
  toolCalls: ToolCallRecord[];
  timeline: ConversationTimelineItem[];
}
```
