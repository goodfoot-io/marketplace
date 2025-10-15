import type { Rule } from '../types/rule.js';
import type { RuleViolation } from '../types.js';
import { join } from 'path';
import { readDirectory, isDirectory, shouldSuppressError } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * INVALID_MESSAGE_FILENAME Rule
 *
 * Validates that message files follow the required naming convention
 *
 * @description
 * Ensures all inter-agent message files follow the strict naming convention
 * required for automated message processing. Invalid filenames can break
 * the coordination system and prevent proper agent communication.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Create messages in `agents/messages/` using format: `[YYMMDDHHMM]-[specialist-name]-[topic].msg`"
 *
 * @enforcement
 * Checks all .msg files in agents/messages/ directories and validates they follow
 * the pattern: [timestamp]-[specialist-name]-[topic].msg where:
 * - timestamp: YYMMDDHHMM format (10 digits)
 * - specialist-name: specialist/agent name (no spaces, hyphens allowed)
 * - topic: topic of the message (hyphens allowed)
 *
 * @notFixable
 * Cannot automatically fix as the correct timestamp and agent names are unknown
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const messagesPath = join(storyPath, 'agents', 'messages');

    if (await isDirectory(messagesPath)) {
      try {
        const messageFiles = await readDirectory(messagesPath);

        for (const filename of messageFiles) {
          if (filename.endsWith('.msg')) {
            if (!isValidMessageFilename(filename)) {
              violations.push(
                createViolation(
                  'INVALID_MESSAGE_FILENAME',
                  `Story \`${storySlug}\` has message file \`${filename}\` that doesn't follow naming convention [YYMMDDHHMM]-[specialist-name]-[topic].msg`,
                  `${rootDir}/${storySlug}/agents/messages/${filename}`,
                  'error'
                )
              );
            }
          }
        }
      } catch (error: unknown) {
        // Only suppress known file system errors for missing/inaccessible directories
        if (shouldSuppressError(error)) {
          // Skip directories that don't exist or can't be read due to permissions
          continue;
        }
        // Re-throw unexpected errors (memory issues, etc.)
        throw error;
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

/**
 * Validates message filename against the required pattern
 */
function isValidMessageFilename(filename: string): boolean {
  // Remove .msg extension
  const nameWithoutExt = filename.replace(/\.msg$/, '');

  // Split by hyphens
  const parts = nameWithoutExt.split('-');

  // Must have at least 3 parts: timestamp-from-to
  if (parts.length < 3) {
    return false;
  }

  // First part should be a timestamp (basic check for YYYYMMDD or ISO format)
  const timestampPart = parts[0];
  if (!isValidTimestamp(timestampPart)) {
    return false;
  }

  // Second part should be agent name (no special chars except hyphens)
  const fromPart = parts[1];
  if (!isValidAgentName(fromPart)) {
    return false;
  }

  // Remaining parts form the "to" field
  const toPart = parts.slice(2).join('-');

  // Valid recipients: agent names, "all", or "newsroom-request"
  if (!isValidRecipient(toPart)) {
    return false;
  }

  return true;
}

/**
 * Basic timestamp validation
 */
function isValidTimestamp(timestamp: string): boolean {
  // Strictly enforce YYMMDDHHMM format (10 digits)
  return /^\d{10}$/.test(timestamp);
}

/**
 * Validates agent name format
 */
function isValidAgentName(name: string): boolean {
  // Agent names should be alphanumeric with hyphens, no spaces
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(name) || /^[a-zA-Z0-9]$/.test(name);
}

/**
 * Validates recipient format
 */
function isValidRecipient(recipient: string): boolean {
  // Special recipients
  if (recipient === 'all' || recipient === 'newsroom-request') {
    return true;
  }

  // Regular agent names
  return isValidAgentName(recipient);
}

const rule: Rule = {
  code: 'INVALID_MESSAGE_FILENAME',
  title: 'Invalid Message File Naming',
  check
};

export default rule;
