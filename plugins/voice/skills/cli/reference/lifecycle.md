# Conversation Lifecycle

All commands are subcommands of `voice conversation`.

```typescript
// ConversationSnapshot — returned by start, end, and reset
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

## Commands

### Start

```bash
voice conversation start [--port N]
```

```typescript
{ conversation: ConversationSnapshot; createdAt: string }
```

### Pause

```bash
voice conversation pause [--port N]
```

```typescript
{ conversationId: string; createdAt: string }
```

### Resume

```bash
voice conversation resume [--port N]
```

```typescript
{ conversationId: string; createdAt: string }
```

### End

```bash
voice conversation end [--port N]
```

```typescript
{ conversation: ConversationSnapshot; createdAt: string }
```

### Reset

Ends the current conversation and immediately starts a new one.

```bash
voice conversation reset [--port N]
```

```typescript
{ previousConversation: ConversationSnapshot; currentConversation: ConversationSnapshot; createdAt: string }
```

## Events

### `conversation.started`

```typescript
{ conversation: ConversationSnapshot; createdAt: string }
```

### `conversation.paused`

```typescript
{ conversationId: string; createdAt: string }
```

### `conversation.resumed`

```typescript
{ conversationId: string; createdAt: string }
```

### `conversation.ended`

```typescript
{ conversation: ConversationSnapshot; createdAt: string }
```

### `conversation.reset`

```typescript
{ previousConversation: ConversationSnapshot; currentConversation: ConversationSnapshot; createdAt: string }
```

### `conversation.error`

```typescript
{ conversationId?: string; error: RealtimeVoiceServerError; createdAt: string }
```
