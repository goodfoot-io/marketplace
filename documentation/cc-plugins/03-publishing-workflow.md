# Publishing Workflow - Step by Step

This guide provides a complete, actionable workflow for publishing your Claude Code plugins from the current `.claude/` directory to the `goodfoot-io/cc-plugins` marketplace.

## Overview

The publishing workflow consists of these major phases:

1. **Preparation** - Organize and categorize existing content
2. **Plugin Creation** - Structure files into logical plugins
3. **Repository Setup** - Create and configure GitHub repository
4. **Migration** - Move files into plugin structure
5. **Testing** - Validate functionality
6. **Documentation** - Write comprehensive guides
7. **Publishing** - Make available to users
8. **Maintenance** - Ongoing updates and improvements

## Phase 1: Preparation

### 1.1 Audit Current Content

```bash
# Generate inventory of current .claude/ directory
cd /workspace
find .claude -type f -name "*.md" | sort > /tmp/claude-inventory.txt
find .claude -type f -name "*.json" | sort >> /tmp/claude-inventory.txt

# Review the inventory
cat /tmp/claude-inventory.txt
```

### 1.2 Categorize Content

Create a categorization matrix:

| Category | Commands | Agents | Purpose |
|----------|----------|--------|---------|
| **Investigation** | `/investigate`, `/second-opinion`, `/genius` | - | Decision-making and analysis |
| **Project Management** | `/project:*` commands | `project-*` agents | Project orchestration |
| **Code Quality** | `/review:*`, `/rewrite:*` | - | Code review and improvement |
| **Testing** | `/test-agent` | `test-*` agents | Test automation |
| **Documentation** | `/document`, `/jsdoc` | `documenter` | Documentation generation |
| **Utilities** | `/utilities:*`, `/recommend` | `codebase-explainer` | General helpers |

### 1.3 Define Plugin Packages

Based on categorization, define 5 core plugins:

```
1. investigation-toolkit       (Investigation tools)
2. project-orchestrator        (Project management)
3. code-quality-suite         (Review & rewrite)
4. test-automation            (Testing tools)
5. developer-utilities        (General utilities & docs)
```

## Phase 2: Plugin Creation

### 2.1 Create Plugin Template Structure

```bash
# Create working directory
mkdir -p /tmp/cc-plugins-workspace/plugins

# Plugin creation function
create_plugin() {
  local name=$1
  local display_name=$2
  local description=$3

  local plugin_dir="/tmp/cc-plugins-workspace/plugins/$name"

  mkdir -p "$plugin_dir/.claude-plugin"
  mkdir -p "$plugin_dir/commands"
  mkdir -p "$plugin_dir/agents"
  mkdir -p "$plugin_dir/shared"

  # Create plugin.json
  cat > "$plugin_dir/.claude-plugin/plugin.json" << EOF
{
  "name": "$name",
  "displayName": "$display_name",
  "description": "$description",
  "version": "1.0.0",
  "author": {
    "name": "Goodfoot",
    "email": "contact@goodfoot.io",
    "url": "https://github.com/goodfoot-io"
  },
  "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/$name",
  "license": "MIT",
  "keywords": []
}
EOF

  # Create plugin README
  cat > "$plugin_dir/README.md" << EOF
# $display_name

$description

## Installation

\`\`\`bash
/plugin install $name@goodfoot-plugins
\`\`\`

## Commands

<!-- List commands here -->

## Agents

<!-- List agents here -->

## Usage Examples

<!-- Add examples here -->
EOF

  echo "Created plugin: $name"
}
```

### 2.2 Create All Plugins

```bash
# Investigation Toolkit
create_plugin \
  "investigation-toolkit" \
  "Investigation Toolkit" \
  "Parallel evaluation and investigation tools for informed decision-making"

# Project Orchestrator
create_plugin \
  "project-orchestrator" \
  "Project Orchestrator" \
  "Comprehensive project planning, assessment, and implementation workflows"

# Code Quality Suite
create_plugin \
  "code-quality-suite" \
  "Code Quality Suite" \
  "Code review and rewriting tools for maintaining high code quality"

# Test Automation
create_plugin \
  "test-automation" \
  "Test Automation Suite" \
  "Comprehensive testing agents for execution, analysis, and reproduction"

# Developer Utilities
create_plugin \
  "developer-utilities" \
  "Developer Utilities" \
  "General-purpose utilities and helper commands for daily development"
```

## Phase 3: Repository Setup

### 3.1 Create GitHub Repository

```bash
# Using GitHub CLI
gh repo create goodfoot-io/cc-plugins \
  --public \
  --description "Claude Code plugins for professional development workflows" \
  --clone

cd cc-plugins
```

Or create via web:
1. Go to https://github.com/new
2. Repository name: `cc-plugins`
3. Description: "Claude Code plugins for professional development workflows"
4. Visibility: Public
5. Initialize with README: No (we'll create it)
6. Click "Create repository"

### 3.2 Initialize Repository

```bash
cd cc-plugins

# Create base structure
mkdir -p .claude-plugin
mkdir -p plugins
mkdir -p docs/plugin-guides
mkdir -p examples

# Copy plugins from workspace
cp -r /tmp/cc-plugins-workspace/plugins/* plugins/

# Initialize git
git init
git branch -M main
```

### 3.3 Create Marketplace Manifest

```bash
cat > .claude-plugin/marketplace.json << 'EOF'
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
      "license": "MIT"
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
      "license": "MIT"
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
      "license": "MIT"
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
      "license": "MIT"
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
      "license": "MIT"
    }
  ]
}
EOF
```

## Phase 4: Migration

### 4.1 Migration Mapping

Create a migration script:

```bash
cat > /tmp/migrate-plugins.sh << 'EOF'
#!/bin/bash

# Source and destination directories
SOURCE_DIR="/workspace/.claude"
DEST_DIR="/path/to/cc-plugins/plugins"

# Investigation Toolkit
echo "Migrating Investigation Toolkit..."
cp "$SOURCE_DIR/commands/investigate.md" "$DEST_DIR/investigation-toolkit/commands/"
cp "$SOURCE_DIR/commands/second-opinion.md" "$DEST_DIR/investigation-toolkit/commands/"
cp "$SOURCE_DIR/commands/genius.md" "$DEST_DIR/investigation-toolkit/commands/"

# Project Orchestrator
echo "Migrating Project Orchestrator..."
mkdir -p "$DEST_DIR/project-orchestrator/commands/project"
mkdir -p "$DEST_DIR/project-orchestrator/agents/project"
cp "$SOURCE_DIR/commands/project/"*.md "$DEST_DIR/project-orchestrator/commands/project/"
cp "$SOURCE_DIR/agents/project/"*.md "$DEST_DIR/project-orchestrator/agents/project/"
cp "$SOURCE_DIR/commands/plan-then-implement.md" "$DEST_DIR/project-orchestrator/commands/"

# Code Quality Suite
echo "Migrating Code Quality Suite..."
mkdir -p "$DEST_DIR/code-quality-suite/commands/review"
mkdir -p "$DEST_DIR/code-quality-suite/commands/rewrite"
cp "$SOURCE_DIR/commands/review/"*.md "$DEST_DIR/code-quality-suite/commands/review/"
cp "$SOURCE_DIR/commands/rewrite/"*.md "$DEST_DIR/code-quality-suite/commands/rewrite/"
cp "$SOURCE_DIR/commands/recommend.md" "$DEST_DIR/code-quality-suite/commands/"

# Test Automation
echo "Migrating Test Automation..."
cp "$SOURCE_DIR/agents/test-"*.md "$DEST_DIR/test-automation/agents/"
cp "$SOURCE_DIR/commands/test-agent.md" "$DEST_DIR/test-automation/commands/"

# Developer Utilities
echo "Migrating Developer Utilities..."
mkdir -p "$DEST_DIR/developer-utilities/commands/utilities"
cp "$SOURCE_DIR/commands/document.md" "$DEST_DIR/developer-utilities/commands/"
cp "$SOURCE_DIR/commands/jsdoc.md" "$DEST_DIR/developer-utilities/commands/"
cp "$SOURCE_DIR/commands/utilities/"*.md "$DEST_DIR/developer-utilities/commands/utilities/"
cp "$SOURCE_DIR/commands/iterate-on/"*.md "$DEST_DIR/developer-utilities/commands/iterate-on/"
cp "$SOURCE_DIR/agents/documenter.md" "$DEST_DIR/developer-utilities/agents/"
cp "$SOURCE_DIR/agents/codebase-explainer.md" "$DEST_DIR/developer-utilities/agents/"

# Copy shared resources
echo "Copying shared resources..."
for plugin in investigation-toolkit project-orchestrator code-quality-suite test-automation developer-utilities; do
  mkdir -p "$DEST_DIR/$plugin/shared"
  cp -r "$SOURCE_DIR/shared/"* "$DEST_DIR/$plugin/shared/" 2>/dev/null || true
done

echo "Migration complete!"
EOF

chmod +x /tmp/migrate-plugins.sh
```

### 4.2 Execute Migration

```bash
# Update destination path in script
sed -i 's|/path/to/cc-plugins|'$(pwd)'|g' /tmp/migrate-plugins.sh

# Run migration
bash /tmp/migrate-plugins.sh
```

### 4.3 Update Plugin Metadata

For each plugin, update `.claude-plugin/plugin.json` with accurate keywords:

```bash
# Investigation Toolkit
jq '.keywords = ["investigation", "analysis", "decision-making", "evaluation", "genius"]' \
  plugins/investigation-toolkit/.claude-plugin/plugin.json > /tmp/plugin.json
mv /tmp/plugin.json plugins/investigation-toolkit/.claude-plugin/plugin.json

# Repeat for other plugins...
```

## Phase 5: Testing

### 5.1 Validate JSON Files

```bash
# Validate marketplace.json
jq empty .claude-plugin/marketplace.json && echo "✓ marketplace.json valid"

# Validate all plugin.json files
for plugin in plugins/*/; do
  echo "Validating $plugin"
  jq empty "$plugin/.claude-plugin/plugin.json" && echo "✓ Valid"
done
```

### 5.2 Test Plugin Structure

```bash
# Check required files exist
for plugin in plugins/*/; do
  plugin_name=$(basename "$plugin")
  echo "Checking $plugin_name..."

  [ -f "$plugin/.claude-plugin/plugin.json" ] && echo "  ✓ plugin.json"
  [ -f "$plugin/README.md" ] && echo "  ✓ README.md"
  [ -d "$plugin/commands" ] || [ -d "$plugin/agents" ] && echo "  ✓ Content directories"
done
```

### 5.3 Local Installation Test

```bash
# Commit current state
git add .
git commit -m "Initial plugin structure"

# In Claude Code, test local installation
# /plugin marketplace add /absolute/path/to/cc-plugins
# /plugin
# /plugin install investigation-toolkit@goodfoot-plugins
```

### 5.4 Test Commands and Agents

After installation, test each command:

```bash
# In Claude Code
/investigate "Should I use REST or GraphQL?"
/project:create "Build a user authentication system"
/review:complexity @src/complex-file.js
```

## Phase 6: Documentation

### 6.1 Create Installation Guide

```bash
cat > docs/installation.md << 'EOF'
# Installation Guide

## Prerequisites

- Claude Code (latest version)
- Git (for cloning if needed)

## Quick Start

1. Add the Goodfoot marketplace:
   ```bash
   /plugin marketplace add goodfoot-io/cc-plugins
   ```

2. Browse available plugins:
   ```bash
   /plugin
   ```

3. Install a plugin:
   ```bash
   /plugin install investigation-toolkit@goodfoot-plugins
   ```

## Installing All Plugins

To install all plugins at once:

```bash
/plugin install investigation-toolkit@goodfoot-plugins
/plugin install project-orchestrator@goodfoot-plugins
/plugin install code-quality-suite@goodfoot-plugins
/plugin install test-automation@goodfoot-plugins
/plugin install developer-utilities@goodfoot-plugins
```

## Updating Plugins

To update an installed plugin to the latest version:

```bash
/plugin update investigation-toolkit@goodfoot-plugins
```

## Uninstalling Plugins

To remove a plugin:

```bash
/plugin uninstall investigation-toolkit
```

## Troubleshooting

### Plugin not found

Ensure you've added the marketplace:
```bash
/plugin marketplace list
```

If not listed, add it:
```bash
/plugin marketplace add goodfoot-io/cc-plugins
```

### Command not working

1. Verify plugin is installed: `/plugin list`
2. Check command name: `/help`
3. Try reinstalling: `/plugin uninstall <plugin>` then `/plugin install <plugin>@goodfoot-plugins`
EOF
```

### 6.2 Create Plugin Guides

For each plugin, create a detailed guide:

```bash
cat > docs/plugin-guides/investigation-toolkit.md << 'EOF'
# Investigation Toolkit

Parallel evaluation and investigation tools for making informed decisions.

## Overview

The Investigation Toolkit provides commands that help you explore multiple solutions to a problem simultaneously, get diverse perspectives, and make well-informed decisions.

## Commands

### /investigate

Investigate any question or problem using parallel objective evaluations.

**Usage:**
```bash
/investigate "Should I use microservices or monolithic architecture?"
```

**How it works:**
1. Analyzes your question deeply
2. Generates 3 diverse solution approaches
3. Evaluates each solution in parallel using specialized agents
4. Synthesizes results and recommends the best approach
5. Iterates if solutions need refinement

**Best for:**
- Architecture decisions
- Technology selection
- Design pattern choices
- Complex trade-off analysis

### /second-opinion

Get multiple perspectives on a decision or approach.

**Usage:**
```bash
/second-opinion "I'm planning to implement caching at the database level"
```

**Best for:**
- Validating your approach
- Finding blind spots
- Risk assessment
- Alternative perspectives

### /genius

Deep thinking for complex, challenging problems.

**Usage:**
```bash
/genius "How can I optimize this algorithm while maintaining readability?"
```

**Best for:**
- Complex algorithmic problems
- Performance optimization
- Deep architectural challenges
- Novel problem-solving

## Examples

### Example 1: Technology Selection

```bash
/investigate "Should I use PostgreSQL or MongoDB for my social media app?"
```

Output will include:
- Detailed analysis of each database
- Pros and cons for your use case
- Performance considerations
- Scalability implications
- Final recommendation with justification

### Example 2: Architecture Decision

```bash
/second-opinion "I'm planning to split our monolith into microservices"
```

Output will include:
- Multiple expert perspectives
- Potential risks and challenges
- Alternative approaches
- Implementation considerations

## Tips

- Be specific in your questions for better results
- Include context about your project constraints
- Use /investigate for exploring options
- Use /second-opinion to validate decisions
- Use /genius for the hardest problems
EOF

# Create similar guides for other plugins...
```

### 6.3 Create Comprehensive README

```bash
cat > README.md << 'EOF'
# Goodfoot Claude Code Plugins

Professional development workflows and productivity tools for Claude Code.

## Quick Start

```bash
# Add marketplace
/plugin marketplace add goodfoot-io/cc-plugins

# Browse plugins
/plugin

# Install a plugin
/plugin install investigation-toolkit@goodfoot-plugins
```

## Available Plugins

| Plugin | Description | Key Features |
|--------|-------------|--------------|
| [Investigation Toolkit](docs/plugin-guides/investigation-toolkit.md) | Parallel evaluation and investigation tools | `/investigate`, `/second-opinion`, `/genius` |
| [Project Orchestrator](docs/plugin-guides/project-orchestrator.md) | Project planning and execution | `/project:create`, `/project:begin`, `/project:worktree` |
| [Code Quality Suite](docs/plugin-guides/code-quality-suite.md) | Code review and improvement | `/review:*`, `/rewrite:*`, `/recommend` |
| [Test Automation](docs/plugin-guides/test-automation.md) | Testing agents and workflows | `test-issue-reproducer`, `test-evaluator` |
| [Developer Utilities](docs/plugin-guides/developer-utilities.md) | General development helpers | `/document`, `/jsdoc`, utilities |

## Documentation

- 📦 [Installation Guide](docs/installation.md)
- 📚 [Plugin Guides](docs/plugin-guides/)
- 🤝 [Contributing](docs/contributing.md)
- 💡 [Examples](examples/usage-examples.md)

## Support

- 🐛 [Report Issues](https://github.com/goodfoot-io/cc-plugins/issues)
- 💬 [Discussions](https://github.com/goodfoot-io/cc-plugins/discussions)
- 📖 [Documentation](https://github.com/goodfoot-io/cc-plugins/tree/main/docs)

## License

MIT License - see [LICENSE](LICENSE)

## About

Created and maintained by [Goodfoot](https://goodfoot.io).
EOF
```

## Phase 7: Publishing

### 7.1 Final Pre-Publish Checklist

```bash
# Run final validation
bash << 'EOF'
echo "=== Pre-Publish Validation ==="

# Check required files
checks=(
  ".claude-plugin/marketplace.json:Marketplace manifest"
  "README.md:Main README"
  "LICENSE:License file"
  ".gitignore:Git ignore"
  "docs/installation.md:Installation guide"
)

for check in "${checks[@]}"; do
  file="${check%%:*}"
  name="${check##*:}"
  if [ -f "$file" ]; then
    echo "✓ $name"
  else
    echo "✗ $name (MISSING)"
  fi
done

# Validate JSON
echo ""
echo "=== JSON Validation ==="
jq empty .claude-plugin/marketplace.json && echo "✓ marketplace.json"

for plugin in plugins/*/; do
  jq empty "$plugin/.claude-plugin/plugin.json" && echo "✓ $(basename $plugin)"
done

# Check plugin structure
echo ""
echo "=== Plugin Structure ==="
for plugin in plugins/*/; do
  name=$(basename "$plugin")
  has_content=false
  [ -d "$plugin/commands" ] && has_content=true
  [ -d "$plugin/agents" ] && has_content=true

  if $has_content; then
    echo "✓ $name has content"
  else
    echo "✗ $name has no content (WARNING)"
  fi
done

echo ""
echo "=== Validation Complete ==="
EOF
```

### 7.2 Create Initial Commit

```bash
git add .
git commit -m "Initial release of Goodfoot Claude Code Plugins

Plugins included:
- Investigation Toolkit: Parallel evaluation and analysis tools
- Project Orchestrator: Comprehensive project management
- Code Quality Suite: Code review and improvement tools
- Test Automation: Testing agents and workflows
- Developer Utilities: General development helpers

Features:
- 35+ custom slash commands
- 12+ specialized agents
- Comprehensive documentation
- Ready-to-use examples"

# Push to GitHub
git remote add origin https://github.com/goodfoot-io/cc-plugins.git
git push -u origin main
```

### 7.3 Create Release

```bash
# Tag the release
git tag -a v1.0.0 -m "v1.0.0 - Initial Release

First public release of Goodfoot Claude Code Plugins.

Plugins:
- investigation-toolkit v1.0.0
- project-orchestrator v1.0.0
- code-quality-suite v1.0.0
- test-automation v1.0.0
- developer-utilities v1.0.0"

git push origin v1.0.0

# Create GitHub release
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "## Goodfoot Claude Code Plugins - Initial Release

First public release with 5 comprehensive plugin packages.

### Plugins Included

- **Investigation Toolkit** - Parallel evaluation and investigation tools
- **Project Orchestrator** - Project planning and execution workflows
- **Code Quality Suite** - Code review and improvement tools
- **Test Automation** - Testing agents and workflows
- **Developer Utilities** - General development helpers

### Installation

\`\`\`bash
/plugin marketplace add goodfoot-io/cc-plugins
/plugin install <plugin-name>@goodfoot-plugins
\`\`\`

### Documentation

See [README](https://github.com/goodfoot-io/cc-plugins) for complete documentation."
```

### 7.4 Announce to Community

Create announcements in relevant channels:

1. **GitHub Discussions** - Post in your repository
2. **Social Media** - Share with developer community
3. **Claude Code Community** - If there's an official forum/Discord
4. **Blog Post** - Write about your plugins and their benefits

## Phase 8: Maintenance

### 8.1 Issue Management

Set up issue templates:

```bash
mkdir -p .github/ISSUE_TEMPLATE

cat > .github/ISSUE_TEMPLATE/bug_report.md << 'EOF'
---
name: Bug Report
about: Report a bug in a plugin
title: '[BUG] '
labels: bug
---

**Plugin Name**
Which plugin has the issue?

**Description**
Clear description of the bug.

**Steps to Reproduce**
1. Step 1
2. Step 2
3. ...

**Expected Behavior**
What should happen?

**Actual Behavior**
What actually happens?

**Environment**
- Claude Code version:
- OS:
EOF
```

### 8.2 Version Updates

When updating a plugin:

```bash
# 1. Update plugin files
# 2. Bump version in plugin.json
jq '.version = "1.1.0"' plugins/investigation-toolkit/.claude-plugin/plugin.json > /tmp/p.json
mv /tmp/p.json plugins/investigation-toolkit/.claude-plugin/plugin.json

# 3. Update marketplace.json
# (Update the version for the specific plugin entry)

# 4. Commit and tag
git add plugins/investigation-toolkit
git commit -m "investigation-toolkit v1.1.0: Add new features"
git tag -a investigation-toolkit-v1.1.0 -m "Investigation Toolkit v1.1.0"
git push origin main investigation-toolkit-v1.1.0
```

### 8.3 Monitoring

Track:
- GitHub stars and forks
- Issues and pull requests
- Installation metrics (if available)
- User feedback and feature requests

## Troubleshooting Common Issues

### Issue: marketplace.json not found

**Solution:** Ensure `.claude-plugin/marketplace.json` exists at repository root.

### Issue: Plugin installation fails

**Possible causes:**
1. Invalid JSON in plugin.json
2. Missing required fields
3. Incorrect source path in marketplace.json
4. Repository not public

**Solutions:**
```bash
# Validate JSON
jq empty .claude-plugin/marketplace.json
jq empty plugins/*/. claude-plugin/plugin.json

# Check required fields
jq -e '.name, .version, .plugins' .claude-plugin/marketplace.json

# Verify repository is public
gh repo view goodfoot-io/cc-plugins
```

### Issue: Commands not showing after installation

**Solution:**
1. Verify plugin.json has correct structure
2. Ensure commands are in `commands/` directory
3. Check command files have `.md` extension
4. Try reinstalling the plugin

## Next Steps

After successful publication:

1. ✅ Monitor initial installations and issues
2. ✅ Gather user feedback
3. ✅ Plan feature enhancements
4. ✅ Create additional plugin guides
5. ✅ Build community around plugins
6. ✅ Regular updates and maintenance
