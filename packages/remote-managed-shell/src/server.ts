/**
 * The MCP server composition: one factory that builds a fully configured
 * `McpServer` for a single serving unit.
 *
 * `createMcpHandler` calls the factory once per serving unit (one HTTP request
 * for modern protocol traffic, one connection for legacy traffic), so tool
 * registration must live here — in a function — and never in module scope.
 */

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export const SERVER_NAME = "remote-managed-shell";
export const SERVER_VERSION = "0.1.0";

export const ECHO_TOOL_NAME = "echo";

/**
 * Builds a server instance with the current tool surface registered.
 *
 * Right now that surface is a single `echo` tool: it proves the transport,
 * protocol era negotiation, schema validation, and structured results all work
 * before the managed Bash tools are built on this skeleton.
 *
 * @returns A new `McpServer`, ready to be connected to a transport.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    ECHO_TOOL_NAME,
    {
      title: "Echo",
      description:
        "Return the supplied text unchanged. Round-trip check for the MCP route: it reads nothing from the host and changes nothing.",
      inputSchema: z.object({
        text: z.string().describe("Text to return unchanged."),
      }),
      outputSchema: z.object({
        text: z.string(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ text }) => ({
      content: [{ type: "text" as const, text }],
      structuredContent: { text },
    }),
  );

  return server;
}
