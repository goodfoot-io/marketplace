/**
 * Type definitions for MCP wrapper server
 */

/**
 * Transport type for MCP server connections
 */
export type TransportType = 'stdio' | 'http';

/**
 * Configuration for a single wrapped MCP server
 */
export interface ServerConfig {
  /** Server name for identification */
  name: string;
  /** Transport type for communication */
  transport: TransportType;
  /** Command for stdio transport */
  command?: string;
  /** Arguments for stdio transport */
  args?: string[];
  /** URL for HTTP transport */
  url?: string;
  /** Environment variables to pass to server */
  env?: Record<string, string>;
}

/**
 * Aggregated tools from all wrapped servers
 */
export interface AggregatedTools {
  /** All discovered tools with server context */
  allTools: Array<{
    serverName: string;
    tool: {
      name: string;
      description?: string;
      inputSchema: Record<string, unknown>;
    };
  }>;
  /** Array of allowed tool names */
  allowedTools: string[];
  /** Aggregated description of all capabilities */
  description: string;
}

/**
 * Cached tool description format
 */
export interface CachedToolDescription {
  /** Cache format version */
  version: string;
  /** MD5 hash of configuration */
  configHash: string;
  /** Timestamp when cache was created */
  timestamp: number;
  /** All discovered tools */
  allTools: AggregatedTools['allTools'];
  /** Allowed tool names */
  allowedTools: string[];
  /** Aggregated description */
  description: string;
}
