import type { Rule, RuleViolation } from '../types.js';
import { fileExists, readFile, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';
import { parseYaml } from '../utils/yaml-utils.js';

interface LinkOverride {
  url: string;
  reason: string;
  authorized_by: string;
  timestamp: string;
}

interface LinkOverridesStructure {
  overrides: LinkOverride[];
}

/**
 * INVALID_LINK_OVERRIDES_STRUCTURE Rule
 *
 * Validates the structure and content of optional link-overrides.yaml files.
 *
 * @description
 * This rule ensures that when a `link-overrides.yaml` file exists, it adheres to the
 * structure defined in the organization protocol. It checks for required fields
 * and validates the format of override entries.
 *
 * @rationale
 * From protocols/organization-protocol.md:
 * "Claude knows the link-overrides.yaml structure for validation exceptions:
 * ```yaml
 * overrides:
 *   - url: \"[The exact URL that is failing validation]\"
 *     reason: \"[A clear, concise justification for the override]\"
 *     authorized_by: \"[The specialist authorizing the exception]\"
 *     timestamp: \"[ISO 8601 timestamp of the authorization]\"
 * ```"
 *
 * @enforcement
 * Checks for:
 * - Presence of required 'overrides' array
 * - Required fields in each override entry: url, reason, authorized_by, timestamp
 * - ISO 8601 timestamp format validation
 *
 * @notFixable
 * This rule is not fixable as override entries require manual authorization
 * and documentation.
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const overridesPath = resolveProjectPath(storyPath, 'link-overrides.yaml');

    if (await fileExists(overridesPath)) {
      try {
        const content = await readFile(overridesPath);
        const overridesFile = parseYaml(content) as LinkOverridesStructure;

        if (!overridesFile.overrides) {
          violations.push(
            createViolation(
              'INVALID_LINK_OVERRIDES_STRUCTURE',
              'Link overrides file missing required "overrides" array',
              `${rootDir}/${storySlug}/link-overrides.yaml`
            )
          );
          continue;
        }

        if (!Array.isArray(overridesFile.overrides)) {
          violations.push(
            createViolation(
              'INVALID_LINK_OVERRIDES_STRUCTURE',
              'Link overrides "overrides" field must be an array',
              `${rootDir}/${storySlug}/link-overrides.yaml`
            )
          );
          continue;
        }

        overridesFile.overrides.forEach((override: unknown, index: number) => {
          if (!override || typeof override !== 'object') {
            violations.push(
              createViolation(
                'INVALID_LINK_OVERRIDES_STRUCTURE',
                `Override entry [${index}] must be an object`,
                `${rootDir}/${storySlug}/link-overrides.yaml`
              )
            );
            return;
          }

          const overrideObj = override as Record<string, unknown>;
          const requiredFields = ['url', 'reason', 'authorized_by', 'timestamp'];
          const missingFields = requiredFields.filter((field) => !(field in overrideObj));

          if (missingFields.length > 0) {
            violations.push(
              createViolation(
                'INVALID_LINK_OVERRIDES_STRUCTURE',
                `Override entry [${index}] missing required fields: ${missingFields.join(', ')}`,
                `${rootDir}/${storySlug}/link-overrides.yaml`
              )
            );
          }

          // Validate timestamp is ISO 8601 format
          if ('timestamp' in overrideObj && typeof overrideObj.timestamp === 'string') {
            const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
            if (!iso8601Regex.test(overrideObj.timestamp)) {
              violations.push(
                createViolation(
                  'INVALID_LINK_OVERRIDES_STRUCTURE',
                  `Override entry [${index}] timestamp must be in ISO 8601 format (e.g., 2025-01-16T14:30:00Z)`,
                  `${rootDir}/${storySlug}/link-overrides.yaml`
                )
              );
            }
          }

          // Validate authorized_by field
          if ('authorized_by' in overrideObj && typeof overrideObj.authorized_by === 'string') {
            if (!overrideObj.authorized_by.endsWith('-specialist')) {
              violations.push(
                createViolation(
                  'INVALID_LINK_OVERRIDES_STRUCTURE',
                  `Override entry [${index}] authorized_by should be a specialist identifier (e.g., reviewer-specialist)`,
                  `${rootDir}/${storySlug}/link-overrides.yaml`,
                  'warning'
                )
              );
            }
          }
        });
      } catch (error) {
        violations.push(
          createViolation(
            'INVALID_LINK_OVERRIDES_STRUCTURE',
            `Link overrides file contains invalid YAML: ${error instanceof Error ? error.message : 'Parse error'}`,
            `${rootDir}/${storySlug}/link-overrides.yaml`
          )
        );
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'INVALID_LINK_OVERRIDES_STRUCTURE',
  title: 'Invalid Link Overrides Structure',
  check
};

export default rule;
