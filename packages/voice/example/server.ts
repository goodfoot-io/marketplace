import { z } from "zod";
import { createVoiceAgentServer, type VoiceAgentServerEvents, type VoiceAgentToolMap } from "../src/index.js";

type DemoEvents = VoiceAgentServerEvents<VoiceAgentToolMap>;

const eventNames = [
  "server.started",
  "server.stopped",
  "browser.client.connected",
  "browser.client.disconnected",
  "browser.client.rejected",
  "browser.audio.error",
  "browser.audio.deviceChange",
  "conversation.started",
  "conversation.paused",
  "conversation.resumed",
  "conversation.ended",
  "conversation.reset",
  "conversation.error",
  "voice.session.updated",
  "transcript.item",
  "tool.call.started",
  "tool.call.completed",
  "tool.call.failed",
  "tool.call.interrupted",
  "log",
] as const satisfies readonly (keyof DemoEvents)[];

const apiKey = process.env.XAI_API_KEY;
const port = Number(process.env.PORT ?? 3000);

if (!apiKey) {
  console.error("XAI_API_KEY is required.");
  console.error("Start with: XAI_API_KEY='your-api-key-here' yarn demo");
  process.exit(1);
}

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error("PORT must be an integer between 1 and 65535.");
  process.exit(1);
}

const controller = createVoiceAgentServer({
  port,
  apiKey,
  realtime: {
    instructions: "You are a concise voice assistant for a local SDK demo.",
  },
  tools: {
    ping: {
      description: "Responds with pong. Use this to confirm the tool system is working.",
      parameters: z.object({}),
      execute: async () => ({ pong: true }),
    },
  },
  ui: {
    title: "Conversation SDK Demo",
  },
});

for (const name of eventNames) {
  const eventName: keyof DemoEvents = name;
  // Cast handler through a single keyof-erased shape so the loop typechecks
  // — TypeScript cannot narrow the callback parameter when iterating a union.
  (controller.on as (n: keyof DemoEvents, h: (event: DemoEvents[keyof DemoEvents]) => void) => void)(
    eventName,
    (event) => {
      console.log(
        toYaml({
          event: eventName,
          data: event,
        }),
      );
    },
  );
}

await controller.start();

console.log(`Open http://localhost:${port} in your browser.`);

process.once("SIGINT", () => {
  void stopAndExit(0);
});

process.once("SIGTERM", () => {
  void stopAndExit(0);
});

async function stopAndExit(exitCode: number): Promise<void> {
  try {
    if (controller.status.server === "active") {
      await controller.stop();
    }
  } finally {
    process.exit(exitCode);
  }
}

function toYaml(value: unknown): string {
  return `${formatYaml(value, 0)}\n---`;
}

function formatYaml(value: unknown, indent: number): string {
  const padding = " ".repeat(indent);

  if (value instanceof Date) return quoteScalar(value.toISOString());
  if (value instanceof Error) {
    return formatYaml(
      {
        name: value.name,
        message: value.message,
        stack: value.stack,
      },
      indent,
    );
  }
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return quoteScalar(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        const formatted = formatYaml(item, indent + 2);
        return formatted.includes("\n") ? `${padding}-\n${formatted}` : `${padding}- ${formatted}`;
      })
      .join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, item]) => {
        const formatted = formatYaml(item, indent + 2);
        return formatted.includes("\n") ? `${padding}${key}:\n${formatted}` : `${padding}${key}: ${formatted}`;
      })
      .join("\n");
  }

  return quoteScalar(String(value));
}

function quoteScalar(value: string): string {
  return JSON.stringify(value);
}
