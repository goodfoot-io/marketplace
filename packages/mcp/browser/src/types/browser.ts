/**
 * Type definitions and validation functions for browser.ts
 * Provides runtime validation to improve type safety
 */

// Export SessionState interface for external consumers
export interface SessionState {
  id: string; // User-provided or generated sessionId
  sdkSessionId?: string; // Claude Code SDK session UUID from messages
  createdAt: Date; // Session creation timestamp
  lastActivity: Date; // Last tool invocation timestamp
  browserContextId?: string; // Browser context from playwright-mcp
  conversationHistory: string[]; // Accumulated prompts and responses
  isFirstQuery: boolean; // Track if this is the first query in session
}

// Execute tool arguments interface
export interface ExecuteToolArguments {
  prompt: string;
  sessionId?: string;
}

// Message content types for better type safety
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  content: unknown;
  is_error?: boolean;
  tool_use_id?: string;
}

export type MessageContent = TextContent | ToolUseContent | ToolResultContent;

// Assistant message structure
export interface AssistantMessage {
  content?: MessageContent[];
}

// User message structure
export interface UserMessage {
  content?: MessageContent[];
}

// SDK message types
export interface SdkResultMessage {
  type: 'result';
  subtype?: 'success' | 'error_max_turns' | 'error_during_execution';
  result?: string;
  session_id?: string;
}

export interface SdkUserMessage {
  type: 'user';
  message?: {
    content?: MessageContent[];
  };
}

export interface SdkAssistantMessage {
  type: 'assistant';
  message?: {
    content?: MessageContent[];
  };
}

export type SdkMessage = SdkResultMessage | SdkUserMessage | SdkAssistantMessage;

// Environment variables type with validation
export interface BrowserEnvironment extends NodeJS.ProcessEnv {
  // Add specific environment variables if needed
  NODE_ENV?: string;
  PATH?: string;
  HOME?: string;
}

/**
 * Type guard to check if a value is a valid ExecuteToolArguments object
 */
export function isExecuteToolArguments(value: unknown): value is ExecuteToolArguments {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Prompt is required and must be a string
  if (typeof obj.prompt !== 'string' || obj.prompt.trim() === '') {
    return false;
  }

  // SessionId is optional but must be a string if present
  if ('sessionId' in obj && typeof obj.sessionId !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validates and narrows the type of execute tool arguments
 * @throws {Error} if validation fails
 */
export function validateExecuteToolArguments(value: unknown): ExecuteToolArguments {
  if (!isExecuteToolArguments(value)) {
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
      `Invalid execute tool arguments. Expected {prompt: string, sessionId?: string}, received: ${received}`
    );
  }
  return value;
}

/**
 * Type guard for TextContent
 */
export function isTextContent(content: unknown): content is TextContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    (content as { type: unknown }).type === 'text' &&
    'text' in content &&
    typeof (content as { text: unknown }).text === 'string'
  );
}

/**
 * Type guard for ToolUseContent
 */
export function isToolUseContent(content: unknown): content is ToolUseContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    (content as { type: unknown }).type === 'tool_use' &&
    'name' in content &&
    typeof (content as { name: unknown }).name === 'string' &&
    'input' in content &&
    typeof (content as { input: unknown }).input === 'object'
  );
}

/**
 * Type guard for ToolResultContent
 */
export function isToolResultContent(content: unknown): content is ToolResultContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    (content as { type: unknown }).type === 'tool_result' &&
    'content' in content
  );
}

/**
 * Type guard for SDK result message
 */
export function isSdkResultMessage(message: unknown): message is SdkResultMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type: unknown }).type === 'result'
  );
}

/**
 * Type guard for SDK user message
 */
export function isSdkUserMessage(message: unknown): message is SdkUserMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type: unknown }).type === 'user'
  );
}

/**
 * Type guard for SDK assistant message
 */
export function isSdkAssistantMessage(message: unknown): message is SdkAssistantMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type: unknown }).type === 'assistant'
  );
}

/**
 * Validates environment variables and returns typed environment
 */
export function validateEnvironment(env: NodeJS.ProcessEnv): BrowserEnvironment {
  // Ensure all values are strings (filter out undefined)
  const validatedEnv: BrowserEnvironment = {};

  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      validatedEnv[key] = value;
    }
  }

  return validatedEnv;
}

/**
 * Safe extraction of environment variables as a Record<string, string>
 * Filters out undefined values that could cause issues
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
