/**
 * Agent ID generation and workspace utilities
 */

import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Generate a unique 8-character hex agent ID
 * Uses crypto.randomBytes(4) to create a random 4-byte value
 * @returns 8-character lowercase hexadecimal string
 */
export function generateAgentId(): string {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Get the Claude configuration directory
 * Respects CLAUDE_CONFIG_DIR environment variable
 * @returns Absolute path to Claude config directory
 */
export function getClaudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
}

/**
 * Normalize workspace path by replacing non-alphanumeric characters with hyphens
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 * @returns Normalized workspace name with non-alphanumeric chars replaced by hyphens
 */
export function getWorkspaceName(workspacePath?: string): string {
  const targetPath = workspacePath ?? process.cwd();
  return targetPath.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Get the full path to an agent's transcript file
 * Format: {claudeConfigDir}/mcp-wrapper-server/{workspace}/agent-{agentId}.jsonl
 * @param agentId - The agent ID
 * @param workspacePath - Optional workspace path (defaults to process.cwd())
 * @returns Full absolute path to the transcript file
 */
export function getTranscriptPath(agentId: string, workspacePath?: string): string {
  const claudeConfigDir = getClaudeConfigDir();
  const workspaceName = getWorkspaceName(workspacePath);
  return path.join(claudeConfigDir, 'mcp-wrapper-server', workspaceName, `agent-${agentId}.jsonl`);
}
