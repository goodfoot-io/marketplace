---
name: Tools
description: Symbol lookups, type information, diagnostics, refactoring, and workspace commands with the VSCode language server
---

## When to Use Each Tool

### Use `get_symbol_lsp_info` When:

✅ **You need detailed type information:**
- Understanding complex generic types
- Checking function signatures and parameters
- Viewing hover documentation
- Finding where a type is defined

✅ **You want comprehensive symbol info:**
- Get definition, hover, signature, type definition, and implementation all at once

**Example:**
<tool-use-template>
mcp__vscode__get_symbol_lsp_info({
  workspace_path: "/workspace",
  filePath: "packages/api/src/services/user.ts",
  symbol: "UserService",
  infoType: "all"  // or "definition", "hover", "signature_help", "type_definition", "implementation"
})
</tool-use-template>

### Use `get_references` When:

✅ **Finding all usages of a symbol:**
- Checking where a function is called
- Finding all imports of a class
- Impact analysis before refactoring

✅ **Understanding code dependencies:**
- See which files depend on a specific function/class
- Trace usage patterns across the codebase

**Example:**
<tool-use-template>
mcp__vscode__get_references({
  workspace_path: "/workspace",
  filePath: "packages/api/src/services/user.ts",  // File where symbol is DEFINED
  symbol: "UserService",
  includeDeclaration: true,
  usageCodeLineRange: 5  // Include ±5 lines of context
})
</tool-use-template>

### Use `get_diagnostics` When:

✅ **Checking for errors after code changes:**
- After making edits to verify no new errors
- Before committing code
- After refactoring

✅ **Understanding compilation/linting issues:**
- TypeScript type errors
- ESLint warnings
- Other language server diagnostics

**Example:**
<tool-use-template>
// Check specific files
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: ["packages/api/src/user.ts"],
  severities: ["error", "warning"],
  sources: ["ts", "eslint"]  // Optional: filter by source
})

// Check all modified files (empty array)
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: [],  // Auto-detects git modified files
  severities: ["error"]
})
</tool-use-template>

### Use `rename_symbol` When:

✅ **Renaming across the codebase:**
- Renaming functions, classes, variables, types
- Automatic import updates needed
- Scope-aware renaming required

✅ **Faster than search-and-replace:**
- Language server understands scope and shadowing
- More accurate than text-based replacement

**Example:**
<tool-use-template>
mcp__vscode__rename_symbol({
  workspace_path: "/workspace",
  filePath: "packages/api/src/services/user.ts",
  symbol: "getUserById",
  newName: "findUserById",
  codeSnippet: "async getUserById("  // Optional: disambiguate multiple symbols
})
</tool-use-template>

### Use `execute_command` When:

✅ **Formatting code:**
- After making changes
- Before committing

✅ **Auto-fixing issues:**
- Applying ESLint/TypeScript fixes
- Organizing imports

✅ **Managing workspace:**
- Saving all files
- Restarting language servers

**Example:**
<tool-use-template>
// Format document
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "editor.action.formatDocument",
  args: "[]"
})

// Auto-fix all issues
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "editor.action.fixAll",
  args: "[]"
})

// Save all files
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "workbench.action.files.saveAll",
  args: "[]"
})
</tool-use-template>

### Use `open_files` When:

✅ **Preparing for multi-file editing:**
- Opening related files before making changes
- Setting up workspace for a task

✅ **Showing context to user:**
- Opening files to display in editor

**Example:**
<tool-use-template>
mcp__vscode__open_files({
  workspace_path: "/workspace",
  files: [
    { filePath: "packages/api/src/user.ts", showEditor: true },
    { filePath: "packages/api/src/auth.ts", showEditor: false }
  ]
})
</tool-use-template>

## Tool Selection Guide

### For Symbol Analysis

**Decision tree:**

1. **Need comprehensive symbol information?**
   → Use `get_symbol_lsp_info` with `infoType: "all"`

2. **Need to find all usages?**
   → Use `get_references` with the file where symbol is DEFINED

3. **Need to rename across codebase?**
   → Use `rename_symbol`

### For Code Quality

**Decision tree:**

1. **Need to check for errors?**
   → Use `get_diagnostics`

2. **Need to fix errors automatically?**
   → Use `execute_command` with `"editor.action.fixAll"`

3. **Need to format code?**
   → Use `execute_command` with `"editor.action.formatDocument"`

## Common Workflows

### Workflow 1: Investigate a Symbol

<tool-use-template>
// 1. Get comprehensive symbol information
mcp__vscode__get_symbol_lsp_info({
  workspace_path: "/workspace",
  filePath: "packages/api/src/services/user.ts",
  symbol: "UserService",
  infoType: "all"
})

// 2. Find all references
mcp__vscode__get_references({
  workspace_path: "/workspace",
  filePath: "packages/api/src/services/user.ts",
  symbol: "UserService",
  includeDeclaration: true
})
</tool-use-template>

### Workflow 2: Refactor with Confidence

<tool-use-template>
// 1. Check current diagnostics
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: [],
  severities: ["error"]
})

// 2. Rename symbol
mcp__vscode__rename_symbol({
  workspace_path: "/workspace",
  filePath: "packages/api/src/services/user.ts",
  symbol: "getUserById",
  newName: "findUserById"
})

// 3. Check for new errors
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: [],
  severities: ["error"]
})

// 4. Auto-fix and format
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "editor.action.fixAll",
  args: "[]"
})

mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "editor.action.formatDocument",
  args: "[]"
})
</tool-use-template>

### Workflow 3: Pre-Commit Quality Check

<tool-use-template>
// 1. Get diagnostics for modified files
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: [],  // Auto-detects git modified files
  severities: ["error", "warning"]
})

// 2. Auto-fix issues
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "editor.action.fixAll",
  args: "[]"
})

// 3. Format code
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "editor.action.formatDocument",
  args: "[]"
})

// 4. Save all
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "workbench.action.files.saveAll",
  args: "[]"
})
</tool-use-template>

### Workflow 4: Understand Type Issues

<tool-use-template>
// 1. Get diagnostics for a specific file
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: ["packages/api/src/user.ts"],
  severities: ["error"],
  sources: ["ts"]
})

// 2. Get type information for problematic symbols
mcp__vscode__get_symbol_lsp_info({
  workspace_path: "/workspace",
  filePath: "packages/api/src/user.ts",
  symbol: "User",
  infoType: "type_definition"
})

// 3. Check hover documentation for more context
mcp__vscode__get_symbol_lsp_info({
  workspace_path: "/workspace",
  filePath: "packages/api/src/user.ts",
  symbol: "User",
  infoType: "hover"
})
</tool-use-template>

## Best Practices

### 1. Always Use Definition File for References

When using `get_references`, always provide the file where the symbol is **defined**, not where it's used:

<tool-use-template>
// ✅ Correct - using the file where UserService is defined
mcp__vscode__get_references({
  workspace_path: "/workspace",
  filePath: "packages/api/src/services/user.ts",  // Definition file
  symbol: "UserService"
})

// ❌ Incorrect - using a file where it's imported
mcp__vscode__get_references({
  workspace_path: "/workspace",
  filePath: "packages/api/src/controllers/user.ts",  // Import location
  symbol: "UserService"
})
</tool-use-template>

### 2. Use Empty Array for Auto-Detection

For `get_diagnostics`, use an empty array to automatically check all git-modified files:

<tool-use-template>
// ✅ Recommended - auto-detects modified files
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: [],
  severities: ["error"]
})
</tool-use-template>

### 3. Use Code Snippets for Disambiguation

When multiple symbols have the same name, use `codeSnippet` to disambiguate:

<tool-use-template>
// Multiple "Task" symbols exist (interface, class, type)
mcp__vscode__get_symbol_lsp_info({
  workspace_path: "/workspace",
  filePath: "packages/models/src/task.ts",
  symbol: "Task",
  codeSnippet: "export interface Task {",  // Disambiguates to the interface
  infoType: "all"
})
</tool-use-template>

### 4. Chain Commands for Post-Edit Cleanup

After editing, chain format + fix + save:

<tool-use-template>
// 1. Auto-fix
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "editor.action.fixAll",
  args: "[]"
})

// 2. Format
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "editor.action.formatDocument",
  args: "[]"
})

// 3. Save all
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "workbench.action.files.saveAll",
  args: "[]"
})
</tool-use-template>

### 5. Filter Diagnostics Appropriately

Use severity and source filters to focus on relevant issues:

<tool-use-template>
// Only TypeScript errors
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: [],
  severities: ["error"],
  sources: ["ts"]
})

// Only ESLint warnings
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: [],
  severities: ["warning"],
  sources: ["eslint"]
})
</tool-use-template>

## Common Pitfalls

### ❌ Don't: Use find/usage file for references

<tool-use-template>
// Wrong - this will fail or return incorrect results
mcp__vscode__get_references({
  filePath: "packages/api/src/controllers/user.ts",  // Where it's used
  symbol: "UserService"
})
</tool-use-template>

### ✅ Do: Use definition file for references

<tool-use-template>
// Correct - find definition first, then get references
mcp__vscode__get_references({
  filePath: "packages/api/src/services/user.ts",  // Where it's defined
  symbol: "UserService"
})
</tool-use-template>

### ❌ Don't: Forget args parameter must be JSON string

<tool-use-template>
// Wrong - args as array
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "vscode.open",
  args: ["file:///workspace/file.ts"]  // Wrong type
})
</tool-use-template>

### ✅ Do: Pass args as JSON string

<tool-use-template>
// Correct - args as JSON string
mcp__vscode__execute_command({
  workspace_path: "/workspace",
  command: "vscode.open",
  args: '["file:///workspace/file.ts"]'  // JSON string
})
</tool-use-template>

## Integration with Other Skills

### With codebase-analysis Skill

The VSCode MCP tools are automatically used by the `codebase-analysis` subagent when appropriate:

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Analyze UserService",
  prompt: "Find all references to UserService and show their type information"
})
// The codebase-analysis subagent will automatically use get_symbol_lsp_info and get_references
</tool-use-template>

### Direct vs. Subagent Usage

**Use VSCode tools directly when:**
- You need a specific piece of information (single tool call)
- You know exactly which tool to use
- You're implementing a specific workflow

**Use codebase-analysis subagent when:**
- You need comprehensive analysis (multiple tools)
- You want automatic tool selection
- You're investigating complex issues

## Prerequisites

Before using VSCode MCP tools:

1. **VSCode must be running** with your workspace open
2. **VSCode MCP Bridge extension** must be installed
3. **This plugin must be installed** (provides the .mcp.json configuration)

### Health Check

Verify the connection:

<tool-use-template>
mcp__vscode__health_check({
  workspace_path: "/workspace"
})
</tool-use-template>

### List Available Workspaces

Find available workspaces:

<tool-use-template>
mcp__vscode__list_workspaces()
</tool-use-template>

## Troubleshooting

### Tool returns "Connection refused"

**Cause**: VSCode MCP Bridge extension not installed or workspace not open

**Solution**:
- Install VSCode MCP Bridge extension
- Open your workspace in VSCode

### "Workspace not found" errors

**Cause**: Incorrect workspace path

**Solution**: Use `list_workspaces` to find the correct path

### Symbol not found

**Cause**: Wrong file path or symbol not defined in that file

**Solution**:
- Verify the file path is correct
- Ensure you're using the file where the symbol is DEFINED
- Use `codeSnippet` to disambiguate

## Advanced Usage

### Get Multiple Info Types

<tool-use-template>
// Get all symbol information at once
mcp__vscode__get_symbol_lsp_info({
  workspace_path: "/workspace",
  filePath: "packages/api/src/user.ts",
  symbol: "UserService",
  infoType: "all"  // Returns definition, hover, signature_help, type_definition, implementation
})
</tool-use-template>

### Context-Rich References

<tool-use-template>
// Get references with surrounding code for context
mcp__vscode__get_references({
  workspace_path: "/workspace",
  filePath: "packages/api/src/services/user.ts",
  symbol: "UserService",
  includeDeclaration: true,
  usageCodeLineRange: 10  // ±10 lines of context
})
</tool-use-template>

### Targeted Diagnostics

<tool-use-template>
// Check only specific error types in specific files
mcp__vscode__get_diagnostics({
  workspace_path: "/workspace",
  filePaths: ["packages/api/src/user.ts", "packages/api/src/auth.ts"],
  severities: ["error"],
  sources: ["ts", "eslint"]
})
</tool-use-template>

## Tool Reference Quick Guide

| Tool | Primary Use Case | Key Parameters |
|------|-----------------|----------------|
| `get_symbol_lsp_info` | Type info, definitions | `symbol`, `infoType`, `codeSnippet` |
| `get_references` | Find usages | `symbol` (use definition file!) |
| `get_diagnostics` | Check errors/warnings | `filePaths` ([] = auto), `severities` |
| `rename_symbol` | Safe refactoring | `symbol`, `newName`, `codeSnippet` |
| `execute_command` | Format, fix, save | `command`, `args` (JSON string) |
| `open_files` | Workspace setup | `files` (array) |

## Related Skills

- **codebase-analysis**: Comprehensive code analysis using codebase-analysis subagent
- Uses VSCode MCP tools automatically when appropriate

## Additional Resources

- [VSCode MCP Server Documentation](https://github.com/vscode-mcp/vscode-mcp-server)
- [VSCode MCP Bridge Extension](https://marketplace.visualstudio.com/items?itemName=vscode-mcp.vscode-mcp-bridge)
- [VSCode Commands Reference](https://code.visualstudio.com/api/references/commands)
