# Codebase Tool Optimal Usage Patterns

## Critical Requirement: Always Include Specific Locations

**⚠️ IMPORTANT**: The tool cannot read your mind or previous context. Every question must be self-contained.

### Always specify:
1. **WHERE** to look (FULL file path including package, e.g., `packages/api/src/...` not just `src/...`)
2. **WHAT** specific thing you're asking about (exact class/interface/function name)
3. **SCOPE** when searching (which packages/directories to search within)

**⚠️ CRITICAL**: In monorepos, NEVER use relative paths like `src/...` or `tests/...`. 
Always include the package name: `packages/api/src/...` or `packages/web/tests/...`

### Examples of Missing Context:

❌ **BAD**: "What breaks if I change the UserService class?"
- Which UserService? Where is it located?
✅ **GOOD**: "What breaks if I change the UserService class at packages/api/src/services/user.service.ts?"

❌ **BAD**: "How is authentication implemented?"
- Authentication where? In which package?
✅ **GOOD**: "How is authentication implemented in packages/api/src/auth?"

❌ **BAD**: "What files import the User type?"
- Which User type? From which file?
✅ **GOOD**: "What files import the User type from packages/shared/types/user.ts?"

❌ **BAD**: "Find all Repository implementations"
- In the entire codebase? Which directories?
✅ **GOOD**: "Find all Repository implementations in packages/api/src/repositories/"

❌ **BAD**: "What tests exist for authentication?"
- Where should it look for tests?
✅ **GOOD**: "What tests exist for authentication in packages/api/tests/?"

## Core Principle
The `mcp__codebase__ask` tool provides exhaustive results by default. Keep questions simple and natural, but always include specific file paths or directories.

## Default Behavior
The tool automatically provides:
- Complete code listings (not summaries)
- All occurrences (not samples)
- Exact line numbers and file paths
- Actual code snippets with context
- Type definitions and relationships
- Dependency counts and impact analysis

## Question Templates

### TypeScript Error Analysis
Ask a specific question about the error:
```javascript
mcp__codebase__ask({
  question: "Why does ${error_message} occur at ${filepath}:${line}:${col}? Show type definitions and differences."
})
```

**Example:**
```javascript
mcp__codebase__ask({
  question: "Why is Type 'User' not assignable to type 'AuthUser' at packages/api/src/auth.ts:45:14? Show both type definitions and identify the differences."
})
```

### Impact Analysis
```javascript
mcp__codebase__ask({
  question: "What breaks if I change ${element} at ${location}?"
})
```

**Example:**
```javascript
mcp__codebase__ask({
  question: "What breaks if I change the Database interface at packages/core/src/database.ts?"
})
```

### Architecture Discovery
```javascript
mcp__codebase__ask({
  question: "How is ${feature} implemented in ${specific_directory}?"
})
```

**Example:**
```javascript
mcp__codebase__ask({
  question: "How is authentication implemented in packages/api/src/auth?"
})
```

**Note**: Always include the specific directory path, not just "authentication" or "the auth system"

### Pattern Finding
```javascript
mcp__codebase__ask({
  question: "What ${pattern} implementations exist in ${scope}?"
})
```

**Example:**
```javascript
mcp__codebase__ask({
  question: "What Repository pattern implementations exist in packages/api/src/repositories?"
})
```

### Dependency Analysis
```javascript
mcp__codebase__ask({
  question: "What are the dependencies for ${file} and how many imports does it have?"
})
```

**Example:**
```javascript
mcp__codebase__ask({
  question: "What are the dependencies for packages/api/src/middleware/auth.ts and what would need updating if it changes?"
})
```

### Test Failure Analysis
```javascript
mcp__codebase__ask({
  question: "Why does ${error_message} occur in test file ${file}?"
})
```

**Example:**
```javascript
mcp__codebase__ask({
  question: "Why does 'Cannot read property id of undefined' occur in packages/api/tests/user.test.ts?"
})
```

## Parallel Execution Pattern

Send multiple independent questions in ONE message for simultaneous analysis:

```javascript
// All questions sent together for parallel execution
mcp__codebase__ask({
  question: "How is user authentication implemented in packages/api/src/auth?"
})

mcp__codebase__ask({
  question: "What would break if I change the auth middleware interface at packages/api/src/middleware/auth.ts?"
})

mcp__codebase__ask({
  question: "What tests exist for authentication in packages/api/tests/?"
})
```

## Anti-Patterns to Avoid

### ❌ DON'T use emphasis or redundant instructions
```javascript
// BAD
mcp__codebase__ask({
  question: "Show ALL files that import User. List EVERY occurrence with COMPLETE code."
})

// GOOD
mcp__codebase__ask({
  question: "What files import the User type from packages/shared/types/user.ts?"
})
```

### ❌ DON'T use complex bullet lists
```javascript
// BAD
mcp__codebase__ask({
  question: "Analyze auth showing:
    - Framework versions
    - All middleware functions
    - Test coverage
    - Database schema"
})

// GOOD - Split into focused questions
mcp__codebase__ask({
  question: "What authentication framework is used in packages/api?"
})

mcp__codebase__ask({
  question: "How does the auth middleware at packages/api/src/middleware/auth.ts validate tokens?"
})
```

### ❌ DON'T add parenthetical clarifications
```javascript
// BAD
mcp__codebase__ask({
  question: "Find Repository implementations (show complete code, not summaries)"
})

// GOOD
mcp__codebase__ask({
  question: "What Repository implementations exist in packages/api/src/repositories?"
})
```

### ❌ DON'T use "migration" when you mean "update"
```javascript
// BAD
mcp__codebase__ask({
  question: "Show migration strategy if I change the User interface"
})

// GOOD
mcp__codebase__ask({
  question: "What update steps are needed if I change the User interface at packages/shared/types/user.ts?"
})
```

## Best Practices

1. **Use natural language** - The tool understands context
2. **Be specific about locations** when known
3. **Include exact error formats** from compiler output
4. **Send related questions together** for parallel execution
5. **Trust the tool's defaults** - It provides exhaustive results
6. **Keep questions focused** - One clear objective per question

## When to Use This Tool

✅ **USE FOR:**
- Complex impact analysis across multiple files
- Understanding type relationships and mismatches
- Tracing error root causes through code
- Finding all implementations of a pattern
- Analyzing dependencies and breaking changes

❌ **DON'T USE FOR:**
- Simple file reading (use `Read` tool)
- Basic text search (use `Grep` tool)
- File listing (use `Glob` or `Bash ls`)
- Creating/editing files (use `Write`/`Edit` tools)

## Performance Notes

- Each question uses 10k-50k tokens
- Typical response time: 15-60 seconds
- Complex analysis may take up to 2 minutes
- Parallel questions execute simultaneously (same time as single question)

## Migration from Verbose Patterns

If you're updating existing code that uses verbose patterns:

**Before:**
```javascript
"Show COMPLETE implementation with ALL dependencies"
```

**After:**
```javascript
"How is this implemented?"
```

**Before:**
```javascript
"List EVERY file (show exact count)"
```

**After:**
```javascript
"What files are affected?"
```

The tool handles completeness automatically - no need to emphasize.