<type-error-handling>
When you create or edit a file that contains type errors, for example:

```typescript
const foo: string = 42;
```

You will receive a YAML formatted message describing the issues:

```yaml
errors:
  - type: typescript
    file: /workspace/packages/models/src/example-error.ts
    line: 1
    column: 7
    code: TS2322
    message: "Type 'number' is not assignable to type 'string'."
    context:
      > 1: "const foo: string = 42;"
```

You **MUST** resolve these issues immediately. Do not move on to the next task until the issue is resolved.
</type-error-handling>

<style_rules>
Do not avoid linting, tests, or writing full implementations.

- DO NOT DISABLE TYPESCRIPT RULES.
- DO NOT DISABLE ESLINT RULES.
- DO NOT WRITE SIMULATIONS OF FUNCTIONALITY UNLESS THE USER EXPLICITLY REQUESTS SIMULATIONS.
- DO NOT USE THE `any` TypeScript type
</style_rules>

<useful_cli_commands>
## Code Analysis

For comprehensive code analysis (dependencies, types, patterns, relationships), use the MCP codebase tool:

```
mcp__codebase__ask({
  question: "[Your analysis question]"
})
```

Example questions:
- "Trace all dependencies for src/index.ts and show what imports it"
- "Find all TypeScript types exported from src/types.ts with their definitions"
- "Analyze code quality and complexity in src/**/*.ts"
- "Map the dependency relationships in packages/api"
- "Find all console.log statements and async functions in the codebase"

## Direct CLI Commands (when specific output format needed)

```bash
# File structure visualization
print-filesystem "**/*.ts" --exclude "tests/fixtures/*.ts"

# Quick pattern search with ast-grep
ast-grep -p 'pattern' -l ts  # When you need specific AST patterns
```

For detailed ast-grep patterns and usage, see `.claude/shared/ast-grep-guide.md`

</useful_cli_commands>
