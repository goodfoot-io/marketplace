# Templates and Examples

Ready-to-use templates for creating Claude Code plugins and marketplaces.

## Complete Plugin Template

### Directory Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── command1.md
│   └── namespace/
│       └── command2.md
├── agents/
│   └── agent1.md
├── shared/
│   └── guide.md
├── README.md
├── CHANGELOG.md
└── LICENSE
```

### plugin.json Template

```json
{
  "name": "my-plugin",
  "displayName": "My Plugin",
  "description": "Brief description of what this plugin does (one sentence)",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com",
    "url": "https://github.com/yourusername"
  },
  "homepage": "https://github.com/yourusername/repo/tree/main/plugins/my-plugin",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/repo.git",
    "directory": "plugins/my-plugin"
  },
  "license": "MIT",
  "keywords": [
    "keyword1",
    "keyword2",
    "keyword3"
  ],
  "engines": {
    "claudeCode": ">=0.1.0"
  }
}
```

### Plugin README Template

```markdown
# Plugin Name

Brief description of the plugin's purpose and what problems it solves.

## Installation

```bash
/plugin install plugin-name@marketplace-name
```

## Commands

### /command-name

Brief description of what the command does.

**Usage:**
```bash
/command-name [arguments]
```

**Examples:**
```bash
# Example 1: Basic usage
/command-name arg1

# Example 2: Advanced usage
/command-name arg1 arg2 --option
```

**Options:**
- `arg1` - Description of first argument
- `arg2` - Description of second argument (optional)

## Agents

### agent-name

Brief description of what the agent does and when it's invoked.

**Use cases:**
- Use case 1
- Use case 2
- Use case 3

**Example invocation:**
```bash
> Use the agent-name agent to [perform task]
```

## Tips

- Tip 1
- Tip 2
- Tip 3

## Troubleshooting

### Issue 1
**Problem:** Description of problem
**Solution:** How to fix it

### Issue 2
**Problem:** Description of problem
**Solution:** How to fix it

## License

MIT License - see [repository LICENSE](../../LICENSE) for details.

## Support

- [Report Issues](https://github.com/user/repo/issues)
- [Documentation](https://github.com/user/repo/tree/main/docs)
- [Discussions](https://github.com/user/repo/discussions)
```

### Command Template (Simple)

```markdown
---
description: Brief description of what this command does
---

Your command instructions go here.

You can include:
- Regular markdown text
- Instructions for Claude
- File references using @path/to/file
- Dynamic arguments using $ARGUMENTS

## Task

[Specific task instructions]
```

### Command Template (Advanced)

```markdown
---
description: Comprehensive description of the command
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(git:*)
argument-hint: <required-arg> [optional-arg] | list
---

<user-message>
```!
write-arguments "$ARGUMENTS"
```
</user-message>

# Command Name

## Context

Gather relevant context before executing:

- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -5`
- Modified files: !`git status --short`

## Dynamic Content

File to process: @$ARGUMENTS
Coding standards: @shared/coding-standards.md

## Instructions

1. **Step 1:** First action to take
   - Detail A
   - Detail B

2. **Step 2:** Second action
   - Detail A
   - Detail B

3. **Step 3:** Final action
   - Detail A
   - Detail B

## Output Format

Format your response as:

```
## Summary
[Brief summary]

## Details
[Detailed breakdown]

## Next Steps
[Recommended actions]
```

## Important Notes

- Note 1
- Note 2
- Note 3
```

### Agent Template (Basic)

```markdown
---
name: agent-name
description: Brief description of when to use this agent
tools: Read, Write, Edit
model: inherit
---

You are a specialized agent with expertise in [domain].

## Your Role

[Detailed description of the agent's responsibilities and capabilities]

## When Invoked

1. [First step the agent should take]
2. [Second step]
3. [Continue with workflow]

## Guidelines

- [Important guideline 1]
- [Important guideline 2]
- [Best practice]

## Process

For each [task]:
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Output Format

[How the agent should structure its responses]
```

### Agent Template (Comprehensive)

```markdown
---
name: comprehensive-agent
description: Expert in [domain]. Use proactively when [trigger condition]. MUST BE USED immediately after [event].
tools: Read, Write, Edit, Grep, Glob, Bash
model: inherit
---

# Agent Identity

You are a [role description] specializing in [specialization].

Your expertise includes:
- [Expertise area 1]
- [Expertise area 2]
- [Expertise area 3]

## Invocation Triggers

Use this agent when:
- ✅ [Trigger 1]
- ✅ [Trigger 2]
- ✅ [Trigger 3]

Do NOT use when:
- ❌ [Anti-trigger 1]
- ❌ [Anti-trigger 2]

## Workflow

When invoked, follow this workflow:

### Phase 1: Analysis
1. [Analysis step 1]
2. [Analysis step 2]
3. [Analysis step 3]

### Phase 2: Execution
1. [Execution step 1]
2. [Execution step 2]
3. [Execution step 3]

### Phase 3: Verification
1. [Verification step 1]
2. [Verification step 2]
3. [Verification step 3]

## Quality Standards

Ensure all outputs meet these standards:
- **Standard 1:** Description
- **Standard 2:** Description
- **Standard 3:** Description

## Common Scenarios

### Scenario 1: [Description]
**Approach:**
1. Step 1
2. Step 2
3. Step 3

### Scenario 2: [Description]
**Approach:**
1. Step 1
2. Step 2
3. Step 3

## Output Format

Structure your output as:

```
## Analysis
[What you found]

## Actions Taken
[What you did]

## Results
[What changed]

## Recommendations
[What should happen next]
```

## Best Practices

- [Best practice 1]
- [Best practice 2]
- [Best practice 3]

## Error Handling

If you encounter errors:
1. [Error handling step 1]
2. [Error handling step 2]
3. [Error handling step 3]

## Important Constraints

- ⚠️ [Constraint 1]
- ⚠️ [Constraint 2]
- ⚠️ [Constraint 3]
```

## Marketplace Templates

### marketplace.json Template

```json
{
  "name": "marketplace-name",
  "displayName": "Marketplace Display Name",
  "description": "Brief description of this marketplace",
  "version": "1.0.0",
  "owner": {
    "name": "Owner Name",
    "email": "owner@example.com",
    "url": "https://example.com"
  },
  "homepage": "https://github.com/user/repo",
  "repository": {
    "type": "git",
    "url": "https://github.com/user/repo.git"
  },
  "plugins": [
    {
      "name": "plugin-name",
      "displayName": "Plugin Display Name",
      "description": "Brief description of the plugin",
      "version": "1.0.0",
      "source": "plugins/plugin-name",
      "author": {
        "name": "Author Name",
        "url": "https://github.com/author"
      },
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "license": "MIT",
      "homepage": "https://github.com/user/repo/tree/main/plugins/plugin-name"
    }
  ]
}
```

### Marketplace README Template

```markdown
# Marketplace Name

Brief description of your marketplace and its purpose.

## Installation

Add this marketplace to Claude Code:

```bash
/plugin marketplace add user/repo
```

Browse available plugins:

```bash
/plugin
```

Install a specific plugin:

```bash
/plugin install plugin-name@marketplace-name
```

## Available Plugins

| Plugin | Description | Commands | Agents |
|--------|-------------|----------|--------|
| [plugin-1](plugins/plugin-1) | Brief description | `/cmd1`, `/cmd2` | agent1, agent2 |
| [plugin-2](plugins/plugin-2) | Brief description | `/cmd3`, `/cmd4` | agent3 |
| [plugin-3](plugins/plugin-3) | Brief description | `/cmd5` | - |

## Plugin Categories

### Category 1: [Name]
- **[Plugin Name](plugins/plugin-name)** - Description
- **[Plugin Name](plugins/plugin-name)** - Description

### Category 2: [Name]
- **[Plugin Name](plugins/plugin-name)** - Description
- **[Plugin Name](plugins/plugin-name)** - Description

## Documentation

- 📚 [Plugin Guides](docs/plugin-guides/)
- 📖 [Installation Guide](docs/installation.md)
- 🤝 [Contributing Guide](docs/contributing.md)
- 💡 [Examples](examples/)

## Getting Started

### For End Users

1. Add the marketplace (see Installation above)
2. Browse plugins with `/plugin`
3. Install plugins you need
4. Read plugin documentation for usage

### For Contributors

1. Fork this repository
2. Create a new plugin in `plugins/`
3. Add plugin entry to `marketplace.json`
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Support

- 🐛 [Report Issues](https://github.com/user/repo/issues)
- 💬 [Discussions](https://github.com/user/repo/discussions)
- 📧 [Email](mailto:support@example.com)

## Versioning

We use [Semantic Versioning](https://semver.org/):
- **Major** versions for breaking changes
- **Minor** versions for new features
- **Patch** versions for bug fixes

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

[License Type] - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Thanks to contributors
- Inspired by [project/person]
- Built with Claude Code
```

## Example Plugins

### Example 1: Simple Command Plugin

```
code-formatter/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   └── format.md
└── README.md
```

**plugin.json:**
```json
{
  "name": "code-formatter",
  "displayName": "Code Formatter",
  "description": "Format code according to project standards",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "url": "https://github.com/yourusername"
  },
  "license": "MIT",
  "keywords": ["formatting", "code-style", "linting"]
}
```

**commands/format.md:**
```markdown
---
description: Format code according to project standards
allowed-tools: Read, Write, Edit, Bash
---

# Code Formatting

Format the code according to the project's style guidelines.

## Context

Current file: @$ARGUMENTS
Style guide: @.prettierrc.json or @.eslintrc.js

## Task

1. Read the file(s) specified in $ARGUMENTS
2. Apply formatting rules from style guide
3. Write the formatted code back
4. Report what was changed

## Output

Provide a summary of changes:
- Files formatted
- Issues fixed
- Style violations corrected
```

### Example 2: Agent-Only Plugin

```
security-scanner/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── security-reviewer.md
└── README.md
```

**plugin.json:**
```json
{
  "name": "security-scanner",
  "displayName": "Security Scanner",
  "description": "Automated security review agent for code analysis",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "url": "https://github.com/yourusername"
  },
  "license": "MIT",
  "keywords": ["security", "vulnerability", "scanning"]
}
```

**agents/security-reviewer.md:**
```markdown
---
name: security-reviewer
description: Security expert that reviews code for vulnerabilities. Use proactively after code changes involving authentication, data handling, or external APIs.
tools: Read, Grep, Glob, Bash(git:*)
---

You are a security expert specializing in application security.

## When Invoked

1. Run `git diff HEAD` to see recent changes
2. Focus on security-sensitive areas:
   - Authentication/authorization
   - Data validation
   - API endpoints
   - Database queries
   - File operations

## Security Checklist

- [ ] Input validation implemented
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Secrets not hardcoded
- [ ] Proper error handling (no info leakage)
- [ ] Authentication checks
- [ ] Authorization checks
- [ ] Secure data transmission
- [ ] Safe file operations

## Output Format

## Security Review Summary
[Overall assessment]

## Critical Issues (Must Fix Immediately)
- [Issue 1]: Location, risk, solution

## Warnings (Should Fix Soon)
- [Issue 1]: Location, risk, solution

## Recommendations (Consider)
- [Suggestion 1]: Location, benefit

## Secure Practices Found
- [Good practice 1]
```

### Example 3: Complete Plugin with Everything

```
full-stack-tools/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── api/
│   │   ├── create.md
│   │   └── test.md
│   ├── db/
│   │   ├── migrate.md
│   │   └── seed.md
│   └── deploy.md
├── agents/
│   ├── api-architect.md
│   ├── db-expert.md
│   └── deployment-specialist.md
├── shared/
│   ├── api-standards.md
│   ├── db-best-practices.md
│   └── deployment-checklist.md
├── README.md
├── CHANGELOG.md
└── LICENSE
```

## Documentation Templates

### Installation Guide Template

```markdown
# Installation Guide

## Prerequisites

- Claude Code version X.X.X or higher
- [Any other requirements]

## Quick Start

```bash
# Add marketplace
/plugin marketplace add user/repo

# Install plugin
/plugin install plugin-name@marketplace-name
```

## Detailed Installation

### Step 1: Add Marketplace

```bash
/plugin marketplace add user/repo
```

**What this does:** Adds the marketplace to your Claude Code configuration.

### Step 2: Browse Plugins

```bash
/plugin
```

**What this does:** Opens the plugin browser showing all available plugins.

### Step 3: Install Plugin

```bash
/plugin install plugin-name@marketplace-name
```

**What this does:** Installs the plugin and makes its commands/agents available.

### Step 4: Verify Installation

```bash
/help
```

**What to look for:** Your plugin's commands should appear in the list.

## Updating Plugins

```bash
/plugin update plugin-name@marketplace-name
```

## Uninstalling Plugins

```bash
/plugin uninstall plugin-name
```

## Troubleshooting

### Plugin Not Found

**Problem:** `/plugin` doesn't show the plugin

**Solutions:**
1. Verify marketplace is added: `/plugin marketplace list`
2. Re-add marketplace if needed
3. Check marketplace URL is correct

### Command Not Working

**Problem:** Command executes but fails

**Solutions:**
1. Check command syntax: `/help`
2. Verify required files exist
3. Check permissions
4. Review error message

### Installation Fails

**Problem:** Installation process fails

**Solutions:**
1. Check Claude Code version
2. Verify network connection
3. Try removing and re-adding marketplace
4. Check repository is accessible

## Getting Help

- [Report Issues](https://github.com/user/repo/issues)
- [Documentation](https://github.com/user/repo/tree/main/docs)
- [Discussions](https://github.com/user/repo/discussions)
```

### Contributing Guide Template

```markdown
# Contributing to [Project Name]

Thank you for considering contributing to our Claude Code plugins!

## Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🔧 Submit bug fixes
- ✨ Add new features
- 🧪 Add tests
- 💬 Help others in discussions

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/repo.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Commit: `git commit -m "Add feature: description"`
7. Push: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Plugin Development Guidelines

### Creating a New Plugin

1. Create plugin directory: `plugins/your-plugin-name/`
2. Add `.claude-plugin/plugin.json` with metadata
3. Create `commands/` and/or `agents/` directories
4. Add `README.md` with documentation
5. Add entry to `marketplace.json`
6. Test locally
7. Submit PR

### Plugin Structure

```
plugins/your-plugin-name/
├── .claude-plugin/
│   └── plugin.json       # Required
├── commands/              # Optional
│   └── command.md
├── agents/                # Optional
│   └── agent.md
├── shared/                # Optional
│   └── resources.md
└── README.md              # Required
```

### Code Style

- Use lowercase-with-hyphens for names
- Include frontmatter in commands/agents
- Write clear descriptions
- Add usage examples
- Document edge cases

### Testing

Before submitting:

1. Validate JSON: `jq empty plugin.json`
2. Test locally: `/plugin marketplace add /path/to/repo`
3. Install plugin: `/plugin install plugin-name@marketplace`
4. Test all commands
5. Test all agents
6. Verify documentation

### Commit Messages

Use conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Formatting changes
- `refactor:` Code restructuring
- `test:` Adding tests
- `chore:` Maintenance

Examples:
```
feat: add /investigate:deep command
fix: resolve timeout in /genius command
docs: update installation guide
```

## Pull Request Process

1. **Update Documentation**: Keep README and docs current
2. **Add Tests**: Include test cases for new features
3. **Update Changelog**: Add entry to CHANGELOG.md
4. **Version Bump**: Update version in plugin.json if needed
5. **Description**: Write clear PR description explaining changes

### PR Checklist

- [ ] Code follows project style
- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped (if needed)
- [ ] JSON files validated
- [ ] Tested locally

## Code Review Process

1. Maintainers review within 1 week
2. Address feedback
3. Maintainer approves
4. Maintainer merges

## Questions?

- Open an [issue](https://github.com/user/repo/issues)
- Start a [discussion](https://github.com/user/repo/discussions)
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the [License Type].
```

## Script Templates

### Validation Script

```bash
#!/bin/bash
# validate-marketplace.sh - Validate marketplace structure

set -e

echo "=== Marketplace Validation ==="

# Validate marketplace.json
echo "Checking marketplace.json..."
jq empty .claude-plugin/marketplace.json && echo "✓ Valid JSON"

# Check required fields
jq -e '.name' .claude-plugin/marketplace.json > /dev/null && echo "✓ Has name"
jq -e '.version' .claude-plugin/marketplace.json > /dev/null && echo "✓ Has version"
jq -e '.plugins' .claude-plugin/marketplace.json > /dev/null && echo "✓ Has plugins"

# Validate each plugin
echo ""
echo "=== Plugin Validation ==="

for plugin_dir in plugins/*/; do
  plugin_name=$(basename "$plugin_dir")
  echo "Checking $plugin_name..."

  # Check plugin.json exists and is valid
  if [ -f "$plugin_dir/.claude-plugin/plugin.json" ]; then
    jq empty "$plugin_dir/.claude-plugin/plugin.json" && echo "  ✓ Valid plugin.json"
    jq -e '.name' "$plugin_dir/.claude-plugin/plugin.json" > /dev/null && echo "  ✓ Has name"
    jq -e '.version' "$plugin_dir/.claude-plugin/plugin.json" > /dev/null && echo "  ✓ Has version"
  else
    echo "  ✗ Missing plugin.json"
    exit 1
  fi

  # Check README exists
  if [ -f "$plugin_dir/README.md" ]; then
    echo "  ✓ Has README"
  else
    echo "  ✗ Missing README"
  fi

  # Check has content
  if [ -d "$plugin_dir/commands" ] || [ -d "$plugin_dir/agents" ]; then
    echo "  ✓ Has content"
  else
    echo "  ⚠ No commands or agents"
  fi

  # Count components
  cmd_count=$(find "$plugin_dir/commands" -name "*.md" 2>/dev/null | wc -l)
  agent_count=$(find "$plugin_dir/agents" -name "*.md" 2>/dev/null | wc -l)
  echo "  → $cmd_count commands, $agent_count agents"
done

echo ""
echo "=== Validation Complete ==="
```

### Migration Script Template

```bash
#!/bin/bash
# migrate-to-plugins.sh - Migrate .claude directory to plugins

set -e

SOURCE_DIR="/workspace/.claude"
DEST_DIR="/path/to/plugin-repo/plugins"

# Function to migrate plugin
migrate_plugin() {
  local plugin_name=$1
  local plugin_dir="$DEST_DIR/$plugin_name"

  echo "Migrating $plugin_name..."

  # Create directories
  mkdir -p "$plugin_dir/.claude-plugin"
  mkdir -p "$plugin_dir/commands"
  mkdir -p "$plugin_dir/agents"
  mkdir -p "$plugin_dir/shared"

  # Copy files based on plugin
  # (Add specific copy commands for each plugin)

  echo "  ✓ $plugin_name migrated"
}

# Migrate each plugin
migrate_plugin "plugin1"
migrate_plugin "plugin2"
migrate_plugin "plugin3"

echo ""
echo "=== Migration Complete ==="
```

## Next Steps

1. Choose appropriate templates for your use case
2. Customize templates with your information
3. Follow the structure and patterns shown
4. Test thoroughly before publishing
5. Iterate based on feedback
