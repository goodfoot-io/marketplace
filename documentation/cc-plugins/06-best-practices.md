# Best Practices for Claude Code Plugins

This document compiles best practices, recommendations, and lessons learned from the Claude Code plugin ecosystem.

## Plugin Design Principles

### 1. Single Responsibility

Each plugin should have a clear, focused purpose.

**Good:**
```
investigation-toolkit: Decision-making and analysis tools
test-automation: Testing workflows and agents
```

**Avoid:**
```
everything-plugin: Commands, agents, and utilities for all purposes
```

**Why:** Focused plugins are easier to maintain, understand, and selectively install.

### 2. Consistent Naming

Use clear, descriptive names following conventions:

**Plugin Names:**
- Lowercase with hyphens: `investigation-toolkit`
- Descriptive of purpose: `code-quality-suite`
- Avoid abbreviations: `documentation-tools` not `doc-tools`

**Command Names:**
- Action-oriented: `/investigate`, `/review`, `/rewrite`
- Use namespaces for organization: `/project:create`, `/review:complexity`
- Be specific: `/jsdoc` not just `/doc`

**Agent Names:**
- Descriptive role: `code-reviewer`, `test-issue-reproducer`
- Present tense: `documenter` not `documentation`
- Avoid generic names: `security-scanner` not `helper`

### 3. Comprehensive Documentation

Every plugin component needs documentation:

**Plugin README should include:**
- Clear description of purpose
- Installation instructions
- List of commands with usage examples
- List of agents with use cases
- Tips and best practices

**Commands should have:**
- `description` in frontmatter (shown in `/help`)
- `argument-hint` for auto-complete
- Usage examples in plugin README

**Agents should have:**
- `description` explaining when to invoke
- Clear system prompt defining role
- Tool specifications appropriate for task

### 4. Appropriate Tool Access

Grant only necessary tools to agents and commands.

**Tool Selection Guidelines:**

| Task Type | Recommended Tools | Avoid |
|-----------|------------------|-------|
| **Read-only analysis** | Read, Grep, Glob | Write, Edit, Bash |
| **Code modification** | Read, Write, Edit | Bash (unless needed) |
| **Git operations** | Bash(git:*), Read | Write, Edit to git files |
| **Testing** | All tools (*) | - |
| **Documentation** | Read, Write, Grep, Glob | Bash (unless needed) |

**Examples:**

```markdown
---
# Code reviewer - read only
tools: Read, Grep, Glob, Bash(git:*)
---

---
# Code writer - needs modification
tools: Read, Write, Edit, Grep, Glob
---

---
# Test runner - needs everything
tools: *
---
```

### 5. Semantic Versioning

Follow semver strictly:

- **Major (1.0.0 → 2.0.0)**: Breaking changes
  - Removed commands/agents
  - Changed command syntax
  - Incompatible behavior changes

- **Minor (1.0.0 → 1.1.0)**: New features
  - New commands
  - New agents
  - Enhanced functionality
  - Backward compatible

- **Patch (1.0.0 → 1.0.1)**: Bug fixes
  - Bug fixes
  - Documentation updates
  - No behavior changes

**Example Changelog:**
```markdown
## [1.2.0] - 2025-02-01
### Added
- New `/investigate:deep` command for extended analysis
- `risk-assessor` agent for security evaluation

### Changed
- Improved `/investigate` to include more diverse solutions

### Fixed
- Fixed `/genius` timeout issue with complex problems

## [1.1.0] - 2025-01-15
### Added
- `/second-opinion` command

## [1.0.0] - 2025-01-01
### Added
- Initial release with core investigation commands
```

## Command Best Practices

### 1. Use Frontmatter Effectively

**Complete frontmatter:**
```markdown
---
description: Create comprehensive JSDoc documentation
allowed-tools: Read, Write, Edit, Grep, Glob
argument-hint: <file-or-directory-path> [additional-paths...]
---
```

**Minimal frontmatter (when defaults are fine):**
```markdown
---
description: Quick code review
---
```

### 2. Handle Arguments Gracefully

```markdown
# Good: Handle missing or malformed arguments
$ARGUMENTS is provided: $ARGUMENTS

If $ARGUMENTS is empty, analyze the current directory.
If $ARGUMENTS contains multiple paths, process each one.

# Avoid: Assuming argument format
Process file: $ARGUMENTS (what if it's not a file?)
```

### 3. Provide Context in Commands

```markdown
# Good: Include relevant context
Current branch: !`git branch --show-current`
Recent commits: !`git log --oneline -5`
Modified files: !`git status --short`

# Avoid: Making Claude guess
Create a commit. (What files? What message?)
```

### 4. Use File References Wisely

```markdown
# Good: Specific references
Review the implementation in @src/services/auth.ts
Compare @config/dev.json with @config/prod.json

# Avoid: Overloading with files
Review @src/* @tests/* @config/* (too much context)
```

### 5. Namespace Organization

Organize related commands in namespaces:

```
commands/
├── review/
│   ├── complexity.md      → /review:complexity
│   ├── security.md        → /review:security
│   └── performance.md     → /review:performance
├── rewrite/
│   ├── simplify.md        → /rewrite:simplify
│   └── optimize.md        → /rewrite:optimize
└── analyze.md             → /analyze
```

**Benefits:**
- Logical grouping
- Easy discovery
- Auto-complete friendly

## Agent Best Practices

### 1. Clear Invocation Triggers

Write descriptions that clearly state when to use the agent:

**Good:**
```markdown
---
description: Expert code reviewer for quality and security. Use proactively after code changes.
---
```

**Better:**
```markdown
---
description: MUST BE USED immediately after Write or Edit tools. Reviews code for quality, security, and maintainability issues. Use proactively - do not wait to be asked.
---
```

**Why:** Explicit triggers help Claude Code decide when to invoke agents.

### 2. Structured Agent Prompts

Use consistent structure in agent system prompts:

```markdown
---
name: agent-name
description: When to use this agent
tools: Read, Write, Edit
---

# Role Definition
You are a [role] specializing in [domain].

# When Invoked
1. [First action]
2. [Second action]
3. [Third action]

# Guidelines
- [Important guideline 1]
- [Important guideline 2]
- [Best practice]

# Process
For each [task]:
1. [Step 1]
2. [Step 2]
3. [Step 3]

# Output Format
[How to structure responses]
```

### 3. Scope Agent Responsibilities

**Good:**
- `test-runner`: Runs tests, reports failures
- `test-reproducer`: Creates minimal reproductions
- `test-fixer`: Fixes failing tests

**Avoid:**
- `test-agent`: Does everything related to testing

**Why:** Focused agents perform better than generalists.

### 4. Explicit Tool Lists

Be explicit about tools rather than using `*`:

```markdown
# Good: Specific tools for focused task
---
tools: Read, Grep, Glob, Bash(git:*)
---

# Acceptable: All tools for complex task
---
tools: *
---

# Avoid: All tools for simple task
---
description: Check code formatting
tools: *
---
# Should be: Read, Grep
```

### 5. Include Examples in Prompts

```markdown
# Your Role
You are a code reviewer.

# Example Review Format
## Critical Issues
- [Issue 1]: Explanation and location

## Warnings
- [Warning 1]: Explanation and suggestion

## Suggestions
- [Suggestion 1]: Optional improvement
```

## Marketplace Best Practices

### 1. Descriptive Metadata

**Complete plugin entry:**
```json
{
  "name": "investigation-toolkit",
  "displayName": "Investigation Toolkit",
  "description": "Parallel evaluation and investigation tools for making informed decisions",
  "version": "1.0.0",
  "source": "plugins/investigation-toolkit",
  "author": {
    "name": "Goodfoot",
    "url": "https://github.com/goodfoot-io"
  },
  "keywords": [
    "investigation",
    "analysis",
    "decision-making",
    "evaluation",
    "parallel"
  ],
  "license": "MIT",
  "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/investigation-toolkit"
}
```

**Why each field matters:**
- `displayName`: Shown in UI (user-friendly)
- `description`: Helps users understand purpose
- `keywords`: Enables discovery
- `homepage`: Links to detailed docs
- `author.url`: Credits and contact

### 2. Consistent Version Management

**Repository-level versioning:**
```json
{
  "name": "goodfoot-plugins",
  "version": "1.0.0",
  "plugins": [...]
}
```

**Plugin-level versioning:**
```json
{
  "name": "investigation-toolkit",
  "version": "1.2.0"
}
```

**Strategy:** Update marketplace version when:
- Adding new plugins
- Removing plugins
- Major changes to marketplace structure

Update plugin version when:
- Changing that specific plugin
- Independent of other plugins

### 3. Source Path Organization

**Relative paths (recommended):**
```json
{
  "source": "plugins/investigation-toolkit"
}
```

**Git URLs (for external plugins):**
```json
{
  "source": "https://github.com/user/plugin-repo"
}
```

**Why relative paths:** Easier to test locally, clearer structure.

### 4. Comprehensive README

Your marketplace README should answer:
- **What:** What plugins are available?
- **Why:** Why should someone use your marketplace?
- **How:** How to install and use plugins?
- **Where:** Where to get help and report issues?

**Template structure:**
```markdown
# Marketplace Name

[Brief description]

## Quick Start
[Installation commands]

## Available Plugins
[Table or list with descriptions]

## Documentation
[Links to guides]

## Support
[How to get help]

## Contributing
[How to contribute]
```

## Testing Best Practices

### 1. Test Locally First

```bash
# Always test locally before publishing
/plugin marketplace add /absolute/path/to/marketplace
/plugin install plugin-name@marketplace-name

# Test every command and agent
/command-name arg1 arg2
```

### 2. Create Test Cases

Document test cases for each component:

```markdown
# Test Cases for /investigate

## Test 1: Simple question
Input: `/investigate "Should I use REST or GraphQL?"`
Expected: 3 solutions, evaluations, recommendation

## Test 2: Complex question
Input: `/investigate "Architecture for real-time collaborative editor"`
Expected: In-depth analysis, multiple iterations

## Test 3: Malformed input
Input: `/investigate`
Expected: Handles gracefully, asks for clarification
```

### 3. Validate JSON Before Publishing

```bash
# Validate marketplace.json
jq empty .claude-plugin/marketplace.json

# Validate all plugin.json files
find plugins -name "plugin.json" -exec jq empty {} \;

# Check required fields
jq -e '.name, .version, .plugins' .claude-plugin/marketplace.json
```

### 4. Test Cross-Plugin Compatibility

If plugins reference each other:

```bash
# Install both plugins
/plugin install plugin-a@marketplace
/plugin install plugin-b@marketplace

# Test interdependent features
/plugin-a-command
# Verify plugin-b agent can be invoked
```

## Performance Best Practices

### 1. Minimize Context in Commands

```markdown
# Good: Targeted context
Recent changes: !`git diff HEAD --stat`
Modified files (up to 10): !`git diff HEAD --name-only | head -10`

# Avoid: Excessive context
All diffs: !`git diff HEAD` (potentially huge)
All files: !`find . -type f` (too many files)
```

### 2. Use Appropriate Tools in Agents

```markdown
# Good: Read, Grep (fast, efficient)
---
tools: Read, Grep, Glob
---

# Acceptable: All tools when needed
---
tools: *
---

# Avoid: All tools when not needed
---
description: Simple text analysis
tools: *  # Overhead for unused tools
---
```

### 3. Batch Operations

```markdown
# Good: Single comprehensive command
/review:complete @src/ --include-tests

# Avoid: Multiple sequential commands
/review:complexity @src/
/review:security @src/
/review:performance @src/
# (Better as a single comprehensive review)
```

## Security Best Practices

### 1. Limit Bash Access

```markdown
# Good: Specific git commands only
---
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---

# Avoid: Unrestricted bash
---
allowed-tools: Bash
---
```

### 2. Avoid Storing Secrets

```markdown
# Avoid: Hardcoded secrets
API_KEY="sk-123456789"
Run command with $API_KEY

# Good: Reference environment variables
Use the API key from environment variable $API_KEY
```

### 3. Validate File Paths

```markdown
# Good: Validate before operations
Ensure $ARGUMENTS is a valid file path within the project
If $ARGUMENTS contains "..", reject (directory traversal)

# Avoid: Blindly using paths
Process file: $ARGUMENTS
```

### 4. Clear Permission Requirements

Document required permissions in README:

```markdown
## Permissions Required

- **File System**: Read/write access to project directory
- **Git**: Execute git commands
- **Network**: None required
```

## Documentation Best Practices

### 1. Keep README Updated

Update README when:
- Adding commands/agents
- Changing behavior
- Fixing bugs
- Adding examples

**Automate when possible:**
```bash
# Generate command list from files
find commands -name "*.md" ! -name "CLAUDE.md" | sort
```

### 2. Include Usage Examples

Every command should have at least one example:

```markdown
### /investigate

**Usage:**
```bash
/investigate "Should we migrate to TypeScript?"
```

**Example output:**
```
Solution 1: Gradual Migration
[Analysis...]

Solution 2: Complete Rewrite
[Analysis...]

Solution 3: Hybrid Approach
[Analysis...]

Recommendation: Gradual Migration
[Justification...]
```
```

### 3. Document Edge Cases

```markdown
## Edge Cases

### Empty Arguments
If you run `/investigate` without arguments, you'll be prompted to provide a question.

### Long-Running Operations
Commands using parallel evaluation may take 2-5 minutes for complex problems.

### Rate Limiting
If you encounter rate limits, reduce the number of parallel evaluations.
```

### 4. Maintain Changelog

Update CHANGELOG.md for every release:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- New feature in development

## [1.1.0] - 2025-01-15

### Added
- New `/investigate:deep` command
- Support for custom evaluation criteria

### Changed
- Improved /investigate parallelization

### Fixed
- Fixed timeout issue in /genius command

## [1.0.0] - 2025-01-01

### Added
- Initial release
```

## Community Best Practices

### 1. Provide Support Channels

```markdown
## Support

- 🐛 [Report bugs](https://github.com/user/repo/issues)
- 💬 [Ask questions](https://github.com/user/repo/discussions)
- 📖 [Read docs](https://github.com/user/repo/tree/main/docs)
- 💡 [Request features](https://github.com/user/repo/issues/new?template=feature_request.md)
```

### 2. Accept Contributions

```markdown
## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation
- Share usage examples
```

### 3. Be Responsive

- Respond to issues within 48 hours
- Review PRs within a week
- Keep documentation updated
- Acknowledge feedback

### 4. Share Knowledge

- Write blog posts about your plugins
- Create video tutorials
- Share examples and use cases
- Participate in community discussions

## Maintenance Best Practices

### 1. Regular Updates

- Fix bugs promptly
- Add features based on feedback
- Update dependencies
- Improve documentation

### 2. Monitor Usage

Track (if possible):
- Which plugins are most popular
- Which commands are used most
- Common issues
- Feature requests

### 3. Deprecation Strategy

When removing features:

```markdown
## [2.0.0] - 2025-06-01

### Removed
- `/old-command` (deprecated in v1.5.0)

### Migration Guide
- Use `/new-command` instead of `/old-command`
- See [migration guide](docs/migration-v1-to-v2.md) for details
```

**Deprecation timeline:**
1. Announce deprecation (minor version)
2. Add warnings (patch version)
3. Remove feature (major version)
4. Provide migration guide

### 4. Version Support

Define support policy:

```markdown
## Version Support

- **Latest major version**: Full support
- **Previous major version**: Security fixes only
- **Older versions**: No support (please upgrade)

Example:
- v2.x.x: Full support
- v1.x.x: Security fixes until 2025-12-31
- v0.x.x: No longer supported
```

## Anti-Patterns to Avoid

### 1. Monolithic Plugins

❌ **Don't:**
```
super-plugin/
├── commands/
│   ├── investigate.md
│   ├── test.md
│   ├── review.md
│   ├── deploy.md
│   └── ... (50+ commands)
```

✅ **Do:**
```
investigation-toolkit/
├── commands/
│   ├── investigate.md
│   ├── second-opinion.md
│   └── genius.md

test-automation/
├── commands/
│   └── test.md
```

### 2. Vague Naming

❌ **Don't:**
- Plugin: `utils`
- Command: `/helper`
- Agent: `assistant`

✅ **Do:**
- Plugin: `developer-utilities`
- Command: `/document`
- Agent: `code-reviewer`

### 3. Missing Documentation

❌ **Don't:**
```markdown
# Plugin

A plugin.

Install it.
```

✅ **Do:**
```markdown
# Investigation Toolkit

Parallel evaluation tools for decision-making.

## Installation
`/plugin install investigation-toolkit@goodfoot-plugins`

## Commands
- `/investigate` - Evaluate multiple solutions...
[Detailed docs]
```

### 4. Tool Overuse

❌ **Don't:**
```markdown
---
description: Count lines in file
tools: *
---
```

✅ **Do:**
```markdown
---
description: Count lines in file
tools: Read
---
```

### 5. Hardcoded Paths

❌ **Don't:**
```markdown
Review the file at /Users/username/project/src/file.ts
```

✅ **Do:**
```markdown
Review the file at @src/file.ts
Current file: $ARGUMENTS
```

## Quick Reference Checklist

Before publishing your plugin:

- [ ] Plugin name follows conventions (lowercase, hyphens)
- [ ] plugin.json has all required fields
- [ ] Version follows semver
- [ ] README includes installation and usage
- [ ] All commands have descriptions
- [ ] All agents have clear invocation triggers
- [ ] Tools are appropriately scoped
- [ ] File paths are relative or use @ references
- [ ] No hardcoded secrets or credentials
- [ ] JSON files are valid
- [ ] Tested locally
- [ ] Documentation is complete
- [ ] CHANGELOG.md exists
- [ ] LICENSE file included
- [ ] Support channels defined

## Learning Resources

- [Official Claude Code Docs](https://docs.claude.com/en/docs/claude-code)
- [Plugin Marketplaces Guide](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)
- [Custom Commands](https://docs.claude.com/en/docs/claude-code/custom-commands)
- [Subagents Documentation](https://docs.claude.com/en/docs/claude-code/subagents)
- [Example Marketplaces](https://github.com/topics/claude-code-plugins)

## Getting Help

When encountering issues:

1. Check the [official documentation](https://docs.claude.com/en/docs/claude-code)
2. Search existing [GitHub issues](https://github.com/anthropics/claude-code/issues)
3. Ask in community forums
4. Review example marketplaces for patterns
5. Test locally to isolate problems

## Next Steps

- Review 07-templates.md for ready-to-use templates
- Study existing marketplaces for inspiration
- Start with a simple plugin and iterate
- Gather feedback and improve
