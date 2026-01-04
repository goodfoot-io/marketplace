# Goodfoot Marketplace

A dual-purpose repository providing both a Claude Code plugin marketplace and a collection of MCP (Model Context Protocol) server packages for professional development workflows.

## Quick Start

### Adding the Marketplace

Add this marketplace to Claude Code to access all available plugins:

```bash
/plugin marketplace add goodfoot-io/marketplace
```

### Browsing Available Plugins

View all plugins in the marketplace:

```bash
/plugin
```

### Installing a Plugin

Install any plugin from this marketplace:

```bash
/plugin install <plugin-name>@goodfoot-marketplace
```

## Repository Structure

This repository serves two complementary purposes:

```
marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest for Claude Code
├── plugins/                       # Claude Code plugins (commands & agents)
│   └── [future plugins]           # Installable via /plugin install
├── packages/                      # MCP server packages
│   └── models/                    # Example: MCP server implementation
├── .claude/                       # Project-level commands (not distributed)
│   ├── commands/                  # Local development commands
│   └── agents/                    # Local development agents
└── documentation/                 # Plugin development guides
    └── cc-plugins/                # Claude Code plugin documentation
```

### Directory Purpose

| Directory | Purpose | Distribution |
|-----------|---------|--------------|
| `.claude-plugin/` | Marketplace manifest | Required for marketplace functionality |
| `plugins/` | Reusable Claude Code plugins | Distributed via marketplace |
| `packages/` | MCP server implementations | npm packages (published to registry) |
| `.claude/` | Project-specific workflows | Local only (not distributed) |
| `documentation/` | Development guides | Repository documentation |

## What's Inside

### 1. Claude Code Plugin Marketplace

The marketplace allows users to discover and install Claude Code plugins that extend functionality with specialized commands and agents.

**Key Features:**
- Browse available plugins via `/plugin`
- Install plugins on-demand per project
- Update plugins to latest versions
- Uninstall when no longer needed

**Currently Available Plugins:**
- *Plugins are being prepared for distribution. Check back soon!*

### 2. MCP Server Packages

This repository also serves as a monorepo for MCP (Model Context Protocol) server implementations. These servers provide tools and resources that extend Claude's capabilities.

**Available MCP Servers:**
- Check the `packages/` directory for available implementations
- Each package includes its own README with installation instructions

### 3. Local Development Commands

The `.claude/` directory contains project-specific commands and agents used for developing this repository. These are not distributed via the marketplace but are available when working on this project locally.

## Understanding the Dual Purpose

### Claude Code Plugins (Marketplace)

**What they are:**
- Collections of slash commands (e.g., `/investigate`, `/review:complexity`)
- Specialized agents for specific workflows
- Markdown-based definitions
- Distributed via the marketplace

**How to use them:**
1. Add the marketplace: `/plugin marketplace add goodfoot-io/marketplace`
2. Browse plugins: `/plugin`
3. Install desired plugins: `/plugin install <name>@goodfoot-marketplace`
4. Use the commands/agents in your projects

**Example:**
```bash
# Install investigation toolkit
/plugin install investigation-toolkit@goodfoot-marketplace

# Use the command
/investigate "How should I architect this feature?"
```

### MCP Servers (npm Packages)

**What they are:**
- TypeScript/JavaScript implementations
- Provide tools and resources to Claude
- Follow the Model Context Protocol specification
- Published to npm registry

**How to use them:**
1. Install via npm/yarn
2. Configure in `claude_desktop_config.json`
3. Tools become available to Claude automatically

**Example:**
```json
{
  "mcpServers": {
    "models": {
      "command": "node",
      "args": ["/path/to/packages/models/build/index.js"]
    }
  }
}
```

## Development

### Working with Plugins

See the comprehensive [plugin development documentation](documentation/cc-plugins/) for:
- Plugin anatomy and structure
- Marketplace setup guidelines
- Publishing workflows
- Best practices
- Templates and examples

### Working with MCP Servers

Each package in `packages/` is independently developed:

```bash
# Install dependencies
yarn install

# Build all packages
yarn workspaces foreach run build

# Work on a specific package
cd packages/models
yarn build
```

### Local Testing

Test the marketplace locally before publishing:

```bash
# Add local repository as marketplace
/plugin marketplace add /workspace

# Browse local plugins
/plugin

# Install and test a local plugin
/plugin install <plugin-name>@goodfoot-marketplace
```

## Monorepo Structure

This repository uses Yarn 4 workspaces:

- **Package Manager:** Yarn 4.9.4
- **Workspace Pattern:** `packages/*`
- **TypeScript:** Shared configuration at root
- **ESLint:** Shared configuration at root

## Project Commands

The `.claude/` directory contains useful commands for working on this repository:

```bash
# View available commands
/help

# Example commands (if available in .claude/)
/document              # Generate documentation
/review:complexity     # Review code complexity
/test-agent           # Test agent configurations
```

Note: These commands are only available when working within this repository, they are not distributed via the marketplace.

## Contributing

Contributions are welcome! You can contribute:

1. **New Plugins:** Add plugins to the `plugins/` directory
2. **MCP Servers:** Create new packages in `packages/`
3. **Documentation:** Improve guides and examples
4. **Bug Fixes:** Report or fix issues

Please follow the [plugin development guidelines](documentation/cc-plugins/) when contributing plugins.

## Installation Examples

### For Plugin Users

```bash
# Step 1: Add marketplace
/plugin marketplace add goodfoot-io/marketplace

# Step 2: Browse available plugins
/plugin

# Step 3: Install desired plugins
/plugin install investigation-toolkit@goodfoot-marketplace
/plugin install code-quality-suite@goodfoot-marketplace

# Step 4: Use the plugins
/investigate "Should I use REST or GraphQL?"
/review:complexity src/api/handler.ts
```

### For MCP Server Users

```bash
# Install MCP server package
npm install @goodfoot/models

# Configure in claude_desktop_config.json
{
  "mcpServers": {
    "models": {
      "command": "node",
      "args": ["./node_modules/@goodfoot/models/build/index.js"]
    }
  }
}

# Restart Claude Desktop - tools are now available
```

## Architecture

This repository bridges two important aspects of Claude Code development:

1. **User-Facing Workflows (Plugins):** High-level commands and agents for common development tasks
2. **Core Capabilities (MCP Servers):** Low-level tools and resources that extend Claude's base functionality

By combining both, we provide a comprehensive toolkit for professional development workflows.

## Support

- **Issues:** [GitHub Issues](https://github.com/goodfoot-io/marketplace/issues)
- **Discussions:** [GitHub Discussions](https://github.com/goodfoot-io/marketplace/discussions)
- **Documentation:** [Plugin Guides](documentation/cc-plugins/)
- **Email:** contact@goodfoot.io

## License

MIT License - see [LICENSE](LICENSE) for details.

## Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude/docs)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Plugin Development Guide](documentation/cc-plugins/README.md)

## Roadmap

- [ ] Package and publish first set of plugins
- [ ] Create comprehensive plugin documentation
- [ ] Publish MCP server packages to npm
- [ ] Add automated testing and validation
- [ ] Create plugin templates and generators
- [ ] Expand plugin collection based on community feedback

## Version History

See [CHANGELOG.md](CHANGELOG.md) for release history and version details.

---

Built with Claude Code | Maintained by [Goodfoot](https://goodfoot.io)
