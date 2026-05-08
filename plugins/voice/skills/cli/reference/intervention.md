Use when the avatar needs to be redirected, corrected, or given new direction mid-conversation.

## When to intervene

Read each `transcript.item`. Intervene when:
- The avatar states something factually wrong
- The avatar is heading somewhere the user wouldn't want
- A topic shift would serve the conversation better
- The user (via microphone) said something the avatar clearly misunderstood

Don't intervene for minor imprecisions — the avatar will self-correct. Expect a short delay between injection and the avatar speaking.

## Subroutines

### §CORRECT
**When:** the avatar stated something factually wrong.
Inject a correction. Keep it short and unambiguous. Add `--trigger-response` if it should be addressed immediately rather than woven in naturally.

```xml
<invoke name="Bash">
<parameter name="command">voice inject system <<'EOF'
[CORRECTION]
EOF</parameter>
</invoke>
```

### §REDIRECT
**When:** the conversation is heading somewhere unhelpful or the user wants a topic change.
Frame as a steer, not a command.

```xml
<invoke name="Bash">
<parameter name="command">voice inject system <<'EOF'
[NEW DIRECTION OR TOPIC]
EOF</parameter>
</invoke>
```

### §CLARIFY
**When:** the avatar misunderstood what the user said.
Inject the correct interpretation so the avatar can respond to what was actually meant.

```xml
<invoke name="Bash">
<parameter name="command">voice inject system <<'EOF'
[WHAT THE USER ACTUALLY MEANT]
EOF</parameter>
</invoke>
```

### §LEAD
**When:** the skill just loaded, the conversation has a natural pause, or the conversation has drifted and you want to introduce something.
Inject a thought or topic proactively. The avatar will weave it in naturally.

```xml
<invoke name="Bash">
<parameter name="command">voice inject system <<'EOF'
[THOUGHT OR TOPIC TO INTRODUCE]
EOF</parameter>
</invoke>
```

## Events

### `transcript.item`
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
