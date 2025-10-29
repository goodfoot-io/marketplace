# TypeScript Analysis Command-Line Utilities

This directory contains four powerful command-line utilities for analyzing TypeScript codebases. These tools help you understand code structure, type definitions, dependencies, and relationships between files.

## Overview

| Utility | Purpose | Output Format |
|---------|---------|---------------|
| `print-type-analysis` | Extract type information with complexity metrics | YAML |
| `print-typescript-types` | Export and simplify TypeScript type definitions | YAML |
| `print-dependencies` | Show what a file imports/depends on | Plain text list |
| `print-inverse-dependencies` | Show what files import a given file | Plain text list |

---

## 1. print-type-analysis

### What It Does

Analyzes TypeScript files using the **TypeScript Compiler API** to extract comprehensive type information including:
- Interfaces and their properties
- Type aliases and their definitions
- Classes with inheritance, members, and visibility modifiers
- Enums with their values
- Functions and methods with parameters, return types, and **cyclomatic complexity**

The tool automatically calculates **cyclomatic complexity** for all functions and methods, which measures code complexity by counting decision points (if statements, loops, logical operators, etc.). Higher complexity scores indicate code that may be harder to test and maintain.

### When to Use It

Use `print-type-analysis` when you need to:
- **Audit code complexity**: Identify functions with high cyclomatic complexity that may need refactoring
- **Document type structures**: Generate a comprehensive overview of all types in a file or directory
- **Understand inheritance hierarchies**: See which interfaces/classes extend or implement others
- **Analyze exported vs internal types**: The tool shows which types are exported
- **Get line-number references**: Each type includes its line number for easy navigation
- **Review API surfaces**: Quickly see all public interfaces and classes in a module

### Usage

```bash
print-type-analysis <files...>
print-type-analysis [options] <files...>
```

**Options:**
- `-h, --help`: Show help message

**File Patterns:**
- Supports glob patterns like `src/**/*.ts`
- Can accept multiple files or patterns
- Works with both `.ts` source files and `.d.ts` declaration files

### Examples

```bash
# Analyze all TypeScript files in src directory
print-type-analysis src/**/*.ts

# Analyze specific files
print-type-analysis src/models/*.ts src/types/*.ts

# Analyze a single file
print-type-analysis /path/to/specific/file.ts

# Find high-complexity functions (complexity > 10)
print-type-analysis src/**/*.ts | grep -A 1 "complexity: [1-9][0-9]"
```

### Output Format

The tool outputs YAML with the following structure:

```yaml
files:
  - path: relative/path/to/file.ts
    items:
      - kind: interface
        name: UserProfile
        line: 15
        exported: true
        properties:
          - id: string
          - name: string
          - email?: string

      - kind: function
        name: processUser
        line: 42
        exported: true
        parameters:
          - user: UserProfile
          - options?: ProcessOptions
        returnType: Promise<void>
        complexity: 8

summary:
  interfaces: 5
  functions: 12
  classes: 3
  total: 20
```

### Understanding Complexity Scores

**Cyclomatic Complexity Guide:**
- **1-5**: Simple, low risk - easy to test and maintain
- **6-10**: Moderate complexity - still manageable
- **11-20**: Complex - consider refactoring
- **21+**: Very complex - high maintenance risk, difficult to test

### Practical Use Cases

**1. Code Review - Identify Complex Functions**
```bash
# Find all functions with complexity > 15
print-type-analysis src/**/*.ts | grep -B 5 "complexity: [1-9][0-9]" | grep "name:"
```

**2. API Documentation**
```bash
# Generate type documentation for a module
print-type-analysis packages/api/src/index.ts > docs/api-types.yaml
```

**3. Refactoring Planning**
```bash
# List all classes and their inheritance
print-type-analysis src/**/*.ts | grep -A 3 "kind: class"
```

---

## 2. print-typescript-types

### What It Does

Extracts and **simplifies** exported TypeScript types from files or npm packages using **ts-morph**. This tool is particularly powerful because it:
- Shows both **full declarations** and **simplified versions** of types
- Resolves complex generic types into more readable forms
- Handles npm packages and workspace packages (not just files)
- Can filter output to show only specific types
- Cleans up import paths and type noise

The "simplified" output is like TypeScript's `SimplifyDeep<T>` utility type - it expands and flattens complex types to show what they actually represent.

### When to Use It

Use `print-typescript-types` when you need to:
- **Understand npm package APIs**: See what types a package exports and their actual structure
- **Compare workspace packages**: Examine types exported from your monorepo packages
- **Understand complex generics**: See what `Partial<Pick<User, 'id' | 'name'>>` actually resolves to
- **Extract specific types**: Use `--type` to focus on particular type definitions
- **Generate type documentation**: Create readable API documentation
- **Debug type errors**: Understand what types are actually being passed around

### Usage

```bash
print-typescript-types [options] <file-or-package-path> [<file-or-package-path> ...]
```

**Options:**
- `--pwd <directory>`: Set working directory for relative paths (useful for resolving workspace packages)
- `--type <typename>`: Filter to show only specific type(s) - can be used multiple times

**Input Types:**
- **File paths**: Absolute or relative paths to `.ts` or `.d.ts` files
- **NPM packages**: Package names like `express` or `@types/node`
- **Scoped packages**: Like `@openai/agents`
- **Package subpaths**: Like `@openai/agents/realtime`
- **Workspace packages**: Monorepo packages like `@myapp/models`

### Examples

```bash
# Examine types from a local file
print-typescript-types src/types/user.ts

# See what Express exports
print-typescript-types @types/express

# Check a workspace package from specific directory
print-typescript-types --pwd packages/api @myapp/models

# Show only specific types
print-typescript-types --type UserProfile --type Settings src/types.ts

# Compare type exports from multiple files
print-typescript-types src/types/v1.ts src/types/v2.ts

# Understand complex library types
print-typescript-types @openai/agents/realtime

# Multiple packages
print-typescript-types express socket.io
```

### Output Format

The tool outputs YAML showing both the full declaration and simplified version:

```yaml
- file: /workspace/packages/models/src/index.ts
  exports:
    - name: UserProfile
      declaration: |
        interface UserProfile {
          id: string;
          name: string;
          email?: string;
          settings: UserSettings;
        }
      simplified: |
        {
          id: string,
          name: string,
          email?: undefined | string,
          settings: {
            theme: "light" | "dark",
            notifications: boolean
          }
        }

    - name: processUser
      declaration: |
        function processUser(user: UserProfile): Promise<void>
      simplified:
        params:
          user: { id: string, name: string, email?: string, ... }
        return: Promise<void>
```

### Understanding the Output

**Declaration**: Shows the actual TypeScript source code as written
**Simplified**: Shows what the type actually resolves to when fully expanded

This is especially useful for:
- Generic types like `Pick<User, 'id' | 'name'>`
- Utility types like `Partial<T>`, `Required<T>`, `Omit<T, K>`
- Union and intersection types
- Complex function signatures with destructured parameters

### Practical Use Cases

**1. Understand npm Package APIs**
```bash
# What does the Socket.io server actually export?
print-typescript-types socket.io --type Server
```

**2. Compare API Versions**
```bash
# See what changed between versions
print-typescript-types @myapp/api-v1 @myapp/api-v2 --type ApiResponse
```

**3. Debug Type Errors**
```bash
# What is this complex type actually expecting?
print-typescript-types --pwd packages/api @myapp/models --type ProcessingOptions
```

**4. Document Workspace Packages**
```bash
# Generate documentation for internal packages
for pkg in packages/*/; do
  echo "## $(basename $pkg)" >> docs/types.md
  print-typescript-types "$pkg/src/index.ts" >> docs/types.md
done
```

---

## 3. print-dependencies

### What It Does

Shows all **dependencies** of a given TypeScript file - i.e., all the files that the input file **imports** or depends on. This traces the "depends on" relationship.

Think of it as answering: "What does this file need to work?"

### When to Use It

Use `print-dependencies` when you need to:
- **Trace import chains**: See all files required by a module
- **Understand coupling**: Identify how many dependencies a file has
- **Plan refactoring**: Know what will be affected if you change dependencies
- **Detect circular dependencies**: When combined with inverse dependencies
- **Bundle analysis**: Understand what gets included when importing a file
- **Dependency auditing**: Check if a file imports from unexpected locations

### Usage

```bash
print-dependencies <file-path>
```

**Input:**
- Absolute or relative path to a TypeScript file

**Output:**
- Plain text list of file paths (one per line)
- Shows all files that the input file imports, directly or indirectly

### Examples

```bash
# What files does index.ts depend on?
print-dependencies packages/models/src/index.ts

# Count how many dependencies a file has
print-dependencies packages/api/src/routes/users.ts | wc -l

# Check if a file depends on a specific module
print-dependencies src/app.ts | grep "database"

# Find files with too many dependencies (>20)
find src -name "*.ts" -exec sh -c \
  'count=$(print-dependencies {} | wc -l); [ $count -gt 20 ] && echo "{}: $count dependencies"' \;
```

### Sample Output

```bash
$ print-dependencies packages/models/src/index.ts
packages/models/src/conversation.ts
packages/models/src/database.ts
packages/models/src/edge.ts
packages/models/src/graph.ts
packages/models/src/lib/errors.ts
packages/models/src/lib/ids.ts
packages/models/src/list.ts
packages/models/src/note.ts
packages/models/src/question.ts
packages/models/src/reminder.ts
packages/models/src/task.ts
```

This shows that `index.ts` imports from all these files.

### Practical Use Cases

**1. Refactoring Impact Analysis**
```bash
# Before changing database.ts, see what depends on it
print-dependencies packages/models/src/database.ts
```

**2. Detect Circular Dependencies**
```bash
# If file A imports B, and B imports A (directly or indirectly)
deps=$(print-dependencies src/a.ts | grep "src/b.ts")
inverse=$(print-inverse-dependencies src/a.ts | grep "src/b.ts")
[ -n "$deps" ] && [ -n "$inverse" ] && echo "Circular dependency detected"
```

**3. Find Coupling Issues**
```bash
# Files that depend on too many others may need refactoring
for file in src/**/*.ts; do
  count=$(print-dependencies "$file" | wc -l)
  [ $count -gt 15 ] && echo "$file has $count dependencies"
done
```

**4. Trace Import Chains**
```bash
# See the full import tree for a file
print-dependencies src/app.ts | while read dep; do
  echo "$dep:"
  print-dependencies "$dep" | sed 's/^/  /'
done
```

---

## 4. print-inverse-dependencies

### What It Does

Shows all **inverse dependencies** of a given TypeScript file - i.e., all the files that **import from** or depend on the input file. This traces the "is used by" relationship.

Think of it as answering: "What would break if I changed this file?"

### When to Use It

Use `print-inverse-dependencies` when you need to:
- **Assess change impact**: See what files will be affected by modifications
- **Find usage examples**: Locate code that uses a particular module
- **Identify unused code**: Files with zero inverse dependencies may be dead code
- **Plan API changes**: Know all consumers before making breaking changes
- **Refactoring safety**: Ensure all usages are updated
- **Understand module importance**: High inverse dependency count = critical module

### Usage

```bash
print-inverse-dependencies <file-path>
```

**Input:**
- Absolute or relative path to a TypeScript file

**Output:**
- Plain text list of file paths (one per line)
- Shows all files that import from the input file
- Empty output means no files depend on it (possible dead code)

### Examples

```bash
# What files import from database.ts?
print-inverse-dependencies packages/models/src/database.ts

# Find potentially unused files (no inverse dependencies)
find src -name "*.ts" -exec sh -c \
  '[ -z "$(print-inverse-dependencies {})" ] && echo "Unused: {}"' \;

# Count how many files depend on a utility
print-inverse-dependencies src/utils/format.ts | wc -l

# Check if a file can be safely deleted
deps=$(print-inverse-dependencies src/old-module.ts)
[ -z "$deps" ] && echo "Safe to delete" || echo "Still in use by: $deps"

# Find most-used files (highest inverse dependency count)
find src -name "*.ts" -exec sh -c \
  'count=$(print-inverse-dependencies {} | wc -l); echo "$count {}"' \; | sort -rn | head -10
```

### Sample Output

```bash
$ print-inverse-dependencies packages/models/src/database.ts
packages/models/src/conversation.ts
packages/models/src/edge.ts
packages/models/src/graph.ts
packages/models/src/list.ts
packages/models/src/note.ts
packages/models/src/question.ts
packages/models/src/reminder.ts
packages/models/src/task.ts
packages/api/src/services/user.ts
packages/api/src/services/notes.ts
```

This shows that 10 files import from `database.ts` - changing it would potentially affect all these files.

### Practical Use Cases

**1. Impact Analysis Before Changes**
```bash
# Before modifying a module, see what will be affected
echo "Files that will be impacted:"
print-inverse-dependencies src/lib/auth.ts
```

**2. Find Dead Code**
```bash
# Identify files that nothing imports from
find src -name "*.ts" | while read file; do
  [ -z "$(print-inverse-dependencies "$file")" ] && echo "Unused: $file"
done
```

**3. API Change Planning**
```bash
# Before making breaking changes to an API
echo "These files will need updating:"
print-inverse-dependencies packages/api/src/types.ts
```

**4. Identify Critical Files**
```bash
# Files with many inverse dependencies are critical
find packages -name "*.ts" -not -path "*/node_modules/*" | while read file; do
  count=$(print-inverse-dependencies "$file" | wc -l)
  echo "$count $file"
done | sort -rn | head -20
```

**5. Refactoring Validation**
```bash
# After refactoring, ensure all usages still exist
old_count=$(print-inverse-dependencies src/old-api.ts | wc -l)
new_count=$(print-inverse-dependencies src/new-api.ts | wc -l)
[ $old_count -eq 0 ] && [ $new_count -gt 0 ] && echo "Migration successful"
```

---

## Combining the Tools

These utilities are most powerful when used together. Here are some advanced workflows:

### Workflow 1: Complete Dependency Analysis

```bash
FILE="src/services/user.ts"

echo "=== Full Dependency Analysis for $FILE ==="
echo ""
echo "1. Files this imports from (dependencies):"
print-dependencies "$FILE"
echo ""
echo "2. Files that import this (inverse dependencies):"
print-inverse-dependencies "$FILE"
echo ""
echo "3. Type structure and complexity:"
print-type-analysis "$FILE"
```

### Workflow 2: Find Circular Dependencies

```bash
# Check if two files circularly depend on each other
FILE_A="src/a.ts"
FILE_B="src/b.ts"

if print-dependencies "$FILE_A" | grep -q "$FILE_B" && \
   print-dependencies "$FILE_B" | grep -q "$FILE_A"; then
  echo "Circular dependency detected between $FILE_A and $FILE_B"
fi
```

### Workflow 3: Complexity and Usage Report

```bash
# Generate a report showing complexity of functions and how widely they're used
print-type-analysis src/**/*.ts > /tmp/types.yaml
for file in src/**/*.ts; do
  inv_count=$(print-inverse-dependencies "$file" | wc -l)
  echo "$file is used by $inv_count files"
done
```

### Workflow 4: API Surface Documentation

```bash
# Document exported API with types and usage
MODULE="packages/api/src/index.ts"

echo "# API Documentation"
echo ""
echo "## Exported Types"
print-typescript-types "$MODULE"
echo ""
echo "## Type Details"
print-type-analysis "$MODULE"
echo ""
echo "## Used By"
print-inverse-dependencies "$MODULE"
```

### Workflow 5: Refactoring Safety Check

```bash
# Before refactoring a file, get complete context
TARGET="src/legacy/old-api.ts"

echo "Refactoring Impact Assessment for $TARGET"
echo "=========================================="
echo ""
echo "Directly depends on $(print-dependencies "$TARGET" | wc -l) files"
echo "Directly used by $(print-inverse-dependencies "$TARGET" | wc -l) files"
echo ""
echo "Functions and their complexity:"
print-type-analysis "$TARGET" | grep -A 1 "kind: function"
echo ""
echo "Files to update after refactoring:"
print-inverse-dependencies "$TARGET"
```

---

## Integration with Other Tools

### With grep/ripgrep

```bash
# Find high complexity functions across codebase
print-type-analysis src/**/*.ts | grep -B 4 "complexity: [2-9][0-9]"

# Find all exported interfaces
print-type-analysis src/**/*.ts | grep -A 5 "kind: interface" | grep "exported: true"
```

### With jq (for JSON processing)

```bash
# Convert YAML to JSON for processing (requires yq)
print-typescript-types packages/api/src/index.ts | yq eval -o=json | jq '.[] | .exports[] | .name'
```

### With watch (continuous monitoring)

```bash
# Monitor type changes in real-time
watch -n 2 'print-type-analysis src/app.ts'
```

### In CI/CD Pipelines

```bash
# Fail if complexity threshold exceeded
max_complexity=$(print-type-analysis src/**/*.ts | grep "complexity:" | awk '{print $2}' | sort -rn | head -1)
if [ "$max_complexity" -gt 20 ]; then
  echo "ERROR: Maximum complexity $max_complexity exceeds threshold of 20"
  exit 1
fi

# Ensure no dead code
for file in src/**/*.ts; do
  if [ -z "$(print-inverse-dependencies "$file")" ] && [ "$file" != "src/index.ts" ]; then
    echo "WARNING: Potentially unused file: $file"
  fi
done
```

---

## Best Practices

### 1. Regular Complexity Audits
Run `print-type-analysis` regularly to catch complexity creep early:
```bash
# Add to pre-commit hook
print-type-analysis $(git diff --cached --name-only | grep ".ts$") | grep "complexity: [2-9][0-9]" && \
  echo "Warning: High complexity functions detected"
```

### 2. Document Public APIs
Use `print-typescript-types` to maintain API documentation:
```bash
# Generate docs for all packages
find packages -name "index.ts" | while read f; do
  pkg=$(dirname $(dirname "$f"))
  print-typescript-types "$f" > "$pkg/docs/types.md"
done
```

### 3. Monitor Dependencies
Track dependency counts to prevent tight coupling:
```bash
# Alert on files with >15 dependencies
find src -name "*.ts" | while read file; do
  count=$(print-dependencies "$file" | wc -l)
  [ $count -gt 15 ] && echo "High coupling: $file ($count deps)"
done
```

### 4. Visualize Architecture
Combine tools to create dependency graphs:
```bash
# Simple text-based dependency tree
function show_tree() {
  local file=$1
  local indent=$2
  echo "${indent}${file}"
  print-dependencies "$file" | while read dep; do
    show_tree "$dep" "${indent}  "
  done
}
show_tree "src/app.ts" ""
```

---

## Troubleshooting

### "Could not resolve package" Error

**Problem:** `print-typescript-types` can't find a package

**Solutions:**
```bash
# Use --pwd to set correct working directory
print-typescript-types --pwd /workspace/packages/api @myapp/models

# Ensure the package is built (for workspace packages)
cd packages/models && yarn build

# Check package.json has correct 'types' field
```

### Empty Output from print-type-analysis

**Problem:** No types found in file

**Causes:**
- File contains only imports/exports
- File is a `.js` file (tool works best with `.ts`)
- File is a declaration file without actual definitions

### No Output from print-inverse-dependencies

**Problem:** Empty result even though file is used

**Causes:**
- Build artifacts may be stale - rebuild the project
- File may be used indirectly (through re-exports)
- The tool may not have indexed all files yet

---

## Performance Tips

1. **Use specific paths** instead of `**/*` when possible
2. **Build declaration files** first (`.d.ts`) for faster analysis
3. **Limit glob patterns** to relevant directories
4. **Cache results** for frequently analyzed files
5. **Run in parallel** when analyzing multiple independent files

---

## Summary Table

| Task | Command |
|------|---------|
| Find complex functions | `print-type-analysis src/**/*.ts \| grep -A 1 "complexity: [1-9][0-9]"` |
| See what file imports | `print-dependencies src/file.ts` |
| See what imports file | `print-inverse-dependencies src/file.ts` |
| Understand package API | `print-typescript-types @package/name` |
| Check for dead code | `[ -z "$(print-inverse-dependencies file.ts)" ] && echo "Unused"` |
| Count dependencies | `print-dependencies file.ts \| wc -l` |
| Export specific types | `print-typescript-types --type TypeName file.ts` |
| Full file analysis | `print-type-analysis file.ts` |
| Impact assessment | `print-inverse-dependencies file.ts` |

---

## Additional Resources

- TypeScript Compiler API: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- ts-morph Documentation: https://ts-morph.com/
- Cyclomatic Complexity: https://en.wikipedia.org/wiki/Cyclomatic_complexity
- AST Grep (complementary tool): See `.claude/shared/ast-grep-guide.md`

---

## Contributing

These utilities are located in `.devcontainer/utilities/`. Source files:
- `print-type-analysis.ts` - TypeScript source for type analysis
- `print-typescript-types` - Node.js script for type extraction
- `print-dependencies` - Compiled binary for dependency tracking
- `print-inverse-dependencies` - Compiled binary for reverse dependency tracking

To modify or extend these tools, edit the source files and test thoroughly with various TypeScript patterns.
