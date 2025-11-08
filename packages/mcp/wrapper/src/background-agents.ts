/**
 * Background agent tracking system
 * Provides in-memory storage and status checking for background agent execution promises
 */

import type { AgentToolResponse } from './types/wrapper.js';
import { loadTranscript, type TranscriptMessage } from './transcript-store.js';

/**
 * Response structure for completed agents
 */
export interface CompletedResponse {
  sessionId: string;
  output: string;
  status: 'completed' | 'failed';
}

/**
 * Agent status types
 */
export type AgentStatus = 'running' | 'completed' | 'failed' | 'not_found';

/**
 * In-memory storage for background agent promises
 * Map<agentId, Promise<AgentToolResponse | CompletedResponse>>
 */
const agentRegistry = new Map<string, Promise<AgentToolResponse | CompletedResponse>>();

/**
 * Register a background agent with its execution promise
 * Stores the promise in memory for status checking and result retrieval
 *
 * @param agentId - The unique agent identifier
 * @param promise - The promise representing the agent's execution
 */
export function registerAgent(agentId: string, promise: Promise<AgentToolResponse | CompletedResponse>): void {
  agentRegistry.set(agentId, promise);
}

/**
 * Get the status of a background agent
 * Uses Promise.race() to check promise state without blocking
 *
 * @param agentId - The agent identifier
 * @returns Promise resolving to agent status
 */
export async function getAgentStatus(agentId: string): Promise<AgentStatus> {
  const promise = agentRegistry.get(agentId);

  if (!promise) {
    return 'not_found';
  }

  // Use Promise.race to check if promise has settled without blocking
  // If the promise is still pending, the immediate rejection will win
  try {
    await Promise.race([promise, Promise.reject(new Error('PROMISE_PENDING'))]);

    // If we reach here, the promise resolved successfully
    return 'completed';
  } catch (error) {
    // Check if this is our sentinel error (promise still pending)
    if (error instanceof Error && error.message === 'PROMISE_PENDING') {
      return 'running';
    }

    // Otherwise, the original promise rejected
    return 'failed';
  }
}

/**
 * Get the result of a background agent
 * First checks in-memory cache, then falls back to loading transcript from disk
 *
 * @param agentId - The agent identifier
 * @param workspacePath - Optional workspace path for transcript location
 * @returns Promise resolving to AgentToolResponse or CompletedResponse or null if not available
 */
export async function getAgentResult(
  agentId: string,
  workspacePath?: string
): Promise<AgentToolResponse | CompletedResponse | null> {
  const promise = agentRegistry.get(agentId);

  // Try to get result from memory first
  if (promise) {
    const status = await getAgentStatus(agentId);

    // Only return result if promise has completed successfully
    if (status === 'completed') {
      try {
        return await promise;
      } catch {
        // Promise rejected, fall through to disk fallback
      }
    }

    // Promise still running or failed
    if (status === 'running' || status === 'failed') {
      return null;
    }
  }

  // Fall back to loading from disk (historical agent)
  return await loadResultFromTranscript(agentId, workspacePath);
}

/**
 * Load agent result from transcript file on disk
 * Constructs CompletedResponse from transcript messages
 *
 * @param agentId - The agent identifier
 * @param workspacePath - Optional workspace path for transcript location
 * @returns Promise resolving to CompletedResponse or null if not found
 */
async function loadResultFromTranscript(agentId: string, workspacePath?: string): Promise<CompletedResponse | null> {
  try {
    const messages = await loadTranscript(agentId, workspacePath);

    if (messages.length === 0) {
      return null;
    }

    // Extract session ID from any message (they should all have the same session_id)
    const sessionId = messages[0].session_id;

    // Combine all messages into output, with result messages having highest priority
    const resultMessages = messages.filter((m: TranscriptMessage) => m.type === 'result');
    const allContent = messages.map((m: TranscriptMessage) => m.content).join('\n');

    // If we have result messages, use the last one as primary output
    const output = resultMessages.length > 0 ? resultMessages[resultMessages.length - 1].content : allContent;

    return {
      sessionId,
      output,
      status: 'completed'
    };
  } catch {
    // Error loading transcript
    return null;
  }
}

/**
 * Clear all registered agents from memory
 * Used for testing and cleanup
 */
export function clearAgents(): void {
  agentRegistry.clear();
}
