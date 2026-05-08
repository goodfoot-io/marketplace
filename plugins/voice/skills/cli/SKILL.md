---
name: cli
description: Use to launch a voice agent and have a conversation with the user
---

```!

echo "<instructions>" | voice start

```


## Commands

### Inject

Text is piped via stdin.

```bash
echo "<text>" | voice inject user [--source textInput|system] [--port N]
echo "<text>" | voice inject assistant [--source assistantText|system] [--port N]
echo "<text>" | voice inject system [--trigger-response] [--port N]
```

```typescript
// all three return a TranscriptItem
{
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  source: "microphone" | "textInput" | "firstMessage" | "assistantAudio" | "assistantText" | "system";
  text: string;
  createdAt: string;
}
```

### Answer

Answer a pending `question` event. Text is piped via stdin.

```bash
echo "<answer>" | voice answer <questionId> [--port N]
```

```typescript
{ questionId: number }
```

### Watch

```bash
voice watch [event-type...] [--port N]
```

Outputs JSONL. Each line is `{ seq: number; event: string; timestamp: string; data: object }`.

If unread matching events exist, outputs them all and exits. Otherwise blocks until the next matching event arrives, outputs it, and exits. Multiple event types are OR-combined.

```bash
voice watch
voice watch conversation.started
voice watch tool.call.started tool.call.completed tool.call.failed
voice watch question conversation.ended
```

## Transcript events

### `transcript.item`

Emitted when a transcript item is finalised.

```typescript
{
  item: {
    id: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    source: "microphone" | "textInput" | "firstMessage" | "assistantAudio" | "assistantText" | "system";
    text: string;
  };
  createdAt: string;
}
```

### `transcript.delta`

Emitted continuously while a transcript item is streaming.

```typescript
{
  conversationId: string;
  itemId: string;
  role: "user" | "assistant";
  source: "microphone" | "assistantAudio" | "assistantText" | "textInput";
  delta: string;
  fullTextSoFar: string;
  createdAt: string;
}
```

## Tool call events

### `tool.call.started`

```typescript
{
  conversationId: string;
  toolCallId: string;
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  startedAt: string;
}
```

### `tool.call.completed`

```typescript
{
  conversationId: string;
  toolCallId: string;
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  startedAt: string;
  completedAt: string;
}
```

### `tool.call.failed`

```typescript
{
  phase: "validation" | "execution" | "serialization";
  conversationId: string;
  toolCallId: string;
  callId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  error: RealtimeVoiceServerError;
  startedAt?: string;
  failedAt: string;
}
```

### `tool.call.interrupted`

```typescript
{
  conversationId: string;
  toolCallId: string;
  callId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  reason: string;
  interruptedAt: string;
}
```

## Question events

### `question`

Emitted when the built-in `ask` tool is invoked by the model.

```typescript
{ questionId: number; question: string; createdAt: string }
```
