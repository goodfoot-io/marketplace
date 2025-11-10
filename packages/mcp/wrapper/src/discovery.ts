/**
 * Tool discovery system with caching
 */

import type { ServerConfig, AggregatedTools } from './types/wrapper.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { generateConfigHash, readCacheFile, writeCacheFile } from './cache.js';
import { debug, info, warn } from './logger.js';
import { getEnvironmentAsRecord } from './types/wrapper.js';

/**
 * Discover tools from a single server with timeout
 */
async function discoverServerTools(
  config: ServerConfig,
  options?: { timeout?: number }
): Promise<
  Array<{ serverName: string; tool: { name: string; description?: string; inputSchema: Record<string, unknown> } }>
> {
  let client: Client | null = null;
  const abortController = new AbortController();

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
    let transport: StdioClientTransport | StreamableHTTPClientTransport | null = null;

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

    await client.connect(transport, { signal: abortController.signal, timeout: options?.timeout });

    debug(`Connected to server: ${config.name}`);

    const result = await client.listTools(undefined, { signal: abortController.signal, timeout: options?.timeout });

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
    abortController.abort();
    // Always close the client
    if (client) {
      try {
        await client.close();
        debug(`Closed discovery client for: ${config.name}`);
      } catch (closeError) {
        warn(`Error closing discovery client for ${config.name}:`, closeError);
      }
    }
  }
}

/**
 * Generate aggregated description from discovered tools using AI
 */
async function generateDescription(allTools: AggregatedTools['allTools']): Promise<string> {
  if (allTools.length === 0) {
    return 'Integration tool (no capabilities discovered yet)';
  }

  // Build fallback template-based description
  const getFallbackDescription = (): string => {
    // Group tools by server
    const serverGroups = new Map<string, string[]>();
    for (const { serverName, tool } of allTools) {
      if (!serverGroups.has(serverName)) {
        serverGroups.set(serverName, []);
      }
      serverGroups.get(serverName)!.push(tool.name);
    }

    const serverCount = serverGroups.size;
    const toolCount = allTools.length;

    if (serverCount === 1) {
      const [serverName, toolNames] = Array.from(serverGroups.entries())[0];
      const toolList = toolNames.slice(0, 5).join(', ');
      const more = toolNames.length > 5 ? ` and ${toolNames.length - 5} more` : '';
      return `${serverName} integration tool with ${toolCount} capabilities: ${toolList}${more}`;
    }

    const serverList = Array.from(serverGroups.keys()).slice(0, 3).join(', ');
    const moreServers = serverGroups.size > 3 ? ` and ${serverGroups.size - 3} more` : '';
    return `Integration tool with ${toolCount} capabilities from ${serverCount} servers: ${serverList}${moreServers}`;
  };

  try {
    // Build prompt for AI description generation
    const toolDescriptions = allTools
      .map(({ serverName, tool }) => {
        const desc = tool.description ? `: ${tool.description}` : '';
        return `- ${tool.name} (from ${serverName})${desc}`;
      })
      .join('\n');

    const prompt = `You are Claude generating a description for another Claude instance about a tool that provides access to capabilities.

Available underlying tools:
${toolDescriptions}

Generate a concise description (similar to existing tool descriptions in Claude Code) that:
1. Uses singular framing: presents this as ONE tool that can be prompted to perform various actions
2. Opens with "[Domain] tool for [high-level purpose]" (e.g., "GitHub integration tool for managing repositories...")
3. Uses "Use this to [action list]" to describe what can be accomplished by prompting this tool
4. Ends with "Essential for [workflow contexts]" to guide when to use it
5. Does not exceed three paragraphs

Respond with ONLY the description text, nothing else.`;

    debug('Generating AI-powered description for tools');

    // Use query to generate description
    let result = '';
    for await (const message of query({
      prompt,
      options: {
        model: 'haiku',
        maxTurns: 1,
        permissionMode: 'bypassPermissions',
        systemPrompt:
          'You are a technical writer creating concise tool descriptions. Output only the description text with no formatting, quotes, or explanation.'
      }
    })) {
      // Type the message and extract result
      const msg = message as unknown;

      if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'result') {
        const resultMsg = msg as { type: 'result'; subtype?: string; result?: string };
        if (resultMsg.subtype === 'success' && resultMsg.result) {
          result = resultMsg.result;
        }
      }
    }

    if (result && result.trim().length > 0) {
      info('Generated AI-powered description successfully');
      return result.trim();
    }

    warn('AI description generation returned empty result, using fallback');
    return getFallbackDescription();
  } catch (error) {
    warn('Failed to generate AI description, using fallback:', error);
    return getFallbackDescription();
  }
}

/**
 * Discover tools from wrapped MCP servers
 *
 * Caches discovered tools to improve startup performance. Set the environment variable
 * MCP_WRAPPER_IGNORE_CACHE='true' to bypass cache and force fresh discovery.
 */
export async function discoverTools(configs: ServerConfig[], options?: { timeout?: number }): Promise<AggregatedTools> {
  // Handle empty configuration
  if (configs.length === 0) {
    debug('No servers configured, returning empty tools');
    return {
      allTools: [],
      allowedTools: [],
      description: 'Integration tool (no capabilities discovered yet)'
    };
  }

  // Generate cache hash
  const hash = generateConfigHash(configs);
  debug(`Configuration hash: ${hash}`);

  // Check if cache should be ignored
  const ignoreCache = process.env.MCP_WRAPPER_IGNORE_CACHE === 'true';

  // Check cache (unless explicitly ignored)
  if (!ignoreCache) {
    const cached = await readCacheFile(hash);
    if (cached) {
      info(`Using cached tools for configuration ${hash}`);
      return cached;
    }
  } else {
    info('MCP_WRAPPER_IGNORE_CACHE is set, bypassing cache');
  }

  info('Cache miss, discovering tools from servers');

  // Discover tools from all servers
  const allTools: AggregatedTools['allTools'] = [];
  for (const config of configs) {
    const serverTools = await discoverServerTools(config, options);
    allTools.push(...serverTools);
  }

  // Build allowed tools list with MCP prefix format: mcp__<servername>__<toolname>
  // List each tool explicitly as the Agent SDK may not support wildcards
  const allowedTools = allTools.map((item) => `mcp__${item.serverName}__${item.tool.name}`);

  // Generate description
  const description = await generateDescription(allTools);

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
