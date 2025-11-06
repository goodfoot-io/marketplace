/**
 * Tool discovery system with caching
 */

import type { ServerConfig, AggregatedTools } from './types/wrapper.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { generateConfigHash, readCacheFile, writeCacheFile } from './cache.js';
import { debug, info, warn } from './logger.js';
import { getEnvironmentAsRecord } from './types/wrapper.js';

/**
 * Timeout for tool discovery in milliseconds
 */
const DISCOVERY_TIMEOUT_MS = 10000;

/**
 * Discover tools from a single server with timeout
 */
async function discoverServerTools(
  config: ServerConfig
): Promise<
  Array<{ serverName: string; tool: { name: string; description?: string; inputSchema: Record<string, unknown> } }>
> {
  let client: Client | null = null;

  try {
    debug(`Discovering tools from server: ${config.name}`);

    // Create client
    client = new Client(
      {
        name: 'mcp-wrapper-discovery',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    // Create transport based on type
    let transport;
    if (config.transport === 'stdio') {
      if (!config.command) {
        warn(`Server ${config.name}: stdio transport requires command`);
        return [];
      }

      const env = config.env ? getEnvironmentAsRecord(config.env) : undefined;
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env
      });
    } else {
      // config.transport === 'http'
      if (!config.url) {
        warn(`Server ${config.name}: HTTP transport requires URL`);
        return [];
      }

      // Create HTTP transport with headers if provided
      const transportOptions: { requestInit?: RequestInit } = {};
      if (config.headers && Object.keys(config.headers).length > 0) {
        transportOptions.requestInit = {
          headers: config.headers
        };
      }

      transport = new StreamableHTTPClientTransport(new URL(config.url), transportOptions);
    }

    // Connect with timeout
    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), DISCOVERY_TIMEOUT_MS))
    ]);

    debug(`Connected to server: ${config.name}`);

    // List tools with timeout
    const result = await Promise.race([
      client.listTools(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('listTools timeout')), DISCOVERY_TIMEOUT_MS))
    ]);

    info(`Discovered ${result.tools.length} tools from ${config.name}`);

    // Map tools to include server name
    return result.tools.map((tool) => ({
      serverName: config.name,
      tool: {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>
      }
    }));
  } catch (error) {
    warn(`Failed to discover tools from ${config.name}:`, error);
    return [];
  } finally {
    // Always close the client
    if (client) {
      try {
        await client.close();
        debug(`Closed discovery client for: ${config.name}`);
      } catch (error) {
        debug(`Error closing discovery client for ${config.name}:`, error);
      }
    }
  }
}

/**
 * Generate aggregated description from discovered tools
 */
function generateDescription(allTools: AggregatedTools['allTools']): string {
  if (allTools.length === 0) {
    return 'Multi-tool agent (no tools discovered yet)';
  }

  // Group tools by server
  const serverGroups = new Map<string, string[]>();
  for (const { serverName, tool } of allTools) {
    if (!serverGroups.has(serverName)) {
      serverGroups.set(serverName, []);
    }
    serverGroups.get(serverName)!.push(tool.name);
  }

  // Build description
  const serverCount = serverGroups.size;
  const toolCount = allTools.length;

  if (serverCount === 1) {
    const [serverName, toolNames] = Array.from(serverGroups.entries())[0];
    const toolList = toolNames.slice(0, 5).join(', ');
    const more = toolNames.length > 5 ? ` and ${toolNames.length - 5} more` : '';
    return `${serverName} agent with ${toolCount} tools: ${toolList}${more}`;
  }

  const serverList = Array.from(serverGroups.keys()).slice(0, 3).join(', ');
  const moreServers = serverGroups.size > 3 ? ` and ${serverGroups.size - 3} more` : '';
  return `Multi-tool agent with ${toolCount} tools from ${serverCount} servers: ${serverList}${moreServers}`;
}

/**
 * Discover tools from wrapped MCP servers
 */
export async function discoverTools(configs: ServerConfig[]): Promise<AggregatedTools> {
  // Handle empty configuration
  if (configs.length === 0) {
    debug('No servers configured, returning empty tools');
    return {
      allTools: [],
      allowedTools: [],
      description: 'Multi-tool agent (no tools discovered yet)'
    };
  }

  // Generate cache hash
  const hash = generateConfigHash(configs);
  debug(`Configuration hash: ${hash}`);

  // Check cache
  const cached = await readCacheFile(hash);
  if (cached) {
    info(`Using cached tools for configuration ${hash}`);
    return cached;
  }

  info('Cache miss, discovering tools from servers');

  // Discover tools from all servers
  const allTools: AggregatedTools['allTools'] = [];
  for (const config of configs) {
    const serverTools = await discoverServerTools(config);
    allTools.push(...serverTools);
  }

  // Build allowed tools list
  const allowedTools = allTools.map((item) => item.tool.name);

  // Generate description
  const description = generateDescription(allTools);

  // Build result
  const result: AggregatedTools = {
    allTools,
    allowedTools,
    description
  };

  // Write to cache
  try {
    await writeCacheFile(hash, result);
    info(`Cached tools for configuration ${hash}`);
  } catch (error) {
    warn('Failed to write cache file, continuing without cache:', error);
  }

  return result;
}
