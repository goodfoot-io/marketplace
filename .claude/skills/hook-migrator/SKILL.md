---
name: hook-migrator
description: Migrate Claude Code hook implementations to use @goodfoot/claude-code-hooks.
---

# Hook Migrator

Migrate existing Claude Code hook implementations to `@goodfoot/claude-code-hooks` TypeScript SDK.

## Workflow

### 1. Fork and Clone

Load `github:github` skill, then fork and clone the target repository:

```typescript
// Fork repository
const { data: fork } = await octokit.rest.repos.createFork({ owner, repo });

// Clone to /home/node/hook-repos
git clone https://github.com/${yourUsername}/${repo}.git /home/node/hook-repos/${repo}
```

**Multiple hook projects:** If `reports/hook-repositories.typescript.csv` exists, read it to find all internal paths for each repository. The CSV has columns: `repo`, `internal_path`, and other metadata.

```bash
# Parse CSV for all internal paths in a repository
internal_paths=$(grep "^${repo}," reports/hook-repositories.typescript.csv | cut -d',' -f2)

# Process each internal path
for internal_path in $internal_paths; do
  # internal_path is relative to repo root (e.g., "packages/hooks", "plugins/claude-hooks")
  hook_dir="/home/node/hook-repos/${repo}/${internal_path}"

  # Run analysis and conversion for this hook project
  # ... steps 2-7 below apply to each internal_path
done
```

When a repository has multiple internal paths, **process all of them** before moving to the next repository. Each internal path is treated as a separate hook project with its own:
- `hooks.json` configuration
- `hooks/src/` TypeScript sources
- `package.json` build script
- Status reporting entry

### 2. Analyze Candidacy

Find all hooks.json files and assess conversion feasibility. See [references/candidate-analysis.md](references/candidate-analysis.md).

**Good candidates have:**
- Bash scripts or inline commands (not complex service daemons)
- Standard hook types (PreToolUse, PostToolUse, Stop, etc.)
- Logic translatable to TypeScript
- Existing test suite

**Status reporting:** For hook projects assessed as "concerning" or "poor candidate", append the result to `reports/hook-repositories-status.csv` with columns:
- `repo` - Repository name
- `directory` - Full path to hook project directory
- `internal_path` - Relative path within repo (empty if root-level)
- `status` - One of: `good`, `concerning`, `poor_candidate`

```bash
# Create CSV if it doesn't exist
mkdir -p reports
if [ ! -f reports/hook-repositories-status.csv ]; then
  echo "repo,directory,internal_path,status" > reports/hook-repositories-status.csv
fi

# Append result (internal_path may be empty for root-level hooks)
echo "${repo},${directory},${internal_path},${status}" >> reports/hook-repositories-status.csv
```

**Skip concerning/poor candidates** and continue to the next repository. Only proceed with conversion for "good" candidates.

### 3. Load SDK Skill

```
Load the "claude-code-hooks:sdk" skill for implementation guidance.
```

### 4. Install Package

```bash
cd /home/node/hook-repos/${repo}
npm install @goodfoot/claude-code-hooks --save-dev
```

Add build script to package.json:
```json
{
  "scripts": {
    "build:hooks": "claude-code-hooks -i 'hooks/src/*.ts' -o './hooks.json'"
  }
}
```

### 5. Convert Hooks

For each hook in the existing hooks.json:

1. Create TypeScript source in `hooks/src/`
2. Use appropriate factory: `preToolUseHook`, `postToolUseHook`, `stopHook`, etc.
3. Use output builders: `preToolUseOutput`, `postToolUseOutput`, etc.
4. Preserve original functionality exactly

See [references/conversion-patterns.md](references/conversion-patterns.md) for patterns.

**Critical rules:**
- Use `logger` from context, never `console.log`
- Use `export default` for each hook
- Use snake_case for wire format (`tool_input`, `tool_name`)
- Build after every change: `npm run build:hooks`

### 6. Validate with Subagent

Spawn a subagent for full validation:

```
Use Task tool with subagent_type="general-purpose" to:
1. Run existing test suite (npm test, pytest, bun test, etc.)
2. Create hook-specific tests in test/hooks/
3. Verify each converted hook matches original behavior
4. Report any failures with details
```

**Subagent prompt template:**
```
Validate hook migration in /home/node/hook-repos/${repo}:

1. Run existing tests: [detect and run test command]
2. For each hook in hooks/src/*.ts:
   - Create test in test/hooks/ using vitest
   - Test with mock inputs matching original hook's matchers
   - Verify output structure matches SDK spec
3. Build hooks: npm run build:hooks
4. Report: tests passed/failed, coverage, any issues

Return structured summary of validation results.
```

### 7. Push Changes

After validation passes:

```bash
cd /home/node/hook-repos/${repo}
git add -A
git commit -m "Migrate hooks to @goodfoot/claude-code-hooks SDK

- Convert bash/command hooks to TypeScript
- Add build:hooks script
- Add hook tests"
git push origin main
```

## Quick Reference

| Original Type | Factory | Output Builder |
|--------------|---------|----------------|
| Bash command | `preToolUseHook` | `preToolUseOutput` |
| Post-execution | `postToolUseHook` | `postToolUseOutput` |
| Stop/completion | `stopHook` | `stopOutput` |
| Session init | `sessionStartHook` | `sessionStartOutput` |
| User prompt | `userPromptSubmitHook` | `userPromptSubmitOutput` |
| Subagent stop | `subagentStopHook` | `subagentStopOutput` |
