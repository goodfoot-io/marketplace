---
name: Skill Management
description: Create, edit, and configure autonomous Claude Code skills
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

## What Are Skills?

**Skills** are autonomous capabilities that Claude invokes based on contextual matching. They differ from other component types:

| Component | Invocation | Tool Access | Use Case |
|-----------|------------|-------------|----------|
| **Skill** | Autonomous (Claude decides) | Optional restrictions | Background capabilities Claude activates when relevant |
| **Slash Command** | User types `/command` | No restrictions | User-initiated instructions |
| **Sub-Agent** | Main agent uses Task tool | Optional restrictions | Explicit delegation to specialized agent |

**Key Distinction**: Skills are **autonomously invoked** - Claude reads skill descriptions and decides when they're relevant to the current conversation context.

## Progressive Disclosure Architecture

**Critical Concept (October 2025)**: Claude Code uses a progressive disclosure pattern for skill loading to optimize performance.

### How Skill Loading Works

**Phase 1 - Initial Load (at plugin installation)**:
- Claude Code scans all `skills/*/SKILL.md` files
- Reads ONLY the **YAML frontmatter** (name and description)
- The full markdown body is NOT loaded into memory
- Skill metadata is indexed for fast lookup

**Phase 2 - Skill Activation (when relevant)**:
- Claude receives user request
- Matches request against skill descriptions (lightweight comparison)
- When a skill is determined relevant, **only then** loads the full SKILL.md content
- The skill's markdown body is injected as additional instructions

**Phase 3 - Execution**:
- Claude follows both base instructions AND skill instructions
- Skill-specific tools restrictions (if any) are enforced
- Working directory may change to skill directory

### Why This Matters

**Performance**: Loading all skill content upfront would consume excessive context window. Progressive disclosure means:
- Fast plugin installation (only frontmatter parsed)
- Minimal memory footprint (descriptions only)
- Efficient context usage (full content loaded only when needed)

**Implication for Skill Authors**:

> **⚠️ CRITICAL**: Your skill **description** is the ONLY information Claude initially sees. Make it:
> - **Specific**: Include exact trigger keywords and error patterns
> - **Comprehensive**: Mention all scenarios where the skill applies
> - **Front-loaded**: Most important keywords should appear first
> - **Searchable**: Think like a search query - what would trigger this skill?

**Bad Description** (too vague, won't trigger):
```yaml
description: Helps with code
```

**Good Description** (specific, triggers on relevant keywords):
```yaml
description: Fixes TypeScript import errors including "Cannot find module", "Module not found", and path resolution issues in /workspace
```

The good description includes specific error messages that appear in TypeScript output, making it likely to activate when those errors occur.

## Autonomous Invocation Mechanism

### How Claude Decides to Activate Skills

1. **Skills are loaded** when plugins are installed
2. **Each skill has a `description` field** with trigger keywords and capability statements
3. **Claude reads these descriptions** and matches them against:
   - User's current request
   - Conversation context and topic
   - Keywords and capability statements
4. **When Claude determines a skill is relevant**, it loads the SKILL.md instructions
5. **The skill's markdown body** becomes additional instructions for Claude to follow

### Example Activation Pattern

If a skill has:
```yaml
description: Fixes TypeScript import errors in /workspace when module not found errors occur
```

Claude activates it when:
- User mentions "import error" or "cannot find module"
- TypeScript compiler output shows import-related errors
- Working with TypeScript files and encountering import issues

## Directory Structure Requirements

**⚠️ CRITICAL**: Skills MUST be in a subdirectory with exact naming.

### Required Structure

```
/workspace/<plugin-name>/skills/
└── skill-directory-name/        # Subdirectory (lowercase, hyphens)
    ├── SKILL.md                 # Required: Skill definition (EXACT NAME)
    ├── reference.md             # Optional: Additional documentation
    ├── scripts/                 # Optional: Helper scripts
    │   ├── helper.py
    │   └── validator.sh
    └── templates/               # Optional: File templates
        ├── component.tsx
        └── config.json
```

### Critical Naming Rules

1. **Skill must be in subdirectory**: Not `skills/skill-name.md`, but `skills/skill-name/SKILL.md`
2. **Exact filename**: `SKILL.md` (all uppercase, `.md` extension)
3. **Directory name**: Lowercase with hyphens (e.g., `fix-imports`, `generate-docs`)
4. **Directory name becomes identifier**: Used in marketplace.json components array

**Examples**:
- ✅ `/workspace/my-plugin/skills/fix-imports/SKILL.md` → identifier is `fix-imports`
- ✅ `/workspace/typescript-tools/skills/add-jsdoc/SKILL.md` → identifier is `add-jsdoc`
- ❌ `/workspace/my-plugin/skills/skill-name.md` → Invalid (not in subdirectory)
- ❌ `/workspace/my-plugin/skills/skill-name/skill.md` → Invalid (wrong case)

## SKILL.md Format

### Complete SKILL.md Structure

```markdown
---
name: Skill Display Name
description: What this skill does and trigger keywords for autonomous invocation
allowed-tools: Read, Write, Edit, Bash
---

# Skill Instructions

Detailed instructions for Claude when this skill is active.

## When to Use This Skill

[Specific conditions that indicate this skill should activate]

## Process

1. Step one with specific actions
2. Step two with tool usage
3. Deliver results

## Supporting Files

- scripts/helper.py: [What it does and how to use it]
- templates/template.txt: [What it contains and when to use it]

## Path Resolution

Relative paths resolve from `/workspace/<plugin-name>/skills/<skill-name>/`

## Examples

[Concrete examples of using this skill with actual commands]
```

### YAML Frontmatter Fields

| Field | Required | Format | Purpose |
|-------|----------|--------|---------|
| `name` | Yes | Display name (spaces/capitals allowed) | How skill appears in listings |
| `description` | Yes | Natural language with trigger keywords | **CRITICAL**: Determines autonomous invocation |
| `allowed-tools` | No | Comma-separated string | Restricts tools during skill execution |

**IMPORTANT**: Field name is `allowed-tools` (hyphenated) for skills, NOT `tools`.

#### Field Name Distinction

```yaml
# In SKILLS (SKILL.md):
allowed-tools: Read, Write, Edit    # Hyphenated

# In AGENTS (agent-name.md):
tools: Read, Write, Edit            # No hyphen
```

**Why different?** Claude Code loads agents and skills through different mechanisms:
- **Agents** use `tools` - loaded via Task tool invocation
- **Skills** use `allowed-tools` - loaded for autonomous activation

**Consequence of wrong field name**: Using `tools` in a skill or `allowed-tools` in an agent causes the field to be ignored, granting ALL tools by default (including MCP tools).

#### Tools Field Format

**Correct format** (comma-separated string):
```yaml
allowed-tools: Read, Write, Edit, Bash, Grep
```

**NOT** YAML array syntax:
```yaml
# DON'T use this:
allowed-tools: [Read, Write, Edit]
```

**Common tool combinations**:
- Read-only analysis: `Read, Glob, Grep`
- File operations: `Read, Write, Edit, Glob`
- Development work: `Read, Write, Edit, Bash, Glob, Grep`
- No restriction: Omit `allowed-tools` field entirely

**Tool name capitalization**: Use exact capitalization - `Read`, `Write`, `Bash`, `Glob`, `Grep`, `Edit`, `Task`, `WebSearch`, `WebFetch`

**Omitting the field**: If you omit `allowed-tools`, the skill gets ALL tools including MCP-provided tools (Model Context Protocol external integrations).

## Writing Effective Descriptions for Autonomous Invocation

The `description` field is **the most critical part** of a skill. It determines when Claude decides to activate the skill.

### Description Writing Strategy

1. **State capability clearly**: "Generates comprehensive JSDoc documentation for TypeScript files"
2. **Include trigger keywords**: Words that signal relevance
   - For JSDoc skill: "JSDoc", "TypeScript", "documentation", "comments"
   - For import fixing: "import", "module", "cannot find module", "TypeScript"
   - For React components: "React", "component", "JSX", "hooks"
3. **Specify context**: "When working with TypeScript projects in /workspace/packages/"
4. **Be specific over generic**: "Analyzes React hooks for missing dependencies" beats "Helps with React"
5. **Include error patterns**: "when module not found errors occur", "when type errors are detected"

### Effective Description Examples

✅ **Excellent descriptions**:
```yaml
description: Writes comprehensive JSDoc documentation for TypeScript functions and classes in /workspace with parameter types, return values, and examples
```
- Clear capability: "Writes comprehensive JSDoc documentation"
- Trigger keywords: "JSDoc", "documentation", "TypeScript", "functions", "classes"
- Context: "in /workspace"
- Specific actions: "parameter types, return values, and examples"

```yaml
description: Fixes TypeScript import errors in /workspace when module not found errors or incorrect import paths are detected by the TypeScript compiler
```
- Clear capability: "Fixes TypeScript import errors"
- Trigger keywords: "TypeScript", "import errors", "module not found", "import paths"
- Context: "in /workspace"
- Error pattern: "module not found errors or incorrect import paths"

```yaml
description: Generates React functional components with TypeScript types following Material-UI patterns when user requests new UI components in /workspace
```
- Clear capability: "Generates React functional components"
- Trigger keywords: "React", "components", "TypeScript", "Material-UI", "UI components"
- Context: "in /workspace"
- Pattern: "Material-UI patterns"

✅ **Good descriptions**:
```yaml
description: Debugs Node.js memory leaks using heap snapshots and Chrome DevTools when memory issues are reported
```
- Capability: "Debugs Node.js memory leaks"
- Keywords: "memory leaks", "heap snapshots", "Node.js"
- Trigger: "when memory issues are reported"

```yaml
description: Refactors code duplications into reusable functions when duplicate code patterns are identified across multiple files
```
- Capability: "Refactors code duplications"
- Keywords: "refactor", "duplications", "reusable functions"
- Trigger: "when duplicate code patterns are identified"

❌ **Ineffective descriptions**:
```yaml
description: Helps with documentation
```
- Too vague: What kind of documentation?
- No trigger keywords
- No context about when to activate

```yaml
description: A useful development tool
```
- No capability statement
- No trigger keywords
- Generic noun phrase instead of action

```yaml
description: Code quality
```
- Just a topic, not a capability
- No action verb
- No context or triggers

### Trigger Keyword Strategy

Include keywords that match common user requests and error patterns:

**For Documentation Skills**:
- "documentation", "docs", "comments", "JSDoc", "TSDoc"
- "document this", "add comments", "explain this code"

**For Bug Fixing Skills**:
- "error", "bug", "fix", "debug", "broken", "not working"
- Specific error messages: "cannot find module", "undefined", "null reference"

**For Code Generation Skills**:
- "generate", "create", "scaffold", "template", "boilerplate"
- Type names: "component", "function", "class", "interface"

**For Analysis Skills**:
- "analyze", "review", "check", "inspect", "audit"
- Quality terms: "performance", "security", "complexity"

## Supporting Files Structure

Skills can include helper scripts, templates, and reference documentation.

### Scripts Directory

```
skills/skill-name/
└── scripts/
    ├── helper.py          # Python helper script
    ├── validator.sh       # Bash validation script
    └── processor.js       # Node.js processor
```

**Usage in SKILL.md**:
```markdown
## Process

1. Read the target file
2. Run validation script:
   ```bash
   python scripts/helper.py --validate /workspace/target-file.ts
   ```
3. Apply fixes based on script output
```

### Templates Directory

```
skills/skill-name/
└── templates/
    ├── component.tsx      # React component template
    ├── test.spec.ts       # Test file template
    └── config.json        # Configuration template
```

**Usage in SKILL.md**:
```markdown
## Process

1. Copy base template:
   ```bash
   cp templates/component.tsx /workspace/packages/ui/src/components/NewComponent.tsx
   ```
2. Customize template with user requirements
3. Update imports and exports
```

### Reference Documentation

```
skills/skill-name/
├── SKILL.md           # Main skill definition
└── reference.md       # Extended documentation
```

Use `reference.md` for:
- Detailed examples
- Extended patterns and anti-patterns
- Technical specifications
- API documentation

**Link from SKILL.md**:
```markdown
For detailed pattern examples, see reference.md in this skill directory.
```

## Path Resolution Within Skills

### Working Directory Context

When a skill is active, the working directory is:
```
/workspace/<plugin-name>/skills/<skill-name>/
```

### Path Resolution Rules

**Absolute paths** (starting with `/`): Resolve from filesystem root
```bash
# Always refers to project root
/workspace/packages/api/src/file.ts
```

**Relative paths** (no leading `/`): Resolve from current working directory (skill directory)
```bash
# Resolves from skill directory
scripts/helper.py
# Full path: /workspace/<plugin-name>/skills/<skill-name>/scripts/helper.py

templates/component.tsx
# Full path: /workspace/<plugin-name>/skills/<skill-name>/templates/component.tsx
```

### Path Usage Best Practices

**In SKILL.md markdown body** (when referencing skill's own files):
```markdown
Use the helper script:
```bash
python scripts/helper.py --input data.json
```

Apply the template:
```bash
cp templates/base.tsx /workspace/packages/ui/src/NewComponent.tsx
```
```

**When referencing project files** (always use absolute paths):
```markdown
Read the configuration at `/workspace/tsconfig.json`
Update files in `/workspace/packages/api/src/`
```

## Tool Restriction Patterns

Restrict tools to limit what Claude can do during skill execution.

### Common Restriction Patterns

**Read-only analysis**:
```yaml
allowed-tools: Read, Glob, Grep
```
Use when skill should only analyze without modification.

**Safe modifications**:
```yaml
allowed-tools: Read, Edit, Grep, Glob
```
Use when skill edits existing files but shouldn't create/delete or run commands.

**Full development**:
```yaml
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
```
Use when skill needs complete access to development tools.

**Documentation generation**:
```yaml
allowed-tools: Read, Edit, Grep
```
Use when skill adds documentation to existing files.

**No restrictions** (omit field entirely):
```yaml
name: Full Access Skill
description: Skill with complete tool access
# No allowed-tools field
```

### Tool Restriction Enforcement

Claude Code automatically enforces restrictions:
- If you attempt to use a non-allowed tool, the call **fails with an error**
- You receive: "Tool [ToolName] not allowed in this context"
- You **cannot bypass** restrictions

**Example failure**:
```yaml
allowed-tools: Read, Grep
```
```
Attempted: Write(file_path="/workspace/file.txt", content="...")
Result: Error - "Tool Write not allowed for skill 'read-only-skill'"
```

## Skill Activation Conditions

### When Skills Activate Successfully

Skills activate when:
1. **Description matches context**: Keywords align with user request or conversation topic
2. **Claude determines relevance**: Based on description analysis
3. **Context is appropriate**: Working in relevant files/directories mentioned in description

### Troubleshooting Skill Activation Issues

#### Problem: Skill Never Activates

**Symptom**: Skill exists but Claude never uses it

**Diagnostic steps**:

1. **Check description specificity**:
   ```bash
   grep "description:" /workspace/<plugin-name>/skills/<skill-name>/SKILL.md
   ```
   - Is it vague like "Helps with code"?
   - Does it include trigger keywords?
   - Does it state a clear capability?

2. **Verify directory structure**:
   ```bash
   ls -la /workspace/<plugin-name>/skills/<skill-name>/
   # Should show SKILL.md (all caps)
   ```
   - Must be in subdirectory: `skills/skill-name/SKILL.md`
   - Not a file: `skills/skill-name.md`

3. **Check marketplace.json registration**:
   ```bash
   jq '.plugins[] | select(.name == "<plugin-name>") | .components.skills' /workspace/.claude-plugin/marketplace.json
   ```
   - Should include skill directory name (not "SKILL.md")
   - Example: `["fix-imports"]` not `["SKILL.md"]`

4. **Verify YAML frontmatter**:
   ```bash
   head -n 10 /workspace/<plugin-name>/skills/<skill-name>/SKILL.md
   ```
   - Check for opening `---` and closing `---`
   - Verify `description:` field exists
   - Ensure no tabs (only spaces)

**Common fixes**:

1. **Improve description** - Add specific trigger keywords:
   ```yaml
   # Before (too vague):
   description: Helps with imports

   # After (specific):
   description: Fixes TypeScript import errors in /workspace when module not found errors occur
   ```

2. **Fix directory structure**:
   ```bash
   # If skill is a file instead of directory:
   mkdir -p /workspace/<plugin-name>/skills/<skill-name>
   mv /workspace/<plugin-name>/skills/<skill-name>.md \
      /workspace/<plugin-name>/skills/<skill-name>/SKILL.md
   ```

3. **Update marketplace.json**:
   ```bash
   # Add skill to components
   jq '(.plugins[] | select(.name == "<plugin-name>") | .components.skills) += ["<skill-directory-name>"]' \
     /workspace/.claude-plugin/marketplace.json > /tmp/marketplace.json
   mv /tmp/marketplace.json /workspace/.claude-plugin/marketplace.json
   ```

## Example Skill Workflows

### Example 1: Code Fixing Skill

**Purpose**: Fix TypeScript import errors automatically

**File**: `/workspace/typescript-tools/skills/fix-imports/SKILL.md`

```markdown
---
name: Fix TypeScript Imports
description: Automatically fixes incorrect TypeScript imports in /workspace when import errors or module not found errors are detected by the TypeScript compiler
allowed-tools: Read, Edit, Bash, Grep
---

# Fix TypeScript Imports Skill

Automatically fix TypeScript import errors in /workspace.

## When to Use This Skill

Activate when:
- User mentions "import error", "cannot find module", "module not found"
- TypeScript compiler shows import-related errors
- User requests "fix imports" or "resolve import paths"
- Working with TypeScript files and encountering import issues

## Process

1. **Identify the error**:
   - Read error message for file path and module name
   - Example: "Cannot find module './utils' at /workspace/packages/api/src/handler.ts:5"

2. **Locate the file**:
   ```bash
   # Read the file with the import error
   Read(file_path="/workspace/packages/api/src/handler.ts")
   ```

3. **Find correct import path**:
   ```bash
   # Search for the module across the workspace
   Grep(pattern="export.*Utils", path="/workspace", glob="**/*.ts", output_mode="files_with_matches")
   ```

4. **Fix the import**:
   ```
   Edit(
     file_path="/workspace/packages/api/src/handler.ts",
     old_string="import { Utils } from './utils'",
     new_string="import { Utils } from '../shared/utils'"
   )
   ```

5. **Verify the fix**:
   ```bash
   Bash(
     command="cd /workspace && yarn typecheck packages/api/src/handler.ts",
     description="Verify import fix"
   )
   ```

## Common Import Patterns

- Relative imports: `./file`, `../dir/file`
- Package imports: `@workspace/package-name`
- Node modules: `express`, `typescript`

## Examples

### Example 1: Fix relative path import
```
Error: Cannot find module './utils'
File: /workspace/packages/api/src/handler.ts

Fix: Search for utils export, update path to '../shared/utils'
```

### Example 2: Fix package import
```
Error: Cannot find module '@workspace/types'
File: /workspace/packages/ui/src/component.tsx

Fix: Check package.json, update to '@workspace/shared-types'
```
```

### Example 2: Code Generation Skill with Templates

**Purpose**: Generate React components with TypeScript

**Directory**: `/workspace/react-tools/skills/generate-component/`

**File structure**:
```
/workspace/react-tools/skills/generate-component/
├── SKILL.md
├── templates/
│   ├── functional-component.tsx
│   ├── class-component.tsx
│   └── component.test.tsx
└── scripts/
    └── validate-component-name.py
```

**File**: `SKILL.md`
```markdown
---
name: Generate React Component
description: Generates React functional or class components with TypeScript types and Material-UI patterns when user requests new UI components in /workspace
allowed-tools: Read, Write, Bash
---

# Generate React Component Skill

Generate TypeScript React components with proper structure and types.

## When to Use This Skill

Activate when:
- User says "create component", "new component", "generate component"
- User mentions "React component", "UI component"
- Context is React/TypeScript project in /workspace
- User specifies component name and type

## Process

1. **Validate component name**:
   ```bash
   python scripts/validate-component-name.py "<ComponentName>"
   ```

2. **Determine component type**:
   - Functional component (default)
   - Class component (if user specifies)

3. **Copy appropriate template**:
   ```bash
   # For functional component
   cp templates/functional-component.tsx /workspace/packages/ui/src/components/<ComponentName>.tsx
   ```

4. **Customize template**:
   - Replace placeholder name with actual component name
   - Add props interface if specified
   - Include imports for Material-UI if mentioned

5. **Generate test file**:
   ```bash
   cp templates/component.test.tsx /workspace/packages/ui/src/components/<ComponentName>.test.tsx
   ```

6. **Update exports**:
   - Add component to `/workspace/packages/ui/src/components/index.ts`

## Supporting Files

### templates/functional-component.tsx
Base template for functional components with TypeScript:
- Props interface
- Component declaration
- Export statement
- Basic Material-UI structure

### templates/class-component.tsx
Base template for class components (legacy):
- Props and state interfaces
- Component class with lifecycle methods
- Export statement

### templates/component.test.tsx
Base test file using React Testing Library:
- Import statements
- Basic render test
- Placeholder for additional tests

### scripts/validate-component-name.py
Validates component name follows conventions:
- PascalCase required
- No special characters
- Not a reserved word

## Examples

### Example 1: Simple functional component
```
User: "Create a UserProfile component"

Actions:
1. Validate "UserProfile" is valid PascalCase
2. Copy templates/functional-component.tsx
3. Replace "ComponentName" with "UserProfile"
4. Write to /workspace/packages/ui/src/components/UserProfile.tsx
5. Generate test file
```

### Example 2: Component with props
```
User: "Create a Button component with onClick and label props"

Actions:
1. Copy functional-component.tsx template
2. Add props interface:
   interface ButtonProps {
     onClick: () => void;
     label: string;
   }
3. Update component to use props
4. Write to /workspace/packages/ui/src/components/Button.tsx
```
```

### Example 3: Analysis Skill

**Purpose**: Analyze code complexity and suggest refactoring

**File**: `/workspace/code-quality/skills/analyze-complexity/SKILL.md`

```markdown
---
name: Code Complexity Analysis
description: Analyzes code complexity in TypeScript and JavaScript files when user requests code review, refactoring suggestions, or performance analysis in /workspace
allowed-tools: Read, Grep, Bash
---

# Code Complexity Analysis Skill

Analyze code for complexity issues and suggest refactoring.

## When to Use This Skill

Activate when:
- User requests "code review", "analyze code", "check complexity"
- User mentions "refactor", "simplify", "improve code quality"
- Context is improving existing code in /workspace
- User asks about "technical debt" or "code smell"

## Process

1. **Identify target files**:
   - User specified files
   - Or search for large/complex files

2. **Analyze complexity metrics**:
   ```bash
   # Count lines of code
   Bash(command="wc -l /workspace/target-file.ts")

   # Count functions
   Grep(pattern="^\\s*(function|const.*=.*=>|class)", path="/workspace/target-file.ts")
   ```

3. **Check for common complexity indicators**:
   - Long functions (>50 lines)
   - Deep nesting (>4 levels)
   - Many parameters (>5)
   - Duplicate code patterns
   - Large files (>500 lines)

4. **Read and analyze code structure**:
   ```
   Read(file_path="/workspace/target-file.ts")
   ```

5. **Report findings**:
   - Complexity score
   - Specific issues with line numbers
   - Refactoring suggestions
   - Priority ranking

## Complexity Metrics

### Function Length
- ✅ Good: <30 lines
- ⚠️ Warning: 30-50 lines
- ❌ High complexity: >50 lines

### Nesting Depth
- ✅ Good: <3 levels
- ⚠️ Warning: 3-4 levels
- ❌ High complexity: >4 levels

### Parameters
- ✅ Good: <4 parameters
- ⚠️ Warning: 4-5 parameters
- ❌ High complexity: >5 parameters

## Refactoring Suggestions

Based on complexity type:

1. **Long functions**: Extract smaller functions
2. **Deep nesting**: Use early returns, extract conditionals
3. **Many parameters**: Use parameter objects
4. **Duplicate code**: Extract shared functions
5. **Large files**: Split into modules

## Examples

### Example 1: Long function refactoring
```typescript
// Before (complex):
function processUser(id: string) {
  // 80 lines of code
}

// Suggested refactoring:
function processUser(id: string) {
  const user = fetchUser(id);
  validateUser(user);
  transformUser(user);
  saveUser(user);
}
```

### Example 2: Deep nesting
```typescript
// Before (complex):
if (user) {
  if (user.active) {
    if (user.verified) {
      if (user.role === 'admin') {
        // action
      }
    }
  }
}

// Suggested refactoring:
if (!user || !user.active || !user.verified || user.role !== 'admin') {
  return;
}
// action
```
```

## Creating a New Skill Step-by-Step

### Step 1: Plan the Skill

Determine:
1. **Purpose**: What specific capability does this skill provide?
2. **Trigger keywords**: What words signal this skill is needed?
3. **Tool requirements**: What tools does it need?
4. **Supporting files**: Does it need scripts or templates?

### Step 2: Create Directory Structure

```bash
cd /workspace/<plugin-name>/skills
mkdir -p <skill-name>
cd <skill-name>
```

### Step 3: Create SKILL.md

```bash
cat > SKILL.md << 'EOF'
---
name: Skill Display Name
description: Clear capability statement with trigger keywords
allowed-tools: Read, Write, Edit
---

# Skill Name

Brief overview of what this skill does.

## When to Use This Skill

List specific conditions that indicate activation.

## Process

1. Step one
2. Step two
3. Step three

## Examples

Concrete examples of skill usage.
EOF
```

### Step 4: Add Supporting Files (if needed)

```bash
# Create scripts directory
mkdir scripts
cat > scripts/helper.py << 'EOF'
#!/usr/bin/env python3
import sys

# Helper script implementation
EOF
chmod +x scripts/helper.py

# Create templates directory
mkdir templates
cat > templates/template.txt << 'EOF'
# Template content
EOF
```

### Step 5: Update marketplace.json

```bash
cd /workspace
jq '(.plugins[] | select(.name == "<plugin-name>") | .components.skills) += ["<skill-directory-name>"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
```

### Step 6: Validate

```bash
# Check SKILL.md exists
ls -la /workspace/<plugin-name>/skills/<skill-name>/SKILL.md

# Validate YAML frontmatter
head -n 10 /workspace/<plugin-name>/skills/<skill-name>/SKILL.md

# Check marketplace.json
jq '.plugins[] | select(.name == "<plugin-name>") | .components.skills' \
  /workspace/.claude-plugin/marketplace.json
```

### Step 7: Test Activation

1. Install plugin: `/plugin install <plugin-name>@<marketplace>`
2. Trigger skill by using keywords from description
3. Verify skill activates and instructions are followed
4. Test tool restrictions (try non-allowed tools)
5. Test supporting files (scripts/templates)

## Complete Skill Creation Example

Let's create a skill that formats TypeScript files with Prettier.

### Planning

- **Purpose**: Auto-format TypeScript files using Prettier
- **Triggers**: "format", "prettier", "code style", "formatting"
- **Tools needed**: Read, Bash (to run prettier)
- **Supporting files**: None needed (uses project's prettier)

### Implementation

```bash
# Step 1: Create directory
cd /workspace/typescript-tools/skills
mkdir -p auto-format
cd auto-format

# Step 2: Create SKILL.md
cat > SKILL.md << 'EOF'
---
name: Auto-Format TypeScript
description: Automatically formats TypeScript and JavaScript files in /workspace using Prettier when user requests code formatting or mentions prettier
allowed-tools: Read, Bash
---

# Auto-Format TypeScript Skill

Format TypeScript/JavaScript files using Prettier.

## When to Use This Skill

Activate when:
- User says "format code", "format file", "run prettier"
- User mentions "code style", "formatting", "prettier"
- Context is TypeScript/JavaScript files in /workspace
- User wants consistent code formatting

## Process

1. **Identify target files**:
   - User specified files
   - Or current file being worked on

2. **Check Prettier is available**:
   ```bash
   Bash(
     command="cd /workspace && yarn prettier --version",
     description="Check Prettier availability"
   )
   ```

3. **Format the file(s)**:
   ```bash
   Bash(
     command="cd /workspace && yarn prettier --write /workspace/path/to/file.ts",
     description="Format TypeScript file with Prettier"
   )
   ```

4. **Verify formatting**:
   ```bash
   Read(file_path="/workspace/path/to/file.ts")
   ```

5. **Report completion**:
   - Number of files formatted
   - Any errors encountered

## Examples

### Example 1: Format single file
```
User: "Format the UserService.ts file"

Actions:
1. Run: yarn prettier --write /workspace/packages/api/src/services/UserService.ts
2. Read formatted file to confirm
3. Report: "Formatted UserService.ts successfully"
```

### Example 2: Format multiple files
```
User: "Format all files in the api package"

Actions:
1. Run: yarn prettier --write "/workspace/packages/api/src/**/*.ts"
2. Report: "Formatted 15 files in api package"
```

### Example 3: Check formatting without changes
```
User: "Check if files are formatted correctly"

Actions:
1. Run: yarn prettier --check /workspace/packages/api/src/**/*.ts
2. Report files that would change
3. Ask user if they want to apply formatting
```
EOF

# Step 3: Update marketplace.json
cd /workspace
jq '(.plugins[] | select(.name == "typescript-tools") | .components.skills) += ["auto-format"]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json

# Step 4: Validate
echo "Validating skill structure..."
ls -la /workspace/typescript-tools/skills/auto-format/SKILL.md
head -n 15 /workspace/typescript-tools/skills/auto-format/SKILL.md
jq '.plugins[] | select(.name == "typescript-tools") | .components.skills' \
  /workspace/.claude-plugin/marketplace.json
```

## Best Practices for Skills

### Description Best Practices

1. **Front-load important keywords**: Put trigger words early in description
2. **Include error patterns**: Mention specific errors that trigger skill
3. **Be action-oriented**: Use verbs ("Fixes", "Generates", "Analyzes")
4. **Include context**: Mention /workspace or specific directories
5. **Avoid jargon**: Use clear, searchable terms

### Tool Restriction Best Practices

1. **Grant minimum necessary**: Only include tools actually needed
2. **Separate read/write**: Use Read-only when possible for safety
3. **Document restrictions**: Explain in SKILL.md why tools are limited
4. **Test restrictions**: Verify skill works with limited tools

### Supporting Files Best Practices

1. **Keep scripts focused**: One script = one purpose
2. **Make scripts executable**: `chmod +x scripts/*.py`
3. **Add shebangs**: `#!/usr/bin/env python3` at top of scripts
4. **Document parameters**: Comment script usage in SKILL.md
5. **Use templates for consistency**: Don't generate from scratch

### Testing Best Practices

1. **Test activation**: Use exact trigger keywords from description
2. **Test tool restrictions**: Try using non-allowed tools
3. **Test paths**: Verify relative paths resolve correctly
4. **Test supporting files**: Execute scripts/templates
5. **Test with variations**: Try different phrasings of triggers

## Troubleshooting Guide

### Issue: YAML Parse Error

**Symptom**: Skill doesn't load, YAML error in logs

**Solutions**:
1. Check for tabs (use only spaces)
2. Verify opening and closing `---` delimiters
3. Quote strings with special characters: `"Contains: colon"`
4. Use comma-separated string for tools: `allowed-tools: Read, Write`
5. Check indentation is consistent (2 or 4 spaces)

### Issue: Wrong Field Name Used

**Symptom**: Skill has unrestricted tool access despite `tools:` field

**Solution**: Change `tools:` to `allowed-tools:` in SKILL.md frontmatter

```yaml
# Wrong (for skills):
tools: Read, Write

# Correct (for skills):
allowed-tools: Read, Write
```

### Issue: Supporting Files Not Found

**Symptom**: Script/template path errors when skill runs

**Solutions**:
1. Verify working directory: `/workspace/<plugin>/<skills>/<skill-name>/`
2. Use relative paths: `scripts/helper.py` not `/scripts/helper.py`
3. Check file exists: `ls -la scripts/helper.py`
4. Check executable permissions: `chmod +x scripts/helper.py`

### Issue: Skill Description Too Generic

**Symptom**: Skill activates too often or not often enough

**Solutions**:
1. Add specific trigger keywords related to exact use case
2. Include error patterns: "when module not found errors occur"
3. Mention specific technologies: "TypeScript", "React", not just "code"
4. Add context: "in /workspace/packages/api/"
5. Test variations: Try different user phrasings

## Additional Resources

### Referencing Main Documentation

For complete plugin system details, see:
- `/workspace/documentation/claude-code-plugins.md` (comprehensive guide)
- Claude Code official docs: https://docs.claude.com/claude-code/

### Related Components

- **Slash Commands**: User-invoked instructions at `<plugin>/commands/<name>.md`
- **Sub-Agents**: Explicitly invoked agents at `<plugin>/agents/<name>.md`
- **Hooks**: Event-triggered scripts at `<plugin>/hooks/hooks.json`

### Key Differences Summary

| Aspect | Skills | Commands | Agents |
|--------|--------|----------|--------|
| **File location** | `skills/<name>/SKILL.md` | `commands/<name>.md` | `agents/<name>.md` |
| **Invocation** | Autonomous (Claude decides) | User types `/name` | Main agent uses Task tool |
| **Tool field** | `allowed-tools` | N/A (no restrictions) | `tools` |
| **Supporting files** | Yes (scripts/, templates/) | No | No |
| **Working directory** | Skill subdirectory | /workspace | Inherits from parent |

## Summary Checklist

When creating a skill, verify:

- [ ] Skill is in subdirectory: `skills/<skill-name>/SKILL.md`
- [ ] Filename is exactly `SKILL.md` (all caps)
- [ ] YAML frontmatter has `---` delimiters
- [ ] `name` field is present with display name
- [ ] `description` includes specific trigger keywords
- [ ] `allowed-tools` uses comma-separated format (if restricting)
- [ ] Field name is `allowed-tools` NOT `tools`
- [ ] Markdown body has clear "When to Use" section
- [ ] Process steps are specific and actionable
- [ ] Supporting files referenced with relative paths
- [ ] Project files referenced with absolute paths
- [ ] Skill added to marketplace.json components.skills array
- [ ] Directory name (not SKILL.md) used in marketplace.json
- [ ] Examples show concrete usage patterns
- [ ] Tool restrictions match actual needs

You now have complete knowledge to create, edit, and manage Claude Code skills effectively!

## Official Documentation

For the latest information and updates, refer to the official Claude Code documentation:

- **Skills Documentation**: https://docs.claude.com/en/docs/claude-code/skills
- **Plugins Documentation**: https://docs.claude.com/en/docs/claude-code/plugins
- **Plugins Reference**: https://docs.claude.com/en/docs/claude-code/plugins-reference

## See Also

**Related Skills** (in this plugin):
- **Plugin Management**: Creating plugins that contain skills
- **Sub-Agent Management**: Explicit invocation via Task tool (different from autonomous)
- **Slash Command Management**: User invocation (different from autonomous)
- **Plugin Marketplace Management**: Registering skills in marketplace.json
- **MCP Server Configuration**: Skills can use MCP tools if unrestricted

**Key Architecture Concepts**:
- **Progressive Disclosure**: Only descriptions loaded initially; full content loaded on activation
- **Autonomous Invocation**: Claude decides when to activate based on description matching
- **Tool Restrictions**: Use `allowed-tools` field (hyphenated, different from agents' `tools`)
- **Working Directory**: Skills execute from their own directory (`/workspace/<plugin>/skills/<skill>/`)

**Writing Effective Skills**:
- Front-load trigger keywords in descriptions
- Include specific error messages and patterns
- Think like a search query
- Mention all applicable scenarios

**Related Topics**:
- Supporting files (scripts/, templates/)
- Reference.md for extended documentation
- Path resolution within skills

---

*Last Updated: October 2025*
