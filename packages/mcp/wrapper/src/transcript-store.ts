/**
 * Transcript store - JSONL file storage for agent messages
 */

import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getTranscriptPath } from './agent-id.js';
import { info, warn, error as logError } from './logger.js';

/**
 * Message type for transcript entries
 */
export interface TranscriptMessage {
  type: 'user' | 'assistant' | 'result';
  content: string;
  timestamp: string;
  session_id: string;
}

/**
 * Write a message to the agent's transcript file
 * Appends JSON line atomically using fs/promises appendFile
 * Creates directory structure with mkdir recursive: true if missing
 * Handles write errors gracefully without failing
 *
 * @param agentId - The agent ID
 * @param message - The message to write
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 */
export async function writeTranscriptMessage(
  agentId: string,
  message: TranscriptMessage,
  workspacePath?: string
): Promise<void> {
  try {
    const transcriptPath = getTranscriptPath(agentId, workspacePath);
    const transcriptDir = dirname(transcriptPath);

    // Ensure directory exists
    await mkdir(transcriptDir, { recursive: true });

    // Serialize message to JSON and append with newline
    const line = JSON.stringify(message) + '\n';

    // Atomic append operation
    await appendFile(transcriptPath, line, 'utf-8');

    info(`Wrote message to transcript: ${transcriptPath}`);
  } catch (err) {
    // Handle errors gracefully without failing
    logError(`Failed to write transcript message for agent ${agentId}:`, err);
  }
}

/**
 * Load all messages from an agent's transcript file
 * Returns array of messages
 * Skips malformed lines with warnings
 * Handles missing files gracefully
 *
 * @param agentId - The agent ID
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 * @returns Array of transcript messages
 */
export async function loadTranscript(agentId: string, workspacePath?: string): Promise<TranscriptMessage[]> {
  try {
    const transcriptPath = getTranscriptPath(agentId, workspacePath);

    // Read file content
    const content = await readFile(transcriptPath, 'utf-8');

    // Parse JSONL - one JSON object per line
    const messages: TranscriptMessage[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) {
        continue;
      }

      try {
        const message = JSON.parse(line) as TranscriptMessage;
        messages.push(message);
      } catch {
        // Skip malformed lines with warning
        warn(`Skipping malformed transcript line for agent ${agentId}:`, line);
      }
    }

    info(`Loaded ${messages.length} messages from transcript: ${transcriptPath}`);
    return messages;
  } catch (err) {
    // Handle missing files gracefully
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      info(`No transcript file found for agent ${agentId}, returning empty array`);
      return [];
    }

    // Log other errors but still return empty array
    logError(`Failed to load transcript for agent ${agentId}:`, err);
    return [];
  }
}
