# Candidate Analysis Checklist

## Status Reporting

When a hook project is assessed as "concerning" or "poor_candidate", append to `reports/hook-repositories-status.csv`:

```bash
# Initialize CSV if needed
mkdir -p reports
[ -f reports/hook-repositories-status.csv ] || echo "repo,directory,internal_path,status" > reports/hook-repositories-status.csv

# Log result (status: good | concerning | poor_candidate)
echo "${repo},${directory},${internal_path},${status}" >> reports/hook-repositories-status.csv
```

| Column | Description |
|--------|-------------|
| `repo` | Repository name (e.g., `owner/repo-name`) |
| `directory` | Full path to hook project (e.g., `/home/node/hook-repos/repo-name/packages/hooks`) |
| `internal_path` | Relative path within repo (e.g., `packages/hooks`), empty if root-level |
| `status` | Assessment result: `good`, `concerning`, or `poor_candidate` |

## Multiple Hook Projects

When `reports/hook-repositories.typescript.csv` contains multiple internal paths for a repository, **analyze each one separately**. Each internal path represents a distinct hook project that needs its own:
- Candidacy assessment
- Status report entry
- Conversion (if good candidate)

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

### Concerning (Log and Skip)

- [ ] **Long-running daemons** - Worker services, background processes
- [ ] **External API calls** - HTTP requests to external services
- [ ] **Complex state management** - Session persistence, databases
- [ ] **Custom matchers** - Non-standard tool matching logic
- [ ] **No tests** - Cannot verify conversion correctness
- [ ] **Heavy dependencies** - MCP servers, agent SDKs

**Action:** Log to `reports/hook-repositories-status.csv` with status `concerning` and skip.

### Poor Candidates (Log and Skip)

- [ ] **Service architecture** - Bun/Node services with lifecycle management
- [ ] **Database dependencies** - SQLite, Redis, external storage
- [ ] **Tightly coupled systems** - Hooks depend on other repo components
- [ ] **Custom protocols** - Non-standard input/output formats

**Action:** Log to `reports/hook-repositories-status.csv` with status `poor_candidate` and skip.

## Analysis Template

```markdown
## Repository: {name}
## Internal Path: {internal_path or "root"}

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
- [ ] Proceed with full conversion (status: `good`)
- [ ] Log and skip (status: `concerning`)
- [ ] Log and skip (status: `poor_candidate`)

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

### High Complexity (Log and Skip)
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
Service architecture with persistent worker - log as `poor_candidate` and skip.
