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
export {};
