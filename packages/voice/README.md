# @goodfoot/conversation-sdk

Local Realtime voice conversation server and browser control surface.

```ts
import { z } from "zod";
import { createRealtimeVoiceServer } from "@goodfoot/conversation-sdk";

const controller = createRealtimeVoiceServer({
  port: 3000,
  apiKey: process.env.OPENAI_API_KEY!,
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
