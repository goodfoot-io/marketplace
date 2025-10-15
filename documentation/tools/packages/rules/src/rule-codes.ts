export const RULE_CODES = {
  // Directory Structure Rules
  MISSING_REQUIRED_DIRECTORY: {
    code: 'MISSING_REQUIRED_DIRECTORY',
    title: 'Missing Required Directory'
  },
  MISSING_BLACKBOARD: {
    code: 'MISSING_BLACKBOARD',
    title: 'Missing Blackboard File'
  },
  DUPLICATE_TEMPLATES_DIR: {
    code: 'DUPLICATE_TEMPLATES_DIR',
    title: 'Duplicate Templates Directory'
  },
  MISSING_ROOT_TEMPLATES: {
    code: 'MISSING_ROOT_TEMPLATES',
    title: 'Missing Root Templates Directory'
  },
  MISSING_TEMPLATE_SUBDIR: {
    code: 'MISSING_TEMPLATE_SUBDIR',
    title: 'Missing Template Subdirectory'
  },
  MISSING_WORKSPACE_FILE: {
    code: 'MISSING_WORKSPACE_FILE',
    title: 'Missing Required Workspace File'
  },

  // Naming Convention Rules
  INVALID_STORY_SLUG: {
    code: 'INVALID_STORY_SLUG',
    title: 'Invalid Story Slug Format'
  },
  INVALID_VERSION_DIRECTORY_NAME: {
    code: 'INVALID_VERSION_DIRECTORY_NAME',
    title: 'Invalid Version Directory Name'
  },
  MISSING_SOURCE_DATE_PREFIX: {
    code: 'MISSING_SOURCE_DATE_PREFIX',
    title: 'Missing Source Date Prefix'
  },

  // Content Rules
  MISSING_SOURCE_URL: {
    code: 'MISSING_SOURCE_URL',
    title: 'Missing Source URL'
  },
  VAGUE_SOURCE_ATTRIBUTION: {
    code: 'VAGUE_SOURCE_ATTRIBUTION',
    title: 'Vague Source Attribution'
  },
  MISSING_YAML_FRONTMATTER: {
    code: 'MISSING_YAML_FRONTMATTER',
    title: 'Missing YAML Frontmatter'
  },
  MISSING_FRONTMATTER_FIELD: {
    code: 'MISSING_FRONTMATTER_FIELD',
    title: 'Missing Frontmatter Field'
  },

  // Structure Rules
  UNEXPECTED_DIRECTORY: {
    code: 'UNEXPECTED_DIRECTORY',
    title: 'Unexpected Directory'
  },
  UNEXPECTED_ROOT_DIRECTORY: {
    code: 'UNEXPECTED_ROOT_DIRECTORY',
    title: 'Unexpected Root Directory'
  },
  UNEXPECTED_FILE: {
    code: 'UNEXPECTED_FILE',
    title: 'File in Wrong Location'
  },

  // Required Files Rules
  MISSING_CHANGELOG: {
    code: 'MISSING_CHANGELOG',
    title: 'Missing Version History File'
  },

  // Naming Convention Rules for Agent Files
  INVALID_MESSAGE_FILENAME: {
    code: 'INVALID_MESSAGE_FILENAME',
    title: 'Invalid Message File Naming'
  },
  INVALID_PERFORMANCE_REVIEW_FILENAME: {
    code: 'INVALID_PERFORMANCE_REVIEW_FILENAME',
    title: 'Invalid Performance Review File Naming'
  },
  INVALID_REVIEW_FILENAME: {
    code: 'INVALID_REVIEW_FILENAME',
    title: 'Invalid Review File Naming'
  },

  // Essay Structure Rules
  INVALID_BLACKBOARD_STRUCTURE: {
    code: 'INVALID_BLACKBOARD_STRUCTURE',
    title: 'Invalid Blackboard Structure'
  },
  INVALID_USER_FEEDBACK_STRUCTURE: {
    code: 'INVALID_USER_FEEDBACK_STRUCTURE',
    title: 'Invalid User Feedback Structure'
  },
  INVALID_LINK_OVERRIDES_STRUCTURE: {
    code: 'INVALID_LINK_OVERRIDES_STRUCTURE',
    title: 'Invalid Link Overrides Structure'
  },
  INVALID_LEDGER_STRUCTURE: {
    code: 'INVALID_LEDGER_STRUCTURE',
    title: 'Invalid Link Status Ledger Structure'
  },
  BROKEN_LINK_DETECTED: {
    code: 'BROKEN_LINK_DETECTED',
    title: 'Broken Link Detected'
  },
  REDUNDANT_FRONTMATTER_FIELD: {
    code: 'REDUNDANT_FRONTMATTER_FIELD',
    title: 'Redundant Frontmatter Field'
  },
  LEGACY_AGENTS_DIRECTORY_FOUND: {
    code: 'LEGACY_AGENTS_DIRECTORY_FOUND',
    title: 'Legacy Agents Directory Found'
  },
  INCONSISTENT_WORKFLOW_STATE: {
    code: 'INCONSISTENT_WORKFLOW_STATE',
    title: 'Workflow state inconsistency detected'
  },

  // System Rules
  RULE_ERROR: {
    code: 'RULE_ERROR',
    title: 'Rule Execution Error'
  }
} as const;

export type RuleCode = keyof typeof RULE_CODES;
