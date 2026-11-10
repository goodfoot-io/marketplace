import { createRequire } from "node:module";

// Resolve the SDK's CommonJS exports together: the Node adapter imports the
// server itself, so mixing its ESM and CommonJS paths would still require the
// server's ESM artifact in an incomplete installation.
const require = createRequire(import.meta.url);
const server: typeof import("@modelcontextprotocol/server") = require("@modelcontextprotocol/server");
const node: typeof import("@modelcontextprotocol/node") = require("@modelcontextprotocol/node");

export const { McpServer, createMcpHandler } = server;
export type McpServer = import("@modelcontextprotocol/server").McpServer;
export const { toNodeHandler } = node;
