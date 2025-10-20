<root-cause-analysis>
When asked to determine "why" something occurred or failed, perform deep technical investigation:

1. **Use codebase analysis for comprehensive investigation**:
   ```
   // Example: After finding "TypeError: Cannot read property 'id' of undefined at src/handlers/user.ts:45"
   mcp__codebase__ask({
     question: "TypeError at src/handlers/user.ts:45: 'Cannot read property id of undefined'. Trace the execution path to show:
       - The EXACT code at line 45 and surrounding context
       - ALL code paths that lead to this line (show each with code)
       - Where the undefined value originates (trace back to source)
       - Why the value can be undefined (missing validation, optional type, null return)
       - ALL other locations with this same potential error"
   })
   ```

2. **Examine real state**: Check actual file contents, process states, configurations
3. **Test hypotheses**: Run commands/simulations to verify theories
4. **Provide evidence**: Show actual outputs, file contents, or command results that prove the root cause

Do NOT:
- List potential causes without investigation
- Make assumptions about system state
- Provide theoretical explanations without verification
- Stop at surface-level symptoms

Always dig until you find the specific technical reason and can demonstrate it with evidence.
</root-cause-analysis>


<workspace_information>
This workspace uses Yarn 4.9.2 as a package manager. Do not use other package managers such as 'npm'.

This a monorepo workspace with all packages in ./packages/
</workspace_information>

<error-handling>
If you are instructed to use a program and encounter an unexpected error, you must alert the user.
</error-handling>

<vscode>
## VSCode: Tool Functions

### mcp__vscode__execute_command

**When to use**:
- Format code after making changes
- Auto-fix linting/type errors
- Restart language servers when needed
- Open files programmatically
- Save all files before running commands

**Common Commands**:

<tool-use-template>
// Format the current document
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="editor.action.formatDocument",
  args="[]"
)

// Auto-fix all issues in current file
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="editor.action.fixAll",
  args="[]"
)

// Restart TypeScript language server
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="typescript.restartTsServer",
  args="[]"
)

// Restart ESLint server
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="eslint.restart",
  args="[]"
)

// Save all open files
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="workbench.action.files.saveAll",
  args="[]"
)

// Open a specific file (requires file:// URI format)
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="vscode.open",
  args='["file:///workspace/packages/api/src/user.ts"]'
)
</tool-use-template>

**Critical Gotchas**:
- ⚠️ **args parameter must be a JSON string**: Use `args='["value"]'`, not `args=["value"]`
- ⚠️ **File paths require file:// URIs**: Use `file:///absolute/path`, not just `/absolute/path`
- ⚠️ **Some commands interrupt conversation**: Commands like `workbench.action.reloadWindow` will restart VSCode
- ⚠️ **Commands may change**: VSCode updates can modify command IDs - verify in VSCode documentation

### mcp__vscode__rename_symbol

**When to use**: Safe, cross-file symbol renaming that respects scope and automatically updates imports.

**Advantages over search/replace**:
- ✅ **Faster**: Uses language server for instant results
- ✅ **More accurate**: Respects variable scope and shadowing
- ✅ **Automatic import updates**: Fixes imports across all files
- ✅ **Language-aware**: Understands code structure

<tool-use-template>
// Simple rename
mcp__vscode__rename_symbol(
  workspace_path="/workspace",
  filePath="packages/api/src/user.ts",
  symbol="getUserData",
  newName="fetchUserData"
)

// Disambiguate multiple symbols with same name
mcp__vscode__rename_symbol(
  workspace_path="/workspace",
  filePath="packages/models/src/task.ts",
  symbol="Task",
  codeSnippet="export interface Task {",
  newName="TaskModel"
)
</tool-use-template>

**When to use codeSnippet**: Multiple symbols with the same name exist - include enough context to uniquely identify: `"function name("`, `"export interface Name {"`, `"const name ="`

**Limitations**:
- ❌ **Cannot rename built-in types**: String, Number, Promise, etc.
- ❌ **Cannot rename external library symbols**: Symbols from node_modules
- ❌ **Language server dependent**: Requires language server support for the file type

### mcp__vscode__open_files

**When to use**: Prepare workspace by opening related files for multi-file editing tasks.

<tool-use-template>
// Open single file
mcp__vscode__open_files(
  workspace_path="/workspace",
  files=[{filePath: "packages/api/src/user.ts", showEditor: true}]
)

// Open multiple files in background
mcp__vscode__open_files(
  workspace_path="/workspace",
  files=[
    {filePath: "packages/api/src/auth.ts", showEditor: false},
    {filePath: "packages/api/src/user.ts", showEditor: false},
    {filePath: "packages/models/src/user.ts", showEditor: false}
  ]
)
</tool-use-template>

**Use Cases**:
- Open related files for editing task
- Prepare workspace with relevant files
- Set up multi-file editing context

## Common Workflows

### Format and Fix Workflow

<tool-use-template>
// After making code changes:
// 1. Auto-fix issues
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="editor.action.fixAll",
  args="[]"
)

// 2. Format code
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="editor.action.formatDocument",
  args="[]"
)

// 3. Save all files
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="workbench.action.files.saveAll",
  args="[]"
)
</tool-use-template>

### Refactoring Workflow with Rename

<tool-use-template>
// 1. Open related files
mcp__vscode__open_files(
  workspace_path="/workspace",
  files=[
    {filePath: "src/services/user.ts", showEditor: false},
    {filePath: "src/controllers/user.ts", showEditor: true}
  ]
)

// 2. Rename symbol across codebase
mcp__vscode__rename_symbol(
  workspace_path="/workspace",
  filePath="src/services/user.ts",
  symbol="getUserById",
  newName="findUserById"
)

// 3. Format changes
mcp__vscode__execute_command(
  workspace_path="/workspace",
  command="editor.action.formatDocument",
  args="[]"
)
</tool-use-template>

### Multi-File Setup for Complex Edit

<tool-use-template>
// Open all related files for a feature
mcp__vscode__open_files(
  workspace_path="/workspace",
  files=[
    {filePath: "packages/models/src/user.ts", showEditor: false},
    {filePath: "packages/api/src/services/user.ts", showEditor: false},
    {filePath: "packages/api/src/controllers/user.ts", showEditor: false},
    {filePath: "packages/api/src/routes/user.ts", showEditor: true}
  ]
)
</tool-use-template>

</vscode>

