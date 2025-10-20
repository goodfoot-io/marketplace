---
name: Slash Command Management
description: Create, edit, and configure Claude Code slash commands
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

## What Are Slash Commands?

**Slash commands** are user-invoked markdown files that inject instructions into Claude's conversation context. When a user types `/command-name`, Claude Code:

1. Locates the corresponding markdown file at `commands/<command-name>.md`
2. Injects the markdown body as system instructions
3. Claude receives and follows these instructions as if they were part of the system prompt
4. The user sees Claude's response to the command

**Key Characteristics**:
- Commands are **user-invoked** (not autonomous like skills)
- The command name comes from the **filename without .md extension**
- Commands **do not receive arguments** as separate parameters
- The markdown body becomes **additional instructions** for Claude
- Commands can reference files, embed bash code blocks, and provide multi-step workflows

## How Commands Differ from Other Components

| Feature | Slash Commands | Sub-Agents | Skills |
|---------|---------------|------------|--------|
| **Invocation** | User types `/command` | Main agent calls Task tool | Claude decides autonomously |
| **Tool Restrictions** | Optional via `allowed-tools` field (default: uses main agent's tools) | Via `tools` field | Via `allowed-tools` field |
| **Arguments** | Not supported | Via prompt parameter | Not applicable |
| **Working Directory** | `/workspace` (main context) | Inherits parent | Skill directory |
| **Use Case** | Reusable user workflows | Delegated sub-tasks | Contextual automation |

**Note**: By default, commands execute with full access to main agent's tools. Use the `allowed-tools` frontmatter field to restrict access for specific commands (see YAML Frontmatter Fields section).

### Command Sources (October 2025)

Commands can come from multiple sources:

**1. Project Commands** (`.claude/commands/`)
- Version controlled with project
- Shared across all team members
- Project-specific workflows

**2. User Commands** (`~/.claude/commands/`)
- Personal commands in user's home directory
- Not shared with team
- User-specific preferences

**3. Plugin Commands** (`<plugin>/commands/`)
- Reusable commands distributed via plugin marketplace
- Installed via plugin system
- Shareable across projects

**4. MCP Commands** (October 2025+)
- **New**: MCP servers can expose prompts as slash commands
- Dynamically discovered from connected MCP servers
- Integrated seamlessly with other command types
- Example: MCP server "code-tools" might expose `/mcp-code-tools:format` command
- Automatically available when MCP server is configured

**Command Discovery**: Users can see all available commands (from all sources) using `/help` or tab completion.

## Command File Structure

### Location and Naming

**Directory**: `/workspace/<plugin-name>/commands/`

**Filename Format**: `<command-name>.md` (lowercase, hyphens allowed)

**Command Name Mapping**:
- `analyze.md` → User invokes with `/analyze`
- `validate-typescript.md` → User invokes with `/validate-typescript`
- `git-status.md` → User invokes with `/git-status`

**⚠️ CRITICAL**: The filename (minus `.md`) becomes the command name. Do NOT use `commands/analyze/command.md` - use `commands/analyze.md`.

### File Format

```markdown
---
description: Brief description of what this command does (required)
---

# Command Implementation

Detailed instructions for Claude to execute when command is invoked.

Can include:
- Multi-line instructions
- Step-by-step processes
- Code examples in fenced blocks
- References to files using absolute paths
- Embedded bash commands
- Expected output formats
```

### YAML Frontmatter Requirements

**Required Fields**:
- `description`: Brief explanation shown in command listings and help text

**Optional Functional Fields** (supported by Claude Code, October 2025+):
- `allowed-tools`: Comma-separated list restricting tool access during command execution
  - Example: `allowed-tools: Read, Grep, Bash`
  - Omitting this field grants full tool access (commands use main agent's tools by default)
  - **Note**: Commands and skills use `allowed-tools` (hyphenated), while sub-agents use `tools` (no hyphen). This distinction is intentional in Claude Code's architecture

### 🔒 Security Considerations for allowed-tools

Apply the principle of least privilege when restricting tools in commands:

**When to restrict tools**:
- **Read-only analysis commands**: `allowed-tools: Read, Grep, Bash` (no Write/Edit = cannot modify files)
- **Validation commands**: `allowed-tools: Bash, Read` (run checks without changes)
- **Information commands**: `allowed-tools: Read, Bash` (report status without modifications)

**When to allow full access**:
- Code generation commands that need Write/Edit capabilities
- Deployment commands requiring full tool access
- Refactoring commands that modify multiple files

**Best Practice**: Grant only the tools needed for the command's specific purpose to limit potential impact of errors or misuse.

**Example - Read-only Analysis Command**:
```yaml
---
description: Analyze codebase for type errors
allowed-tools: Read, Grep, Bash
---
```

- `model`: Preferred model for command execution
  - Options: `sonnet`, `opus`, `haiku`
  - Example: `model: haiku` (for lightweight commands)

### Model Selection for Commands (October 2025)

Choose the right model based on command complexity and frequency:

| Command Type | Recommended Model | Rationale | Example Commands |
|--------------|------------------|-----------|------------------|
| Simple validation | `haiku` | Fast, cost-effective, sufficient capability | `/lint`, `/typecheck`, `/format` |
| Code analysis | `sonnet` | Better reasoning for complex analysis | `/analyze-architecture`, `/find-patterns` |
| Code generation | `sonnet` | Superior coding performance | `/generate-component`, `/scaffold` |
| Architectural review | `opus` | Maximum reasoning for critical decisions | `/review-design`, `/assess-security` |
| Documentation generation | `haiku` or `sonnet` | Depends on complexity | `/doc-simple` → haiku, `/doc-api` → sonnet |
| Multi-step workflows | `sonnet` | Better at coordinating complex processes | `/deploy-pipeline`, `/release-process` |

**Cost/Performance Tradeoffs**:
- **Haiku 4.5**: 3x cheaper, 2x faster, 90% of Sonnet capability - ideal for frequent, lightweight commands
- **Sonnet 4.5**: Best balance for most commands, recommended default
- **Opus 4.1**: Only for most demanding tasks (architectural decisions, security reviews)

**Best Practice**: Start with `haiku` for simple commands, upgrade to `sonnet` if quality issues arise.

- `argument-hint`: Hint text for command arguments (displayed in help)
  - Example: `argument-hint: <file-path> [options]`
  - **Important**: This field is for documentation purposes only
  - Commands don't receive arguments as structured parameters
  - Arguments typed by user appear in conversation context but aren't parsed or passed to command
  - Use this field to document expected usage patterns for users

**Optional Metadata Fields** (informational only, not used by Claude Code):
- `author`: Command creator
- `version`: Command version
- `tags`: Categorization tags

**YAML Rules** (critical for parsing):
1. **Delimiters**: Exactly `---` on its own line (no leading/trailing whitespace)
2. **Indentation**: Spaces only, never tabs (2 or 4 spaces consistently)
3. **String handling**: Quote strings containing special characters: `: " ' | # @ !`
4. **Multi-line strings**: Use `|` (preserve newlines) or `>` (fold newlines)

**Example Frontmatter**:
```yaml
---
description: Run TypeScript compiler and report type errors with file locations
---
```

**Common Errors to Avoid**:
- ❌ `--- ` (trailing space after delimiter)
- ❌ `description: Has: unquoted colon` (breaks YAML parser)
- ❌ Missing closing `---` delimiter
- ❌ Using tabs for indentation

## Command Body Structure

The markdown body (everything after frontmatter) becomes Claude's instructions. Effective command bodies follow these patterns:

### 1. Clear Objective Statement

Start with what the command accomplishes:

```markdown
# TypeScript Validation Command

Run the TypeScript compiler in check mode and analyze any errors.
```

### 2. Step-by-Step Process

Provide numbered steps for complex workflows:

```markdown
## Process

1. Navigate to the project root (currently /workspace)
2. Run `yarn typecheck` (this repository uses Yarn 4.9.2)
3. Parse output for type errors
4. For each error, report:
   - File path (absolute path from /workspace)
   - Line number
   - Error message
5. Suggest fixes for common patterns
```

### 3. Context and Constraints

Specify working directory, file locations, and limitations:

```markdown
## Context

- Project root: /workspace
- Package manager: Yarn 4.9.2
- TypeScript config: /workspace/tsconfig.json
- This is a monorepo with packages in /workspace/packages/

## Constraints

- Use absolute paths like /workspace/packages/api/src/file.ts
- Do not modify files unless explicitly requested
- If more than 10 errors, summarize instead of listing all
```

### 4. Examples and Expected Output

Show what the output should look like:

```markdown
## Expected Output Format

For each error:
```
Error at /workspace/packages/api/src/user.ts:45
  TS2322: Type 'string | undefined' is not assignable to type 'string'.

  Suggested fix: Add null check or use optional chaining
```
```

## Path References in Commands

**Best Practice**: Use **absolute paths** starting with `/workspace/` when referencing project files.

**Why?**: Commands execute in the main agent context with working directory `/workspace`, but being explicit prevents confusion.

**Examples**:

```markdown
# Good (explicit absolute paths)
1. Read configuration from /workspace/.config/settings.json
2. Run tests using /workspace/scripts/test.sh
3. Check files in /workspace/packages/api/src/

# Acceptable (relative to working directory)
1. Read configuration from .config/settings.json
2. Run tests using scripts/test.sh

# Avoid (ambiguous)
1. Read the config file (which file? where?)
2. Run the tests (which test script? where?)
```

## Embedding Bash Commands

Commands can include bash code blocks that Claude will execute. Use proper markdown fencing:

### Inline Commands

For simple commands, use inline code:

```markdown
Run `yarn typecheck` from /workspace to validate TypeScript types.
```

### Code Blocks

For complex commands or scripts, use fenced code blocks:

````markdown
Run the following validation script:

```bash
#!/bin/bash
cd /workspace
yarn typecheck 2>&1 | tee /tmp/typecheck-output.txt
if [ $? -eq 0 ]; then
  echo "✓ No type errors found"
else
  echo "✗ Type errors detected"
fi
```
````

**Key Points**:
- Use triple backticks with `bash` language identifier
- No escaping needed within markdown code blocks
- Claude will execute the bash code using the Bash tool
- Commands run with working directory `/workspace`

## Command Scopes

Commands can exist in three different scopes with different purposes and audiences:

### 1. Project Commands (`.claude/commands/`)

**Location**: `/workspace/.claude/commands/`

**Purpose**: Team-shared commands specific to this project

**Characteristics**:
- Version controlled with the project
- Shared across all team members
- Project-specific workflows and automation
- Committed to git repository

**Use Cases**:
- Project build/test/deploy workflows
- Project-specific code generation
- Repository maintenance tasks
- Team-standard quality checks

**Example**: `/workspace/.claude/commands/deploy-staging.md`

### 2. User Commands (`~/.claude/commands/`)

**Location**: `~/.claude/commands/` (user's home directory)

**Purpose**: Personal commands not shared with team

**Characteristics**:
- User-specific, not version controlled
- Available across all projects for this user
- Personal productivity shortcuts
- Not visible to other team members

**Use Cases**:
- Personal coding shortcuts
- Individual workflow preferences
- Learning/experimental commands
- User-specific integrations

**Example**: `~/.claude/commands/my-custom-review.md`

### 3. Plugin Commands (`<plugin>/commands/`)

**Location**: `/workspace/<plugin-name>/commands/`

**Purpose**: Reusable commands distributed via plugin marketplace

**Characteristics**:
- Distributed through plugin marketplace
- Installed via `/plugin install` command
- Shared across multiple projects and teams
- Versioned with the plugin

**Use Cases**:
- General-purpose development tools
- Framework-specific commands
- Cross-project automation
- Community-shared workflows

**Example**: `/workspace/my-plugin/commands/analyze.md`

> **Note**: This skill focuses on **plugin commands**. Project and user commands follow the same markdown format but are stored in different locations.

### Scope Priority

When multiple commands with the same name exist:
1. **Plugin commands** (most recently installed plugin takes precedence)
2. **Project commands** (`.claude/commands/`)
3. **User commands** (`~/.claude/commands/`)

To avoid conflicts, use unique, descriptive command names.

## Command Naming Conventions

### Filename Rules

**Format**: `[a-z0-9]+(-[a-z0-9]+)*` (lowercase letters, numbers, hyphens only)

**Valid Examples**:
- ✅ `analyze.md` → `/analyze`
- ✅ `validate-typescript.md` → `/validate-typescript`
- ✅ `git-status-verbose.md` → `/git-status-verbose`
- ✅ `deploy-staging.md` → `/deploy-staging`

**Invalid Examples**:
- ❌ `Analyze.md` (uppercase)
- ❌ `validate_typescript.md` (underscores)
- ❌ `git status.md` (spaces)
- ❌ `-analyze.md` (leading hyphen)

### Naming Strategies

**Verb-Based** (action commands):
- `analyze.md` - Analyze code
- `validate.md` - Validate structure
- `format.md` - Format code
- `deploy.md` - Deploy application

**Noun-Subject** (status/info commands):
- `git-status.md` - Show git status
- `project-info.md` - Display project info
- `dependencies.md` - List dependencies

**Qualified Actions** (specific variants):
- `analyze-performance.md` - Specific analysis type
- `deploy-staging.md` - Specific deployment target
- `test-unit.md` - Specific test type

## Arguments Handling

**Important**: Slash commands **do not receive arguments** as separate parameters.

When a user types `/analyze arg1 arg2`, Claude Code:
1. Finds `commands/analyze.md`
2. Injects the markdown body as instructions
3. The text "arg1 arg2" is **ignored** - not passed to the command

**Workaround**: If you need parameterization, instruct Claude to ask the user:

```markdown
---
description: Analyze specific files or directories for issues
---

# Analyze Command

1. Ask the user which files or directories to analyze
2. Wait for their response
3. Proceed with analysis on the specified targets
4. Report findings with absolute paths like /workspace/path/to/file.ts:45
```

## Programmatic Command Invocation

**New in October 2025**: Claude can invoke slash commands programmatically using the `SlashCommand` tool.

### SlashCommand Tool

**Purpose**: Allows Claude to execute slash commands programmatically without user typing them.

**Syntax**:
```
SlashCommand(command="/command-name")
```

**Use Cases**:
- **Sub-agents invoking commands**: Sub-agents can invoke project commands
- **Automated workflow chaining**: Commands can trigger other commands
- **Conditional execution**: Claude can decide whether to invoke a command based on analysis

**Example - Automated Workflow**:

A command that runs tests and automatically invokes the report command if failures occur:

```markdown
---
description: Run tests and generate report on failures
---

# Test and Report

1. Run the test suite using Bash tool
2. Check the exit code
3. If tests failed:
   - Use SlashCommand tool to invoke `/generate-test-report`
   - The report command will analyze failures and create documentation
4. If tests passed:
   - Confirm success to user
```

**Limitations**:
- Commands still don't receive arguments via SlashCommand tool
- The invoked command executes in the current conversation context
- Recursive command invocation should be avoided (command A calling command B calling command A)

**Example - Conditional Command**:

```
# Main agent decides based on analysis
if error_detected:
    SlashCommand(command="/fix-imports")
else:
    report_success()
```

## Writing Effective Command Descriptions

The `description` field appears in command listings and help text. Write descriptions that:

### Be Concise (1-2 lines)

```yaml
# Good
description: Run TypeScript compiler and report type errors with file locations

# Too verbose
description: This command runs the TypeScript compiler in check mode, parses all output, identifies type errors, and generates a detailed report with file paths, line numbers, and suggested fixes

# Too vague
description: Checks code
```

### Use Action Verbs

```yaml
# Good - clear action
description: Validate TypeScript types in all packages
description: Generate documentation for API endpoints
description: Deploy application to staging environment

# Weak - passive or vague
description: TypeScript validation
description: Helps with documentation
description: Deployment tool
```

### Specify Scope

```yaml
# Good - clear scope
description: Analyze React components in /workspace/packages/ui for missing PropTypes
description: Run all unit tests in /workspace and report failures

# Too broad
description: Analyze components
description: Run tests
```

## Complete Command Examples

### Example 1: Code Analysis Command

**File**: `/workspace/my-plugin/commands/analyze-typescript.md`

```markdown
---
description: Run TypeScript compiler and report type errors with file locations
---

# TypeScript Analysis Command

Run the TypeScript compiler in check mode and analyze any errors found in the codebase.

## Process

1. Navigate to the project root at /workspace
2. Run `yarn typecheck` (this repository uses Yarn 4.9.2 as package manager)
3. Parse compiler output for type errors
4. For each error found, report:
   - File path (use absolute path from /workspace)
   - Line number and column
   - Error code and message
   - Surrounding code context if helpful
5. If more than 10 errors, provide summary statistics and list only the most critical issues
6. Suggest common fixes for recurring error patterns

## Output Format

Format each error as:

```
Error at /workspace/packages/api/src/user.ts:45:12
  TS2322: Type 'string | undefined' is not assignable to type 'string'.

  Context: Property 'email' is being assigned
  Suggested fix: Add null check or use optional chaining operator
```

## Notes

- Use absolute paths starting with /workspace/
- This is a monorepo with packages in /workspace/packages/
- TypeScript configuration is at /workspace/tsconfig.json
- Do not modify files, only analyze and report
```

### Example 2: Multi-Step Workflow Command

**File**: `/workspace/my-plugin/commands/prepare-release.md`

```markdown
---
description: Prepare codebase for release by running validations and updating version
---

# Release Preparation Command

Prepare the codebase for a new release by running all validations and updating version information.

## Step 1: Run All Validations

Execute the following validation checks from /workspace:

```bash
cd /workspace
echo "Running linter..."
yarn lint
echo "Running type checker..."
yarn typecheck
echo "Running tests..."
yarn test
```

If any validation fails, **stop** and report the failures. Do not proceed to next steps.

## Step 2: Update Version

1. Ask the user for the new version number (format: X.Y.Z)
2. Update version in /workspace/package.json
3. Update version in /workspace/.claude-plugin/marketplace.json
4. For each plugin in /workspace/plugins/, update its plugin.json version if modified

## Step 3: Update Changelog

1. Read /workspace/CHANGELOG.md
2. Add new section at top with version and date
3. List major changes made since last release
4. Ask user to review and approve changelog entry

## Step 4: Create Git Tag

```bash
cd /workspace
git add .
git commit -m "Release version X.Y.Z"
git tag -a vX.Y.Z -m "Release version X.Y.Z"
```

## Step 5: Summary

Report:
- Version number
- Files modified
- Git commit and tag created
- Next steps: `git push origin main --tags`

## Important Notes

- Stop at first validation failure
- Require user confirmation before git operations
- Use semantic versioning (semver.org)
- This repository uses Yarn 4.9.2
```

### Example 3: Git Workflow Command

**File**: `/workspace/my-plugin/commands/git-commit-smart.md`

```markdown
---
description: Create an intelligent git commit with auto-generated message from changes
---

# Smart Git Commit Command

Create a git commit with an automatically generated commit message based on changed files and diff analysis.

## Process

1. **Check Status**
   ```bash
   cd /workspace
   git status --porcelain
   ```

2. **Analyze Changes**
   - Use `git diff` to see what changed
   - Identify the nature of changes:
     - New files → "Add"
     - Modified files → "Update" or "Fix" depending on context
     - Deleted files → "Remove"
     - Refactoring without behavior change → "Refactor"

3. **Generate Commit Message**

   Format: `<type>: <concise description>`

   Types:
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `style`: Code style/formatting
   - `refactor`: Code refactoring
   - `test`: Test additions/changes
   - `chore`: Maintenance tasks

   Example: `feat: add TypeScript validation command`

4. **Present to User**
   - Show the generated message
   - Ask: "Would you like to use this commit message, modify it, or cancel?"
   - Wait for user response

5. **Create Commit**

   If user approves:
   ```bash
   cd /workspace
   git add .
   git commit -m "<generated-message>"
   ```

## Commit Message Guidelines

- **Be specific**: "Update user authentication" not "Update files"
- **Be concise**: Aim for 50 characters or less
- **Use imperative mood**: "Add feature" not "Added feature"
- **Reference scope**: "feat(api): add user endpoint" when applicable

## Examples

Good commit messages:
- `feat: add slash command management skill`
- `fix: resolve TypeScript import errors in utils`
- `docs: update marketplace creation guide`
- `refactor: simplify command validation logic`

Avoid:
- `Update stuff` (too vague)
- `Fixed bugs and added features` (multiple changes, be specific)
- `WIP` (don't commit work in progress)
```

### Example 4: Configuration Command

**File**: `/workspace/my-plugin/commands/setup-environment.md`

```markdown
---
description: Set up development environment with required tools and configurations
---

# Environment Setup Command

Set up the development environment for working with this Claude Code marketplace.

## Prerequisites Check

Verify required tools are installed:

```bash
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || echo "ERROR: Node.js not found"
command -v yarn >/dev/null 2>&1 || echo "ERROR: Yarn not found"
command -v git >/dev/null 2>&1 || echo "ERROR: Git not found"
node --version
yarn --version
```

If any tool is missing, provide installation instructions for the user's platform.

## Step 1: Install Dependencies

```bash
cd /workspace
yarn install
```

## Step 2: Configure Git Hooks (Optional)

Ask user if they want to set up git hooks for validation:

If yes:
```bash
cd /workspace
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
cd /workspace
yarn lint-staged
EOF
chmod +x .git/hooks/pre-commit
```

## Step 3: Validate Marketplace

Run validation to ensure marketplace structure is correct:

```bash
cd /workspace
bash scripts/validate-marketplace.sh
```

Report any errors found.

## Step 4: Set Up IDE Integration (Optional)

Ask user about their IDE:
- **VSCode**: Recommend extensions (ESLint, Prettier, YAML)
- **Other**: Provide general setup guidance

## Summary

Report:
- ✓ Dependencies installed
- ✓ Git hooks configured (if selected)
- ✓ Marketplace validation passed
- ✓ Environment ready

Next steps:
- Run `/plugin marketplace add /workspace` to add this marketplace
- Run `/plugin list` to see available plugins
```

## Troubleshooting Command Issues

### Command Not Found After Creation

**Symptom**: User types `/my-command` but Claude says "command not found"

**Checklist**:
1. ✅ File exists at `/workspace/<plugin-name>/commands/my-command.md`
2. ✅ File has `.md` extension (not `.markdown` or no extension)
3. ✅ Command is listed in `marketplace.json` components array (use filename without .md)
4. ✅ Plugin is installed: `/plugin list` shows the plugin
5. ✅ Name/version match between marketplace.json and plugin.json

**Resolution Steps**:
```bash
# Verify file exists
ls -la /workspace/<plugin-name>/commands/my-command.md

# Check marketplace.json lists the command
jq '.plugins[] | select(.name == "<plugin-name>") | .components.commands' /workspace/.claude-plugin/marketplace.json

# Reinstall plugin
/plugin uninstall <plugin-name>
/plugin install <plugin-name>@<marketplace-name>
```

### YAML Parsing Errors

**Symptom**: Command loads but frontmatter fields are missing or incorrect

**Common Causes**:
1. **Tabs instead of spaces**: YAML requires space indentation
   - Fix: Replace all tabs with spaces

2. **Missing closing delimiter**:
   ```markdown
   ---
   description: My command

   # Content starts here without closing ---
   ```
   - Fix: Add closing `---` before markdown content

3. **Unquoted special characters**:
   ```yaml
   description: Validates: files and configs  # Breaks on unquoted colon
   ```
   - Fix: `description: "Validates: files and configs"`

4. **Wrong indentation**:
   ```yaml
   ---
   description: Command description
     extra-field: value  # Incorrect indentation
   ---
   ```
   - Fix: Align all fields at same level

**Validation Command**:
```bash
# Extract and validate YAML frontmatter
cd /workspace
sed -n '/^---$/,/^---$/p' <plugin-name>/commands/<command-name>.md | sed '1d;$d' > /tmp/test.yaml
python3 -c "import yaml; yaml.safe_load(open('/tmp/test.yaml'))" && echo "✓ Valid YAML" || echo "✗ Invalid YAML"
```

### Command Behavior Incorrect

**Symptom**: Command loads but Claude doesn't follow the instructions correctly

**Possible Issues**:

1. **Ambiguous Instructions**:
   - Problem: "Check the files" (which files? where?)
   - Fix: "Check TypeScript files in /workspace/packages/ for type errors"

2. **Missing Context**:
   - Problem: Command assumes Claude knows project structure
   - Fix: Explicitly state "This is a monorepo with packages in /workspace/packages/"

3. **Conflicting Instructions**:
   - Problem: "Analyze all files" then "Focus only on changed files"
   - Fix: Be consistent or clearly separate into conditional steps

4. **No Success Criteria**:
   - Problem: Command doesn't specify what output is expected
   - Fix: Add "Expected Output Format" section with examples

### Path Resolution Problems

**Symptom**: Command can't find files or runs commands in wrong directory

**Diagnosis**:
```bash
# Check current working directory
pwd

# Verify file exists at expected location
ls -la /workspace/path/to/file.txt
```

**Solutions**:
- Always use absolute paths: `/workspace/packages/api/src/file.ts`
- Explicitly `cd /workspace` in bash blocks
- Avoid relative paths unless very clear context

## Command Testing Workflow

### Before Committing a New Command

1. **Syntax Validation**
   ```bash
   # Check YAML frontmatter
   cd /workspace
   sed -n '/^---$/,/^---$/p' <plugin>/commands/<cmd>.md | sed '1d;$d' > /tmp/test.yaml
   python3 -c "import yaml; yaml.safe_load(open('/tmp/test.yaml'))" || echo "Invalid YAML"
   ```

2. **Path Verification**
   - All referenced paths exist or creation is intentional
   - Paths use absolute format (`/workspace/...`)

3. **Marketplace Registration**
   ```bash
   # Verify command listed in marketplace.json
   jq '.plugins[] | select(.name == "<plugin>") | .components.commands' /workspace/.claude-plugin/marketplace.json
   ```

4. **Installation Test**
   ```
   /plugin uninstall <plugin>
   /plugin install <plugin>@<marketplace>
   /plugin list
   ```

5. **Invocation Test**
   ```
   /<command-name>
   ```
   - Does command execute?
   - Does Claude follow instructions correctly?
   - Are outputs in expected format?

6. **Edge Case Testing**
   - Test with no files
   - Test with error conditions
   - Test with unusual inputs

### Iterative Improvement

Commands rarely work perfectly on first try. Iterate:

1. **Test** → Identify issues
2. **Edit** → Fix command markdown
3. **Save** → Update file
4. **Reload** → Reinstall plugin if needed
5. **Retest** → Verify fix

Common iterations:
- Add missing context about project structure
- Clarify ambiguous steps
- Add error handling instructions
- Improve output format specification
- Add examples for clarity

## Skill Execution Guidelines

When this skill is active:

### For Creating New Commands

1. **Understand Requirements**
   - Ask clarifying questions about command purpose
   - Identify target files/directories
   - Understand expected behavior and outputs

2. **Choose Appropriate Filename**
   - Use lowercase with hyphens
   - Verb-based or noun-subject naming
   - Ensure name doesn't conflict with existing commands

3. **Write Command File**
   - Start with clear YAML frontmatter
   - Provide comprehensive instructions in body
   - Use absolute paths for file references
   - Include examples and expected outputs

4. **Update Marketplace**
   - Add command to plugin's components.commands array
   - Use filename without .md extension

5. **Validate**
   - Check YAML syntax
   - Verify file paths
   - Test installation and invocation

### For Editing Existing Commands

1. **Read Current Implementation**
   ```bash
   Read /workspace/<plugin>/commands/<command-name>.md
   ```

2. **Understand Requested Changes**
   - What's not working?
   - What needs to be added/modified?
   - Are there new requirements?

3. **Make Targeted Edits**
   - Use Edit tool for specific changes
   - Maintain existing structure unless overhaul needed
   - Preserve working functionality

4. **Test Changes**
   - Validate YAML if frontmatter changed
   - Reinstall plugin if needed
   - Invoke command to verify behavior

### For Troubleshooting Commands

1. **Gather Information**
   - What is the exact error or unexpected behavior?
   - What command was invoked?
   - What was expected vs. actual result?

2. **Inspect Command File**
   ```bash
   Read /workspace/<plugin>/commands/<command-name>.md
   ```

3. **Check Common Issues**
   - YAML syntax errors
   - Missing marketplace.json entry
   - Path resolution problems
   - Ambiguous instructions

4. **Verify Installation**
   ```bash
   jq '.plugins[] | select(.name == "<plugin>") | .components.commands' /workspace/.claude-plugin/marketplace.json
   ```

5. **Provide Solution**
   - Fix identified issues
   - Explain what was wrong
   - Verify fix works

## Best Practices Summary

### Do's
- ✅ Use descriptive, action-oriented command names
- ✅ Write clear, comprehensive descriptions in frontmatter
- ✅ Provide step-by-step instructions in command body
- ✅ Use absolute paths starting with `/workspace/`
- ✅ Include examples of expected output
- ✅ Specify context (monorepo, package manager, etc.)
- ✅ Add error handling guidance
- ✅ Test commands before committing
- ✅ Keep commands focused on single task

### Don'ts
- ❌ Don't use uppercase or underscores in filenames
- ❌ Don't forget closing `---` in YAML frontmatter
- ❌ Don't use tabs for indentation in YAML
- ❌ Don't make assumptions about project structure
- ❌ Don't write vague instructions like "check the files"
- ❌ Don't expect commands to receive arguments as parameters
- ❌ Don't create command subdirectories (use flat structure)
- ❌ Don't forget to update marketplace.json components array

## Reference Documentation

For complete technical specifications, see:
- `/workspace/documentation/claude-code-plugins.md` - Full plugin system documentation
- [Official Claude Code Plugin Documentation](https://docs.claude.com/en/docs/claude-code/plugins.md)
- [Plugins Reference](https://docs.claude.com/en/docs/claude-code/plugins-reference.md)

## Quick Reference: Command Creation Checklist

```
☐ Choose appropriate command name (lowercase, hyphens only)
☐ Create file: /workspace/<plugin>/commands/<name>.md
☐ Add YAML frontmatter with description field
☐ Write comprehensive command body with:
  ☐ Clear objective
  ☐ Step-by-step process
  ☐ Context and constraints
  ☐ Expected output format
  ☐ Examples
☐ Use absolute paths (/workspace/...)
☐ Update marketplace.json components.commands array (name without .md)
☐ Validate YAML syntax
☐ Test command installation
☐ Test command invocation
☐ Verify behavior matches requirements
☐ Commit changes
```

## Official Documentation

For the latest information and updates, refer to the official Claude Code documentation:

- **Slash Commands Documentation**: https://docs.claude.com/en/docs/claude-code/slash-commands
- **Plugins Documentation**: https://docs.claude.com/en/docs/claude-code/plugins
- **CLI Reference**: https://docs.claude.com/en/docs/claude-code/cli-reference

## See Also

**Related Skills** (in this plugin):
- **Plugin Management**: Creating plugins that contain slash commands
- **Sub-Agent Management**: Programmatic delegation (different from user invocation)
- **Skill Management**: Autonomous activation (different from explicit user trigger)
- **Plugin Marketplace Management**: Registering commands in marketplace.json

**Key Concepts**:
- **Command Scopes**: Project (`.claude/commands/`), User (`~/.claude/commands/`), Plugin (`<plugin>/commands/`)
- **Programmatic Invocation**: SlashCommand tool (October 2025+)
- **Extended Frontmatter**: `allowed-tools`, `model`, `argument-hint` fields
- **No Arguments**: Commands don't receive parameters directly

**Related Topics**:
- MCP-provided commands (exposed by MCP servers as slash commands)
- Command naming collision resolution
- Working directory context (`/workspace`)
- YAML frontmatter conventions

---

*Last Updated: October 2025*
