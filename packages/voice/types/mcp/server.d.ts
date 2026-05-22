/**
 * Voice MCP server factory.
 *
 * Embeds the `createVoiceAgentServer` controller in-process and exposes its
 * lifecycle as MCP tools, while bridging controller events to `claude/channel`
 * notifications (the same events `voice watch` streams, delivered as raw event
 * JSON). This module imports ONLY the core voice library (`../index.js`) — it
 * shares no code with the CLI or daemon.
 *
 * Tools:
 *   conversation({ action }) — pause | resume | reset | status (start/end are automatic with the page)
 *   set({ context?, topics?, instructions? }) — steer the live session
 *   inject({ role, message, source?, triggerResponse? }) — add a transcript item
 *   html({ path? }) — render an HTML file as the stage (no path clears it)
 *
 * @module voice/mcp/server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { VoiceMcpConfig } from "./config.js";
import { type DiagnosticLogger } from "./logger.js";
export interface VoiceMcpServer {
    start(): Promise<void>;
    stop(): Promise<void>;
    mcpServer: McpServer;
}
export interface CreateVoiceMcpServerOptions {
    /** Override the MCP transport (defaults to stdio). Used in tests. */
    transport?: Transport;
    /** Override the diagnostic logger. Used in tests. */
    logger?: DiagnosticLogger;
}
/**
 * Creates a voice MCP server bound to the given configuration.
 *
 * @param config - Environment-derived configuration.
 * @param options - Optional transport/logger overrides for tests.
 * @returns An object with `start`, `stop`, and `mcpServer`.
 */
export declare function createVoiceMcpServer(config: VoiceMcpConfig, options?: CreateVoiceMcpServerOptions): Promise<VoiceMcpServer>;
