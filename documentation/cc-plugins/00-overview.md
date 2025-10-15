# Claude Code Plugins - Overview

## Executive Summary

This documentation provides a comprehensive guide for publishing Claude Code plugins from the current `.claude/` directory to a new GitHub repository at `https://github.com/goodfoot-io/cc-plugins`.

**Current State:**
- Rich collection of custom commands, agents, and configurations in `.claude/`
- 35+ custom slash commands organized in namespaces
- 12+ specialized subagents for various development tasks
- Custom hooks and settings for workflow automation

**Goal:**
- Create a public plugin marketplace at `goodfoot-io/cc-plugins`
- Enable one-command installation: `/plugin marketplace add goodfoot-io/cc-plugins`
- Share best practices and productivity workflows with the community
- Maintain versioning and updates for continuous improvement

## What Are Claude Code Plugins?

Claude Code plugins are packaged collections of extensions that enhance the AI coding assistant's capabilities. Each plugin can include:

1. **Slash Commands** - Custom shortcuts for frequently-used operations
2. **Subagents** - Specialized AI assistants for specific task types
3. **MCP Servers** - Integrations with external tools and data sources
4. **Hooks** - Event-driven automation for workflow customization

## Why Create a Plugin Marketplace?

### Benefits

**For Users:**
- ✅ One-command installation of curated workflows
- ✅ Browse and discover productivity-enhancing tools
- ✅ Easily toggle plugins on/off as needed
- ✅ Automatic updates when you publish new versions

**For Your Team:**
- ✅ Standardize development practices across projects
- ✅ Share institutional knowledge through codified workflows
- ✅ Reduce onboarding time with ready-to-use tools
- ✅ Continuous improvement through versioned releases

**For the Community:**
- ✅ Contribute to the Claude Code ecosystem
- ✅ Learn from others' plugin implementations
- ✅ Build reputation as a developer productivity expert
- ✅ Receive feedback and contributions from users

## Plugin Marketplace Ecosystem

As of January 2025, several notable marketplaces exist:

### Official Examples
- **Anthropic's Example Plugins**: PR review, security guidance, Claude Agent SDK development
- **Plugin Generator**: Meta-plugin for creating new plugins

### Community Marketplaces
- **ananddtyagi/claude-code-marketplace**: 113 plugins (35 commands + 78 agents)
  - Community-driven with web directory at claudecodecommands.directory
  - Auto-sync from live database
  - Granular, independent plugin installation

- **EveryInc/every-marketplace**: Official Every.to workflow marketplace
  - Focus on "Compounding Engineering" philosophy
  - AI-powered development workflows
  - Specialized agents for code review, testing, PR management

- **wshobson/agents**: 83+ specialized agents collection
  - 15 workflow orchestrators
  - 42 development utilities
  - Domain-specific agents (Architecture, Programming Languages, Infrastructure)

- **Dan Ávila's marketplace**: DevOps, documentation, project management plugins

## Current Asset Inventory

Your `.claude/` directory contains:

### Commands (35+)
```
.claude/commands/
├── document.md
├── investigate.md
├── genius.md
├── jsdoc.md
├── plan-then-implement.md
├── recommend.md
├── second-opinion.md
├── test-agent.md
├── iterate-on/
│   ├── command.md
│   └── command-with-memory.md
├── project/
│   ├── create.md
│   ├── begin.md
│   ├── worktree.md
│   └── describe.md
├── review/
│   ├── complexity.md
│   ├── chain.md
│   ├── linting.md
│   ├── language.md
│   ├── tests-v2.md
│   └── producer-consumer.md
├── rewrite/
│   ├── complexity.md
│   ├── integrate.md
│   ├── headers.md
│   ├── pov.md
│   ├── language.md
│   ├── system-instructions.md
│   ├── prompt.md
│   └── tests-v2.md
└── utilities/
    ├── map-integration-chain.md
    └── echo.md
```

### Agents (12+)
```
.claude/agents/
├── codebase-explainer.md
├── documenter.md
├── test-agent-evaluation-runner.md
├── test-evaluator.md
├── test-issue-reproducer.md
└── project/
    ├── assumption-tester.md
    ├── implementation-evaluator.md
    ├── project-implementer.md
    ├── project-plan-assessor.md
    └── sledgehammer.md
```

### Supporting Files
```
.claude/
├── memory/
│   └── command-improvement-tips.md
├── output-styles/
│   └── forensic-investigator.md
├── shared/
│   ├── codebase-tool-patterns.md
│   ├── jest-mocking-guide.md
│   └── project-plan-annotated-example.md
└── settings.json
```

## Repository Structure Goals

The new `goodfoot-io/cc-plugins` repository will follow this structure:

```
cc-plugins/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace metadata and plugin catalog
├── plugins/
│   ├── investigation-toolkit/    # Plugin: Investigation and analysis tools
│   ├── project-orchestrator/     # Plugin: Project planning and execution
│   ├── code-quality-suite/       # Plugin: Review and rewrite commands
│   ├── test-automation/          # Plugin: Testing agents and workflows
│   └── developer-utilities/      # Plugin: Utility commands and helpers
├── docs/
│   ├── installation.md
│   ├── plugin-guides/
│   └── contributing.md
├── examples/
│   └── usage-examples.md
├── README.md
├── LICENSE
└── .gitignore
```

## Next Steps

1. **Review Plugin Anatomy** - Understand the structure of plugins and marketplace files
2. **Setup GitHub Repository** - Create and configure the repository
3. **Organize Plugins** - Group related commands/agents into logical plugins
4. **Create Marketplace Manifest** - Write the marketplace.json file
5. **Document Usage** - Write clear installation and usage instructions
6. **Publish and Share** - Make the marketplace available to the community

## Documentation Structure

This documentation is organized into focused sections:

- **00-overview.md** (this file) - High-level introduction
- **01-plugin-anatomy.md** - Detailed plugin structure and formats
- **02-marketplace-setup.md** - Repository configuration and setup
- **03-publishing-workflow.md** - Step-by-step publishing process
- **04-current-inventory.md** - Analysis of existing .claude/ assets
- **05-migration-strategy.md** - Plan for organizing into plugins
- **06-best-practices.md** - Recommendations and patterns
- **07-templates.md** - Reusable templates and examples

## References

- [Claude Code Plugin Documentation](https://docs.claude.com/en/docs/claude-code/plugins)
- [Plugin Marketplaces Documentation](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)
- [Claude Code Plugins Announcement](https://www.anthropic.com/news/claude-code-plugins)
- [Custom Slash Commands](https://docs.claude.com/en/docs/claude-code/custom-commands)
- [Subagents Documentation](https://docs.claude.com/en/docs/claude-code/subagents)
