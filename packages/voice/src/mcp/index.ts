#!/usr/bin/env node
/**
 * CLI entry point for the voice MCP server.
 *
 * Reads configuration from the environment, embeds the voice controller, and
 * serves MCP over stdio. stdout is reserved for the MCP JSON-RPC stream — all
 * diagnostics go to stderr or the `VOICE_SERVER_LOG_PATH` file.
 *
 * @module voice/mcp/index
 */

import { readConfig } from "./config.js";
import { createVoiceMcpServer } from "./server.js";

async function main(): Promise<void> {
  const config = readConfig();
  const server = createVoiceMcpServer(config);

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    server
      .stop()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await server.start();
}

main().catch((err: unknown) => {
  process.stderr.write(`[voice-mcp] Startup failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
