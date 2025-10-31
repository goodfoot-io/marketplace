---
name: Tools
description: Direct access to VSCode Language Server Protocol (LSP) tools for symbol lookups, type information, diagnostics, refactoring operations, and workspace commands. Use when users need quick symbol information, want to find references, request code diagnostics, need rename refactoring, or require specific LSP operations.
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
```xml
<invoke name="mcp__plugin_vscode_vscode__get_symbol_lsp_info">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/services/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
<parameter name="infoType">all</parameter>
</invoke>
```

### Use `get_references` When:

✅ **Finding all usages of a symbol:**
- Checking where a function is called
- Finding all imports of a class
- Impact analysis before refactoring

✅ **Understanding code dependencies:**
- See which files depend on a specific function/class
- Trace usage patterns across the codebase

**Example:**
```xml
<invoke name="mcp__plugin_vscode_vscode__get_references">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/services/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
<parameter name="includeDeclaration">true</parameter>
<parameter name="usageCodeLineRange">5</parameter>
</invoke>
```
<!-- File where symbol is DEFINED -->
<!-- Include ±5 lines of context -->

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
```xml
<!-- Check specific files -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">["packages/api/src/user.ts"]</parameter>
<parameter name="severities">["error", "warning"]</parameter>
<parameter name="sources">["ts", "eslint"]</parameter>
</invoke>

<!-- Check all modified files (empty array) -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">[]</parameter>
<parameter name="severities">["error"]</parameter>
</invoke>
```
<!-- Auto-detects git modified files -->

### Use `rename_symbol` When:

✅ **Renaming across the codebase:**
- Renaming functions, classes, variables, types
- Automatic import updates needed
- Scope-aware renaming required

✅ **Faster than search-and-replace:**
- Language server understands scope and shadowing
- More accurate than text-based replacement

**Example:**
```xml
<invoke name="mcp__plugin_vscode_vscode__rename_symbol">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/services/user.ts</parameter>
<parameter name="symbol">getUserById</parameter>
<parameter name="newName">findUserById</parameter>
<parameter name="codeSnippet">async getUserById(</parameter>
</invoke>
```
<!-- Optional: disambiguate multiple symbols -->

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
```xml
<!-- Format document -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">editor.action.formatDocument</parameter>
<parameter name="args">[]</parameter>
</invoke>

<!-- Auto-fix all issues -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">editor.action.fixAll</parameter>
<parameter name="args">[]</parameter>
</invoke>

<!-- Save all files -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">workbench.action.files.saveAll</parameter>
<parameter name="args">[]</parameter>
</invoke>
```

### Use `open_files` When:

✅ **Preparing for multi-file editing:**
- Opening related files before making changes
- Setting up workspace for a task

✅ **Showing context to user:**
- Opening files to display in editor

**Example:**
```xml
<invoke name="mcp__plugin_vscode_vscode__open_files">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="files">[
  { "filePath": "packages/api/src/user.ts", "showEditor": true },
  { "filePath": "packages/api/src/auth.ts", "showEditor": false }
]</parameter>
</invoke>
```

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

```xml
<!-- 1. Get comprehensive symbol information -->
<invoke name="mcp__plugin_vscode_vscode__get_symbol_lsp_info">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/services/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
<parameter name="infoType">all</parameter>
</invoke>

<!-- 2. Find all references -->
<invoke name="mcp__plugin_vscode_vscode__get_references">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/services/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
<parameter name="includeDeclaration">true</parameter>
</invoke>
```

### Workflow 2: Refactor with Confidence

```xml
<!-- 1. Check current diagnostics -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">[]</parameter>
<parameter name="severities">["error"]</parameter>
</invoke>

<!-- 2. Rename symbol -->
<invoke name="mcp__plugin_vscode_vscode__rename_symbol">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/services/user.ts</parameter>
<parameter name="symbol">getUserById</parameter>
<parameter name="newName">findUserById</parameter>
</invoke>

<!-- 3. Check for new errors -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">[]</parameter>
<parameter name="severities">["error"]</parameter>
</invoke>

<!-- 4. Auto-fix and format -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">editor.action.fixAll</parameter>
<parameter name="args">[]</parameter>
</invoke>

<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">editor.action.formatDocument</parameter>
<parameter name="args">[]</parameter>
</invoke>
```

### Workflow 3: Pre-Commit Quality Check

```xml
<!-- 1. Get diagnostics for modified files -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">[]</parameter>
<parameter name="severities">["error", "warning"]</parameter>
</invoke>
<!-- Auto-detects git modified files -->

<!-- 2. Auto-fix issues -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">editor.action.fixAll</parameter>
<parameter name="args">[]</parameter>
</invoke>

<!-- 3. Format code -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">editor.action.formatDocument</parameter>
<parameter name="args">[]</parameter>
</invoke>

<!-- 4. Save all -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">workbench.action.files.saveAll</parameter>
<parameter name="args">[]</parameter>
</invoke>
```

### Workflow 4: Understand Type Issues

```xml
<!-- 1. Get diagnostics for a specific file -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">["packages/api/src/user.ts"]</parameter>
<parameter name="severities">["error"]</parameter>
<parameter name="sources">["ts"]</parameter>
</invoke>

<!-- 2. Get type information for problematic symbols -->
<invoke name="mcp__plugin_vscode_vscode__get_symbol_lsp_info">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/user.ts</parameter>
<parameter name="symbol">User</parameter>
<parameter name="infoType">type_definition</parameter>
</invoke>

<!-- 3. Check hover documentation for more context -->
<invoke name="mcp__plugin_vscode_vscode__get_symbol_lsp_info">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/user.ts</parameter>
<parameter name="symbol">User</parameter>
<parameter name="infoType">hover</parameter>
</invoke>
```

## Best Practices

### 1. Always Use Definition File for References

When using `get_references`, always provide the file where the symbol is **defined**, not where it's used:

```xml
<!-- ✅ Correct - using the file where UserService is defined -->
<invoke name="mcp__plugin_vscode_vscode__get_references">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/services/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
</invoke>
<!-- Definition file -->

<!-- ❌ Incorrect - using a file where it's imported -->
<invoke name="mcp__plugin_vscode_vscode__get_references">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/controllers/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
</invoke>
<!-- Import location -->
```

### 2. Use Empty Array for Auto-Detection

For `get_diagnostics`, use an empty array to automatically check all git-modified files:

```xml
<!-- ✅ Recommended - auto-detects modified files -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">[]</parameter>
<parameter name="severities">["error"]</parameter>
</invoke>
```

### 3. Use Code Snippets for Disambiguation

When multiple symbols have the same name, use `codeSnippet` to disambiguate:

```xml
<!-- Multiple "Task" symbols exist (interface, class, type) -->
<invoke name="mcp__plugin_vscode_vscode__get_symbol_lsp_info">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/models/src/task.ts</parameter>
<parameter name="symbol">Task</parameter>
<parameter name="codeSnippet">export interface Task {</parameter>
<parameter name="infoType">all</parameter>
</invoke>
<!-- Disambiguates to the interface -->
```

### 4. Chain Commands for Post-Edit Cleanup

After editing, chain format + fix + save:

```xml
<!-- 1. Auto-fix -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">editor.action.fixAll</parameter>
<parameter name="args">[]</parameter>
</invoke>

<!-- 2. Format -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">editor.action.formatDocument</parameter>
<parameter name="args">[]</parameter>
</invoke>

<!-- 3. Save all -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">workbench.action.files.saveAll</parameter>
<parameter name="args">[]</parameter>
</invoke>
```

### 5. Filter Diagnostics Appropriately

Use severity and source filters to focus on relevant issues:

```xml
<!-- Only TypeScript errors -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">[]</parameter>
<parameter name="severities">["error"]</parameter>
<parameter name="sources">["ts"]</parameter>
</invoke>

<!-- Only ESLint warnings -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">[]</parameter>
<parameter name="severities">["warning"]</parameter>
<parameter name="sources">["eslint"]</parameter>
</invoke>
```

## Common Pitfalls

### ❌ Don't: Use find/usage file for references

```xml
<!-- Wrong - this will fail or return incorrect results -->
<invoke name="mcp__plugin_vscode_vscode__get_references">
<parameter name="filePath">packages/api/src/controllers/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
</invoke>
<!-- Where it's used -->
```

### ✅ Do: Use definition file for references

```xml
<!-- Correct - find definition first, then get references -->
<invoke name="mcp__plugin_vscode_vscode__get_references">
<parameter name="filePath">packages/api/src/services/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
</invoke>
<!-- Where it's defined -->
```

### ❌ Don't: Forget args parameter must be JSON string

```xml
<!-- Wrong - args as array -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">vscode.open</parameter>
<parameter name="args">["file:///workspace/file.ts"]</parameter>
</invoke>
<!-- Wrong type -->
```

### ✅ Do: Pass args as JSON string

```xml
<!-- Correct - args as JSON string -->
<invoke name="mcp__plugin_vscode_vscode__execute_command">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="command">vscode.open</parameter>
<parameter name="args">["file:///workspace/file.ts"]</parameter>
</invoke>
<!-- JSON string -->
```

## Integration with Other Skills

### With codebase-analysis Skill

The VSCode MCP tools are automatically used by the `codebase-analysis` subagent when appropriate:

```xml
<invoke name="Task">
<parameter name="subagent_type">vscode:Analysis</parameter>
<parameter name="description">Analyze UserService</parameter>
<parameter name="prompt">Find all references to UserService and show their type information</parameter>
</invoke>
```
<!-- The codebase-analysis subagent will automatically use get_symbol_lsp_info and get_references -->

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

```xml
<invoke name="mcp__plugin_vscode_vscode__health_check">
<parameter name="workspace_path">/workspace</parameter>
</invoke>
```

### List Available Workspaces

Find available workspaces:

```xml
<invoke name="mcp__plugin_vscode_vscode__list_workspaces">
</invoke>
```

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

```xml
<!-- Get all symbol information at once -->
<invoke name="mcp__plugin_vscode_vscode__get_symbol_lsp_info">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
<parameter name="infoType">all</parameter>
</invoke>
<!-- Returns definition, hover, signature_help, type_definition, implementation -->
```

### Context-Rich References

```xml
<!-- Get references with surrounding code for context -->
<invoke name="mcp__plugin_vscode_vscode__get_references">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePath">packages/api/src/services/user.ts</parameter>
<parameter name="symbol">UserService</parameter>
<parameter name="includeDeclaration">true</parameter>
<parameter name="usageCodeLineRange">10</parameter>
</invoke>
<!-- ±10 lines of context -->
```

### Targeted Diagnostics

```xml
<!-- Check only specific error types in specific files -->
<invoke name="mcp__plugin_vscode_vscode__get_diagnostics">
<parameter name="workspace_path">/workspace</parameter>
<parameter name="filePaths">["packages/api/src/user.ts", "packages/api/src/auth.ts"]</parameter>
<parameter name="severities">["error"]</parameter>
<parameter name="sources">["ts", "eslint"]</parameter>
</invoke>
```

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
