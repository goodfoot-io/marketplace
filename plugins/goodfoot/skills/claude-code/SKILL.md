---
name: Claude Code
description: Guide for creating and managing Claude Code marketplaces, plugins, subagents, slash commands, and MCP servers. Use when users want to develop Claude Code plugins, create plugin marketplaces, configure MCP servers, or extend Claude Code functionality with custom components.
---

### Plugin Marketplaces Guide
**URL**: https://docs.claude.com/en/docs/claude-code/plugin-marketplaces.md

**Overview**: Comprehensive guide for creating, hosting, and distributing plugin marketplaces.

**When to use**: Consult this document when you need to create a new plugin marketplace, understand the `marketplace.json` schema, set up marketplace hosting on GitHub or other git services, or configure team-wide plugin distribution. This is the primary resource for marketplace creators and organizations wanting to distribute plugins across teams. It covers the complete lifecycle from marketplace creation to distribution and troubleshooting.

### Plugins Guide
**URL**: https://docs.claude.com/en/docs/claude-code/plugins.md

**Overview**: Guide for installing, managing, and developing Claude Code plugins.

**When to use**: Reference this document when you need to understand how to add marketplace sources, install plugins from marketplaces, or get started with plugin development basics. This is particularly useful when onboarding new users to plugin functionality or when you need to understand the user experience of discovering and installing plugins. It also provides foundational concepts before diving into more technical plugin development.

### Plugins Reference
**URL**: https://docs.claude.com/en/docs/claude-code/plugins-reference.md

**Overview**: Complete technical specifications and schemas for plugin development.

**When to use**: Use this document when you need the exact `plugin.json` schema, understand directory structure requirements, learn about YAML frontmatter rules for components, or work with environment variables like `${CLAUDE_PLUGIN_ROOT}`. This is the authoritative technical reference for plugin developers who need precise specifications for manifest files, component paths, and structural requirements. Consult this when implementing or validating plugin configurations.

### Settings Reference
**URL**: https://docs.claude.com/en/docs/claude-code/settings.md

**Overview**: Configuration reference including marketplace settings and plugin options.

**When to use**: Reference this document when configuring `extraKnownMarketplaces` in team settings, understanding marketplace source types (GitHub, Git, local), or setting up team-level plugin configurations. This is essential for teams wanting to distribute plugins automatically through repository settings or when troubleshooting marketplace configuration issues. Use this when you need to understand how settings cascade from user-level to project-level.

## Plugin Component Documentation

### Slash Commands
**URL**: https://docs.claude.com/en/docs/claude-code/slash-commands.md

**Overview**: Guide for creating custom slash commands with markdown and frontmatter.

**When to use**: Consult this document when creating user-invokable commands for plugins, understanding command markdown format, or configuring command frontmatter specifications. This is essential when you want to add new commands like `/deploy` or `/analyze` that users can explicitly trigger. Use this when you need to understand command file structure, parameter handling, or how commands appear in the command palette.

### Agents/Subagents
**URL**: https://docs.claude.com/en/docs/claude-code/sub-agents.md

**Overview**: Guide for creating specialized agents that Claude invokes automatically.

**When to use**: Reference this document when creating specialized subagents for specific tasks, configuring agent capabilities, or defining agent markdown format. This is particularly useful when you want Claude to automatically invoke specialized behavior for tasks like code analysis, testing, or deployments. Consult this when you need to understand how agents are discovered, how capabilities are specified, or when to use agents versus commands.

### Skills
**URL**: https://docs.claude.com/en/docs/claude-code/skills.md

**Overview**: Guide for creating autonomous tools that extend Claude's capabilities.

**When to use**: Use this document when creating skills that Claude can invoke autonomously, understanding skill directory structure with `SKILL.md`, or adding supporting resources to skills. This is essential when you want to extend Claude's toolkit with specialized functionality that should be context-driven rather than user-invoked. Consult this when building complex skills with helper scripts, templates, or reference documentation.

### Hooks
**URL**: https://docs.claude.com/en/docs/claude-code/hooks.md

**Overview**: Reference for hook event types and hooks.json configuration.

**When to use**: Reference this document when you need to respond to Claude Code events like PreToolUse, PostToolUse, or UserPromptSubmit, understand hook types (command, validation, notification), or configure `hooks.json`. This is critical when you need to add validation logic, trigger actions on specific events, or integrate external workflows. Use this when you need the technical specification for hook configuration.

### Hooks Guide
**URL**: https://docs.claude.com/en/docs/claude-code/hooks-guide.md

**Overview**: Practical patterns and examples for using hooks effectively.

**When to use**: Consult this document for practical hook usage patterns, real-world examples, and best practices for implementing hooks. This complements the hooks reference with hands-on guidance and is particularly useful when you're new to hooks or looking for implementation patterns. Use this to understand common hook scenarios and learn from worked examples rather than just technical specifications.

### MCP Servers
**URL**: https://docs.claude.com/en/docs/claude-code/mcp.md

**Overview**: Guide for bundling Model Context Protocol servers with plugins.

**When to use**: Reference this document when integrating external tools and services through MCP, configuring `.mcp.json`, or bundling MCP servers that start automatically with your plugin. This is essential when your plugin needs to connect Claude to databases, APIs, file systems, or other external resources. Consult this when you need to understand MCP configuration format or how MCP servers are managed within plugins.

## Related Documentation

### Output Styles
**URL**: https://docs.claude.com/en/docs/claude-code/output-styles.md

**Overview**: Guide for customizing plugin output appearance and formatting.

**When to use**: Use this document when you want to customize how plugin outputs are displayed, create branded output styles, or improve the visual presentation of plugin results. This is particularly useful for plugins that generate structured output or reports and want to maintain consistent formatting. Consult this when you need to enhance the user experience of your plugin's output beyond plain text.

