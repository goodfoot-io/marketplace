# Goodfoot Marketplace

A Claude Code marketplace whose portable skill sources also build for Codex, OpenCode, and Antigravity, plus the npm packages used by those plugins.

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
/plugin install agent-skills@goodfoot
```

## Repository Structure

Every plugin under `skills-src/` builds into all four platform roots by convention — no declared target list, no exceptions:

```
marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest for Claude Code
├── .agents/plugins/
│   └── marketplace.json          # Marketplace manifest for Codex
├── skills-src/                   # Authored portable Eta skill templates
├── plugins-claude/                # Claude plugin roots and generated skills
├── plugins-codex/                 # Codex manifests and generated skills
├── plugins-opencode/               # OpenCode packages and generated skills
├── plugins-antigravity/            # Bare manifests and generated applicable skills
├── packages/                     # Compiler, validation, and runtime packages
├── .claude/                       # Project-level commands (not distributed)
│   ├── commands/                  # Local development commands
│   └── agents/                    # Local development agents
└── documentation/                # Plugin authoring and style guides
```

### Directory Purpose

| Directory | Purpose | Distribution |
|-----------|---------|--------------|
| `.claude-plugin/` | Claude marketplace manifest | Required for marketplace functionality |
| `.agents/plugins/` | Codex marketplace manifest | Required for Codex distribution |
| `skills-src/` | Authored portable skill templates | Input to the convention-driven build |
| `plugins-claude/` | Claude Code plugins (generated + hand-maintained) | Distributed via marketplace |
| `plugins-codex/` | Codex plugin trees | Codex distribution |
| `plugins-opencode/` | OpenCode plugin trees | OpenCode distribution |
| `plugins-antigravity/` | Antigravity plugin trees | Antigravity distribution |
| `packages/` | Compiler, validation, and runtime packages | Workspace/npm packages |
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

**Currently available plugins:**

- Eight plugins built from `skills-src/` and distributed at the standard per-platform path (`plugins-claude/<name>`, `plugins-codex/<name>`, `plugins-opencode/<name>`, `plugins-antigravity/<name>`): `agent-hooks`, `agent-skills`, `claude-code-skill-reader`, `gmail`, `goodfoot`, `jsdoczoom`, `linear`, and `voice`
- Two hand-maintained, Claude-only plugins with no `skills-src/` source: `typescript-hooks` and `expansion`

Among the eight, a plugin's rendered content can still be gated to a subset of platforms per skill (`voice`'s handbook, for instance, only ships on Claude Code, since the MCP server it documents doesn't run anywhere else) — but its directory exists at all four standard roots regardless, with no per-plugin opt-out.

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
3. Install desired plugins: `/plugin install <name>@goodfoot`
4. Use the commands/agents in your projects

**Example:**
```bash
# Install the portable skill-authoring plugin
/plugin install agent-skills@goodfoot
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

The voice plugin is the repository's concrete MCP example; its package and plugin documentation describe its runtime configuration.

## Development

### Working with Plugins

See the comprehensive [plugin development documentation](documentation/claude-plugin-authoring.md) for:
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
yarn build

# Work on a specific package
yarn workspace @goodfoot/agent-skills build
```

### Local Testing

From the repository root, start Claude Code and add the current checkout as a local marketplace:

```bash
# Add the repository root as a local marketplace
/plugin marketplace add ./

# Browse local plugins
/plugin

# Install and test a local plugin
/plugin install agent-skills@goodfoot
```

## Monorepo Structure

This repository uses Yarn 4 workspaces:

- **Package Manager:** Yarn 4.12.0
- **Workspace Pattern:** `packages/*`
- **TypeScript:** Shared configuration at root
- **ESLint:** Shared configuration at root

## Project Commands

The `.claude/` directory contains useful commands for working on this repository:

```bash
# View available commands
/help

# Examples present in .claude/commands/
/trace
/update-skills
```

Note: These commands are only available when working within this repository, they are not distributed via the marketplace.

## Contributing

Contributions are welcome! You can contribute:

1. **New Plugins:** Add portable skills under `skills-src/<name>/` to build across all four platforms by convention, or add a genuinely hand-maintained, Claude-only plugin directly under `plugins-claude/`
2. **MCP Servers:** Create new packages in `packages/`
3. **Documentation:** Improve guides and examples
4. **Bug Fixes:** Report or fix issues

Please follow the [plugin development guidelines](documentation/claude-plugin-authoring.md) when contributing plugins.

## Installation Examples

### For Plugin Users

```bash
# Step 1: Add marketplace
/plugin marketplace add goodfoot-io/marketplace

# Step 2: Browse available plugins
/plugin

# Step 3: Install a real marketplace plugin
/plugin install agent-skills@goodfoot
```

### For MCP Server Users

```bash
# Build the repository's voice package
yarn workspace @goodfoot/voice build
```

## Architecture

Portable plugin architecture, computed by convention rather than declared in a registry:

1. `skills-src/<plugin>/` owns authored Eta templates and opaque skill assets. Every directory here is a plugin; its shape — which platforms it renders to, where its manifest lives — follows fixed, formulaic per-platform paths (`plugins-claude/<plugin>`, `plugins-codex/<plugin>`, `plugins-opencode/<plugin>`, `plugins-antigravity/<plugin>`), not a declared target list. A skill file can still gate itself to a subset of platforms with a `platforms:` front-config declaration.
2. `yarn build:agent-skills` produces the Claude/Codex/OpenCode/Antigravity trees for every `skills-src/` plugin; generated `SKILL.md` files are not authoring surfaces.
3. `yarn lint:agent-skills` validates generated ownership and portability.
4. Hand-maintained, Claude-only plugins with no `skills-src/` sibling (`typescript-hooks`, `expansion`) live directly under `plugins-claude/` and are out of scope for the build.

Antigravity plugins use a bare root `plugin.json`. Hooks use a root `hooks.json`, not Claude's `hooks/hooks.json`; this repository does not publish Antigravity hooks or MCP payloads until `agy plugin validate` reports a positive processed category.

A plugin's Claude manifest is the version of record. `./scripts/sync-plugin-versions.sh` propagates it to the Codex manifest, OpenCode package, Antigravity manifest, and the Claude marketplace entry for every `skills-src/` plugin; the pre-commit hook runs it automatically whenever a plugin's owned files change. A plugin's npm package (`packages/<name>`), where one exists, is a separate release line with its own manually-bumped version.

## Support

- **Issues:** [GitHub Issues](https://github.com/goodfoot-io/marketplace/issues)
- **Discussions:** [GitHub Discussions](https://github.com/goodfoot-io/marketplace/discussions)
- **Documentation:** [Plugin authoring guide](documentation/claude-plugin-authoring.md)
- **Email:** contact@goodfoot.io

## Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude/docs)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Plugin Development Guide](documentation/claude-plugin-authoring.md)

## Validation

```bash
yarn build:agent-skills
yarn build:agent-skills --check-targets
yarn lint:agent-skills
./scripts/sync-plugin-versions.sh --check
```

CI validates declared Antigravity roots with `agy plugin validate` and requires a positive processed result rather than accepting exit status alone.

---

Built with Claude Code | Maintained by [Goodfoot](https://goodfoot.io)
