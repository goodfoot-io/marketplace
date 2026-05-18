Use when the conversation is getting long, the avatar seems confused about earlier content, or context needs to be refreshed across conversations.

## Diagnose

Get the full current transcript:

```xml
<invoke name="Bash">
<parameter name="command">voice status</parameter>
</invoke>
```

The transcript is under `currentConversation.transcript`. Each item has `role`, `source`, and `text`. The `source` field distinguishes microphone speech (`"microphone"`) from injected text (`"system"`, `"textInput"`).

## Subroutines

When the transcript is long, there are two moves. **Reset-and-re-seed is the preferred default** for routine long-conversation hygiene and on topic changes — see §RESET in [SKILL.md](../SKILL.md) and @reference/conversation-lifecycle.md.

§SUMMARY_INJECT below is the move when you must preserve the exact running session — an unbroken transcript matters (e.g. the avatar is mid-thought, or recent turns must stay verbatim in context) and only earlier content needs reinforcing. Prefer it only when the live session itself must continue uninterrupted.

### §SUMMARY_INJECT
**When:** the transcript is long or the avatar shows signs of losing context — repetition, confusion about earlier content, inconsistent recall — **and** the running session must be preserved rather than reset (otherwise prefer reset-and-re-seed, above).
Distil the key facts and decisions so far. Inject as a system message; the avatar will use it as working context going forward.

```xml
<invoke name="Bash">
<parameter name="command">voice inject system <<'EOF'
[SUMMARY OF KEY POINTS SO FAR]
EOF</parameter>
</invoke>
```

### §CONTEXT_REFRESH
**When:** starting a new conversation that should carry forward context from a previous one.
Pull the previous transcript via `voice status` (`previousConversations`). Summarise and inject before the user speaks.

```xml
<invoke name="Bash">
<parameter name="command">voice inject system <<'EOF'
[RELEVANT CONTEXT FROM PREVIOUS CONVERSATION]
EOF</parameter>
</invoke>
```

### §FACT_INJECT
**When:** a specific fact, preference, or decision was established earlier and the avatar seems to have lost track of it.
Inject just that fact — keep it short so it's easy for the model to absorb.

```xml
<invoke name="Bash">
<parameter name="command">voice inject system <<'EOF'
[SPECIFIC FACT TO REINFORCE]
EOF</parameter>
</invoke>
```

## Events

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
