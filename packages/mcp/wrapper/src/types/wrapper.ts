/**
 * Type definitions and validation functions for MCP wrapper server
 * Provides runtime validation to improve type safety
 */

import { z } from 'zod';

/**
 * Transport type for MCP server connections
 */
export type TransportType = 'stdio' | 'http';

/**
 * Zod schema for TransportType
 */
export const TransportTypeSchema = z.enum(['stdio', 'http']);

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
  /** HTTP headers for HTTP transport */
  headers?: Record<string, string>;
  /** Environment variables to pass to server */
  env?: Record<string, string>;
}

/**
 * Zod schema for ServerConfig with runtime validation
 */
export const ServerConfigSchema = z.object({
  name: z.string().min(1, 'Server name cannot be empty'),
  transport: TransportTypeSchema,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  env: z.record(z.string()).optional()
});

/**
 * Tool schema for discovered tools
 */
export const ToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown())
});

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
 * Zod schema for AggregatedTools
 */
export const AggregatedToolsSchema = z.object({
  allTools: z.array(
    z.object({
      serverName: z.string(),
      tool: ToolSchema
    })
  ),
  allowedTools: z.array(z.string()),
  description: z.string()
});

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

/**
 * Zod schema for CachedToolDescription
 */
export const CachedToolDescriptionSchema = z.object({
  version: z.string(),
  configHash: z.string(),
  timestamp: z.number(),
  allTools: z.array(
    z.object({
      serverName: z.string(),
      tool: ToolSchema
    })
  ),
  allowedTools: z.array(z.string()),
  description: z.string()
});

/**
 * Type guard to check if a value is a valid ServerConfig object
 */
export function isServerConfig(value: unknown): value is ServerConfig {
  const result = ServerConfigSchema.safeParse(value);
  return result.success;
}

/**
 * Validates and narrows the type of server configuration
 * @throws {Error} if validation fails
 */
export function validateServerConfig(value: unknown): ServerConfig {
  if (!isServerConfig(value)) {
    let received: string;
    if (value === null) {
      received = 'null';
    } else if (value === undefined) {
      received = 'undefined';
    } else if (typeof value === 'object') {
      try {
        received = JSON.stringify(value);
      } catch {
        received = '[object with circular reference]';
      }
    } else if (typeof value === 'string') {
      received = `"${value}"`;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      received = String(value);
    } else {
      received = typeof value;
    }
    throw new Error(
      `Invalid server configuration. Expected {name: string, transport: 'stdio'|'http', ...}, received: ${received}`
    );
  }
  return value;
}

/**
 * Type guard to check if a value is a valid AggregatedTools object
 */
export function isAggregatedTools(value: unknown): value is AggregatedTools {
  const result = AggregatedToolsSchema.safeParse(value);
  return result.success;
}

/**
 * Validates and narrows the type of aggregated tools
 * @throws {Error} if validation fails
 */
export function validateAggregatedTools(value: unknown): AggregatedTools {
  if (!isAggregatedTools(value)) {
    let received: string;
    if (value === null) {
      received = 'null';
    } else if (value === undefined) {
      received = 'undefined';
    } else if (typeof value === 'object') {
      try {
        received = JSON.stringify(value);
      } catch {
        received = '[object with circular reference]';
      }
    } else {
      received = typeof value;
    }
    throw new Error(
      `Invalid aggregated tools. Expected {allTools: Array, allowedTools: string[], description: string}, received: ${received}`
    );
  }
  return value;
}

/**
 * Type guard to check if a value is a valid CachedToolDescription object
 */
export function isCachedToolDescription(value: unknown): value is CachedToolDescription {
  const result = CachedToolDescriptionSchema.safeParse(value);
  return result.success;
}

/**
 * Validates and narrows the type of cached tool description
 * @throws {Error} if validation fails
 */
export function validateCachedToolDescription(value: unknown): CachedToolDescription {
  if (!isCachedToolDescription(value)) {
    let received: string;
    if (value === null) {
      received = 'null';
    } else if (value === undefined) {
      received = 'undefined';
    } else if (typeof value === 'object') {
      try {
        received = JSON.stringify(value);
      } catch {
        received = '[object with circular reference]';
      }
    } else {
      received = typeof value;
    }
    throw new Error(
      `Invalid cached tool description. Expected {version: string, configHash: string, timestamp: number, ...}, received: ${received}`
    );
  }
  return value;
}

/**
 * Safe extraction of environment variables as a Record<string, string>
 * Filters out undefined values that could cause issues with MCP SDK
 */
export function getEnvironmentAsRecord(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Arguments for agent tool execution
 */
export interface AgentToolArguments {
  /** The task for the agent to perform */
  prompt: string;
  /** Optional model to use for this agent. If not specified, inherits from parent. Prefer haiku for quick, straightforward tasks to minimize cost and latency. */
  model?: 'sonnet' | 'opus' | 'haiku';
  /**
   * Optional session ID to resume from. If provided, the agent will continue from the previous execution.
   *
   * The session ID is returned in the response text in the format:
   * ```
   * Session ID: <session_id>
   *
   * ---
   *
   * <result text>
   * ```
   *
   * To resume a conversation, extract the session ID from a previous response and pass it here.
   */
  resume?: string;
  /** Set to true to run this agent in the background. Use AgentOutputTool to read the output later. */
  run_in_background?: boolean;
}

/**
 * Zod schema for AgentToolArguments with runtime validation
 */
export const AgentToolArgumentsSchema = z.object({
  prompt: z.string().min(1, 'prompt cannot be empty'),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
  resume: z.string().optional(),
  run_in_background: z.boolean().optional()
});

/**
 * Validates and narrows the type of agent tool arguments
 * @throws {Error} if validation fails
 */
export function validateAgentToolArguments(value: unknown): AgentToolArguments {
  const result = AgentToolArgumentsSchema.safeParse(value);
  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid agent tool arguments: ${errorMessages}`);
  }
  return result.data;
}

/**
 * Response when agent execution is launched asynchronously
 */
export interface AsyncLaunchedResponse {
  /** Response status indicating async launch */
  status: 'async_launched';
  /** Unique identifier for the agent execution */
  agentId: string;
  /** Description of the agent task */
  description: string;
  /** The task prompt for the agent */
  prompt: string;
}

/**
 * Zod schema for AsyncLaunchedResponse
 */
export const AsyncLaunchedResponseSchema = z.object({
  status: z.literal('async_launched'),
  agentId: z.string().min(1, 'agentId cannot be empty'),
  description: z.string(),
  prompt: z.string().min(1, 'prompt cannot be empty')
});

/**
 * Response when agent execution is completed
 */
export interface CompletedResponse {
  /** Response status indicating completion */
  status: 'completed';
  /** The original task prompt */
  prompt: string;
  /** Unique identifier for the agent execution */
  agentId: string;
  /** Response content from the agent */
  content: Array<{ type: 'text'; text: string }>;
  /** Total number of tool uses during execution */
  totalToolUseCount: number;
  /** Total duration of execution in milliseconds */
  totalDurationMs: number;
  /** Total tokens used during execution */
  totalTokens: number;
  /** Detailed usage statistics */
  usage: Record<string, unknown>;
}

/**
 * Zod schema for CompletedResponse
 */
export const CompletedResponseSchema = z.object({
  status: z.literal('completed'),
  prompt: z.string().min(1, 'prompt cannot be empty'),
  agentId: z.string().min(1, 'agentId cannot be empty'),
  content: z.array(
    z.object({
      type: z.literal('text'),
      text: z.string()
    })
  ),
  totalToolUseCount: z.number().min(0, 'totalToolUseCount must be non-negative'),
  totalDurationMs: z.number().min(0, 'totalDurationMs must be non-negative'),
  totalTokens: z.number().min(0, 'totalTokens must be non-negative'),
  usage: z.record(z.unknown())
});

/**
 * Discriminated union of possible agent tool responses
 * Use the status field to discriminate between response types
 */
export type AgentToolResponse = AsyncLaunchedResponse | CompletedResponse;

/**
 * Zod schema for AgentToolResponse discriminated union
 */
export const AgentToolResponseSchema = z.discriminatedUnion('status', [
  AsyncLaunchedResponseSchema,
  CompletedResponseSchema
]);

/**
 * Type guard to check if a value is a valid AgentToolResponse
 */
export function isAgentToolResponse(value: unknown): value is AgentToolResponse {
  const result = AgentToolResponseSchema.safeParse(value);
  return result.success;
}

/**
 * Validates and narrows the type of agent tool response
 * @throws {Error} if validation fails
 */
export function validateAgentToolResponse(value: unknown): AgentToolResponse {
  if (!isAgentToolResponse(value)) {
    let received: string;
    if (value === null) {
      received = 'null';
    } else if (value === undefined) {
      received = 'undefined';
    } else if (typeof value === 'object') {
      try {
        received = JSON.stringify(value);
      } catch {
        received = '[object with circular reference]';
      }
    } else {
      received = typeof value;
    }
    throw new Error(
      `Invalid agent tool response. Expected {status: 'async_launched' | 'completed', ...}, received: ${received}`
    );
  }
  return value;
}

/**
 * Arguments for agent-output tool
 */
export interface AgentOutputArguments {
  /** Array of agent IDs to retrieve results for */
  agentIds: string[];
  /** Whether to block until results are ready */
  block?: boolean;
  /** Maximum time to wait in seconds */
  wait_up_to?: number;
}

/**
 * Zod schema for AgentOutputArguments with runtime validation
 */
export const AgentOutputArgumentsSchema = z.object({
  agentIds: z.array(z.string()),
  block: z.boolean().optional().default(true),
  wait_up_to: z.number().min(0).max(300).optional().default(150)
});

/**
 * Validates and narrows the type of agent-output arguments
 * @throws {Error} if validation fails
 */
export function validateAgentOutputArguments(value: unknown): AgentOutputArguments {
  const result = AgentOutputArgumentsSchema.safeParse(value);
  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid agent-output arguments: ${errorMessages}`);
  }
  return result.data;
}
