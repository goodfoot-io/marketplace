#!/usr/bin/env node
/**
 * CLI entry point: parse arguments, start the server, and hold the process open
 * until a termination signal arrives.
 *
 * A leading `openai` selects the tunnel launcher instead and hands it the rest
 * of the command line unchanged (see `tunnel-launcher.ts`).
 *
 * Startup failures are fail-closed: an unusable configuration exits `2` with
 * the usage text, and a failure to bind exits `1` with the underlying error.
 * Nothing is left listening in either case.
 */

import { ConfigError, parseArgs, type ServerConfig, USAGE, UsageRequested } from "./config.js";
import { receiveLauncherRecord } from "./logging/relay.js";
import { startServer } from "./serve.js";
import { isTunnelCommand, runTunnelLauncher, tunnelArguments } from "./tunnel-launcher.js";

/** Exit code for a configuration the process refuses to run with. */
const USAGE_EXIT_CODE = 2;

async function main(argv: readonly string[]): Promise<number> {
  if (isTunnelCommand(argv)) return await runTunnelLauncher(tunnelArguments(argv));

  let config: ServerConfig;
  try {
    config = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageRequested) {
      console.log(USAGE);
      return 0;
    }
    if (error instanceof ConfigError) {
      console.error(`shell-mcp: ${error.message}\n`);
      console.error(USAGE);
      return USAGE_EXIT_CODE;
    }
    throw error;
  }

  const running = await startServer(config);
  if (process.send) {
    process.on("message", (value: unknown) => {
      if (receiveLauncherRecord(value, running.logger) && process.connected) {
        process.send?.({ shellMcpLogAck: true }, undefined, undefined, () => {});
      }
    });
  }
  running.logger.display({ type: "notice", text: `shell-mcp ready on ${running.host}:${running.port}` });
  running.logger.display({ type: "notice", text: "Warning: anyone reaching this endpoint has full shell access.\n" });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    running.logger.log("server.shutdown", "server", "", { logger: "server", level: "info", signal });
    running.close().then(
      () => {
        process.exit(0);
      },
      (error: unknown) => {
        console.error(`shell-mcp: shutdown failed: ${String(error)}`);
        process.exit(1);
      },
    );
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return 0;
}

await main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`shell-mcp: failed to start: ${message}`);
    process.exitCode = 1;
  },
);
