import type { Rule, RuleViolation } from '../types.js';
import { z } from 'zod';
import { fileExists, readFile, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * INVALID_LEDGER_STRUCTURE Rule
 *
 * Validates the structure of link-status-ledger.json files
 *
 * @description
 * This rule ensures that any link-status-ledger.json file present in a story
 * directory follows the required schema. The ledger tracks the status of all
 * links found in essay files, including their health status and last check time.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude understands the Link Status Ledger System for automated link validation:
 * - Uses `link-status-ledger.json` at each story root to track link status
 * - `active/` stories: Links re-checked if last check > 48 hours ago
 * - `published/` and `archive/` stories: No broken link checking performed
 * - `BROKEN_LINK_DETECTED` rule reports failing links not in `link-overrides.yaml`"
 *
 * @enforcement
 * - Validates JSON syntax
 * - Ensures required fields are present
 * - Validates data types and formats
 * - Checks timestamp formats
 *
 * @notFixable
 * Ledger corruption requires manual investigation to determine the correct
 * state of link health. Automatic fixes could mask underlying issues.
 */

// Define the schema for link status entries
const LinkStatusSchema = z.object({
  url: z.string().url(),
  status: z.enum(['healthy', 'broken', 'redirect']),
  httpStatus: z.number().int().min(100).max(599),
  finalUrl: z.string().url(),
  lastChecked: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
  retryCount: z.number().int().min(0).default(0),
  lastError: z.string().optional()
});

const LinkStatusLedgerSchema = z.object({
  version: z.literal('1.0'),
  links: z.record(z.string(), LinkStatusSchema)
});

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const ledgerPath = resolveProjectPath(storyPath, 'link-status-ledger.json');

    if (await fileExists(ledgerPath)) {
      try {
        const content = await readFile(ledgerPath);
        const data: unknown = JSON.parse(content);

        // Validate against schema
        const result = LinkStatusLedgerSchema.safeParse(data);

        if (!result.success) {
          const errors = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');

          violations.push(
            createViolation(
              'INVALID_LEDGER_STRUCTURE',
              `Link status ledger has invalid structure: ${errors}`,
              `${rootDir}/${storySlug}/link-status-ledger.json`,
              'error'
            )
          );
        }
      } catch (error: unknown) {
        violations.push(
          createViolation(
            'INVALID_LEDGER_STRUCTURE',
            `Link status ledger is not valid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
            `${rootDir}/${storySlug}/link-status-ledger.json`,
            'error'
          )
        );
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'INVALID_LEDGER_STRUCTURE',
  title: 'Invalid Link Status Ledger Structure',
  check
};

export default rule;
