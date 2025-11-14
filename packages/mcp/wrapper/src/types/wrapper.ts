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
  /** Set to true to run this agent in the background. Use the output tool to read the output later. */
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
 * Arguments for output tool
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
 * Validates and narrows the type of output tool arguments
 * @throws {Error} if validation fails
 */
export function validateAgentOutputArguments(value: unknown): AgentOutputArguments {
  const result = AgentOutputArgumentsSchema.safeParse(value);
  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid output tool arguments: ${errorMessages}`);
  }
  return result.data;
}

/**
 * Configuration options for the wrapper server
 * All properties are optional for backward compatibility
 */
export interface WrapperOptions {
  /** Custom system prompt to replace the default */
  systemPrompt?: string;
  /** Additional text to append to the default system prompt */
  appendSystemPrompt?: string;
  /** Path to a file containing the system prompt */
  systemPromptFile?: string;
}

/**
 * Zod schema for WrapperOptions with runtime validation
 */
export const WrapperOptionsSchema = z.object({
  systemPrompt: z.string().optional(),
  appendSystemPrompt: z.string().optional(),
  systemPromptFile: z.string().optional()
});

/**
 * Type guard to check if a value is a valid WrapperOptions object
 */
export function isWrapperOptions(value: unknown): value is WrapperOptions {
  const result = WrapperOptionsSchema.safeParse(value);
  return result.success;
}

/**
 * Validates and narrows the type of wrapper options
 * @throws {Error} if validation fails
 */
export function validateWrapperOptions(value: unknown): WrapperOptions {
  const result = WrapperOptionsSchema.safeParse(value);
  if (!result.success) {
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
      `Invalid wrapper options. Expected {systemPrompt?: string, appendSystemPrompt?: string, systemPromptFile?: string}, received: ${received}`
    );
  }
  return result.data;
}

/**
 * Metadata for a wrapper template
 */
export interface TemplateMetadata {
  /** Template name for identification */
  name: string;
  /** Human-readable description of the template */
  description: string;
  /** Semantic version of the template */
  version: string;
  /** Author or organization name */
  author?: string;
}

/**
 * Zod schema for TemplateMetadata
 */
export const TemplateMetadataSchema = z.object({
  name: z.string().min(1, 'Template name cannot be empty'),
  description: z.string(),
  version: z.string().min(1, 'Template version cannot be empty'),
  author: z.string().optional()
});

/**
 * System prompt configuration options
 * Discriminated union based on type field
 *
 * Note: Environment variable placeholders like ${VARIABLE} in these configurations
 * are resolved by Claude Desktop configuration system BEFORE reaching the wrapper.
 * The wrapper receives already-expanded values.
 */
export type SystemPromptConfig =
  | {
      /** Inline text system prompt */
      type: 'text';
      /** The system prompt content */
      content: string;
    }
  | {
      /** Load system prompt from file */
      type: 'file';
      /** Absolute path to the system prompt file. Relative paths are not supported. */
      path: string;
    }
  | {
      /** Append text to the default system prompt */
      type: 'append';
      /** The text to append to the default system prompt */
      content: string;
    };

/**
 * Zod schema for SystemPromptConfig discriminated union
 */
export const SystemPromptConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    content: z.string()
  }),
  z.object({
    type: z.literal('file'),
    path: z.string().min(1, 'System prompt file path cannot be empty')
  }),
  z.object({
    type: z.literal('append'),
    content: z.string()
  })
]);

/**
 * Complete template configuration for MCP wrapper
 * Combines server configuration with metadata and system prompt options
 *
 * Environment variable placeholders:
 * - Use ${VARIABLE} syntax in any string field (url, command, args, env values, etc.)
 * - These are resolved by Claude Desktop configuration system, NOT by the wrapper
 * - The wrapper receives already-expanded values via getEnvironmentAsRecord()
 * - To include a literal $, use $$
 *
 * Example with placeholders:
 * ```json
 * {
 *   "metadata": { "name": "github-api", "description": "...", "version": "1.0.0" },
 *   "name": "github",
 *   "transport": "http",
 *   "url": "https://api.github.com",
 *   "headers": { "Authorization": "token ${GITHUB_TOKEN}" },
 *   "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
 * }
 * ```
 */
export interface WrapperTemplate {
  /** Template metadata (namespaced to avoid conflicts with ServerConfig) */
  metadata: TemplateMetadata;
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
  /**
   * Environment variables to pass to server
   * Note: ${VARIABLE} placeholders are resolved by Claude Desktop, not the wrapper
   */
  env?: Record<string, string>;
  /** Optional system prompt configuration */
  systemPrompt?: SystemPromptConfig;
}

/**
 * Zod schema for WrapperTemplate with transport-specific validation
 */
export const WrapperTemplateSchema = z
  .object({
    metadata: TemplateMetadataSchema,
    name: z.string().min(1, 'Server name cannot be empty'),
    transport: TransportTypeSchema,
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    headers: z.record(z.string()).optional(),
    env: z.record(z.string()).optional(),
    systemPrompt: SystemPromptConfigSchema.optional()
  })
  .refine(
    (data) => {
      // stdio transport requires command
      if (data.transport === 'stdio') {
        return data.command !== undefined && data.command.length > 0;
      }
      return true;
    },
    {
      message: 'stdio transport requires a command',
      path: ['command']
    }
  )
  .refine(
    (data) => {
      // http transport requires url
      if (data.transport === 'http') {
        return data.url !== undefined && data.url.length > 0;
      }
      return true;
    },
    {
      message: 'http transport requires a url',
      path: ['url']
    }
  );

/**
 * Type guard to check if a value is a valid TemplateMetadata object
 */
export function isTemplateMetadata(value: unknown): value is TemplateMetadata {
  const result = TemplateMetadataSchema.safeParse(value);
  return result.success;
}

/**
 * Validates and narrows the type of template metadata
 * @throws {Error} if validation fails
 */
export function validateTemplateMetadata(value: unknown): TemplateMetadata {
  if (!isTemplateMetadata(value)) {
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
      `Invalid template metadata. Expected {name: string, description: string, version: string, author?: string}, received: ${received}`
    );
  }
  return value;
}

/**
 * Type guard to check if a value is a valid SystemPromptConfig object
 */
export function isSystemPromptConfig(value: unknown): value is SystemPromptConfig {
  const result = SystemPromptConfigSchema.safeParse(value);
  return result.success;
}

/**
 * Validates and narrows the type of system prompt config
 * @throws {Error} if validation fails
 */
export function validateSystemPromptConfig(value: unknown): SystemPromptConfig {
  if (!isSystemPromptConfig(value)) {
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
      `Invalid system prompt config. Expected {type: 'text'|'file'|'append', ...}, received: ${received}`
    );
  }
  return value;
}

/**
 * Type guard to check if a value is a valid WrapperTemplate object
 */
export function isWrapperTemplate(value: unknown): value is WrapperTemplate {
  const result = WrapperTemplateSchema.safeParse(value);
  return result.success;
}

/**
 * Validates and narrows the type of wrapper template
 * @throws {Error} if validation fails
 */
export function validateWrapperTemplate(value: unknown): WrapperTemplate {
  const result = WrapperTemplateSchema.safeParse(value);
  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid wrapper template: ${errorMessages}`);
  }
  return result.data;
}

/**
 * Converts a WrapperTemplate to ServerConfig
 * Extracts only the server configuration fields, omitting metadata and system prompt
 *
 * Note: This utility is designed for future CLI integration (out of current scope).
 * It does NOT perform ${VARIABLE} substitution - that's handled upstream by Claude Desktop.
 *
 * @param template - The wrapper template to convert
 * @returns ServerConfig compatible with existing wrapper infrastructure
 */
export function templateToServerConfig(template: WrapperTemplate): ServerConfig {
  const config: ServerConfig = {
    name: template.name,
    transport: template.transport
  };

  if (template.command !== undefined) {
    config.command = template.command;
  }

  if (template.args !== undefined) {
    config.args = template.args;
  }

  if (template.url !== undefined) {
    config.url = template.url;
  }

  if (template.headers !== undefined) {
    config.headers = template.headers;
  }

  if (template.env !== undefined) {
    config.env = template.env;
  }

  return config;
}

/**
 * Resolves SystemPromptConfig to WrapperOptions format
 * Converts the template's system prompt configuration to the format expected by the wrapper
 *
 * Note: This utility is designed for future CLI integration (out of current scope).
 * For 'file' type, this function does NOT load the file content - that's handled by
 * loadSystemPromptFromFile() in wrapper.ts. It only converts the configuration structure.
 *
 * @param config - The system prompt configuration from template
 * @returns WrapperOptions compatible with existing wrapper infrastructure
 */
export function resolveSystemPrompt(config: SystemPromptConfig): WrapperOptions {
  switch (config.type) {
    case 'text':
      return { systemPrompt: config.content };
    case 'file':
      return { systemPromptFile: config.path };
    case 'append':
      return { appendSystemPrompt: config.content };
  }
}
