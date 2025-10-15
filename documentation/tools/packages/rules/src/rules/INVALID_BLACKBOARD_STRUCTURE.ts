import type { Rule, RuleViolation } from '../types.js';
import { fileExists, readFile, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';
import { parseYaml } from '../utils/yaml-utils.js';

interface BlackboardStructure {
  project_metadata?: {
    primary_topic?: string;
    latest_version?: string;
    latest_file?: string;
    story_slug?: string;
    created?: string;
    current_version?: string;
    working_file?: string;
  };
  shared_knowledge?: {
    key_insights?: unknown[];
    open_questions?: unknown[];
    resource_links?: unknown[];
  };
  agent_activity?: {
    active_agents?: unknown[];
    last_updated?: string;
    version_context?: string;
  };
  specialist_requests?: {
    pending?: unknown[];
    completed?: unknown[];
  };
  provisional_sources?: unknown[];
}

/**
 * INVALID_BLACKBOARD_STRUCTURE Rule
 *
 * Validates the structure and content of the blackboard.yaml file.
 *
 * @description
 * This rule ensures that the `agents/blackboard.yaml` file adheres to the
 * normalized structure defined in the protocol. It checks for required sections,
 * required fields within those sections, and the absence of forbidden, derivable
 * fields.
 *
 * @rationale
 * From protocols/organization-protocol.md:
 * "Claude maintains the required blackboard structure:
 * ```yaml
 * project_metadata:
 *   primary_topic: [topic]
 *   latest_version: [YYMMDDHHMM-reason]
 *   latest_file: essay/[YYMMDDHHMM-reason]/essay.md
 *
 * shared_knowledge:
 *   key_insights: []
 *   open_questions: []
 *   resource_links: []
 *
 * agent_activity:
 *   active_agents: []
 *
 * specialist_requests:
 *   pending: []
 *   completed: []
 * ```"
 *
 * @enforcement
 * Checks for:
 * - Presence of required sections: project_metadata, shared_knowledge, etc.
 * - Presence of required fields in nested objects.
 * - Absence of forbidden fields like `story_slug`, `created`, etc.
 *
 * @notFixable
 * This rule is not fixable as correcting the structure requires knowledge of
 * the project's current state, which cannot be automatically determined.
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const blackboardPath = resolveProjectPath(storyPath, 'agents', 'blackboard.yaml');

    if (await fileExists(blackboardPath)) {
      try {
        const content = await readFile(blackboardPath);
        const blackboard = parseYaml(content) as BlackboardStructure;

        const requiredSections = ['project_metadata', 'shared_knowledge', 'agent_activity', 'specialist_requests'];
        const missingSections = requiredSections.filter((section) => !(section in blackboard));

        if (missingSections.length > 0) {
          violations.push(
            createViolation(
              'INVALID_BLACKBOARD_STRUCTURE',
              `Blackboard missing required sections: ${missingSections.join(', ')}`,
              `${rootDir}/${storySlug}/agents/blackboard.yaml`
            )
          );
        }

        if (blackboard.project_metadata) {
          const requiredMetadata = ['primary_topic', 'latest_version', 'latest_file'];
          const missingMetadata = requiredMetadata.filter(
            (field) => !blackboard.project_metadata![field as keyof typeof blackboard.project_metadata]
          );

          if (missingMetadata.length > 0) {
            violations.push(
              createViolation(
                'INVALID_BLACKBOARD_STRUCTURE',
                `Blackboard project_metadata missing required fields: ${missingMetadata.join(', ')}`,
                `${rootDir}/${storySlug}/agents/blackboard.yaml`
              )
            );
          }

          const forbiddenMetadata = ['story_slug', 'created', 'current_version', 'working_file'];
          const presentForbidden = forbiddenMetadata.filter((field) => field in blackboard.project_metadata!);

          if (presentForbidden.length > 0) {
            violations.push(
              createViolation(
                'INVALID_BLACKBOARD_STRUCTURE',
                `Blackboard project_metadata contains derivable fields that should not be stored: ${presentForbidden.join(', ')}`,
                `${rootDir}/${storySlug}/agents/blackboard.yaml`
              )
            );
          }
        }

        if (blackboard.agent_activity) {
          const forbiddenActivity = ['last_updated', 'version_context'];
          const presentForbidden = forbiddenActivity.filter((field) => field in blackboard.agent_activity!);

          if (presentForbidden.length > 0) {
            violations.push(
              createViolation(
                'INVALID_BLACKBOARD_STRUCTURE',
                `Blackboard agent_activity contains derivable fields that should not be stored: ${presentForbidden.join(', ')}`,
                `${rootDir}/${storySlug}/agents/blackboard.yaml`
              )
            );
          }
        }

        if (blackboard.specialist_requests) {
          const checkRequests = (requests: unknown[], type: string) => {
            if (Array.isArray(requests)) {
              requests.forEach((request: unknown, index: number) => {
                if (request && typeof request === 'object') {
                  const req = request as Record<string, unknown>;

                  // Check for forbidden fields
                  if ('timestamp' in req || 'version' in req) {
                    violations.push(
                      createViolation(
                        'INVALID_BLACKBOARD_STRUCTURE',
                        `Blackboard specialist_requests.${type}[${index}] contains derivable fields (timestamp/version) that should not be stored`,
                        `${rootDir}/${storySlug}/agents/blackboard.yaml`
                      )
                    );
                  }

                  // Check required fields for all requests
                  const requiredFields = ['specialist', 'needs', 'blocking', 'work_location'];
                  const missingFields = requiredFields.filter((field) => !(field in req));

                  if (missingFields.length > 0) {
                    violations.push(
                      createViolation(
                        'INVALID_BLACKBOARD_STRUCTURE',
                        `Blackboard specialist_requests.${type}[${index}] missing required fields: ${missingFields.join(', ')}`,
                        `${rootDir}/${storySlug}/agents/blackboard.yaml`
                      )
                    );
                  }

                  // Check writer-specific requirements
                  if (req.specialist === 'writer-specialist') {
                    if (!('narrative_purpose' in req)) {
                      violations.push(
                        createViolation(
                          'INVALID_BLACKBOARD_STRUCTURE',
                          `Blackboard specialist_requests.${type}[${index}] writer requests must include 'narrative_purpose' field`,
                          `${rootDir}/${storySlug}/agents/blackboard.yaml`
                        )
                      );
                    }

                    if (req.blocking !== true) {
                      violations.push(
                        createViolation(
                          'INVALID_BLACKBOARD_STRUCTURE',
                          `Blackboard specialist_requests.${type}[${index}] writer requests must have 'blocking: true'`,
                          `${rootDir}/${storySlug}/agents/blackboard.yaml`
                        )
                      );
                    }
                  }

                  // Check blocking_issue field requirement
                  if (req.blocking === true && !('blocking_issue' in req)) {
                    violations.push(
                      createViolation(
                        'INVALID_BLACKBOARD_STRUCTURE',
                        `Blackboard specialist_requests.${type}[${index}] blocking requests must include 'blocking_issue' field`,
                        `${rootDir}/${storySlug}/agents/blackboard.yaml`
                      )
                    );
                  }
                }
              });
            }
          };

          if (blackboard.specialist_requests.pending) {
            checkRequests(blackboard.specialist_requests.pending, 'pending');
          }
          if (blackboard.specialist_requests.completed) {
            checkRequests(blackboard.specialist_requests.completed, 'completed');
          }
        }

        if (blackboard.shared_knowledge) {
          const requiredArrays = ['key_insights', 'open_questions', 'resource_links'];
          const invalidArrays = requiredArrays.filter((field) => {
            const value = blackboard.shared_knowledge![field as keyof typeof blackboard.shared_knowledge];
            return value !== undefined && !Array.isArray(value);
          });

          if (invalidArrays.length > 0) {
            violations.push(
              createViolation(
                'INVALID_BLACKBOARD_STRUCTURE',
                `Blackboard shared_knowledge fields must be arrays: ${invalidArrays.join(', ')}`,
                `${rootDir}/${storySlug}/agents/blackboard.yaml`
              )
            );
          }
        }

        if (blackboard.provisional_sources !== undefined) {
          if (!Array.isArray(blackboard.provisional_sources)) {
            violations.push(
              createViolation(
                'INVALID_BLACKBOARD_STRUCTURE',
                'Blackboard provisional_sources must be an array',
                `${rootDir}/${storySlug}/agents/blackboard.yaml`
              )
            );
          } else if (blackboard.provisional_sources.length > 0) {
            blackboard.provisional_sources.forEach((source: unknown, index: number) => {
              if (source && typeof source === 'object') {
                const requiredFields = ['source_url', 'claim_to_support', 'status', 'requesting_specialist'];
                const sourceObj = source as Record<string, unknown>;
                const missingFields = requiredFields.filter((field) => !(field in sourceObj));

                if (missingFields.length > 0) {
                  violations.push(
                    createViolation(
                      'INVALID_BLACKBOARD_STRUCTURE',
                      `Blackboard provisional_sources[${index}] missing required fields: ${missingFields.join(', ')}`,
                      `${rootDir}/${storySlug}/agents/blackboard.yaml`
                    )
                  );
                }

                if (
                  'status' in sourceObj &&
                  !['pending_vetting', 'approved', 'rejected'].includes(sourceObj.status as string)
                ) {
                  violations.push(
                    createViolation(
                      'INVALID_BLACKBOARD_STRUCTURE',
                      `Blackboard provisional_sources[${index}] has invalid status '${String(sourceObj.status)}' (must be pending_vetting, approved, or rejected)`,
                      `${rootDir}/${storySlug}/agents/blackboard.yaml`
                    )
                  );
                }
              } else {
                violations.push(
                  createViolation(
                    'INVALID_BLACKBOARD_STRUCTURE',
                    `Blackboard provisional_sources[${index}] must be an object`,
                    `${rootDir}/${storySlug}/agents/blackboard.yaml`
                  )
                );
              }
            });
          }
        }
      } catch (error) {
        violations.push(
          createViolation(
            'INVALID_BLACKBOARD_STRUCTURE',
            `Blackboard contains invalid YAML: ${error instanceof Error ? error.message : 'Parse error'}`,
            `${rootDir}/${storySlug}/agents/blackboard.yaml`
          )
        );
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'INVALID_BLACKBOARD_STRUCTURE',
  title: 'Invalid Blackboard Structure',
  check
};

export default rule;
