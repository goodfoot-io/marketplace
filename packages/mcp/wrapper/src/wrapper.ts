#!/usr/bin/env node
/**
 * MCP wrapper server - Generic wrapper for multiple MCP servers with dynamic tool discovery
 */

import type { ServerConfig, AggregatedTools } from './types/wrapper.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { discoverTools } from './discovery.js';
import { info, debug, warn } from './logger.js';
import { validateAgentToolArguments } from './types/wrapper.js';

/**
 * Parse CLI arguments to extract multiple wrapped server configurations
 *
 * Expected format:
 *   -- server-name --transport stdio|http <args...> -- next-server ...
 *
 * Examples:
 *   -- clickup --transport stdio npx -y @hauptsache.net/clickup-mcp
 *   -- hugging-face --transport http https://huggingface.co/mcp
 *   -- hf --transport http https://huggingface.co/mcp -- clickup --transport stdio npx -y @hauptsache.net/clickup-mcp
 *
 * @param argv - Process arguments (typically process.argv)
 * @returns Array of ServerConfig objects
 * @throws Error if arguments are invalid or no servers configured
 */
export function parseCliArguments(argv: string[]): ServerConfig[] {
  // Find where the first "--" separator starts (after script name)
  const firstSeparatorIndex = argv.indexOf('--');

  if (firstSeparatorIndex === -1) {
    throw new Error(
      'No server configurations provided. Expected format: -- <server-name> --transport stdio|http <args...>'
    );
  }

  // Extract everything after the first "--"
  const allArgs = argv.slice(firstSeparatorIndex + 1);

  // Split by "--" to get individual server configurations
  const serverGroups: string[][] = [];
  let currentGroup: string[] = [];

  for (const arg of allArgs) {
    if (arg === '--') {
      if (currentGroup.length > 0) {
        serverGroups.push(currentGroup);
        currentGroup = [];
      }
    } else {
      currentGroup.push(arg);
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    serverGroups.push(currentGroup);
  }

  if (serverGroups.length === 0) {
    throw new Error(
      'No server configurations provided. Expected format: -- <server-name> --transport stdio|http <args...>'
    );
  }

  // Parse each server group
  const configs: ServerConfig[] = [];

  for (const group of serverGroups) {
    if (group.length === 0) {
      continue;
    }

    // First arg is the server name
    const name = group[0];
    if (!name) {
      throw new Error('Server name is required as first argument after "--"');
    }

    // Server name cannot start with "--" (it's not a flag)
    if (name.startsWith('--')) {
      throw new Error(`Server name cannot start with "--". Received: "${name}"`);
    }

    // Find --transport flag (default to stdio if not specified)
    const transportIndex = group.indexOf('--transport');
    let transport: 'stdio' | 'http' = 'stdio';
    let remainingArgs: string[];

    if (transportIndex !== -1) {
      // Transport flag found
      if (transportIndex + 1 >= group.length) {
        throw new Error(`Server "${name}": --transport flag requires a value (stdio or http)`);
      }

      const transportValue = group[transportIndex + 1];
      if (transportValue !== 'stdio' && transportValue !== 'http') {
        throw new Error(`Server "${name}": Invalid transport type "${transportValue}". Expected "stdio" or "http"`);
      }

      transport = transportValue;

      // Remaining args are everything after the transport value
      remainingArgs = group.slice(transportIndex + 2);
    } else {
      // No transport flag, everything after name is args (default to stdio)
      remainingArgs = group.slice(1);
    }

    // Build config based on transport type
    if (transport === 'stdio') {
      // For stdio: first remaining arg is command, rest are args
      if (remainingArgs.length === 0) {
        throw new Error(`Server "${name}": stdio transport requires at least a command`);
      }

      const command = remainingArgs[0];
      const args = remainingArgs.slice(1);

      configs.push({
        name,
        transport: 'stdio',
        command,
        args
      });
    } else {
      // For HTTP: remaining arg should be a URL
      if (remainingArgs.length === 0) {
        throw new Error(`Server "${name}": http transport requires a URL`);
      }

      const url = remainingArgs[0];

      // Basic URL validation
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(`Server "${name}": Invalid URL "${url}". Must start with http:// or https://`);
      }

      configs.push({
        name,
        transport: 'http',
        url
      });
    }
  }

  if (configs.length === 0) {
    throw new Error('No valid server configurations parsed');
  }

  return configs;
}

/**
 * Wrapper server instance with discovered tools
 */
export interface WrapperServer {
  server: Server;
  tools: AggregatedTools;
}

/**
 * Initialize MCP server with tool discovery
 *
 * @param configs - Array of server configurations
 * @returns Server instance with registered tool handlers
 */
export async function initializeServer(configs: ServerConfig[]): Promise<WrapperServer> {
  info('Initializing MCP wrapper server');

  // Discover tools from wrapped servers (with caching)
  const tools = await discoverTools(configs);
  info(`Discovered ${tools.allTools.length} tools total`);

  // Create MCP server instance
  const server = new Server(
    {
      name: 'mcp-wrapper-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Register ListToolsRequestSchema handler
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: 'agent',
        description: tools.description,
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Instructions for the agent'
            },
            sessionId: {
              type: 'string',
              description: 'Session ID for conversation continuity'
            }
          },
          required: ['prompt']
        }
      }
    ]
  }));

  // Register CallToolRequestSchema handler for agent tool
  server.setRequestHandler(CallToolRequestSchema, async (request, meta) => {
    if (request.params.name !== 'agent') {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }

    // Validate arguments with runtime type checking
    let args;
    try {
      args = validateAgentToolArguments(request.params.arguments);
    } catch (error) {
      throw new McpError(ErrorCode.InvalidParams, (error as Error).message);
    }

    const { prompt } = args;

    if (!prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'prompt is required');
    }

    // Extract progress token from meta for progress notifications
    const progressToken =
      meta && typeof meta === 'object' && '_meta' in meta && typeof meta._meta === 'object' && meta._meta !== null
        ? (meta._meta as Record<string, unknown>).progressToken
        : undefined;

    // Build mcpServers configuration from ServerConfig array
    const mcpServers: Record<
      string,
      { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> } | { type: 'http'; url: string }
    > = {};

    for (const config of configs) {
      if (config.transport === 'stdio') {
        if (!config.command) {
          warn(`Skipping server ${config.name}: stdio transport requires command`);
          continue;
        }
        mcpServers[config.name] = {
          type: 'stdio',
          command: config.command,
          args: config.args || [],
          env: config.env ? config.env : undefined
        };
      } else {
        // HTTP transport
        if (!config.url) {
          warn(`Skipping server ${config.name}: HTTP transport requires URL`);
          continue;
        }
        mcpServers[config.name] = {
          type: 'http',
          url: config.url
        };
      }
    }

    // Configure query options
    const queryOptions: Parameters<typeof query>[0]['options'] = {
      systemPrompt: `You are a helpful assistant with access to multiple tools from different MCP servers.
Use these tools to help the user accomplish their goals.
Always check the available tools and use them appropriately to complete tasks.`,
      maxTurns: 100,
      allowedTools: tools.allowedTools,
      permissionMode: 'bypassPermissions',
      mcpServers
    };

    let result = '';
    let toolCallCount = 0;

    try {
      // Execute the query using Claude Code SDK
      for await (const message of query({
        prompt,
        options: queryOptions
      })) {
        // Type the message as unknown first, then narrow with type guards
        const msg = message as unknown;

        // Check for result messages
        if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'result') {
          const resultMsg = msg as { type: 'result'; subtype?: string; result?: string };
          if (resultMsg.subtype === 'error_max_turns' || resultMsg.subtype === 'error_during_execution') {
            throw new Error(`Agent execution error: ${resultMsg.subtype}`);
          }
          if (resultMsg.subtype === 'success' && resultMsg.result) {
            result = resultMsg.result;
          }
        }

        // Check for assistant messages with tool use
        if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'assistant' && 'message' in msg) {
          const assistantMsg = msg as { type: 'assistant'; message?: { content?: unknown[] } };
          if (assistantMsg.message && assistantMsg.message.content && Array.isArray(assistantMsg.message.content)) {
            for (const content of assistantMsg.message.content) {
              if (typeof content === 'object' && content !== null && 'type' in content && content.type === 'tool_use') {
                const toolUse = content as { type: 'tool_use'; name: string; input: unknown };

                // Send progress notification if token is available
                if (progressToken && typeof progressToken === 'string') {
                  toolCallCount++;

                  // Format simplified tool input for progress message
                  let inputPreview = '';
                  if (typeof toolUse.input === 'object' && toolUse.input !== null) {
                    const inputObj = toolUse.input as Record<string, unknown>;
                    const keys = Object.keys(inputObj).slice(0, 2);
                    inputPreview = keys.map((k) => `${k}=...`).join(', ');
                  }

                  const progressMessage = `Tool ${toolCallCount}: ${toolUse.name}(${inputPreview})`;

                  // Send progress notification (fire and forget)
                  server
                    .notification({
                      method: 'notifications/progress',
                      params: {
                        progressToken,
                        progress: toolCallCount,
                        message: progressMessage
                      }
                    })
                    .catch((err: Error) => {
                      debug('Failed to send progress notification:', err);
                    });
                }
              }
            }
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: result || 'No response from agent.'
          }
        ]
      };
    } catch (error) {
      const errorMessage = `Agent execution failed: ${(error as Error).message}. Tool calls executed: ${toolCallCount}.`;
      throw new McpError(ErrorCode.InternalError, errorMessage);
    }
  });

  info('MCP server initialized successfully');

  return { server, tools };
}

/**
 * Main entry point for the wrapper server
 */
export async function main(): Promise<void> {
  console.error('MCP wrapper server starting...');

  const configs = parseCliArguments(process.argv);
  console.error(`Parsed ${configs.length} server configuration(s):`, JSON.stringify(configs, null, 2));
  // Implementation will be added in subsequent tasks

  await Promise.resolve(); // Placeholder to satisfy async requirement
}

// Auto-start when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
