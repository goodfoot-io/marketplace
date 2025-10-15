# Migration Strategy

This document outlines a comprehensive, step-by-step strategy for migrating the current `.claude/` directory contents to the `goodfoot-io/cc-plugins` marketplace repository.

## Migration Principles

1. **Preserve Functionality** - All commands and agents must work identically after migration
2. **Maintain Structure** - Keep namespace organization (review/*, rewrite/*, etc.)
3. **Ensure Discoverability** - Add metadata and keywords for easy plugin discovery
4. **Enable Testing** - Create testable plugin packages before publication
5. **Document Thoroughly** - Provide clear documentation for each plugin

## Migration Phases

### Phase 1: Pre-Migration Setup

#### 1.1 Create Workspace

```bash
# Create migration workspace
mkdir -p /tmp/plugin-migration
cd /tmp/plugin-migration

# Create plugin directories
for plugin in investigation-toolkit project-orchestrator code-quality-suite test-automation developer-utilities; do
  mkdir -p "plugins/$plugin/.claude-plugin"
  mkdir -p "plugins/$plugin/commands"
  mkdir -p "plugins/$plugin/agents"
  mkdir -p "plugins/$plugin/shared"
done
```

#### 1.2 Backup Current State

```bash
# Create backup of current .claude directory
cd /workspace
tar -czf /tmp/claude-backup-$(date +%Y%m%d-%H%M%S).tar.gz .claude/
echo "Backup created at /tmp/claude-backup-*.tar.gz"
```

### Phase 2: Plugin Structure Creation

#### 2.1 Create Plugin Manifests

For each plugin, create `.claude-plugin/plugin.json`:

**Investigation Toolkit**
```bash
cat > /tmp/plugin-migration/plugins/investigation-toolkit/.claude-plugin/plugin.json << 'EOF'
{
  "name": "investigation-toolkit",
  "displayName": "Investigation Toolkit",
  "description": "Parallel evaluation and investigation tools for making informed decisions",
  "version": "1.0.0",
  "author": {
    "name": "Goodfoot",
    "email": "contact@goodfoot.io",
    "url": "https://github.com/goodfoot-io"
  },
  "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/investigation-toolkit",
  "repository": {
    "type": "git",
    "url": "https://github.com/goodfoot-io/cc-plugins.git",
    "directory": "plugins/investigation-toolkit"
  },
  "license": "MIT",
  "keywords": [
    "investigation",
    "analysis",
    "decision-making",
    "evaluation",
    "parallel",
    "genius"
  ]
}
EOF
```

**Project Orchestrator**
```bash
cat > /tmp/plugin-migration/plugins/project-orchestrator/.claude-plugin/plugin.json << 'EOF'
{
  "name": "project-orchestrator",
  "displayName": "Project Orchestrator",
  "description": "Comprehensive project planning, assessment, and implementation workflows",
  "version": "1.0.0",
  "author": {
    "name": "Goodfoot",
    "email": "contact@goodfoot.io",
    "url": "https://github.com/goodfoot-io"
  },
  "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/project-orchestrator",
  "repository": {
    "type": "git",
    "url": "https://github.com/goodfoot-io/cc-plugins.git",
    "directory": "plugins/project-orchestrator"
  },
  "license": "MIT",
  "keywords": [
    "project",
    "planning",
    "orchestration",
    "workflow",
    "implementation",
    "assessment"
  ]
}
EOF
```

**Code Quality Suite**
```bash
cat > /tmp/plugin-migration/plugins/code-quality-suite/.claude-plugin/plugin.json << 'EOF'
{
  "name": "code-quality-suite",
  "displayName": "Code Quality Suite",
  "description": "Code review and rewriting tools for maintaining high code quality",
  "version": "1.0.0",
  "author": {
    "name": "Goodfoot",
    "email": "contact@goodfoot.io",
    "url": "https://github.com/goodfoot-io"
  },
  "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/code-quality-suite",
  "repository": {
    "type": "git",
    "url": "https://github.com/goodfoot-io/cc-plugins.git",
    "directory": "plugins/code-quality-suite"
  },
  "license": "MIT",
  "keywords": [
    "review",
    "quality",
    "rewrite",
    "refactoring",
    "complexity",
    "language"
  ]
}
EOF
```

**Test Automation**
```bash
cat > /tmp/plugin-migration/plugins/test-automation/.claude-plugin/plugin.json << 'EOF'
{
  "name": "test-automation",
  "displayName": "Test Automation Suite",
  "description": "Comprehensive testing agents for test execution, analysis, and reproduction",
  "version": "1.0.0",
  "author": {
    "name": "Goodfoot",
    "email": "contact@goodfoot.io",
    "url": "https://github.com/goodfoot-io"
  },
  "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/test-automation",
  "repository": {
    "type": "git",
    "url": "https://github.com/goodfoot-io/cc-plugins.git",
    "directory": "plugins/test-automation"
  },
  "license": "MIT",
  "keywords": [
    "testing",
    "automation",
    "test-runner",
    "quality",
    "reproduction",
    "evaluation"
  ]
}
EOF
```

**Developer Utilities**
```bash
cat > /tmp/plugin-migration/plugins/developer-utilities/.claude-plugin/plugin.json << 'EOF'
{
  "name": "developer-utilities",
  "displayName": "Developer Utilities",
  "description": "General-purpose utilities and helper commands for daily development tasks",
  "version": "1.0.0",
  "author": {
    "name": "Goodfoot",
    "email": "contact@goodfoot.io",
    "url": "https://github.com/goodfoot-io"
  },
  "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/developer-utilities",
  "repository": {
    "type": "git",
    "url": "https://github.com/goodfoot-io/cc-plugins.git",
    "directory": "plugins/developer-utilities"
  },
  "license": "MIT",
  "keywords": [
    "utilities",
    "tools",
    "helpers",
    "productivity",
    "documentation",
    "jsdoc"
  ]
}
EOF
```

### Phase 3: File Migration

#### 3.1 Investigation Toolkit

```bash
SOURCE="/workspace/.claude"
DEST="/tmp/plugin-migration/plugins/investigation-toolkit"

# Copy commands
cp "$SOURCE/commands/investigate.md" "$DEST/commands/"
cp "$SOURCE/commands/second-opinion.md" "$DEST/commands/"
cp "$SOURCE/commands/genius.md" "$DEST/commands/"

# No agents for this plugin (uses general-purpose)

echo "✓ Investigation Toolkit migrated"
```

#### 3.2 Project Orchestrator

```bash
SOURCE="/workspace/.claude"
DEST="/tmp/plugin-migration/plugins/project-orchestrator"

# Copy commands
mkdir -p "$DEST/commands/project"
cp "$SOURCE/commands/project/"*.md "$DEST/commands/project/"
cp "$SOURCE/commands/plan-then-implement.md" "$DEST/commands/"

# Copy agents
mkdir -p "$DEST/agents/project"
cp "$SOURCE/agents/project/"*.md "$DEST/agents/project/"

# Copy shared resources
cp "$SOURCE/shared/project-plan-annotated-example.md" "$DEST/shared/" 2>/dev/null || true

echo "✓ Project Orchestrator migrated"
```

#### 3.3 Code Quality Suite

```bash
SOURCE="/workspace/.claude"
DEST="/tmp/plugin-migration/plugins/code-quality-suite"

# Copy review commands
mkdir -p "$DEST/commands/review"
cp "$SOURCE/commands/review/"*.md "$DEST/commands/review/"

# Copy rewrite commands
mkdir -p "$DEST/commands/rewrite"
cp "$SOURCE/commands/rewrite/"*.md "$DEST/commands/rewrite/"

# Copy recommend command
cp "$SOURCE/commands/recommend.md" "$DEST/commands/"

# No agents for this plugin

echo "✓ Code Quality Suite migrated"
```

#### 3.4 Test Automation

```bash
SOURCE="/workspace/.claude"
DEST="/tmp/plugin-migration/plugins/test-automation"

# Copy command
cp "$SOURCE/commands/test-agent.md" "$DEST/commands/"

# Copy agents
cp "$SOURCE/agents/test-issue-reproducer.md" "$DEST/agents/"
cp "$SOURCE/agents/test-evaluator.md" "$DEST/agents/"
cp "$SOURCE/agents/test-agent-evaluation-runner.md" "$DEST/agents/"

# Copy shared resources
cp "$SOURCE/shared/jest-mocking-guide.md" "$DEST/shared/" 2>/dev/null || true

echo "✓ Test Automation migrated"
```

#### 3.5 Developer Utilities

```bash
SOURCE="/workspace/.claude"
DEST="/tmp/plugin-migration/plugins/developer-utilities"

# Copy documentation commands
cp "$SOURCE/commands/document.md" "$DEST/commands/"
cp "$SOURCE/commands/jsdoc.md" "$DEST/commands/"

# Copy utility commands
mkdir -p "$DEST/commands/utilities"
cp "$SOURCE/commands/utilities/"*.md "$DEST/commands/utilities/"

# Copy iterate-on commands
mkdir -p "$DEST/commands/iterate-on"
cp "$SOURCE/commands/iterate-on/"*.md "$DEST/commands/iterate-on/"

# Copy agents
cp "$SOURCE/agents/documenter.md" "$DEST/agents/"
cp "$SOURCE/agents/codebase-explainer.md" "$DEST/agents/"

# Copy shared resources
cp "$SOURCE/shared/codebase-tool-patterns.md" "$DEST/shared/" 2>/dev/null || true
cp "$SOURCE/memory/command-improvement-tips.md" "$DEST/shared/" 2>/dev/null || true

echo "✓ Developer Utilities migrated"
```

### Phase 4: Path Updates

Some commands may reference shared resources with absolute or relative paths. Update these references:

#### 4.1 Update File References

```bash
# Function to update file references in markdown files
update_file_references() {
  local plugin_dir=$1

  # Find all markdown files
  find "$plugin_dir" -name "*.md" -type f | while read -r file; do
    # Update references to shared resources
    sed -i 's|@\.claude/shared/|@shared/|g' "$file"
    sed -i 's|@/workspace/\.claude/shared/|@shared/|g' "$file"

    # Update memory references
    sed -i 's|@\.claude/memory/|@shared/|g' "$file"
    sed -i 's|@/workspace/\.claude/memory/|@shared/|g' "$file"

    echo "Updated references in $(basename $file)"
  done
}

# Update references in all plugins
for plugin in investigation-toolkit project-orchestrator code-quality-suite test-automation developer-utilities; do
  update_file_references "/tmp/plugin-migration/plugins/$plugin"
done
```

#### 4.2 Verify Bash Command Paths

Commands using `!`command`` may have hardcoded paths. Review and update:

```bash
# Find commands with bash execution
grep -r '!\`' /tmp/plugin-migration/plugins/ --include="*.md"

# Manually review each instance and update paths if needed
```

### Phase 5: Create Plugin READMEs

#### 5.1 Investigation Toolkit README

```bash
cat > /tmp/plugin-migration/plugins/investigation-toolkit/README.md << 'EOF'
# Investigation Toolkit

Parallel evaluation and investigation tools for making informed decisions.

## Installation

```bash
/plugin install investigation-toolkit@goodfoot-plugins
```

## Commands

### /investigate

Investigate any question or problem using parallel objective evaluations.

**Usage:**
```bash
/investigate "Should we use microservices or a monolith?"
```

**How it works:**
1. Analyzes your question deeply
2. Generates 3 diverse solution approaches
3. Evaluates each solution in parallel
4. Synthesizes results and recommends the best approach
5. Iterates if needed

### /second-opinion

Get multiple objective perspectives on a decision.

**Usage:**
```bash
/second-opinion "I'm planning to use Redis for session storage"
```

### /genius

Deep thinking for complex, challenging problems.

**Usage:**
```bash
/genius "How can I optimize this distributed system?"
```

## Use Cases

- Architecture decisions
- Technology selection
- Design pattern choices
- Complex trade-off analysis
- Risk assessment
- Performance optimization strategies

## Tips

- Be specific in your questions
- Include context about constraints
- Use /investigate for exploring options
- Use /second-opinion to validate decisions
- Use /genius for the hardest problems

## License

MIT License - see repository LICENSE for details.
EOF
```

#### 5.2 Create READMEs for Other Plugins

Create similar comprehensive READMEs for:
- project-orchestrator
- code-quality-suite
- test-automation
- developer-utilities

(See templates in 07-templates.md)

### Phase 6: Create Repository Structure

#### 6.1 Initialize Repository

```bash
cd /tmp/plugin-migration

# Create additional directories
mkdir -p .claude-plugin
mkdir -p docs/plugin-guides
mkdir -p examples

# Copy plugins to repository
# (Already in place from previous steps)
```

#### 6.2 Create Marketplace Manifest

```bash
cat > /tmp/plugin-migration/.claude-plugin/marketplace.json << 'EOF'
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
      "keywords": ["investigation", "analysis", "decision-making"],
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
      "keywords": ["project", "planning", "orchestration"],
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
      "keywords": ["review", "quality", "rewrite"],
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
      "keywords": ["testing", "automation", "quality"],
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
      "keywords": ["utilities", "tools", "productivity"],
      "license": "MIT",
      "homepage": "https://github.com/goodfoot-io/cc-plugins/tree/main/plugins/developer-utilities"
    }
  ]
}
EOF
```

### Phase 7: Validation

#### 7.1 JSON Validation

```bash
cd /tmp/plugin-migration

# Validate marketplace.json
jq empty .claude-plugin/marketplace.json && echo "✓ marketplace.json valid"

# Validate all plugin.json files
for plugin in plugins/*/; do
  plugin_name=$(basename "$plugin")
  if jq empty "$plugin/.claude-plugin/plugin.json" 2>/dev/null; then
    echo "✓ $plugin_name plugin.json valid"
  else
    echo "✗ $plugin_name plugin.json INVALID"
  fi
done
```

#### 7.2 Structure Validation

```bash
# Check each plugin has required components
for plugin in plugins/*/; do
  plugin_name=$(basename "$plugin")
  echo "Checking $plugin_name..."

  # Required files
  [ -f "$plugin/.claude-plugin/plugin.json" ] && echo "  ✓ plugin.json" || echo "  ✗ plugin.json MISSING"
  [ -f "$plugin/README.md" ] && echo "  ✓ README.md" || echo "  ✗ README.md MISSING"

  # Content directories
  if [ -d "$plugin/commands" ] || [ -d "$plugin/agents" ]; then
    echo "  ✓ Has content"
  else
    echo "  ✗ No content directories"
  fi

  # Count components
  cmd_count=$(find "$plugin/commands" -name "*.md" 2>/dev/null | wc -l)
  agent_count=$(find "$plugin/agents" -name "*.md" 2>/dev/null | wc -l)
  echo "  → $cmd_count commands, $agent_count agents"
done
```

#### 7.3 Content Validation

```bash
# Verify no CLAUDE.md files were copied as components
find /tmp/plugin-migration/plugins -name "CLAUDE.md" -type f

# Should return no results - if it does, remove them:
# find /tmp/plugin-migration/plugins -name "CLAUDE.md" -type f -delete
```

### Phase 8: Testing

#### 8.1 Local Testing

```bash
# In Claude Code, add local marketplace
/plugin marketplace add /tmp/plugin-migration

# List available plugins
/plugin

# Install a plugin
/plugin install investigation-toolkit@goodfoot-plugins

# Test a command
/investigate "Test question"

# Uninstall when done testing
/plugin uninstall investigation-toolkit
```

#### 8.2 Individual Plugin Testing

Create a testing checklist:

```bash
cat > /tmp/plugin-migration/TESTING-CHECKLIST.md << 'EOF'
# Plugin Testing Checklist

## Investigation Toolkit

- [ ] `/investigate` command works
- [ ] `/second-opinion` command works
- [ ] `/genius` command works
- [ ] Commands create reports in correct location
- [ ] Parallel agent invocation works

## Project Orchestrator

- [ ] `/project:create` command works
- [ ] `/project:begin` command works
- [ ] `/project:worktree` command works
- [ ] `/project:describe` command works
- [ ] `/plan-then-implement` command works
- [ ] All project agents accessible
- [ ] Shared resources load correctly

## Code Quality Suite

- [ ] All `/review:*` commands work
- [ ] All `/rewrite:*` commands work
- [ ] `/recommend` command works
- [ ] Commands handle file references correctly

## Test Automation

- [ ] `/test-agent` command works
- [ ] `test-issue-reproducer` agent works
- [ ] `test-evaluator` agent works
- [ ] Agents create reproduction tests correctly

## Developer Utilities

- [ ] `/document` command works
- [ ] `/jsdoc` command works
- [ ] `/utilities:*` commands work
- [ ] `/iterate-on:*` commands work
- [ ] Agents work correctly
- [ ] Shared resources accessible
EOF
```

### Phase 9: GitHub Repository Creation

#### 9.1 Create Repository

```bash
# Create repository via GitHub CLI
gh repo create goodfoot-io/cc-plugins \
  --public \
  --description "Claude Code plugins for professional development workflows" \
  --clone

# Or create via web interface and clone
# git clone https://github.com/goodfoot-io/cc-plugins.git
```

#### 9.2 Copy Files to Repository

```bash
cd cc-plugins

# Copy all files from migration workspace
cp -r /tmp/plugin-migration/.claude-plugin .
cp -r /tmp/plugin-migration/plugins .
cp -r /tmp/plugin-migration/docs .
cp -r /tmp/plugin-migration/examples .

# Create additional files
# (README.md, LICENSE, .gitignore - see 02-marketplace-setup.md)
```

### Phase 10: Publication

#### 10.1 Initial Commit

```bash
cd cc-plugins

git add .
git commit -m "Initial release of Goodfoot Claude Code Plugins

Plugins included:
- Investigation Toolkit (3 commands)
- Project Orchestrator (5 commands, 5 agents)
- Code Quality Suite (15 commands)
- Test Automation (1 command, 3 agents)
- Developer Utilities (8 commands, 2 agents)

Total: 32 commands, 10 agents"

git push origin main
```

#### 10.2 Create Release

```bash
git tag -a v1.0.0 -m "v1.0.0 - Initial Release"
git push origin v1.0.0

gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "First public release of Goodfoot Claude Code Plugins"
```

## Rollback Plan

If issues are discovered after migration:

### Option 1: Fix Forward

```bash
# Make fixes in plugin repository
# Push updates
# Increment patch version
```

### Option 2: Rollback to Original

```bash
# Original .claude/ directory remains unchanged
# Users can continue using project-level commands
# Fix issues before re-attempting plugin publication
```

## Post-Migration Maintenance

### Keeping Original and Plugins in Sync

**Strategy 1: Plugin-First Development**
- Develop new features in plugin repository
- Copy to `.claude/` for local use

**Strategy 2: Local-First Development**
- Develop in `.claude/`
- Periodically sync to plugin repository

**Strategy 3: Dual Maintenance**
- Maintain both independently
- Use version control to track differences

**Recommendation:** Plugin-first development for public features, local-first for experimental features.

## Migration Verification

After completing migration, verify:

```bash
# Count components
echo "Original counts:"
find /workspace/.claude/commands -name "*.md" ! -name "CLAUDE.md" | wc -l
find /workspace/.claude/agents -name "*.md" ! -name "CLAUDE.md" | wc -l

echo "Migrated counts:"
find /tmp/plugin-migration/plugins -name "*.md" -path "*/commands/*" | wc -l
find /tmp/plugin-migration/plugins -name "*.md" -path "*/agents/*" | wc -l

# Verify specific files
diff /workspace/.claude/commands/investigate.md \
     /tmp/plugin-migration/plugins/investigation-toolkit/commands/investigate.md
```

## Success Criteria

Migration is successful when:

- [ ] All commands migrated to appropriate plugins
- [ ] All agents migrated to appropriate plugins
- [ ] All plugin.json files valid
- [ ] marketplace.json valid
- [ ] All plugins install successfully
- [ ] All commands work after installation
- [ ] All agents work after installation
- [ ] Documentation complete
- [ ] Repository published to GitHub
- [ ] Initial release created

## Timeline Estimate

- Phase 1-2: Setup (1-2 hours)
- Phase 3-5: Migration (2-3 hours)
- Phase 6-7: Repository Creation & Validation (1-2 hours)
- Phase 8: Testing (2-3 hours)
- Phase 9-10: Publication (1 hour)

**Total Estimated Time: 7-11 hours**

## Next Steps

After successful migration:

1. Monitor initial user feedback
2. Create additional documentation
3. Plan version 1.1.0 features
4. Engage with community
5. Iterate based on usage patterns
