# Marketplace Setup Guide

## Repository Structure

A Claude Code marketplace is a Git repository containing:
1. A `.claude-plugin/marketplace.json` manifest
2. Plugin directories with their respective files
3. Documentation and supporting files

### Recommended Repository Structure

```
cc-plugins/                              # Repository root
├── .claude-plugin/
│   └── marketplace.json                 # Required: Marketplace manifest
├── plugins/                             # Recommended: All plugins in subdirectory
│   ├── investigation-toolkit/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   ├── agents/
│   │   └── README.md
│   ├── project-orchestrator/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   ├── agents/
│   │   └── README.md
│   └── code-quality-suite/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── commands/
│       ├── agents/
│       └── README.md
├── docs/                                # Documentation
│   ├── installation.md
│   ├── plugin-guides/
│   │   ├── investigation-toolkit.md
│   │   ├── project-orchestrator.md
│   │   └── code-quality-suite.md
│   └── contributing.md
├── examples/                            # Usage examples
│   └── usage-examples.md
├── README.md                            # Main documentation
├── LICENSE                              # License file
├── CHANGELOG.md                         # Marketplace changelog
└── .gitignore                           # Git ignore patterns
```

## marketplace.json Format

The marketplace.json file is the core of your plugin marketplace. It defines metadata and lists all available plugins.

### Complete Example

```json
{
  "name": "goodfoot-plugins",
  "displayName": "Goodfoot Claude Code Plugins",
  "description": "Professional development workflows and productivity tools from Goodfoot",
  "version": "1.0.0",
  "owner": {
    "name": "Goodfoot",
    "email": "contact@goodfoot.io",
    "url": "https://goodfoot.io"
  },
  "homepage": "https://github.com/goodfoot-io/cc-plugins",
  "repository": {
    "type": "git",
    "url": "https://github.com/goodfoot-io/cc-plugins.git"
  },
  "plugins": [
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
      "keywords": ["investigation", "analysis", "decision-making", "evaluation"],
      "license": "MIT",
      "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/investigation-toolkit"
    },
    {
      "name": "project-orchestrator",
      "displayName": "Project Orchestrator",
      "description": "Comprehensive project planning, assessment, and implementation workflows",
      "version": "1.0.0",
      "source": "plugins/project-orchestrator",
      "author": {
        "name": "Goodfoot",
        "url": "https://github.com/goodfoot-io"
      },
      "keywords": ["project", "planning", "orchestration", "workflow"],
      "license": "MIT",
      "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/project-orchestrator"
    },
    {
      "name": "code-quality-suite",
      "displayName": "Code Quality Suite",
      "description": "Code review and rewriting tools for maintaining high code quality",
      "version": "1.0.0",
      "source": "plugins/code-quality-suite",
      "author": {
        "name": "Goodfoot",
        "url": "https://github.com/goodfoot-io"
      },
      "keywords": ["review", "quality", "rewrite", "refactoring"],
      "license": "MIT",
      "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/code-quality-suite"
    },
    {
      "name": "test-automation",
      "displayName": "Test Automation Suite",
      "description": "Comprehensive testing agents for test execution, analysis, and reproduction",
      "version": "1.0.0",
      "source": "plugins/test-automation",
      "author": {
        "name": "Goodfoot",
        "url": "https://github.com/goodfoot-io"
      },
      "keywords": ["testing", "automation", "test-runner", "quality"],
      "license": "MIT",
      "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/test-automation"
    },
    {
      "name": "developer-utilities",
      "displayName": "Developer Utilities",
      "description": "General-purpose utilities and helper commands for daily development tasks",
      "version": "1.0.0",
      "source": "plugins/developer-utilities",
      "author": {
        "name": "Goodfoot",
        "url": "https://github.com/goodfoot-io"
      },
      "keywords": ["utilities", "tools", "helpers", "productivity"],
      "license": "MIT",
      "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/developer-utilities"
    }
  ]
}
```

### Marketplace Metadata Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ Yes | Unique marketplace identifier (lowercase, hyphens) |
| `displayName` | ❌ No | Human-readable marketplace name |
| `description` | ✅ Yes | Brief description of the marketplace |
| `version` | ✅ Yes | Marketplace version (semver) |
| `owner` | ✅ Yes | Marketplace maintainer information |
| `homepage` | ❌ No | Marketplace homepage URL |
| `repository` | ❌ No | Source repository information |
| `plugins` | ✅ Yes | Array of plugin entries |

### Plugin Entry Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ Yes | Unique plugin identifier (must match plugin.json) |
| `displayName` | ❌ No | Human-readable plugin name |
| `description` | ✅ Yes | Brief plugin description |
| `version` | ✅ Yes | Plugin version (semver) |
| `source` | ✅ Yes | Relative path to plugin directory or git URL |
| `author` | ❌ No | Plugin author information |
| `keywords` | ❌ No | Array of searchable keywords |
| `license` | ❌ No | License identifier |
| `homepage` | ❌ No | Plugin documentation URL |

### Source Field Options

The `source` field can specify different plugin locations:

```json
{
  "plugins": [
    {
      "name": "plugin1",
      "source": "plugins/plugin1",
      "description": "Relative path within repository"
    },
    {
      "name": "plugin2",
      "source": "https://github.com/user/repo",
      "description": "External GitHub repository"
    },
    {
      "name": "plugin3",
      "source": "git@github.com:user/repo.git",
      "description": "Git SSH URL"
    },
    {
      "name": "plugin4",
      "source": "/absolute/path/to/plugin",
      "description": "Absolute file system path (for local testing)"
    }
  ]
}
```

## GitHub Repository Setup

### Step 1: Create Repository

```bash
# Via GitHub CLI
gh repo create goodfoot-io/cc-plugins \
  --public \
  --description "Claude Code plugins for professional development workflows" \
  --clone

cd cc-plugins

# Or via web interface
# https://github.com/new
# Repository name: cc-plugins
# Description: Claude Code plugins for professional development workflows
# Visibility: Public
```

### Step 2: Initialize Repository Structure

```bash
# Create directory structure
mkdir -p .claude-plugin
mkdir -p plugins
mkdir -p docs/plugin-guides
mkdir -p examples

# Create marketplace manifest
cat > .claude-plugin/marketplace.json << 'EOF'
{
  "name": "goodfoot-plugins",
  "displayName": "Goodfoot Claude Code Plugins",
  "description": "Professional development workflows and productivity tools",
  "version": "1.0.0",
  "owner": {
    "name": "Goodfoot",
    "email": "contact@goodfoot.io",
    "url": "https://goodfoot.io"
  },
  "homepage": "https://github.com/goodfoot-io/cc-plugins",
  "repository": {
    "type": "git",
    "url": "https://github.com/goodfoot-io/cc-plugins.git"
  },
  "plugins": []
}
EOF
```

### Step 3: Create README.md

Create a comprehensive README:

```bash
cat > README.md << 'EOF'
# Goodfoot Claude Code Plugins

Professional development workflows and productivity tools for Claude Code.

## Installation

Add this marketplace to Claude Code:

```bash
/plugin marketplace add goodfoot-io/cc-plugins
```

Browse available plugins:

```bash
/plugin
```

Install a specific plugin:

```bash
/plugin install investigation-toolkit@goodfoot-plugins
```

## Available Plugins

### Investigation Toolkit
Parallel evaluation and investigation tools for making informed decisions.

**Commands:**
- `/investigate` - Parallel evaluation of solutions
- `/second-opinion` - Get multiple perspectives
- `/genius` - Deep thinking for complex problems

### Project Orchestrator
Comprehensive project planning and execution workflows.

**Commands:**
- `/project:create` - Create detailed project plans
- `/project:begin` - Start project execution
- `/project:worktree` - Set up project worktrees

### Code Quality Suite
Code review and improvement tools.

**Commands:**
- `/review:complexity` - Analyze code complexity
- `/review:language` - Review natural language clarity
- `/rewrite:complexity` - Simplify complex code

### Test Automation
Comprehensive testing and analysis.

**Agents:**
- `test-issue-reproducer` - Reproduce test failures
- `test-evaluator` - Evaluate test quality

### Developer Utilities
General-purpose development helpers.

**Commands:**
- `/jsdoc` - Add comprehensive JSDoc
- `/document` - Generate documentation

## Documentation

- [Installation Guide](docs/installation.md)
- [Plugin Guides](docs/plugin-guides/)
- [Contributing](docs/contributing.md)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Issues: https://github.com/goodfoot-io/cc-plugins/issues
- Discussions: https://github.com/goodfoot-io/cc-plugins/discussions

EOF
```

### Step 4: Add License

```bash
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2025 Goodfoot

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

### Step 5: Create .gitignore

```bash
cat > .gitignore << 'EOF'
# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
*.log
logs/

# Testing
.test/
coverage/

# Temporary files
tmp/
temp/
*.tmp

# Environment
.env
.env.local
EOF
```

### Step 6: Initial Commit

```bash
git add .
git commit -m "Initial marketplace setup

- Create repository structure
- Add marketplace.json manifest
- Add comprehensive README
- Add MIT license
- Configure .gitignore"

git push origin main
```

## Repository Configuration

### GitHub Settings

Configure your repository settings:

1. **About Section**
   - Description: "Claude Code plugins for professional development workflows"
   - Website: Your documentation site (if available)
   - Topics: `claude-code`, `plugins`, `ai-tools`, `developer-productivity`

2. **Features**
   - ✅ Issues - Enable for bug reports and feature requests
   - ✅ Discussions - Enable for community Q&A
   - ✅ Wiki - Optional for extended documentation
   - ❌ Projects - Optional

3. **Branch Protection** (for main branch)
   - Require pull request before merging
   - Require status checks to pass
   - Require conversation resolution before merging

### Repository Topics

Add these topics for discoverability:
- `claude-code`
- `claude-code-plugins`
- `ai-tools`
- `developer-productivity`
- `development-workflows`
- `automation`

### Creating Documentation Site (Optional)

Enable GitHub Pages for documentation:

```bash
# Create docs site structure
mkdir -p docs
cat > docs/index.md << 'EOF'
# Goodfoot Claude Code Plugins

Welcome to the Goodfoot Claude Code Plugins documentation.

[View on GitHub](https://github.com/goodfoot-io/cc-plugins)

## Quick Start

1. Add marketplace: `/plugin marketplace add goodfoot-io/cc-plugins`
2. Browse plugins: `/plugin`
3. Install plugin: `/plugin install <plugin-name>@goodfoot-plugins`

## Available Plugins

- [Investigation Toolkit](plugin-guides/investigation-toolkit.md)
- [Project Orchestrator](plugin-guides/project-orchestrator.md)
- [Code Quality Suite](plugin-guides/code-quality-suite.md)
- [Test Automation](plugin-guides/test-automation.md)
- [Developer Utilities](plugin-guides/developer-utilities.md)
EOF

# Enable GitHub Pages in repository settings:
# Settings → Pages → Source: main branch → /docs folder
```

## Testing Your Marketplace

### Local Testing

Before publishing, test your marketplace locally:

```bash
# Clone your repository
cd /tmp
git clone https://github.com/goodfoot-io/cc-plugins.git
cd cc-plugins

# Verify structure
ls -la .claude-plugin/
cat .claude-plugin/marketplace.json

# Check plugin directories
ls -la plugins/

# Test installation (in Claude Code)
/plugin marketplace add /tmp/cc-plugins
/plugin
```

### Validation Checklist

- [ ] `.claude-plugin/marketplace.json` exists and is valid JSON
- [ ] All required fields are present in marketplace.json
- [ ] All plugin entries have valid `source` paths
- [ ] Each plugin directory has `.claude-plugin/plugin.json`
- [ ] Plugin names in marketplace.json match their plugin.json files
- [ ] All versions follow semver format
- [ ] README.md provides clear installation instructions
- [ ] LICENSE file is present
- [ ] Repository is public (for public marketplace)

### Testing Installation Flow

```bash
# In Claude Code, test the complete flow:

# 1. Add marketplace
/plugin marketplace add goodfoot-io/cc-plugins

# Expected: Success message

# 2. List plugins
/plugin

# Expected: See all your plugins listed

# 3. Install a plugin
/plugin install investigation-toolkit@goodfoot-plugins

# Expected: Plugin installed successfully

# 4. Verify commands/agents
/help

# Expected: See commands from installed plugin

# 5. Test a command
/investigate "How should I structure my new API?"

# Expected: Command executes successfully
```

## Continuous Integration (Optional)

Add GitHub Actions for automated validation:

```yaml
# .github/workflows/validate.yml
name: Validate Marketplace

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate marketplace.json
        run: |
          # Check JSON is valid
          jq empty .claude-plugin/marketplace.json

          # Check required fields
          jq -e '.name' .claude-plugin/marketplace.json
          jq -e '.plugins' .claude-plugin/marketplace.json

      - name: Validate plugin manifests
        run: |
          for plugin in plugins/*/; do
            echo "Validating $plugin"
            jq empty "$plugin/.claude-plugin/plugin.json"
            jq -e '.name' "$plugin/.claude-plugin/plugin.json"
            jq -e '.version' "$plugin/.claude-plugin/plugin.json"
          done
```

## Publishing Checklist

Before announcing your marketplace:

- [ ] Repository is public
- [ ] marketplace.json is complete and valid
- [ ] All plugins are tested and working
- [ ] README provides clear instructions
- [ ] Documentation is comprehensive
- [ ] LICENSE is appropriate
- [ ] GitHub repository topics are set
- [ ] Issues and Discussions are enabled
- [ ] At least one release/tag is created
- [ ] Installation instructions are tested

## Creating Your First Release

```bash
# Tag your first release
git tag -a v1.0.0 -m "Initial release of Goodfoot Claude Code Plugins

Plugins included:
- Investigation Toolkit
- Project Orchestrator
- Code Quality Suite
- Test Automation
- Developer Utilities"

git push origin v1.0.0

# Or create via GitHub CLI
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "Initial release with 5 comprehensive plugin packages"
```

## Next Steps

After setup:
1. Migrate your commands and agents into plugin directories
2. Test each plugin individually
3. Update marketplace.json with accurate metadata
4. Write plugin-specific documentation
5. Announce your marketplace to the community
