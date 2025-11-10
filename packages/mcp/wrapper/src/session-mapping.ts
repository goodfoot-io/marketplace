/**
 * Session mapping storage - Maps agent IDs to SDK session IDs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getClaudeConfigDir, getWorkspaceName } from './agent-id.js';
import { info, warn, error as logError } from './logger.js';

/**
 * Simple in-memory lock manager for concurrent file access
 */
const locks = new Map<string, Promise<void>>();

/**
 * Execute a function with exclusive lock on a file path
 * @param key - Lock key (file path)
 * @param fn - Function to execute with lock
 * @returns Result of the function
 */
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any existing lock on this key
  while (locks.has(key)) {
    await locks.get(key);
  }

  // Create a new lock
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  locks.set(key, lockPromise);

  try {
    // Execute the function
    return await fn();
  } finally {
    // Release the lock
    locks.delete(key);
    releaseLock!();
  }
}

/**
 * Session mappings stored as a record
 */
interface SessionMappings {
  [agentId: string]: string;
}

/**
 * Get the path to the session mappings file for a workspace
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 * @returns Full absolute path to the session mappings file
 */
function getSessionMappingsPath(workspacePath?: string): string {
  const claudeConfigDir = getClaudeConfigDir();
  const workspaceName = getWorkspaceName(workspacePath);
  return join(claudeConfigDir, 'mcp-wrapper-server', workspaceName, 'session-mappings.json');
}

/**
 * Load all session mappings from file
 * Returns empty object if file doesn't exist or is invalid
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 * @returns Session mappings object
 */
async function loadMappings(workspacePath?: string): Promise<SessionMappings> {
  try {
    const mappingsPath = getSessionMappingsPath(workspacePath);
    const content = await readFile(mappingsPath, 'utf-8');

    try {
      const mappings = JSON.parse(content) as SessionMappings;
      info(`Loaded session mappings from: ${mappingsPath}`);
      return mappings;
    } catch {
      warn(`Invalid JSON in session mappings file: ${mappingsPath}, returning empty mappings`);
      return {};
    }
  } catch (err) {
    // Handle missing file gracefully
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      info(`No session mappings file found, returning empty mappings`);
      return {};
    }

    // Log other errors but still return empty object
    logError(`Failed to load session mappings:`, err);
    return {};
  }
}

/**
 * Save all session mappings to file
 * Creates directory structure if missing
 * @param mappings - Session mappings object to save
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 */
async function saveMappings(mappings: SessionMappings, workspacePath?: string): Promise<void> {
  try {
    const mappingsPath = getSessionMappingsPath(workspacePath);
    const mappingsDir = dirname(mappingsPath);

    // Ensure directory exists
    await mkdir(mappingsDir, { recursive: true });

    // Serialize to JSON with pretty formatting
    const content = JSON.stringify(mappings, null, 2);

    // Write atomically
    await writeFile(mappingsPath, content, 'utf-8');

    info(`Saved session mappings to: ${mappingsPath}`);
  } catch (err) {
    logError(`Failed to save session mappings:`, err);
    throw err;
  }
}

/**
 * Save the mapping between an agent ID and session ID
 * @param agentId - The wrapper's agent identifier
 * @param sessionId - The SDK's session identifier
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 */
export async function saveSessionMapping(agentId: string, sessionId: string, workspacePath?: string): Promise<void> {
  const mappingsPath = getSessionMappingsPath(workspacePath);

  await withLock(mappingsPath, async () => {
    // Load existing mappings
    const mappings = await loadMappings(workspacePath);

    // Update mapping
    mappings[agentId] = sessionId;

    // Save back to file
    await saveMappings(mappings, workspacePath);

    info(`Saved session mapping: ${agentId} -> ${sessionId}`);
  });
}

/**
 * Retrieve the session ID for a given agent ID
 * @param agentId - The wrapper's agent identifier
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 * @returns The session ID, or null if not found
 */
export async function getSessionId(agentId: string, workspacePath?: string): Promise<string | null> {
  // Load mappings
  const mappings = await loadMappings(workspacePath);

  // Lookup agent ID
  const sessionId = mappings[agentId];

  if (sessionId !== undefined) {
    info(`Retrieved session mapping: ${agentId} -> ${sessionId}`);
    return sessionId;
  }

  info(`No session mapping found for agent: ${agentId}`);
  return null;
}
