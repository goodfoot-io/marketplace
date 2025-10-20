#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import yaml from 'js-yaml';

const server = new Server(
  {
    name: 'test-agent-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Interface for YAML front matter
interface FrontMatter {
  name?: string;
  description?: string;
  tools?: string;
  model?: string;
}

// Helper function to parse YAML front matter from markdown content
function parseFrontMatter(content: string): { frontMatter: FrontMatter | null; content: string } {
  // Check if content starts with YAML front matter
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontMatterRegex);

  if (match) {
    try {
      const frontMatter = yaml.load(match[1]) as FrontMatter;
      const contentWithoutFrontMatter = content.slice(match[0].length);
      return { frontMatter, content: contentWithoutFrontMatter };
    } catch (error) {
      // If YAML parsing fails, treat entire content as system instructions
      console.error('Failed to parse YAML front matter:', error);
      return { frontMatter: null, content };
    }
  }

  // No front matter found
  return { frontMatter: null, content };
}

// Helper function to format tool inputs in a clean, readable way
function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      // For multiline strings, use backtick quotes
      if (value.includes('\n')) {
        lines.push(
          `  ${key}=\`\n${value
            .split('\n')
            .map((line) => '    ' + line)
            .join('\n')}\n  \``
        );
      } else {
        lines.push(`  ${key}="${value}"`);
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`  ${key}=${JSON.stringify(value)}`);
    } else {
      lines.push(`  ${key}=${String(value)}`);
    }
  }

  return lines.join(',\n');
}

async function logAgentExecution(
  systemInstructionsFile: string | undefined,
  description: string,
  prompt: string,
  transcript: string[]
): Promise<string> {
  const logDir = path.join('/workspace', 'reports', '.test-agent-logs');

  // Ensure the directory exists
  await fs.mkdir(logDir, { recursive: true });

  // Create filename with current datetime
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -1);
  const filename = `${timestamp}.md`;
  const filepath = path.join(logDir, filename);

  // Format the content with clear separators (similar to codebase server)
  const formattedPrompt = prompt
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

  const systemInstructionsSection = systemInstructionsFile
    ? `### System Instructions
\`${systemInstructionsFile}\`

`
    : `### System Instructions
_Using default system instructions_

`;

  const content = `## Task: ${description}

${systemInstructionsSection}### Prompt
${formattedPrompt}

---

${transcript.join('\n\n')}`;

  // Write to file
  await fs.writeFile(filepath, content, 'utf-8');

  // Return the filepath for inclusion in the response
  return filepath;
}

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'task',
      description:
        'Launch a new agent to handle complex, multi-step tasks autonomously. ' +
        'The agent runs with custom system instructions loaded from a specified file.',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'A short (3-5 word) description of the task'
          },
          prompt: {
            type: 'string',
            description: 'The task for the agent to perform'
          },
          system_instructions_file: {
            type: 'string',
            description:
              'Absolute path to a markdown file containing system instructions that define ' +
              "the agent's behavior, capabilities, and approach. If not provided, the agent will use " +
              'the `general-purpose` agent type.'
          }
        },
        required: ['description', 'prompt']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request, meta) => {
  console.error('[DEBUG] ========================================');
  console.error('[DEBUG] CallToolRequestSchema handler invoked');
  console.error('[DEBUG] Tool name:', request.params.name);
  console.error('[DEBUG] Request ID:', 'id' in request ? request.id : 'N/A');

  if (request.params.name !== 'task') {
    console.error('[DEBUG] Unknown tool requested:', request.params.name);
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }

  const { description, prompt, system_instructions_file } = request.params.arguments as {
    description: string;
    prompt: string;
    system_instructions_file?: string;
  };

  console.error('[DEBUG] Arguments received:', {
    hasDescription: !!description,
    hasPrompt: !!prompt,
    hasSystemInstructions: !!system_instructions_file
  });

  if (!description) {
    console.error('[DEBUG] Missing required parameter: description');
    throw new McpError(ErrorCode.InvalidParams, 'description is required');
  }

  if (!prompt) {
    console.error('[DEBUG] Missing required parameter: prompt');
    throw new McpError(ErrorCode.InvalidParams, 'prompt is required');
  }

  // Handle system instructions - either from file or use default
  let customSystemPrompt: string | undefined;
  let frontMatter: FrontMatter | null = null;

  if (system_instructions_file) {
    // Validate that the file path is absolute
    if (!path.isAbsolute(system_instructions_file)) {
      throw new McpError(ErrorCode.InvalidParams, 'system_instructions_file must be an absolute path');
    }

    // Read the system instructions file
    try {
      const fileContent = await fs.readFile(system_instructions_file, 'utf-8');
      // Parse YAML front matter if present
      const parsed = parseFrontMatter(fileContent);
      frontMatter = parsed.frontMatter;
      customSystemPrompt = parsed.content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new McpError(ErrorCode.InvalidParams, `System instructions file not found: ${system_instructions_file}`);
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read system instructions file: ${(error as Error).message}`
      );
    }
  }
  // If no system_instructions_file provided, customSystemPrompt remains undefined
  // and the agent will use default system instructions

  // Create an AbortController for this request
  const abortController = new AbortController();

  // Check if meta provides any cancellation signal
  if (meta && typeof meta === 'object' && 'signal' in meta && meta.signal instanceof AbortSignal) {
    meta.signal.addEventListener('abort', () => {
      abortController.abort();
    });
  }

  try {
    console.error('[DEBUG] Starting test-agent execution');
    console.error('[DEBUG] Description:', description);
    console.error('[DEBUG] Prompt length:', prompt.length);
    console.error('[DEBUG] System instructions file:', system_instructions_file || 'none');
    console.error('[DEBUG] Has custom system prompt:', !!customSystemPrompt);
    console.error('[DEBUG] Front matter:', frontMatter);

    let result = '';
    const transcript: string[] = [];

    // Execute the query using Claude Code SDK with optional custom system instructions
    const queryOptions: Parameters<typeof query>[0]['options'] = {
      maxTurns: 100,
      includePartialMessages: true,
      abortController,
      permissionMode: 'bypassPermissions'
    };

    console.error('[DEBUG] Base query options configured:', {
      maxTurns: queryOptions.maxTurns,
      includePartialMessages: queryOptions.includePartialMessages,
      permissionMode: queryOptions.permissionMode
    });

    // Only add systemPrompt if provided
    if (customSystemPrompt) {
      queryOptions.systemPrompt = customSystemPrompt;
    }

    // Apply front matter settings if present
    if (frontMatter) {
      // Apply model if specified (ignore "inherit" to use default)
      if (frontMatter.model && frontMatter.model !== 'inherit') {
        queryOptions.model = frontMatter.model;
      }

      // Apply tools restrictions if specified
      if (frontMatter.tools) {
        // Parse tools list (comma-separated)
        const toolsList = frontMatter.tools
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, '')) // Strip quotation marks from start/end
          .filter((t) => t.length > 0);

        if (toolsList.includes('*')) {
          // "*" means all tools are allowed
          // Don't set allowedTools or disallowedTools - use default behavior
          // But still prevent recursive calls
          queryOptions.disallowedTools = ['Task', 'mcp__test-agent__task'];
        } else if (toolsList.length > 0) {
          // Specific tools are allowed
          queryOptions.allowedTools = toolsList;
          // Also ensure Task and mcp__test-agent__task are never allowed to prevent recursion
          // unless explicitly specified
          if (!toolsList.includes('Task') && !toolsList.includes('mcp__test-agent__task')) {
            // The allowedTools list already restricts to only the specified tools
            // No need to also set disallowedTools
          }
        }
      } else {
        // No tools specified in front matter, use default behavior
        // Prevent recursive calls and Task tool usage (like subagents)
        queryOptions.disallowedTools = ['Task', 'mcp__test-agent__task'];
      }
    } else {
      // No front matter, use default behavior
      // Prevent recursive calls and Task tool usage (like subagents)
      queryOptions.disallowedTools = ['Task', 'mcp__test-agent__task'];
    }

    console.error('[DEBUG] Final query options:', queryOptions);

    console.error('[DEBUG] About to call query() with prompt');

    let messageCount = 0;
    for await (const message of query({
      prompt,
      options: queryOptions
    })) {
      messageCount++;
      console.error(`[DEBUG] Received message #${messageCount}:`, {
        type: message.type,
        subtype: 'subtype' in message ? message.subtype : undefined
      });

      // Check if the operation was aborted
      if (abortController.signal.aborted) {
        console.error('[DEBUG] Operation aborted');
        throw new Error('Operation was aborted');
      }

      if (message.type === 'result' && message.subtype === 'success') {
        console.error('[DEBUG] Success result received, result length:', message.result?.length || 0);
        result = message.result;
      } else if (
        message.type === 'result' &&
        (message.subtype === 'error_max_turns' || message.subtype === 'error_during_execution')
      ) {
        console.error('[DEBUG] Error result received:', message.subtype);
        throw new Error(`Agent error: ${message.subtype}`);
      } else if (message.type === 'user') {
        // Handle tool results that come back as user messages
        if ('message' in message && message.message && typeof message.message === 'object') {
          const msg = message.message as {
            content?: Array<{
              type: string;
              content?: unknown;
              is_error?: boolean;
              tool_use_id?: string;
            }>;
          };
          if (msg.content && Array.isArray(msg.content)) {
            for (const content of msg.content) {
              if (content.type === 'tool_result') {
                // Log tool response
                if (content.is_error) {
                  transcript.push(`\`\`\`tool-response-error\n${String(content.content)}\n\`\`\``);
                } else {
                  const responseContent =
                    typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2);
                  // Clean up system reminders from tool responses if present
                  const cleanedContent = responseContent
                    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
                    .trim();
                  transcript.push(`\`\`\`tool-response\n${cleanedContent}\n\`\`\``);
                }
              }
            }
          }
        }
      } else if (message.type === 'assistant') {
        // Log assistant messages as plain text content
        if ('message' in message && message.message && typeof message.message === 'object') {
          const msg = message.message as {
            content?: Array<{
              type: string;
              text?: string;
              name?: string;
              input?: unknown;
              content?: unknown;
              is_error?: boolean;
            }>;
          };
          if (msg.content && Array.isArray(msg.content)) {
            for (const content of msg.content) {
              if (content.type === 'text' && content.text) {
                transcript.push(content.text);
              } else if (content.type === 'tool_use' && content.name) {
                // Log tool usage in a clean format
                const input = content.input as Record<string, unknown>;
                const formattedInput = formatToolInput(content.name, input);
                transcript.push(`\`\`\`tool-call\n${content.name}(\n${formattedInput}\n)\n\`\`\``);
              } else if (content.type === 'tool_result') {
                // Log tool response
                if (content.is_error) {
                  transcript.push(`\`\`\`tool-response-error\n${String(content.content)}\n\`\`\``);
                } else {
                  const responseContent =
                    typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2);
                  transcript.push(`\`\`\`tool-response\n${responseContent}\n\`\`\``);
                }
              }
            }
          }
        }
      } else if (message.type === 'stream_event') {
        // Process stream events to capture tool calls and responses
        const eventObj = message as SDKMessage;
        if ('event' in eventObj && eventObj.event && typeof eventObj.event === 'object') {
          const event = eventObj.event as {
            type?: string;
            tool_use?: { name?: string; input?: unknown; id?: string };
            content_block?: {
              type?: string;
              text?: string;
              content?: unknown;
              is_error?: boolean;
              name?: string;
              input?: unknown;
              id?: string;
              tool_use_id?: string;
            };
            index?: number;
          };

          // Handle tool calls
          if (event.type === 'tool_use' && event.tool_use && event.tool_use.name) {
            const input = event.tool_use.input as Record<string, unknown>;
            const formattedInput = formatToolInput(event.tool_use.name, input);
            transcript.push(`\`\`\`tool-call\n${event.tool_use.name}(\n${formattedInput}\n)\n\`\`\``);
          } else if (event.type === 'content_block_stop' && event.content_block) {
            const block = event.content_block;
            // Check if this is a tool_use block being completed
            if (block.type === 'tool_use' && block.name && block.input) {
              const input = block.input as Record<string, unknown>;
              const formattedInput = formatToolInput(block.name, input);
              transcript.push(`\`\`\`tool-call\n${block.name}(\n${formattedInput}\n)\n\`\`\``);
            } else if (block.type === 'tool_result') {
              // Log tool response
              if (block.is_error) {
                transcript.push(`\`\`\`tool-response-error\n${String(block.content)}\n\`\`\``);
              } else {
                const responseContent =
                  typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2);
                transcript.push(`\`\`\`tool-response\n${responseContent}\n\`\`\``);
              }
            }
          }
        }
      }
    }

    console.error('[DEBUG] Query loop completed');
    console.error('[DEBUG] Total messages received:', messageCount);
    console.error('[DEBUG] Result obtained:', !!result);
    console.error('[DEBUG] Result length:', result?.length || 0);
    console.error('[DEBUG] Transcript entries:', transcript.length);

    // Use fallback if no result obtained (instead of throwing error)
    const finalResult = result || 'No result obtained from agent (query completed without response)';

    console.error('[DEBUG] Final result:', finalResult.substring(0, 100) + (finalResult.length > 100 ? '...' : ''));

    // Log the complete execution with transcript
    const logFilePath = await logAgentExecution(system_instructions_file, description, prompt, transcript);

    console.error('[DEBUG] Log file created:', logFilePath);

    // Include log file location in the response
    const resultWithLogInfo = `${finalResult}\n\n---\n📄 Execution log: ${logFilePath}`;

    console.error('[DEBUG] Returning response to MCP client');

    return {
      content: [
        {
          type: 'text',
          text: resultWithLogInfo
        }
      ]
    };
  } catch (error) {
    console.error('[DEBUG] Exception caught in test-agent');
    console.error('[DEBUG] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[DEBUG] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[DEBUG] Error stack:', error instanceof Error ? error.stack : 'N/A');

    // Handle abort errors specifically
    if (error instanceof Error) {
      if (error.message === 'Operation was aborted' || error.name === 'AbortError') {
        // Log the abort for debugging
        console.error('[Agent Tool] Query aborted by client');
        throw new McpError(ErrorCode.InternalError, 'Request was cancelled by client');
      }
      console.error('[DEBUG] Throwing McpError with message:', error.message);
      throw new McpError(ErrorCode.InternalError, `Agent execution failed: ${error.message}`);
    }
    console.error('[DEBUG] Throwing McpError for unknown error');
    throw new McpError(ErrorCode.InternalError, 'Agent execution failed: Unknown error');
  }
});

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

// Start the server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
