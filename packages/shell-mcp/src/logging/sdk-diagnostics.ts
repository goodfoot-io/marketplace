import { format } from "node:util";
import type { Logger } from "./logger.js";

/**
 * The SDK emits its JSON-response-mode warning synchronously during handler
 * construction and provides no diagnostic hook for it. Route construction-time
 * warnings to the file without changing transport behavior. No async work or
 * request handling runs inside this temporary interception; always restore it.
 */
export function captureStartupWarnings<T>(logger: Logger, construct: () => T): T {
  const original = console.warn;
  console.warn = (...values: unknown[]) => {
    logger.log("sdk.warning", "server", format(...values), { logger: "mcp-sdk", level: "warn" });
  };
  try {
    return construct();
  } finally {
    console.warn = original;
  }
}
