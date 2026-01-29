# Candidate Analysis Checklist

## Finding Hooks

Search for hook configuration files:
```bash
find . -name "hooks.json" -o -name "*hooks*.json" | head -20
```

Common locations:
- `hooks/hooks.json`
- `.claude/hooks.json`
- `.claude-plugin/hooks/hooks.json`
- `plugin/hooks/hooks.json`

## Assessment Criteria

### Good Candidates (Proceed)

- [ ] **Simple bash scripts** - Scripts that check conditions and exit
- [ ] **Inline commands** - `echo`, `grep`, simple file checks
- [ ] **Standard matchers** - `Bash`, `Write`, `Edit`, `Read`, regex patterns
- [ ] **Standard hook types** - PreToolUse, PostToolUse, Stop, SessionStart
- [ ] **Self-contained logic** - No external service dependencies
- [ ] **Existing tests** - Has npm test, pytest, vitest, or similar

### Concerning (Ask User)

- [ ] **Long-running daemons** - Worker services, background processes
- [ ] **External API calls** - HTTP requests to external services
- [ ] **Complex state management** - Session persistence, databases
- [ ] **Custom matchers** - Non-standard tool matching logic
- [ ] **No tests** - Cannot verify conversion correctness
- [ ] **Heavy dependencies** - MCP servers, agent SDKs

### Poor Candidates (Recommend Abort)

- [ ] **Service architecture** - Bun/Node services with lifecycle management
- [ ] **Database dependencies** - SQLite, Redis, external storage
- [ ] **Tightly coupled systems** - Hooks depend on other repo components
- [ ] **Custom protocols** - Non-standard input/output formats

## Analysis Template

```markdown
## Repository: {name}

### Hook Files Found
- {path}: {line count} lines, {hook count} hooks

### Hook Types
| Type | Count | Matchers |
|------|-------|----------|
| PreToolUse | X | Bash, Write|Edit |
| PostToolUse | X | * |

### Implementation Style
- [ ] Bash scripts
- [ ] Inline commands
- [ ] External scripts (node/python/bun)
- [ ] Service daemons

### Conversion Complexity
- **Low**: Simple scripts, standard patterns
- **Medium**: Some external calls, custom logic
- **High**: Services, state, external dependencies

### Test Coverage
- Framework: {vitest/jest/pytest/bun/none}
- Test files: {count}
- Relevant tests: {yes/no}

### Recommendation
- [ ] Proceed with full conversion
- [ ] Proceed with partial conversion (list exclusions)
- [ ] Ask user for guidance
- [ ] Recommend abort

### Notes
{Any specific concerns or observations}
```

## Quick Complexity Heuristics

| Indicator | Complexity |
|-----------|------------|
| hooks.json < 50 lines | Low |
| hooks.json 50-150 lines | Medium |
| hooks.json > 150 lines | High |
| Uses `bun run` or services | High |
| Uses `npx` commands | Medium |
| Uses bash scripts only | Low |
| Has `timeout > 60000` | Medium-High |
| Has database/MCP deps | High |

## Example Assessments

### Low Complexity (Proceed)
```json
{
  "hooks": [{
    "type": "SessionStart",
    "command": "./scripts/init.sh"
  }]
}
```
Single bash script, standard type, easy conversion.

### Medium Complexity (Proceed with Care)
```json
{
  "hooks": [{
    "type": "PreToolUse",
    "matcher": "Write|Edit|MultiEdit",
    "command": "npx eslint --fix ${TOOL_INPUT_FILE_PATH}"
  }]
}
```
External tool invocation, needs execSync wrapper.

### High Complexity (Ask User)
```json
{
  "hooks": [{
    "type": "SessionStart",
    "command": "bun run scripts/worker-service.cjs start"
  }, {
    "type": "PostToolUse",
    "matcher": "*",
    "command": "bun run scripts/worker-service.cjs hook observation"
  }]
}
```
Service architecture with persistent worker - may need significant redesign.
