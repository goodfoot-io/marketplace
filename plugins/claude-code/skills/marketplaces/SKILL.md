---
name: Plugin Marketplace Management
description: Create, edit, validate, and manage Claude Code plugin marketplaces
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

## Marketplace Directory Structure

**EXACT NAMING REQUIRED** - all names are case-sensitive:

```
/workspace/
├── .claude-plugin/
│   └── marketplace.json      # Required: Marketplace metadata and plugin catalog
├── plugin-name-1/             # Individual plugin directories at repo root
│   ├── .claude-plugin/
│   │   └── plugin.json        # Required: Plugin metadata
│   ├── commands/              # Optional: Slash commands (auto-discovered)
│   │   └── command-name.md    # Filename (minus .md) = command name
│   ├── agents/                # Optional: Sub-agent definitions (auto-discovered)
│   │   └── agent-name.md
│   ├── skills/                # Optional: Autonomous skills (auto-discovered)
│   │   └── skill-name/        # Skills require subdirectory
│   │       └── SKILL.md       # Required: Skill definition (all caps)
│   └── hooks/                 # Optional: Event hooks
│       └── hooks.json         # Default location for hook config
├── plugin-name-2/
│   └── ...
└── README.md                  # Recommended: Marketplace documentation
```

**Critical Path Rules**:
1. Plugin directories must be siblings to `.claude-plugin/` at marketplace root
2. Component directories (`commands/`, `agents/`, `skills/`, `hooks/`) live at plugin root, NOT inside `.claude-plugin/`
3. `.claude-plugin/` contains ONLY `plugin.json` (and optionally `marketplace.json` at repo root)
4. Skills MUST be subdirectories containing `SKILL.md`, not `skills/skill-name.md`
5. Command names come from filename: `analyze-code.md` → `/analyze-code`

## marketplace.json Complete Format

Location: `/workspace/.claude-plugin/marketplace.json`

### Required Structure

```json
{
  "name": "marketplace-identifier",
  "description": "Human-readable marketplace description",
  "version": "1.0.0",
  "plugins": [
    {
      "name": "plugin-identifier",
      "source": "./plugin-directory-name",
      "description": "Plugin description",
      "version": "1.0.0",
      "author": {
        "name": "Author Name",
        "email": "author@example.com"
      },
      "tags": ["typescript", "testing", "automation"]
    }
  ]
}
```

### Field Specifications

| Field | Type | Required | Format | Notes |
|-------|------|----------|--------|-------|
| `name` | string | Yes | Lowercase, hyphens only | Marketplace unique identifier |
| `description` | string | Yes | Free text | Displayed in marketplace listings |
| `version` | string | Yes | Semver (X.Y.Z) | Marketplace version |
| `plugins` | array | Yes | Array of plugin objects | Must contain at least one plugin |
| `plugins[].name` | string | Yes | Lowercase, hyphens only | Must match corresponding plugin.json name exactly |
| `plugins[].source` | string | Yes | Relative path from marketplace root | Must start with `./` prefix |
| `plugins[].version` | string | Yes | Semver (X.Y.Z) | Must match corresponding plugin.json version exactly |
| `plugins[].author` | object | Yes | `{name: string, email?: string}` | Object is required with `name` field; `email` is optional |
| `plugins[].tags` | array | No | Array of strings | For categorization/filtering in marketplace UI. Use concrete descriptors like `["typescript", "testing", "automation"]` not generic placeholders |
| `plugins[].strict` | boolean | No | Default: true | When false, marketplace entry serves as complete manifest if no plugin.json exists |

**Note on tags vs keywords**: In marketplace.json, use `tags` array for plugin categorization. Individual plugin.json files may use `keywords` field. Both serve similar purposes but are distinct fields for their respective contexts.

**⚠️ IMPORTANT**: The `plugins[].components` field is **NOT supported** by Claude Code's marketplace schema and will cause validation errors. Component discovery happens automatically by scanning plugin directories - you do not need to list components in marketplace.json.

### Optional Marketplace-Level Fields

These fields can be added at the root level of marketplace.json for enhanced metadata:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `$schema` | string | JSON schema URL for IDE validation | `"https://anthropic.com/claude-code/marketplace.schema.json"` |
| `displayName` | string | Human-readable marketplace name (defaults to `name` field) | `"Goodfoot Marketplace"` |
| `owner` | object | Marketplace owner information: `{name, email?, url?}` | `{"name": "Goodfoot", "email": "hi@goodfoot.io", "url": "https://goodfoot.io"}` |
| `homepage` | string | URL to marketplace homepage or documentation | `"https://github.com/goodfoot-io/marketplace"` |
| `repository` | object | Git repository information: `{type: "git", url: "..."}` | `{"type": "git", "url": "https://github.com/goodfoot-io/marketplace"}` |

**Example with Optional Fields**:
```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "my-marketplace",
  "displayName": "My Awesome Marketplace",
  "description": "Collection of development tools",
  "version": "1.0.0",
  "owner": {
    "name": "Development Team",
    "email": "team@example.com",
    "url": "https://example.com"
  },
  "homepage": "https://example.com/marketplace",
  "repository": {
    "type": "git",
    "url": "https://github.com/example/marketplace"
  },
  "plugins": [...]
}
```

### Validation Rules

- **Path integrity**: `plugins[].source` must point to directory containing `.claude-plugin/plugin.json`
- **Name consistency**: `plugins[].name` must exactly match `<plugin-path>/.claude-plugin/plugin.json::name`
- **Version consistency**: `plugins[].version` must exactly match `<plugin-path>/.claude-plugin/plugin.json::version`
- **Component discovery**: Claude Code automatically discovers components by scanning plugin directories - no manual listing required in marketplace.json

## plugin.json Format

Location: `/workspace/<plugin-name>/.claude-plugin/plugin.json`

### Minimal Required Structure

```json
{
  "name": "plugin-identifier",
  "description": "Plugin description",
  "version": "1.0.0",
  "author": {
    "name": "Author Name"
  }
}
```

### Field Specifications

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | Must exactly match marketplace.json entry |
| `description` | string | Yes | Should match marketplace.json entry |
| `version` | string | Yes | Semver format, must exactly match marketplace.json |
| `author` | object | Yes | Required object with required `name` field |
| `author.name` | string | Yes | Free text |
| `author.email` | string | No | Valid email format if provided |

## Creating a New Marketplace

### Step 1: Initialize Marketplace Structure

```bash
cd /workspace

# Create marketplace metadata directory
mkdir -p .claude-plugin

# Create marketplace.json
cat > .claude-plugin/marketplace.json << 'EOF'
{
  "name": "workspace-marketplace",
  "description": "Claude Code plugins for this workspace",
  "version": "1.0.0",
  "plugins": []
}
EOF
```

### Step 2: Create First Plugin

```bash
cd /workspace

# Create plugin directory and metadata
mkdir -p my-plugin/.claude-plugin
cat > my-plugin/.claude-plugin/plugin.json << 'EOF'
{
  "name": "my-plugin",
  "description": "My first plugin for workspace",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  }
}
EOF

# Create component directories
mkdir -p my-plugin/commands
mkdir -p my-plugin/agents
mkdir -p my-plugin/skills
mkdir -p my-plugin/hooks
```

### Step 3: Register Plugin in Marketplace

Use jq to add plugin entry:

```bash
cd /workspace

jq '.plugins += [{
  "name": "my-plugin",
  "source": "./my-plugin",
  "description": "My first plugin for workspace",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  },
  "tags": ["utility"]
}]' .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp

mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

## Adding Components to Plugins

### Add a Command

```bash
cd /workspace

# Create command file (filename becomes command name)
cat > my-plugin/commands/analyze.md << 'EOF'
---
description: Analyze TypeScript code in /workspace for common issues
---

# Code Analysis Command

Analyze TypeScript files in /workspace for:
1. Type errors (run yarn typecheck from /workspace)
2. Common patterns that need improvement
3. Files with high complexity

Report findings with absolute paths like /workspace/packages/api/src/file.ts:45
EOF

# Component discovery is automatic - no marketplace.json update needed
# Claude Code scans the commands/ directory automatically
```

### Add a Sub-Agent

```bash
cd /workspace

# Create agent file
cat > my-plugin/agents/code-reviewer.md << 'EOF'
---
name: code-reviewer
description: Reviews code changes for quality and best practices
tools: Read, Grep, Bash
model: sonnet
---

# Code Reviewer Agent

You are a code review agent operating on /workspace.

## Responsibilities
- Review code changes in /workspace for quality issues
- Check adherence to project conventions
- Identify potential bugs or performance issues

## Process
1. Use Read tool to examine files at /workspace/<path>
2. Use Grep to search for patterns
3. Use Bash to run linters/type checkers from /workspace
4. Report findings with specific file locations
EOF

# Component discovery is automatic - no marketplace.json update needed
# Claude Code scans the agents/ directory automatically
```

### Add a Skill

```bash
cd /workspace

# Create skill directory and SKILL.md
mkdir -p my-plugin/skills/fix-imports
cat > my-plugin/skills/fix-imports/SKILL.md << 'EOF'
---
name: Fix TypeScript Imports
description: Automatically fixes incorrect TypeScript imports in /workspace when import errors are detected
allowed-tools: Read, Edit, Bash
---

# Fix Imports Skill

When TypeScript import errors are detected in files under /workspace:

1. Read the file with the import error at /workspace/<path>
2. Analyze the import statement and determine the correct path
3. Use Edit tool to fix the import
4. Verify fix by running yarn typecheck from /workspace

Activate when:
- User mentions import errors
- TypeScript compiler reports "Cannot find module" errors
- Request to "fix imports" or "resolve import paths"
EOF

# Component discovery is automatic - no marketplace.json update needed
# Claude Code scans the skills/ directory automatically
```

### Add Hooks

```bash
cd /workspace

# Create hooks configuration
cat > my-plugin/hooks/hooks.json << 'EOF'
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "command": "python /workspace/scripts/validate-write.py"
        }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "Edit",
      "hooks": [
        {
          "type": "command",
          "command": "bash -c 'cd /workspace && yarn typecheck'"
        }
      ]
    }
  ]
}
EOF

# Component discovery is automatic - no marketplace.json update needed
# Claude Code scans the hooks/ directory automatically
```

## Validation Procedures

### Official Validation Command

**Claude Code provides a built-in validation command** to validate marketplace and plugin manifests:

```bash
# Validate marketplace.json
claude plugin validate /workspace/.claude-plugin/marketplace.json

# Validate a specific plugin
claude plugin validate /workspace/plugins/my-plugin

# Validate all plugins in a marketplace
for plugin_dir in /workspace/plugins/*; do
  if [ -d "$plugin_dir" ]; then
    echo "Validating $(basename $plugin_dir)..."
    claude plugin validate "$plugin_dir"
  fi
done
```

**What the validation command checks**:
- ✅ JSON syntax and structure
- ✅ Required fields (name, version, description, source)
- ✅ Field types and formats (semver, paths, etc.)
- ✅ Name consistency between marketplace.json and plugin.json
- ✅ Version consistency between marketplace.json and plugin.json
- ✅ Path integrity (source paths point to valid plugin directories)
- ✅ Component discovery (commands, agents, skills exist at expected paths)
- ⚠️  Warnings for missing optional fields or best practices

**Example output**:
```
Validating marketplace manifest: /workspace/.claude-plugin/marketplace.json

⚠ Found 1 warning:
  ❯ metadata.description: No marketplace description provided

✔ Validation passed with warnings
```

### Quick JSON Syntax Check

If you need to quickly check JSON syntax without full validation:

```bash
# Check JSON syntax only (does not validate schema)
jq empty /workspace/.claude-plugin/marketplace.json && echo "✓ Valid JSON" || echo "✗ Invalid JSON"

# Pretty print marketplace.json
jq . /workspace/.claude-plugin/marketplace.json
```

**Note**: Use `claude plugin validate` for comprehensive validation. The `jq` command only checks JSON syntax, not Claude Code plugin schema requirements.

## Updating marketplace.json with jq

### Update Plugin Version

```bash
cd /workspace

# Update version in both marketplace.json and plugin.json
NEW_VERSION="1.1.0"
PLUGIN_NAME="my-plugin"

# Update marketplace.json
jq --arg name "$PLUGIN_NAME" --arg version "$NEW_VERSION" \
  '(.plugins[] | select(.name == $name) | .version) = $version' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json

# Update plugin.json
jq --arg version "$NEW_VERSION" '.version = $version' \
  $PLUGIN_NAME/.claude-plugin/plugin.json > $PLUGIN_NAME/.claude-plugin/plugin.json.tmp
mv $PLUGIN_NAME/.claude-plugin/plugin.json.tmp $PLUGIN_NAME/.claude-plugin/plugin.json
```

### Add Component to Existing Plugin

```bash
cd /workspace

PLUGIN_NAME="my-plugin"
COMMAND_NAME="new-command"

# Add to commands array
jq --arg name "$PLUGIN_NAME" --arg cmd "$COMMAND_NAME" \
  '(.plugins[] | select(.name == $name) | .components.commands) += [$cmd]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

### Remove Plugin from Marketplace

```bash
cd /workspace

PLUGIN_NAME="old-plugin"

# Remove plugin entry
jq --arg name "$PLUGIN_NAME" \
  '.plugins = [.plugins[] | select(.name != $name)]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

## Versioning Strategy

Use semantic versioning (semver) per https://semver.org/

**Format**: `MAJOR.MINOR.PATCH` (e.g., `2.3.1`)

- **MAJOR**: Breaking changes (e.g., removing plugin, changing command interface)
- **MINOR**: New features, backward compatible (e.g., adding plugin, new command)
- **PATCH**: Bug fixes, backward compatible (e.g., fixing command logic, typos)

**When to increment**:
- Add new plugin → Bump marketplace MINOR version
- Update plugin functionality → Bump that plugin's MINOR version
- Fix plugin bug → Bump that plugin's PATCH version
- Remove plugin → Bump marketplace MAJOR version (breaking change)
- Change command parameters → Bump plugin MAJOR version (breaking change)

## Troubleshooting Common Issues

### Issue: Name Mismatch Between marketplace.json and plugin.json

**Symptom**: `claude plugin validate` reports "Name mismatch"

**Diagnosis**:
```bash
# Run validation to identify mismatch
claude plugin validate /workspace/.claude-plugin/marketplace.json

# Compare names manually
echo "Marketplace name:"
jq -r '.plugins[0].name' /workspace/.claude-plugin/marketplace.json

echo "Plugin name:"
jq -r '.name' /workspace/my-plugin/.claude-plugin/plugin.json
```

**Fix**:
```bash
# Fix plugin.json to match marketplace.json
CORRECT_NAME=$(jq -r '.plugins[0].name' /workspace/.claude-plugin/marketplace.json)
jq --arg name "$CORRECT_NAME" '.name = $name' \
  /workspace/my-plugin/.claude-plugin/plugin.json > /workspace/my-plugin/.claude-plugin/plugin.json.tmp
mv /workspace/my-plugin/.claude-plugin/plugin.json.tmp /workspace/my-plugin/.claude-plugin/plugin.json

# Verify fix
claude plugin validate /workspace/.claude-plugin/marketplace.json
```

### Issue: Version Mismatch Between marketplace.json and plugin.json

**Symptom**: `claude plugin validate` reports "Version mismatch"

**Diagnosis**:
```bash
# Run validation to identify mismatch
claude plugin validate /workspace/.claude-plugin/marketplace.json
```

**Fix**:
```bash
# Sync versions (update both to match)
NEW_VERSION="1.0.0"
PLUGIN_NAME="my-plugin"

# Update marketplace.json
jq --arg name "$PLUGIN_NAME" --arg version "$NEW_VERSION" \
  '(.plugins[] | select(.name == $name) | .version) = $version' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json

# Update plugin.json
jq --arg version "$NEW_VERSION" '.version = $version' \
  $PLUGIN_NAME/.claude-plugin/plugin.json > $PLUGIN_NAME/.claude-plugin/plugin.json.tmp
mv $PLUGIN_NAME/.claude-plugin/plugin.json.tmp $PLUGIN_NAME/.claude-plugin/plugin.json

# Verify fix
claude plugin validate /workspace/.claude-plugin/marketplace.json
```

### Issue: Invalid JSON Syntax

**Symptom**: Validation fails with JSON parse error

**Common causes**:
1. Trailing comma after last array/object element
2. Missing quotes around string values
3. Unescaped quotes in strings
4. Missing closing brackets/braces

**Diagnosis**:
```bash
# Run validation to see specific errors
claude plugin validate /workspace/.claude-plugin/marketplace.json

# Or check JSON syntax only
jq empty /workspace/.claude-plugin/marketplace.json
```

**Fix**:
- Remove trailing commas
- Add missing quotes
- Escape internal quotes with \"
- Balance brackets/braces

**Verify fix**:
```bash
# Validate after fixing
claude plugin validate /workspace/.claude-plugin/marketplace.json

# Pretty print to verify structure
jq . /workspace/.claude-plugin/marketplace.json
```

### Issue: Skill Missing SKILL.md

**Symptom**: Directory exists but no SKILL.md file inside

**Fix**:
```bash
cd /workspace

PLUGIN_NAME="my-plugin"
SKILL_NAME="my-skill"

# Ensure skill is a directory with SKILL.md
mkdir -p $PLUGIN_NAME/skills/$SKILL_NAME
touch $PLUGIN_NAME/skills/$SKILL_NAME/SKILL.md

# Add basic structure
cat > $PLUGIN_NAME/skills/$SKILL_NAME/SKILL.md << 'EOF'
---
name: Skill Display Name
description: What this skill does and when to activate it
allowed-tools: Read, Write, Edit
---

# Skill Instructions

Details on what this skill does...
EOF
```

### Issue: Path Not Starting with ./

**Symptom**: Plugin path doesn't start with `./`

**Fix**:
```bash
# Add ./ prefix to all plugin paths
jq '(.plugins[].source) |=
  if startswith("./") then . else "./" + . end' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

## Naming Conventions

**Identifiers** (plugin names, agent names, command filenames without extension):
- **Format**: `[a-z0-9]+(-[a-z0-9]+)*` (lowercase letters, numbers, hyphens)
- **Examples**: ✅ `git-tools`, `typescript-helper`, `analyze-performance`
- **Invalid**: ❌ `GitTools`, `typescript_helper`, `-start-with-hyphen`

**Display Names** (skill names, descriptions):
- Can include spaces, capitals, and most Unicode characters
- No hard length limit but keep under 100 characters

## Best Practices

### Plugin Organization

**Group related functionality**:
- ✅ Group: Git commands (`git-commit`, `git-status`) in `git-tools` plugin
- ✅ Separate: Unrelated features in different plugins (`typescript-helpers`, `docker-tools`)
- ❌ Avoid: Mixing unrelated commands in single plugin

### Documentation Standards

**Marketplace README** (`/workspace/README.md`):
- Marketplace description and purpose
- Installation instructions
- Plugin catalog with descriptions
- Usage examples
- Contribution guidelines

**Per-plugin README** (`/workspace/plugin-name/README.md`):
- Plugin overview and purpose
- List of commands with examples
- Sub-agents and when main agent invokes them
- Skills and trigger conditions
- Hooks and what they protect/automate

### Testing Before Release

Before committing marketplace changes:

1. **Syntax validation**: `jq empty /workspace/.claude-plugin/marketplace.json`
2. **Path verification**: Check all component paths resolve correctly
3. **Name/version consistency**: Ensure marketplace.json matches plugin.json
4. **Component verification**: Verify all listed components exist at declared paths

## Common jq Patterns

### List All Plugins

```bash
jq -r '.plugins[] | "\(.name) - \(.version)"' /workspace/.claude-plugin/marketplace.json
```

### Get Plugin by Name

```bash
jq '.plugins[] | select(.name == "my-plugin")' /workspace/.claude-plugin/marketplace.json
```

### Find Plugins with Specific Tag

```bash
jq -r '.plugins[] | select(.tags[]? == "utility") | .name' /workspace/.claude-plugin/marketplace.json
```

### Update Marketplace Version

```bash
jq '.version = "2.0.0"' .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

## Complete Workflow Example

Creating a marketplace with a complete plugin:

```bash
cd /workspace

# Step 1: Initialize marketplace
mkdir -p .claude-plugin
cat > .claude-plugin/marketplace.json << 'EOF'
{
  "name": "my-marketplace",
  "description": "Custom plugins for my workspace",
  "version": "1.0.0",
  "plugins": []
}
EOF

# Step 2: Create plugin structure
mkdir -p my-first-plugin/{.claude-plugin,commands,agents,skills,hooks}

# Step 3: Create plugin.json
cat > my-first-plugin/.claude-plugin/plugin.json << 'EOF'
{
  "name": "my-first-plugin",
  "description": "My first custom plugin",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  }
}
EOF

# Step 4: Add command
cat > my-first-plugin/commands/hello.md << 'EOF'
---
description: Say hello to the user
---

Greet the user warmly and ask how you can help them today.
EOF

# Step 5: Add skill
mkdir -p my-first-plugin/skills/example-skill
cat > my-first-plugin/skills/example-skill/SKILL.md << 'EOF'
---
name: Example Skill
description: Example skill that demonstrates marketplace integration
allowed-tools: Read, Write
---

# Example Skill

This is an example skill for demonstration purposes.
EOF

# Step 6: Register plugin in marketplace
jq '.plugins += [{
  "name": "my-first-plugin",
  "source": "./my-first-plugin",
  "description": "My first custom plugin",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "tags": ["example", "tutorial"]
}]' .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json

# Step 7: Validate
claude plugin validate .claude-plugin/marketplace.json
claude plugin validate my-first-plugin

# Step 8: Pretty print final result
echo "=== Final marketplace.json ==="
jq . .claude-plugin/marketplace.json
```

## Key Principles

1. **Exact naming matters**: `.claude-plugin`, `marketplace.json`, `plugin.json`, `SKILL.md` are case-sensitive
2. **Component names**: Commands/agents use filename without `.md`, skills use directory name
3. **Path format**: Always use `./plugin-name` format with `./` prefix
4. **Consistency**: Name and version must match between marketplace.json and plugin.json
5. **Validation**: Always validate with `claude plugin validate` before committing
6. **Versioning**: Use semver consistently across marketplace and plugins
7. **Structure**: Plugins at repo root, components at plugin root, metadata in `.claude-plugin/`
8. **Component discovery**: Automatic - Claude Code scans plugin directories, no manual listing needed

## Official Documentation

For the latest information and updates, refer to the official Claude Code documentation:

- **Plugin Marketplaces Guide**: https://docs.claude.com/en/docs/claude-code/plugin-marketplaces
- **Plugins Reference**: https://docs.claude.com/en/docs/claude-code/plugins-reference
- **General Plugins Documentation**: https://docs.claude.com/en/docs/claude-code/plugins

## See Also

**Related Skills** (in this plugin):
- **Plugin Management**: Creating and configuring individual plugins
- **Sub-Agent Management**: Creating specialized agents for plugins
- **Slash Command Management**: Creating user-invoked commands
- **Skill Management**: Creating autonomous capabilities
- **MCP Server Configuration**: Integrating external tools via plugins

**Related Topics**:
- Component directories: `commands/`, `agents/`, `skills/`, `hooks/`
- Version management and semver best practices
- YAML frontmatter conventions across all component types

---

*Last Updated: October 2025*
