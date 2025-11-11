#!/usr/bin/env node
/**
 * MCP wrapper server - Generic wrapper for multiple MCP servers with dynamic tool discovery
 */

import type { ServerConfig, AggregatedTools, AgentToolResponse, WrapperOptions } from './types/wrapper.js';
import { realpath } from 'node:fs/promises';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { generateAgentId } from './agent-id.js';
import { registerAgent, getAgentStatus, getAgentResult } from './background-agents.js';
import { discoverTools } from './discovery.js';
import { info, debug, warn, error } from './logger.js';
import { saveSessionMapping, getSessionId } from './session-mapping.js';
import { validateAgentToolArguments, validateAgentOutputArguments } from './types/wrapper.js';

/**
 * Parse global CLI flags before server configurations
 *
 * Extracts system prompt flags (--system-prompt, --append-system-prompt, --system-prompt-file)
 * from argv before the first "--" separator and returns them as WrapperOptions.
 *
 * @param argv - Process arguments (typically process.argv)
 * @returns Object containing parsed options and remaining argv
 * @throws Error if multiple system prompt flags are used or if a flag is missing its value
 */
export function parseGlobalFlags(argv: string[]): { options: WrapperOptions; remainingArgv: string[] } {
  const options: WrapperOptions = {};
  const remainingArgv: string[] = [];

  // Find the first "--" separator
  const firstSeparatorIndex = argv.indexOf('--');

  // Determine where global args end
  const globalArgsEnd = firstSeparatorIndex === -1 ? argv.length : firstSeparatorIndex;
  const globalArgs = argv.slice(0, globalArgsEnd);
  const afterSeparator = firstSeparatorIndex === -1 ? [] : argv.slice(firstSeparatorIndex);

  // Parse global flags
  let i = 0;
  while (i < globalArgs.length) {
    const arg = globalArgs[i];

    if (arg === '--system-prompt') {
      // Check if there's a value after this flag
      if (i + 1 >= globalArgs.length) {
        throw new Error('--system-prompt flag requires a value');
      }
      const nextArg = globalArgs[i + 1];
      if (nextArg === '--') {
        throw new Error('--system-prompt flag requires a value');
      }
      options.systemPrompt = nextArg;
      i += 2; // Skip flag and value
    } else if (arg === '--append-system-prompt') {
      // Check if there's a value after this flag
      if (i + 1 >= globalArgs.length) {
        throw new Error('--append-system-prompt flag requires a value');
      }
      const nextArg = globalArgs[i + 1];
      if (nextArg === '--') {
        throw new Error('--append-system-prompt flag requires a value');
      }
      options.appendSystemPrompt = nextArg;
      i += 2; // Skip flag and value
    } else if (arg === '--system-prompt-file') {
      // Check if there's a value after this flag
      if (i + 1 >= globalArgs.length) {
        throw new Error('--system-prompt-file flag requires a value');
      }
      const nextArg = globalArgs[i + 1];
      if (nextArg === '--') {
        throw new Error('--system-prompt-file flag requires a value');
      }
      options.systemPromptFile = nextArg;
      i += 2; // Skip flag and value
    } else {
      // Not a system prompt flag, preserve it in remaining argv
      remainingArgv.push(arg);
      i++;
    }
  }

  // Validate mutual exclusivity of system prompt flags
  const flagCount =
    (options.systemPrompt !== undefined ? 1 : 0) +
    (options.appendSystemPrompt !== undefined ? 1 : 0) +
    (options.systemPromptFile !== undefined ? 1 : 0);

  if (flagCount > 1) {
    throw new Error(
      'Only one system prompt flag can be used at a time: --system-prompt, --append-system-prompt, or --system-prompt-file'
    );
  }

  // Combine remaining global args with everything after the first separator
  return {
    options,
    remainingArgv: [...remainingArgv, ...afterSeparator]
  };
}

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
      // Headers are NOT parsed for stdio - they're passed through to the command
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
      // For HTTP: parse headers from -H and --header flags
      const headers: Record<string, string> = {};
      const filteredArgs: string[] = [];

      for (let i = 0; i < remainingArgs.length; i++) {
        const arg = remainingArgs[i];

        if (arg === '-H' || arg === '--header') {
          // Next argument should be the header value
          if (i + 1 >= remainingArgs.length) {
            throw new Error(`Server "${name}": ${arg} flag requires a value`);
          }

          const headerValue = remainingArgs[i + 1];

          // Split on first colon to separate name from value
          const colonIndex = headerValue.indexOf(':');
          if (colonIndex === -1) {
            throw new Error(
              `Server "${name}": Invalid header format "${headerValue}". Expected "Header-Name: Header-Value"`
            );
          }

          const headerName = headerValue.substring(0, colonIndex).trim();
          const headerVal = headerValue.substring(colonIndex + 1).trim();

          if (!headerName) {
            throw new Error(`Server "${name}": Header name cannot be empty in "${headerValue}"`);
          }

          headers[headerName] = headerVal;

          // Skip the next argument (header value)
          i++;
        } else {
          filteredArgs.push(arg);
        }
      }

      // For HTTP: remaining arg should be a URL (after filtering headers)
      if (filteredArgs.length === 0) {
        throw new Error(`Server "${name}": http transport requires a URL`);
      }

      const url = filteredArgs[0];

      // Basic URL validation
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(`Server "${name}": Invalid URL "${url}". Must start with http:// or https://`);
      }

      const httpConfig: ServerConfig = {
        name,
        transport: 'http',
        url
      };

      // Add headers if any were parsed
      if (Object.keys(headers).length > 0) {
        httpConfig.headers = headers;
      }

      configs.push(httpConfig);
    }
  }

  if (configs.length === 0) {
    throw new Error('No valid server configurations parsed');
  }

  return configs;
}

/**
 * Safely convert unknown values to strings for display in progress messages
 *
 * @param value - The value to convert
 * @returns String representation of the value
 */
function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

/**
 * Format a descriptive progress message for tool execution
 * Shows actual parameter values for better visibility into what the agent is doing
 *
 * @param toolName - Name of the tool being executed
 * @param input - Tool input parameters
 * @returns Formatted progress message string
 */
function formatProgressMessage(toolName: string, input: unknown): string {
  // Clean up the tool name if it has an mcp__ prefix
  const cleanName = toolName.replace(/^mcp__[^_]+__/, '');

  // Handle non-object input
  if (typeof input !== 'object' || input === null) {
    return `Executing ${cleanName}`;
  }

  const inputObj = input as Record<string, unknown>;
  const keys = Object.keys(inputObj);

  // If no parameters, show simple message
  if (keys.length === 0) {
    return `Executing ${cleanName}`;
  }

  // Common parameter patterns to show in progress messages
  const commonParams = ['prompt', 'url', 'path', 'query', 'question', 'message', 'text', 'command', 'name', 'file'];

  // Find the first common parameter that exists
  const primaryParam = commonParams.find((param) => keys.includes(param));

  if (primaryParam && inputObj[primaryParam] !== undefined) {
    const value = safeString(inputObj[primaryParam]);
    // Truncate long values for readability
    const displayValue = value.length > 80 ? value.substring(0, 77) + '...' : value;

    // Show different formats based on parameter type
    if (primaryParam === 'url') {
      return `${cleanName} → ${displayValue}`;
    } else if (primaryParam === 'path' || primaryParam === 'file') {
      return `${cleanName}: ${displayValue}`;
    } else if (primaryParam === 'prompt' || primaryParam === 'question' || primaryParam === 'query') {
      return `${cleanName}: "${displayValue}"`;
    } else {
      return `${cleanName} (${primaryParam}: ${displayValue})`;
    }
  }

  // If no common parameters, show first 2 parameters with values
  const params = keys
    .slice(0, 2)
    .map((k) => {
      const value = safeString(inputObj[k]);
      // Truncate individual parameter values
      const displayValue = value.length > 40 ? value.substring(0, 37) + '...' : value;
      return `${k}=${displayValue}`;
    })
    .join(', ');

  return `${cleanName} (${params})`;
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
              description: 'The task for the agent to perform'
            },
            model: {
              type: 'string',
              enum: ['sonnet', 'opus', 'haiku'],
              description: 'Optional model to use for this agent.'
            },
            resume: {
              type: 'string',
              description:
                'Optional agent ID to resume from. If provided, the agent will continue from the previous execution transcript.'
            },
            run_in_background: {
              type: 'boolean',
              description:
                'Set to true to run this agent in the background. Use the mcp__*__output tool to read the output later.'
            }
          },
          required: ['prompt']
        }
      },
      {
        name: 'output',
        description:
          'Retrieve output from one or more background agents. Returns status and results for each agent ID provided.',
        inputSchema: {
          type: 'object',
          properties: {
            agentIds: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of agent IDs to retrieve results for'
            },
            block: {
              type: 'boolean',
              description: 'Whether to block until results are ready. Default: true',
              default: true
            },
            wait_up_to: {
              type: 'number',
              description: 'Maximum time to wait in seconds (0-300). Default: 150',
              minimum: 0,
              maximum: 300,
              default: 150
            }
          },
          required: ['agentIds']
        }
      }
    ]
  }));

  // Register CallToolRequestSchema handler for agent and output tools
  server.setRequestHandler(CallToolRequestSchema, async (request, meta) => {
    const toolName = request.params.name;

    // Handle output tool
    if (toolName === 'output') {
      // Validate arguments with runtime type checking
      let args;
      try {
        args = validateAgentOutputArguments(request.params.arguments);
      } catch (error) {
        throw new McpError(ErrorCode.InvalidParams, (error as Error).message);
      }

      const { agentIds, block, wait_up_to } = args;
      const workspacePath = process.cwd();

      // Process each agent ID
      const results: string[] = [];

      for (const agentId of agentIds) {
        const status = await getAgentStatus(agentId);

        // If blocking is enabled and agent is running, wait for it
        if (block && status === 'running') {
          const timeoutMs = (wait_up_to || 150) * 1000;

          // Poll the status until it changes or timeout occurs
          const startTime = Date.now();
          let currentStatus: string = status;

          while (currentStatus === 'running' && Date.now() - startTime < timeoutMs) {
            // Wait a short interval before checking again
            await new Promise((resolve) => setTimeout(resolve, 100));
            currentStatus = await getAgentStatus(agentId);
          }

          // Check final status
          if (currentStatus === 'running') {
            results.push(`Agent ${agentId}: running\nAgent is still executing (timeout after ${wait_up_to}s)\n\n`);
            continue;
          }
        }

        // Get the result based on status
        const finalStatus = await getAgentStatus(agentId);

        if (finalStatus === 'not_found') {
          results.push(`Agent ${agentId}: not_found\nAgent not found in registry\n\n`);
        } else if (finalStatus === 'failed') {
          results.push(`Agent ${agentId}: failed\nAgent execution failed\n\n`);
        } else if (finalStatus === 'running') {
          results.push(`Agent ${agentId}: running\nAgent is still executing\n\n`);
        } else if (finalStatus === 'completed') {
          const result = await getAgentResult(agentId, workspacePath);

          if (result) {
            // Format the result based on its type
            if ('content' in result && result.status === 'completed') {
              // AgentToolResponse type (CompletedResponse from wrapper types)
              const textContent = result.content.map((c) => c.text).join('\n');
              results.push(`Agent ${agentId}: completed\n${textContent}\n\n`);
            } else if ('output' in result && 'sessionId' in result) {
              // CompletedResponse type (from background-agents.ts)
              // Type guard confirms this has 'output' and 'sessionId' properties
              const output = (result as { output: string; sessionId: string }).output;
              results.push(`Agent ${agentId}: completed\n${output}\n\n`);
            } else {
              // Fallback for unexpected result types
              results.push(`Agent ${agentId}: completed\n${JSON.stringify(result)}\n\n`);
            }
          } else {
            results.push(`Agent ${agentId}: completed\nNo result available\n\n`);
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: results.join('')
          }
        ]
      };
    }

    // Handle agent tool
    if (toolName !== 'agent') {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }

    // Validate arguments with runtime type checking
    let args;
    try {
      args = validateAgentToolArguments(request.params.arguments);
    } catch (error) {
      throw new McpError(ErrorCode.InvalidParams, (error as Error).message);
    }

    const { prompt, model, resume, run_in_background } = args;

    if (!prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'prompt is required');
    }

    // Generate agent ID for this execution
    const agentId = generateAgentId();
    const workspacePath = process.cwd();

    // Map agent ID to session ID for resume
    let resumeSessionId: string | undefined = undefined;
    if (resume) {
      try {
        const sessionId = await getSessionId(resume, workspacePath);
        if (sessionId) {
          resumeSessionId = sessionId;
          info(`Resuming agent ${resume} with session ${sessionId}`);
        } else {
          warn(`No session ID found for agent ${resume}, cannot resume`);
        }
      } catch (err) {
        warn(`Failed to load session ID for agent ${resume}:`, err);
      }
    }

    // Extract progress token from meta for progress notifications
    const progressToken =
      meta && typeof meta === 'object' && '_meta' in meta && typeof meta._meta === 'object' && meta._meta !== null
        ? (meta._meta as Record<string, unknown>).progressToken
        : undefined;

    // Build mcpServers configuration from ServerConfig array
    const mcpServers: Record<
      string,
      | { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
      | { type: 'http'; url: string; headers?: Record<string, string> }
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
          url: config.url,
          headers: config.headers || {}
        };
      }
    }

    // Configure query options
    const queryOptions: Parameters<typeof query>[0]['options'] = {
      systemPrompt: `You are a helpful assistant with access to multiple tools from different MCP servers. Use these tools to help the user accomplish their goals. Always check the available tools and use them appropriately to complete tasks.

<tool-call-answer-mode>
If the user's request can be answered the response from a tool call, output the full response as your final message to the user. Do not summarize or include other content in your response.
</tool-call-answer-mode>

<aggregate-answer-mode>
If the user's request requires aggregating multiple tool calls, provide a comprehensive answer. Include the full content of any tool call responses directly relevant to the user's request.
</aggregate-answer-mode>

Do not preface your response with unecessary preambles like "Based on my analysis..." or "Now I can provide...".
`,
      maxTurns: 100,
      strictMcpConfig: true,
      allowedTools: tools.allowedTools,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      mcpServers,
      model,
      resume: resumeSessionId
    };

    // Debug: log the mcpServers configuration
    debug('Query options - mcpServers:', JSON.stringify(mcpServers, null, 2));
    debug('Query options - allowedTools:', JSON.stringify(tools.allowedTools, null, 2));

    // Define the agent execution function
    const executeAgent = async (): Promise<AgentToolResponse> => {
      let result = '';
      let sessionId = '';
      let toolCallCount = 0;
      const startTime = Date.now();
      let totalTokens = 0;
      let usage: Record<string, unknown> = {};

      try {
        // Execute the query using Claude Code SDK
        for await (const message of query({
          prompt,
          options: queryOptions
        })) {
          // Type the message as unknown first, then narrow with type guards
          const msg = message as unknown;

          // Capture session_id from any message
          if (typeof msg === 'object' && msg !== null && 'session_id' in msg) {
            const msgWithSession = msg as { session_id: string };
            if (msgWithSession.session_id && !sessionId) {
              sessionId = msgWithSession.session_id;
              // Save the mapping for future resume operations
              try {
                await saveSessionMapping(agentId, sessionId, workspacePath);
                info(`Saved session mapping: agent ${agentId} -> session ${sessionId}`);
              } catch (err) {
                error(`Failed to save session mapping for agent ${agentId}:`, err);
              }
            }
          }

          // Check for result messages
          if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'result') {
            const resultMsg = msg as {
              type: 'result';
              subtype?: string;
              result?: string;
              usage?: Record<string, unknown>;
            };
            if (resultMsg.subtype === 'error_max_turns' || resultMsg.subtype === 'error_during_execution') {
              throw new Error(`Agent execution error: ${resultMsg.subtype}`);
            }
            if (resultMsg.subtype === 'success' && resultMsg.result) {
              result = resultMsg.result;
            }
            if (resultMsg.usage) {
              usage = resultMsg.usage;
              // Extract total tokens if available
              if (typeof resultMsg.usage.total_tokens === 'number') {
                totalTokens = resultMsg.usage.total_tokens;
              }
            }
          }

          // Check for assistant messages with tool use
          if (
            typeof msg === 'object' &&
            msg !== null &&
            'type' in msg &&
            msg.type === 'assistant' &&
            'message' in msg
          ) {
            const assistantMsg = msg as { type: 'assistant'; message?: { content?: unknown[] } };
            if (assistantMsg.message && assistantMsg.message.content && Array.isArray(assistantMsg.message.content)) {
              for (const content of assistantMsg.message.content) {
                if (
                  typeof content === 'object' &&
                  content !== null &&
                  'type' in content &&
                  content.type === 'tool_use'
                ) {
                  const toolUse = content as { type: 'tool_use'; name: string; input: unknown };
                  toolCallCount++;

                  // Send progress notification if token is available
                  if (progressToken && typeof progressToken === 'string') {
                    // Format progress message with actual parameter values
                    const progressMessage = `Tool ${toolCallCount}: ${formatProgressMessage(toolUse.name, toolUse.input)}`;

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
                        error('Failed to send progress notification:', err);
                      });
                  }
                }
              }
            }
          }
        }

        const totalDurationMs = Date.now() - startTime;

        // Return completed response
        return {
          status: 'completed',
          prompt,
          agentId,
          content: [
            {
              type: 'text',
              text: result || 'No response from agent.'
            }
          ],
          totalToolUseCount: toolCallCount,
          totalDurationMs,
          totalTokens,
          usage
        };
      } catch (err) {
        const errorMessage = `Agent execution failed: ${(err as Error).message}. Tool calls executed: ${toolCallCount}.`;
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    };

    // Check if background execution is requested
    if (run_in_background) {
      // Launch agent in background
      const executionPromise = executeAgent();

      // Register the background agent
      registerAgent(agentId, executionPromise);

      // Return async_launched response immediately
      return {
        content: [
          {
            type: 'text',
            text: `Agent ${agentId} launched in background\n\nUse the output tool to retrieve results:\n\`\`\`xml\n<invoke name="output">\n<parameter name="agentIds">["${agentId}"]</parameter>\n</invoke>\n\`\`\``
          }
        ]
      };
    } else {
      // Execute synchronously and return completed response
      const completedResponse = await executeAgent();

      // Extract the text content from the response
      // completedResponse is always CompletedResponse for synchronous execution
      if (completedResponse.status !== 'completed') {
        throw new Error('Unexpected response status for synchronous execution');
      }
      const textContent = completedResponse.content.map((c) => c.text).join('\n');

      // Only include resume block if this is not already a resumed conversation
      const resumeBlock = resume
        ? ''
        : `\n\n<resume-conversation>\nUse the \`resume\` parameter with agent ID \`${agentId}\` in your next tool call if the user has follow up questions or you need additional information.\n\n\`\`\`xml\n<parameter name="resume">${agentId}</parameter>\n\`\`\`\n</resume-conversation>`;

      return {
        content: [
          {
            type: 'text',
            text: `${textContent}${resumeBlock}`
          }
        ]
      };
    }
  });

  info('MCP server initialized successfully');

  return { server, tools };
}

/**
 * Main entry point for the wrapper server
 */
export async function main(): Promise<void> {
  try {
    info('MCP wrapper server starting...');

    // Parse CLI arguments
    const configs = parseCliArguments(process.argv);
    info(`Parsed ${configs.length} server configuration(s)`);
    debug('Server configurations:', JSON.stringify(configs, null, 2));

    // Initialize server with tool discovery
    const { server, tools } = await initializeServer(configs);
    info(`Server initialized with ${tools.allTools.length} tools`);

    // Create stdio transport
    const transport = new StdioServerTransport();
    info('Created stdio transport');

    // Connect server to transport
    await server.connect(transport);
    info('MCP wrapper server started successfully');

    // Setup graceful shutdown handlers
    const shutdown = async (signal: string): Promise<void> => {
      info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.close();
        info('Server closed successfully');
        process.exit(0);
      } catch (shutdownError) {
        error('Error during shutdown:', shutdownError);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
  } catch (startupError) {
    error('Failed to start MCP wrapper server:', startupError);
    throw startupError;
  }
}

// Auto-start when invoked directly
// Resolve symlinks to handle npx execution where argv[1] points to npx cache
const resolveFileUrl = async (filePath: string): Promise<string> => {
  try {
    const resolved = await realpath(filePath);
    return `file://${resolved}`;
  } catch {
    return `file://${filePath}`;
  }
};

const currentFileUrl = import.meta.url;
const argvFileUrl = await resolveFileUrl(process.argv[1]);

if (currentFileUrl === argvFileUrl) {
  main().catch((startupError: unknown) => {
    console.error('Fatal error:', startupError);
    process.exit(1);
  });
}
