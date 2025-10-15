# Rules Package

A TypeScript validation and enforcement tool for newsroom organizational standards. This package implements the requirements defined in `/protocols/organization-protocol.md` and provides automated validation and protocol drift management.

## Overview

The rules package enforces the standardized file organization system for all newsroom projects. It ensures consistent structure across projects, validates content requirements, and helps maintain organizational integrity through automated checks.

## Installation

```bash
cd tools
yarn install
```

## Available Commands

### `rules-check`

Validates the workspace structure and reports violations:

```bash
# Check entire workspace
rules-check

# Check specific directory
rules-check /path/to/workspace
```

Output includes:

- Violations grouped by rule type
- Severity levels (error/warning)
- Clear descriptions and file locations

### `rules-drift`

Analyzes git history to identify rules that may be outdated relative to protocol changes:

```bash
rules-drift
```

Categorizes rules as:

- **UP_TO_DATE**: No protocol changes since last update/review
- **NEEDS_REVIEW**: Protocol changed recently, rule needs verification
- **STALE**: Protocol changed >30 days ago, urgent review needed

### `rules-drift:mark-reviewed`

Records that rules have been reviewed and verified against current protocol:

```bash
# Mark all rules as reviewed
rules-drift mark-reviewed --all --notes="Verified against protocol v2.1"

# Mark specific rules
rules-drift mark-reviewed --rules "MISSING_BLACKBOARD,INVALID_STORY_SLUG" --notes="Updated rule logic"
```

## Rule Categories

### Directory Structure Rules

- `MISSING_REQUIRED_DIRECTORY` - Validates required story directories exist
- `UNEXPECTED_DIRECTORY` - Detects non-standard directories in stories
- `UNEXPECTED_ROOT_DIRECTORY` - Flags unexpected top-level directories
- `DUPLICATE_TEMPLATES_DIR` - Prevents template directories in wrong locations
- `MISSING_ROOT_TEMPLATES` - Ensures /\_templates directory exists
- `MISSING_TEMPLATE_SUBDIR` - Validates template subdirectories

### Naming Convention Rules

- `INVALID_STORY_SLUG` - Enforces lowercase-hyphen story naming
- `INVALID_VERSION_DIRECTORY_NAME` - Validates [YYMMDDHHMM]-[reason] format
- `INVALID_MESSAGE_FILENAME` - Checks agent message file naming
- `INVALID_PERFORMANCE_REVIEW_FILENAME` - Validates [YYMMDD]-[specialist].yaml format
- `INVALID_REVIEW_FILENAME` - Ensures review files use [YYMMDDHHMM].md format
- `MISSING_SOURCE_DATE_PREFIX` - Requires date prefixes on source files

### Content Requirement Rules

- `MISSING_BLACKBOARD` - Ensures blackboard.yaml exists
- `MISSING_CHANGELOG` - Requires changelog.md in essay directories
- `MISSING_SOURCE_URL` - Validates source attribution
- `VAGUE_SOURCE_ATTRIBUTION` - Detects vague source references
- `MISSING_YAML_FRONTMATTER` - Requires frontmatter in specific files
- `MISSING_FRONTMATTER_FIELD` - Validates required frontmatter fields
- `REDUNDANT_FRONTMATTER_FIELD` - Prevents duplicate metadata

### Structure Validation Rules

- `INVALID_BLACKBOARD_STRUCTURE` - Validates blackboard.yaml schema
- `INVALID_USER_FEEDBACK_STRUCTURE` - Checks user-feedback.md format
- `INVALID_LEDGER_STRUCTURE` - Validates link-status-ledger.json
- `INVALID_LINK_OVERRIDES_STRUCTURE` - Checks link-overrides.yaml format
- `BROKEN_LINK_DETECTED` - Validates external URLs in essays

### File Placement Rules

- `UNEXPECTED_FILE` - Detects files in wrong locations
- `MISSING_WORKSPACE_FILE` - Ensures version workspace files exist where needed

### Legacy Migration Rules

- `LEGACY_AGENTS_DIRECTORY_FOUND` - Helps migrate from old agent structure

## Architecture

### Core Components

#### OrganizationParser

The main validation engine that:

- Loads and executes all rules
- Aggregates violations across the workspace
- Manages fix operations
- Handles error recovery

#### Rule System

Each rule implements the `Rule` interface:

```typescript
interface Rule {
  code: string; // Unique identifier (e.g., "MISSING_BLACKBOARD")
  title: string; // Human-readable title
  check: (workspacePath: string) => Promise<RuleViolation[] | null>;
}
```

#### Protocol Drift Checker

Git-based system that:

- Tracks protocol file changes
- Compares rule update timestamps
- Maintains review records
- Generates drift reports

### Utilities

#### Story Utilities (`story-utils`)

- `iterateStories()` - Iterate over all story directories
- `isValidStorySlug()` - Validate story naming
- `getExpectedState()` - Determine story workflow state

#### Directory Utilities (`directory-utils`)

- `getMissingStoryDirectories()` - Find missing required dirs
- `findFiles()` - Recursive file search
- `ensureRequiredDirectories()` - Create missing directories

#### Validation Utilities (`validation-utils`)

- Pattern matchers for versions, dates, URLs
- Content validators for attributions
- Filename format checkers

#### YAML Utilities (`yaml-utils`)

- `readYamlFile()` - Safe YAML file reading
- `extractYamlFrontmatter()` - Parse markdown frontmatter
- Schema validation helpers

#### File Utilities (`file-utils`)

- Safe file operations
- Path resolution
- Binary file detection

## Rule Development

### Creating a New Rule

1. Create rule file in `src/rules/[RULE_CODE].ts`:

```typescript
import type { Rule, RuleViolation } from '../types.js';
import { createViolation } from '../utils/parse-utils.js';

/**
 * RULE_CODE Rule
 *
 * @description What this rule validates
 * @rationale Quote from organization-protocol.md
 * @enforcement How violations are detected
 */
async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  // Implementation
}

const rule: Rule = {
  code: 'RULE_CODE',
  title: 'Human Readable Title',
  check
};

export default rule;
```

2. Create test file in `tests/rules/[RULE_CODE].test.ts`
3. Add rule code to `src/rule-codes.ts`
4. Document relationship to organization protocol

### Testing

```bash
# Run all tests
yarn test

# Run specific rule test
yarn test tests/rules/MISSING_BLACKBOARD.test.ts

# Run with coverage
yarn test:coverage
```

## Protocol Drift Management

The package tracks when rules may become outdated relative to protocol changes:

1. **Automatic Detection**: Git history analysis identifies protocol changes
2. **Review Workflow**: Mark rules as reviewed after verification
3. **Audit Trail**: Maintains records of reviews in `protocol-reviews.json`
4. **Continuous Monitoring**: Can be integrated into CI/CD pipelines

### Review Process

1. Run `rules-drift` to check status
2. Review protocol changes listed in report
3. Update rules if needed
4. Mark as reviewed with `rules-drift:mark-reviewed`

## Integration

### In Newsroom Workflow

Specialists must run validation before completing work:

```bash
rules-check  # Then manually resolve any violations
rules-check  # Verify all issues resolved
```

### In CI/CD

```bash
# Fail builds on violations
rules-check || exit 1

# Check for protocol drift
rules-drift || echo "Warning: Rules may need review"
```

### With Other Tools

The rules package integrates with:

- `print-filesystem` - For workspace exploration
- `print-dependencies` - For code analysis
- Newsroom agent tools - For automated validation

## Development Scripts

```bash
# Build TypeScript
yarn build

# Run linter
yarn lint

# Run tests
yarn test

# Clean build artifacts
yarn clean
```

## Error Handling

The parser includes comprehensive error handling:

- Graceful file operation failures
- Clear error messages with context
- Recovery suggestions
- Non-blocking validation continues despite errors

## Link Status Management

The package includes intelligent link checking:

- Caches link status to reduce redundant checks
- Respects story lifecycle (active vs. published)
- Allows documented overrides for special cases
- Maintains audit trail in `link-status-ledger.json`

## Contributing

When adding new rules:

1. Ensure alignment with organization-protocol.md
2. Include comprehensive tests (10+ test cases)
3. Document rationale with protocol quotes
4. Update this README if adding new categories

## Version History

This package evolved from the original `newsroom-tools` and now lives in the tools monorepo. It maintains backward compatibility while adding new features like protocol drift management and enhanced error handling.
