#!/usr/bin/env node
/**
 * CLI entry point: parse arguments, start the server, and hold the process open
 * until a termination signal arrives.
 *
 * Startup failures are fail-closed: an unusable configuration exits `2` with
 * the usage text, and a failure to bind exits `1` with the underlying error.
 * Nothing is left listening in either case.
 */

import { ConfigError, parseArgs, type ServerConfig, USAGE, UsageRequested } from "./config.js";
import { startServer } from "./serve.js";

/** Exit code for a configuration the process refuses to run with. */
const USAGE_EXIT_CODE = 2;

async function main(argv: readonly string[]): Promise<number> {
  let config: ServerConfig;
  try {
    config = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageRequested) {
      console.log(USAGE);
      return 0;
    }
    if (error instanceof ConfigError) {
      console.error(`remote-managed-shell: ${error.message}\n`);
      console.error(USAGE);
      return USAGE_EXIT_CODE;
    }
    throw error;
  }

  const running = await startServer(config);
  console.log(`remote-managed-shell: listening on ${running.endpoint.href} (${running.mode} mode)`);
  console.log(`remote-managed-shell: server instance ${running.serverInstanceId}`);
  if (running.readyFile !== undefined) {
    console.log(`remote-managed-shell: ready file ${running.readyFile}`);
  }
  if (config.publicUrl !== undefined) {
    console.log(`remote-managed-shell: advertised public URL ${config.publicUrl}`);
  }
  console.log(
    "remote-managed-shell: WARNING: authenticated clients receive the full shell authority of this Unix account.",
  );
  console.log(`remote-managed-shell: authorize at ${running.authorizationUrl.href}`);
  console.log(`remote-managed-shell: startup secret ${running.startupSecret}`);
  console.log("remote-managed-shell: the startup secret is memory-only and all credentials expire on restart.");

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`remote-managed-shell: received ${signal}, shutting down`);
    running.close().then(
      () => {
        process.exit(0);
      },
      (error: unknown) => {
        console.error(`remote-managed-shell: shutdown failed: ${String(error)}`);
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
    console.error(`remote-managed-shell: failed to start: ${message}`);
    process.exitCode = 1;
  },
);
