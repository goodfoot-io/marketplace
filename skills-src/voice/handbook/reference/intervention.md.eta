Use when the avatar needs to be redirected, corrected, or given new direction mid-conversation.

## When to intervene

Read each `transcript.item`. Intervene when:
- The avatar states something factually wrong.
- The avatar is heading somewhere the user wouldn't want.
- A topic shift would serve the conversation better.
- The user (via microphone) said something the avatar clearly misunderstood.

Don't intervene for minor imprecisions — the avatar self-corrects. Expect a short delay between your steer and the avatar speaking. Don't relay the transcript back to the user; they already heard it.

**The avatar can't see what you've built.** The voice model knows only its persona plus the `context`/`topics` you set — it has no awareness of the HTML stage or your tools. When it gets something wrong because of that (e.g. claiming it can't show a picture while a stage is up), the fix is to tell it, in words, via `set({ context })`.

## How to intervene

Steer with `set` — `set({ context })` to correct silently, `set({ topics })` to redirect what it talks about (both latest-wins). The avatar weaves them into its next turn. Use `inject({ role: "system", ... })` only as the low-level primitive when you need a one-off system message in the transcript; add `triggerResponse: true` when it must be addressed immediately rather than folded in at the next natural turn.

```
set({ context: "<the correction or fact, stated plainly>" })
```

| Situation | Move |
|---|---|
| §CORRECT — avatar stated something factually wrong | `set({ context })` with the correction. Use `inject({ role: "system", message, triggerResponse: true })` if it can't wait. |
| §REDIRECT — conversation heading somewhere unhelpful, or user wants a topic change | `set({ topics })` with the new direction, framed as a steer, not a script. |
| §CLARIFY — avatar misunderstood what the user said | `set({ context })` with what the user actually meant, so the avatar answers the real question. |
| §LEAD — a natural pause, or drift you want to break | `set({ topics })` with a thought or subject to introduce proactively. |

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
