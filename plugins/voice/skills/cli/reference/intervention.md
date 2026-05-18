Use when the avatar needs to be redirected, corrected, or given new direction mid-conversation.

## When to intervene

Read each `transcript.item`. Intervene when:
- The avatar states something factually wrong
- The avatar is heading somewhere the user wouldn't want
- A topic shift would serve the conversation better
- The user (via microphone) said something the avatar clearly misunderstood

Don't intervene for minor imprecisions — the avatar will self-correct. Expect a short delay between injection and the avatar speaking.

## How to intervene

Every intervention is a system injection. Keep the payload short and unambiguous; the avatar weaves it in. Add `--trigger-response` when it must be addressed immediately rather than folded in at the next natural turn.

```xml
<invoke name="Bash">
<parameter name="command">voice inject system <<'EOF'
[PAYLOAD — see table for what goes here and how to frame it]
EOF</parameter>
</invoke>
```

| Situation | Payload framing |
|---|---|
| §CORRECT — avatar stated something factually wrong | The correction, stated plainly. `--trigger-response` if it can't wait. |
| §REDIRECT — conversation heading somewhere unhelpful, or user wants a topic change | The new direction, framed as a steer, not a command. |
| §CLARIFY — avatar misunderstood what the user said | What the user actually meant, so the avatar answers the real question. |
| §LEAD — skill just loaded, a natural pause, or drift you want to break | A thought or topic to introduce proactively. |

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
