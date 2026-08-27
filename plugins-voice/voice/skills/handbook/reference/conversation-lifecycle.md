Use when managing conversation state — pausing, resuming, resetting, or understanding how a conversation begins and ends.

## State

Conversations move through: `starting` → `active` ⇄ `paused` → `ending` → `ended`, with `resetting` (during an atomic reset) and `error` as off-path states. `reset` ends and immediately restarts atomically.

**Start and end are automatic** — the conversation begins when the user opens the page (and the mic is ready) and ends when they close it. The `conversation` tool only adjusts a running conversation: `pause | resume | reset | status`.

Check current state:

```
conversation({ action: "status" })
```

Relevant field: `conversation` — `"none"` | `"starting"` | `"active"` | `"paused"` | `"ending"` | `"resetting"` | `"error"`.

## Subroutines

### §AUTOSTART
**When:** `conversation` is `"none"` and the user expects to be talking.
The conversation starts on its own once the browser is connected and audio is ready. If it stays `"none"`, the browser isn't connected or the mic isn't ready — apply [browser-audio.md](browser-audio.md). On start, any `context`/`topics` you set beforehand are applied, and the avatar opens **only if** context or topics is set; otherwise it waits for the user to speak first.

### §PAUSE
**When:** the user wants to temporarily stop without ending — e.g. stepping away.

```
conversation({ action: "pause" })
```

### §RESUME
**When:** the user returns after a pause.

```
conversation({ action: "resume" })
```

### §END
**When:** the user is done with the current conversation.
There is no end action — the conversation ends when the user **closes the page**, which archives the transcript. Clear the stage first if one is up (it must not outlive the conversation it illustrated — see [SKILL.md §STAGE](../SKILL.md)):

```
html({})
```

Then tell the user they can close the page. See [shutdown.md](shutdown.md) for winding a session down.

### §RESET
**When:** proactively throughout a sustained conversation — on a topic change, on noticeable avatar drift or repetition, and when the transcript has grown long enough that the avatar drags. Recovering from a mid-conversation error is one case among these, not the primary one. Rationale and the canonical reset + re-seed pattern: [SKILL.md §RESET](../SKILL.md) — the essentials are that a bare reset drops continuity, so always re-seed, and the stage must be cleared as part of the reset unless the visual still applies.

```
html({})
conversation({ action: "reset" })
set({ context: "<tight summary of what carries forward>", topics: "<next direction>" })
```

To preserve the exact running session instead of resetting, see §SUMMARY_INJECT in [context-management.md](context-management.md) for when to prefer each.

### §RESTART
**When:** the page is reloaded, or the user opens it again after closing.
A reload is a fresh conversation that auto-starts. Any `context`/`topics`/`instructions` from the previous session were **cleared** when it ended (you'll have seen an `agent.deactivate` event), so the avatar starts from the default persona and stays silent until you re-seed it with `set` on the new `agent.activate`.

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
{ conversationId?: string; error: VoiceAgentServerError; createdAt: string }
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
