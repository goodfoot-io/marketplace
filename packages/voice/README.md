# @goodfoot/voice

Local Voice Agent server (xAI) and browser control surface.

```ts
import { z } from "zod";
import { createVoiceAgentServer } from "@goodfoot/voice";

const controller = createVoiceAgentServer({
  port: 3000,
  apiKey: process.env.XAI_API_KEY!,
  realtime: {
    instructions: "You are a concise voice assistant.",
  },
  tools: {
    remember: {
      description: "Remember a piece of information.",
      parameters: z.object({ text: z.string() }),
      execute: async ({ text }) => ({ remembered: text }),
    },
  },
});

await controller.start();
```

## Known limitations

- **No user-side transcription.** xAI does not currently expose an equivalent
  of OpenAI's `conversation.item.input_audio_transcription.*` events. As a
  result, `transcript.item` events with `role: "user"` will not fire during
  live voice sessions, and `voice watch --events transcript.item` returns
  only assistant items. Injected user messages still produce transcript
  items.
