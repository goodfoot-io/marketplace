import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Generate a unique 8-character hexadecimal agent ID
 */
export function generateAgentId(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Get normalized workspace name from current working directory
 * Replaces non-alphanumeric characters with hyphens
 */
export function getWorkspaceName(workspacePath?: string): string {
  const cwd = workspacePath || process.cwd();
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Get full path to agent transcript file
 */
export function getTranscriptPath(agentId: string, workspacePath?: string): string {
  const workspaceName = getWorkspaceName(workspacePath);
  const transcriptDir = join(homedir(), '.claude', 'projects', workspaceName);
  return join(transcriptDir, `agent-${agentId}.jsonl`);
}
