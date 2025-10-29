# Claude Code Plugins

This directory contains Claude Code plugins that can be installed via the Goodfoot Marketplace.

## What are Plugins?

Claude Code plugins are collections of commands and agents that extend Claude Code's functionality. They are distributed via the marketplace and can be installed on-demand by users.

## Browsing Plugins

After adding the Goodfoot Marketplace to Claude Code, you can browse available plugins:

```bash
/plugin
```

## Installing Plugins

Install any plugin from this marketplace:

```bash
/plugin install <plugin-name>@goodfoot-marketplace
```

For example:
```bash
/plugin install investigation-toolkit@goodfoot-marketplace
```

## Plugins vs MCP Packages

This repository serves dual purposes:

- **Plugins** (this directory): Reusable commands and agents that can be installed via the marketplace into any Claude Code project
- **MCP Packages** (`/packages/`): Model Context Protocol server implementations that provide tools and resources to Claude

Key differences:

| Plugins | MCP Packages |
|---------|--------------|
| Slash commands and agents | MCP servers with tools/resources |
| Installed per-project via `/plugin install` | Configured globally or per-project in `claude_desktop_config.json` |
| Markdown-based (.md files) | TypeScript/JavaScript implementations |
| Extend Claude Code workflows | Extend Claude's capabilities |

## Available Plugins

Currently, this marketplace is being prepared for plugin distribution. Plugins will be added here as they are packaged and published.

## Documentation

For installation instructions and getting started, see the main [README.md](/workspace/README.md) at the repository root.

## Contributing

To contribute a plugin to this marketplace:

1. Create your plugin in this directory following the [plugin structure guidelines](../documentation/cc-plugins/01-plugin-anatomy.md)
2. Add an entry to `/.claude-plugin/marketplace.json`
3. Test locally using `/plugin marketplace add /workspace`
4. Submit a pull request

See the [Claude Code plugin documentation](../documentation/cc-plugins/) for detailed guidelines.
