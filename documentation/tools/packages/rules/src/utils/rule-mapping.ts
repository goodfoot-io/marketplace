import { RULE_CODES } from '../rule-codes.js';

// Map rule codes to the fix functions they should use
export const RULE_TO_FIX_MAP: Record<string, string> = {
  MISSING_REQUIRED_DIRECTORY: 'directory-structure',
  MISSING_STATUS_FILE: 'directory-structure',
  MISSING_BLACKBOARD: 'directory-structure',
  DUPLICATE_TEMPLATES_DIR: 'directory-structure',
  MISSING_ROOT_TEMPLATES: 'directory-structure',
  MISSING_TEMPLATE_SUBDIR: 'directory-structure',
  MISSING_PERSONA_SUBDIR: 'directory-structure',
  INVALID_STORY_SLUG: 'file-naming',
  INVALID_VERSION_DIRECTORY_NAME: 'file-naming',
  MISSING_SOURCE_DATE_PREFIX: 'file-naming',
  MISSING_SOURCE_URL: 'source-urls',
  VAGUE_SOURCE_ATTRIBUTION: 'source-urls',
  MISSING_YAML_FRONTMATTER: 'yaml-frontmatter',
  MISSING_FRONTMATTER_FIELD: 'yaml-frontmatter',
  EMPTY_STATUS_FILE: 'status-file',
  MISSING_STATUS_FIELD: 'status-file',
  INVALID_DATE_FORMAT: 'status-file',
  INVALID_STATUS_STATE: 'status-file',
  STATE_DIRECTORY_MISMATCH: 'status-file',
  RULE_ERROR: 'system'
};

// Helper to get rule info by old identifier
export function getRuleInfoByOldId(oldId: string): { code: string; title: string } | null {
  const ruleEntry = Object.entries(RULE_CODES).find(([key]) => key === oldId);
  if (ruleEntry) {
    return ruleEntry[1];
  }
  return null;
}
