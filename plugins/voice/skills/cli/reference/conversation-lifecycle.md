Use when managing conversation state — starting, pausing, resuming, ending, resetting, or restarting.

## State

Conversations move through: `starting` → `active` ⇄ `paused` → `ending` → `ended`. `reset` ends and immediately restarts atomically.

Check current state:

```xml
<invoke name="Bash">
<parameter name="command">voice status</parameter>
</invoke>
```

Relevant field: `conversation` — `"none"` | `"starting"` | `"active"` | `"paused"` | `"ending"` | `"resetting"` | `"error"`.

## Subroutines

### §START
**When:** `conversation` is `"none"` or `"ended"` and the user is ready to talk.
Requires browser connected and audio ready — apply @reference/browser-audio.md first if not.

```xml
<invoke name="Bash">
<parameter name="command">voice conversation start</parameter>
</invoke>
```

### §PAUSE
**When:** user wants to temporarily stop without ending — e.g. stepping away.

```xml
<invoke name="Bash">
<parameter name="command">voice conversation pause</parameter>
</invoke>
```

### §RESUME
**When:** user returns after a pause.

```xml
<invoke name="Bash">
<parameter name="command">voice conversation resume</parameter>
</invoke>
```

### §END
**When:** the current conversation is done; user wants to stop but keep the server running.
The transcript is archived in `previousConversations`.

```xml
<invoke name="Bash">
<parameter name="command">voice conversation end</parameter>
</invoke>
```

### §RESTART
**When:** `conversation.ended` event arrives, or user asks for a new conversation.
Decide whether to carry forward context. If yes, apply §CONTEXT_REFRESH from @reference/context-management.md before starting. Then:

```xml
<invoke name="Bash">
<parameter name="command">voice conversation start</parameter>
</invoke>
```

### §RESET
**When:** conversation must restart immediately — e.g. after a mid-conversation error.
Ends and restarts atomically with no gap.

```xml
<invoke name="Bash">
<parameter name="command">voice conversation reset</parameter>
</invoke>
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
