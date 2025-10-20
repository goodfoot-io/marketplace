---
name: Analysis
description: Investigate code, trace errors, find symbols, and understand complex flows with the "vscode:Analysis" subagent
---

### ✅ Use the Subagent When:

**Complex multi-tool investigations:**
- You need comprehensive analysis that requires multiple tools
- You want the agent to automatically select appropriate tools
- The investigation involves multiple files or code paths

**Technical deep-dives:**
- Understanding how a feature works across multiple components
- Tracing data flow through the application
- Finding root causes of errors
- Impact analysis for refactoring decisions

**You're unsure which specific tool to use:**
- Let the subagent figure out the best approach
- It knows when to use VSCode LSP vs. file search vs. reading code

### ❌ Don't Use the Subagent When:

**You need a single specific piece of information:**
- Use VSCode MCP tools directly (see vscode-tools skill)
- Example: Just getting diagnostics, just renaming a symbol

**Simple file operations:**
- Use Read, Write, Edit tools directly for straightforward tasks

**You know exactly which tool you need:**
- Direct tool use is faster and more efficient

## How to Use the Subagent

### Basic Usage Pattern

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "<short 3-5 word description>",
  prompt: "<detailed question or investigation request>"
})
</tool-use-template>

**Parameters:**
- `subagent_type`: Always `"codebase-analysis"`
- `description`: Short description for tracking (3-5 words)
- `prompt`: The full question or investigation request with context

### Writing Effective Prompts

#### ✅ Good Prompts (Specific and Actionable)

**1. Include full file paths:**
<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Find AuthService references",
  prompt: "Find the definition and all references to AuthService in packages/api/src/services/auth.ts"
})
</tool-use-template>

**2. Provide error context with codes and line numbers:**
<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Investigate TS2322 error",
  prompt: "TypeScript error TS2322 at packages/api/src/user.ts:45: Why is email required? Show the type definition and all related types"
})
</tool-use-template>

**3. Specify investigation goals:**
<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Trace authentication flow",
  prompt: "How does authentication flow from AuthController through AuthService to the database? Show all code paths and data transformations"
})
</tool-use-template>

**4. Request evidence-based answers:**
<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Analyze payment processing",
  prompt: "How does payment processing work? Show the actual code paths, all involved files, and data transformations"
})
</tool-use-template>

#### ❌ Poor Prompts (Too Vague)

**Missing file paths:**
<tool-use-template>
// ❌ Bad - no file path
Task({
  subagent_type: "vscode:Analysis",
  description: "How does useAuth work",
  prompt: "How does useAuth work?"
})

// ✅ Good - includes full path
Task({
  subagent_type: "vscode:Analysis",
  description: "Analyze useAuth hook",
  prompt: "How does the useAuth hook in packages/ui/src/hooks/useAuth.ts work? Show its dependencies and where it's used"
})
</tool-use-template>

**Too broad:**
<tool-use-template>
// ❌ Bad - too vague
Task({
  subagent_type: "vscode:Analysis",
  description: "Find all bugs",
  prompt: "Find all bugs"
})

// ✅ Good - specific investigation
Task({
  subagent_type: "vscode:Analysis",
  description: "Find null pointer patterns",
  prompt: "Find all locations in packages/api/src/ where we access properties without null checks that could cause 'Cannot read property of null' errors"
})
</tool-use-template>

**Multiple unrelated questions:**
<tool-use-template>
// ❌ Bad - asking for multiple unrelated things
Task({
  subagent_type: "vscode:Analysis",
  description: "Analyze processor",
  prompt: "Analyze packages/api/src/processor.ts: 1) How does it process data? 2) What imports it? 3) What's the performance impact?"
})

// ✅ Good - separate focused questions
Task({
  subagent_type: "vscode:Analysis",
  description: "Analyze processor logic",
  prompt: "How does packages/api/src/processor.ts process data? Show the processing pipeline and transformations"
})

Task({
  subagent_type: "vscode:Analysis",
  description: "Find processor usage",
  prompt: "What files import and use packages/api/src/processor.ts? Show how they use it"
})
</tool-use-template>

**Exception - Multiple related investigation points for a single issue is acceptable:**
<tool-use-template>
// ✅ Good - multi-part investigation of ONE issue
Task({
  subagent_type: "vscode:Analysis",
  description: "Debug production error",
  prompt: `Production error: "Cannot read property 'email' of null" at packages/api/src/services/notification.ts:67

Investigate this single issue:
1. Where can null be introduced in the code path?
2. What conditions lead to null values?
3. Are there other similar null access patterns in the notification service?
4. What validation is missing?`
})
</tool-use-template>

## Best Practices

### 1. Always Provide Context

**Include:**
- Full file paths in monorepos (e.g., `packages/api/src/file.ts`)
- Error codes and line numbers when debugging
- What you're trying to understand or fix
- Relevant error messages or symptoms

**Examples:**
<tool-use-template>
// ✅ Good - full context
prompt: "TypeScript error TS2322 at packages/api/src/user.ts:45: Why is email required?"

// ❌ Bad - missing context
prompt: "Why am I getting a type error?"
</tool-use-template>

### 2. Ask Focused Questions

**One investigation goal per prompt:**
<tool-use-template>
// ✅ Good - focused
Task({ prompt: "What does AuthService do?" })
Task({ prompt: "Where is AuthService used?" })
Task({ prompt: "How does AuthService handle errors?" })

// ❌ Bad - too broad
Task({ prompt: "Tell me everything about AuthService" })
</tool-use-template>

### 3. Request Code Evidence

**Ask to see actual code:**
<tool-use-template>
// ✅ Good - requests code
prompt: "Trace all code paths that lead to the error at src/handlers/user.ts:45 and show where undefined originates"

// ❌ Bad - might get summary without code
prompt: "Check the error in user.ts"
</tool-use-template>

### 4. Break Down Complex Investigations

**Use multiple focused prompts for complex investigations:**
- Better results from focused questions
- Easier to understand incremental findings
- Allows you to adjust course based on findings

### 5. Provide Maximum Context for Debugging

**Include error details, frequency, conditions:**
<tool-use-template>
Task({
  description: "Debug login timeout",
  prompt: `Login timeouts occurring in production:

Error: "Request timeout after 30s"
Location: packages/api/src/auth/login.ts:89
Frequency: 2% of login attempts
Pattern: Only on first login after signup

Show where the timeout occurs and why it might happen on first login only.`
})
</tool-use-template>

## Usage Examples

### Symbol Investigation

**Find where a function is defined and used:**

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Investigate createUser function",
  prompt: "Find where createUser is defined in packages/api/src/users/handlers.ts and show all locations where it's called. Include the function signature and how parameters are passed"
})
</tool-use-template>

### Error Root Cause Analysis

**Trace runtime errors to their origin:**

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Trace undefined error",
  prompt: "TypeError at src/handlers/payment.ts:67: 'Cannot read property amount of undefined'. Trace the execution path to show where the undefined value comes from and why amount might not exist"
})
</tool-use-template>

### Breaking Change Impact Analysis

**Understand what would break from a change:**

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Analyze API breaking change",
  prompt: "What would break if I change the response format of GET /api/users from { users: [] } to { data: [] } in packages/api/src/routes/users.ts? Show all client code that depends on the current format"
})
</tool-use-template>

### Data Flow Tracing

**Understand how data flows through the system:**

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Trace order processing flow",
  prompt: "How does an order flow from the POST /checkout endpoint through validation, inventory check, payment processing, database updates, and confirmation email? Show all code involved and data transformations"
})
</tool-use-template>

### Dependency and Impact Analysis

**Understand file relationships:**

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Analyze config dependencies",
  prompt: "What files import and depend on packages/shared/config/database.ts? Show what would be affected if I change the database connection configuration"
})
</tool-use-template>

### Architecture Pattern Discovery

**Find how patterns are implemented:**

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Find middleware patterns",
  prompt: "Find all middleware implementations in packages/api/src/middleware/ and show the common patterns they follow. How do they handle errors and pass data to the next middleware?"
})
</tool-use-template>

### Refactoring Preparation

**Before refactoring, understand current usage:**

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Find legacy API usage",
  prompt: "Find all usages of the legacy fetchProductById function in packages/api/ so I can replace them with the new getProductById function. Show how each location uses it and what parameters they pass"
})
</tool-use-template>

### Production Issue Debugging

**Investigate production errors:**

<tool-use-template>
Task({
  subagent_type: "vscode:Analysis",
  description: "Debug memory leak",
  prompt: "Memory leak in production: packages/api/src/services/cache.ts. Find all locations where cache entries are created but not cleaned up. Show the lifecycle of cache entries and where cleanup might be missing"
})
</tool-use-template>

## Advanced Usage Patterns

### Multi-Step Investigations

For complex investigations, use multiple focused prompts:

<tool-use-template>
// Step 1: Understand the component
Task({
  subagent_type: "vscode:Analysis",
  description: "Understand PaymentService",
  prompt: "What is the structure of PaymentService in packages/api/src/services/payment.ts? Show all methods, their parameters, and return types"
})

// Step 2: Find usages
Task({
  subagent_type: "vscode:Analysis",
  description: "Find PaymentService usage",
  prompt: "Show all files that use PaymentService and how they call the processPayment method. Focus on error handling"
})

// Step 3: Analyze impact
Task({
  subagent_type: "vscode:Analysis",
  description: "Impact of adding retry logic",
  prompt: "What would break if I add retry logic to PaymentService.processPayment? Show all call sites and whether they handle multiple processing attempts"
})
</tool-use-template>

### Parallel Investigations

Run independent investigations in parallel:

<tool-use-template>
// Investigation 1: Request handling
Task({
  subagent_type: "vscode:Analysis",
  description: "Trace request lifecycle",
  prompt: "How are HTTP requests processed in the API? Show the middleware chain"
})

// Investigation 2: Response formatting
Task({
  subagent_type: "vscode:Analysis",
  description: "Analyze response format",
  prompt: "How are API responses formatted? Show the response wrapper implementation"
})

// Investigation 3: Error handling
Task({
  subagent_type: "vscode:Analysis",
  description: "Map error handling",
  prompt: "How are errors caught and transformed into HTTP responses?"
})
</tool-use-template>

## What the Subagent Does

When you invoke the codebase-analysis subagent, it will:

1. **Analyze your question** to understand what you're asking
2. **Select appropriate tools** (VSCode LSP, Grep, Read, etc.)
3. **Execute investigations** using multiple tools as needed
4. **Compile findings** into a comprehensive, structured answer
5. **Provide evidence** with file paths, line numbers, and code snippets

**The subagent automatically:**
- Uses VSCode LSP for symbol information when appropriate
- Falls back to code search when LSP isn't available
- Reads files to show actual code
- Traces dependencies and references
- Provides structured, evidence-based answers

## Output Format

The subagent provides answers with:

- **Direct findings** with specific file paths and line numbers
- **Actual code snippets** from the codebase
- **Clear sections** with headers for different aspects
- **Concrete evidence** - no guessing or assumptions
- **Structured conclusions** based on what was found

## When to Use Direct Tools Instead

Use individual VSCode MCP tools directly (see vscode-tools skill) when you:

- Need a single specific piece of information
- Want diagnostics for a file: use `mcp__vscode__get_diagnostics`
- Want to rename a symbol: use `mcp__vscode__rename_symbol`
- Want to format code: use `mcp__vscode__execute_command`
- Know exactly which tool you need

**The subagent is for investigations, direct tools are for actions.**

## Related Skills

- **vscode-tools**: Direct usage of VSCode MCP tools for specific actions
- Use vscode-tools when you know exactly which tool you need
- Use codebase-analysis when you need comprehensive investigation

## Summary

**Use the codebase-analysis subagent for:**
- Comprehensive code investigations
- Multi-tool analysis tasks
- Complex technical questions
- When you want automatic tool selection

**Use direct tools for:**
- Single specific actions
- Known tool requirements
- Simple operations

The subagent is your investigation partner - give it specific questions with context, and it will find the answers using the right combination of tools.
