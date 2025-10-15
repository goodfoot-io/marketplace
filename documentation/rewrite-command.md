# Rewrite Command: Evidence-Based Slash Command Enhancement

The `/rewrite:command` command iteratively refines slash commands through systematic testing and evidence-based modifications. It uses an integration chain analysis to understand all components involved in a command's execution.

## Core Concepts

### Integration Chain
Every slash command operates within an "integration chain" - the complete set of files that work together during execution:
- The slash command itself (`.claude/commands/...`)
- Referenced subagents (`.claude/agents/...`)  
- Utilities called by the command (`.devcontainer/utilities/...`)
- Files included via `@` references
- CLAUDE.md (prepended to all commands)

### Evidence-Based Modification
Each improvement cycle requires:
1. Creating three theories about potential improvements
2. Identifying supporting and contradicting evidence for each theory
3. Implementing the most promising theory
4. Testing and measuring results
5. Reverting if no improvement is shown

## Usage Examples

### Example 1: Improving a Code Review Command

**User Command:**
```
/rewrite:command
Run `/review:find-inconsistencies @reports/technical-data.md` and identify as many key inconsistencies from @reports/evaluation.md as possible. You may only edit @.claude/commands/review/find-inconsistencies.md
```

**Internally Evaluated Variables:**
- `[SLASH_COMMAND_EXAMPLE_USAGE]`: `/review:find-inconsistencies @reports/technical-data.md`
- `[SLASH_COMMAND]`: `/review:find-inconsistencies`
- `[EVALUATION]`: "identify as many key inconsistencies from @reports/evaluation.md as possible"
- `[EDITABLE_FILE_LIST]`: `@.claude/commands/review/find-inconsistencies.md`

**Process:**
1. Maps integration chain (finds command file, any subagents it uses, utilities, etc.)
2. Runs baseline test to see current performance
3. Develops theories limited to editing only the command file
4. Tests most promising modification
5. Continues iterating up to 10 cycles

### Example 2: Enhancing a Test Analysis Subagent

**User Command:**
```
/rewrite:command
Execute `/test:coverage @src/components` and ensure it finds all untested edge cases listed in @docs/test-requirements.md
```

**Internally Evaluated Variables:**
- `[SLASH_COMMAND_EXAMPLE_USAGE]`: `/test:coverage @src/components`
- `[SLASH_COMMAND]`: `/test:coverage`
- `[EVALUATION]`: "ensure it finds all untested edge cases listed in @docs/test-requirements.md"
- `[EDITABLE_FILE_LIST]`: Not specified (can edit entire integration chain)

**Process:**
1. Discovers full integration chain including:
   - `.claude/commands/test/coverage.md`
   - Any subagents referenced (e.g., `test-analysis`)
   - Utilities used for coverage analysis
2. Develops theories that could modify any file in the chain
3. Might improve the subagent's prompt, the command's structure, or both

### Example 3: Optimizing Security Scanner Performance

**User Command:**
```
/rewrite:command
Run `/security:scan --deep @packages/api` and match the vulnerability detection rate of the OWASP ZAP scanner output in @reports/zap-scan.json. Focus improvements on @.claude/agents/security-scanner.md and @.claude/commands/security/scan.md
```

**Internally Evaluated Variables:**
- `[SLASH_COMMAND_EXAMPLE_USAGE]`: `/security:scan --deep @packages/api`
- `[SLASH_COMMAND]`: `/security:scan`
- `[EVALUATION]`: "match the vulnerability detection rate of the OWASP ZAP scanner output in @reports/zap-scan.json"
- `[EDITABLE_FILE_LIST]`: `@.claude/agents/security-scanner.md @.claude/commands/security/scan.md`

### Example 4: Improving Producer-Consumer Analysis

**User Command:**
```
/rewrite:command
Test `/review:producer-consumer @.claude/commands/project/create.md` against the Key Inconsistencies section of @reports/output-mismatch.md. Achieve detection of all 6 documented issues.
```

**Internally Evaluated Variables:**
- `[SLASH_COMMAND_EXAMPLE_USAGE]`: `/review:producer-consumer @.claude/commands/project/create.md`
- `[SLASH_COMMAND]`: `/review:producer-consumer`
- `[EVALUATION]`: "Test against the Key Inconsistencies section of @reports/output-mismatch.md. Achieve detection of all 6 documented issues."
- `[EDITABLE_FILE_LIST]`: Not specified

**Expected Iterations:**
```
Iteration 1: Baseline - Detects 2/6 issues
- Theory A: Add explicit format checking → Implement
- Result: Now detects 4/6 issues ✓

Iteration 2: From 4/6 baseline
- Theory B: Improve section order validation → Implement  
- Result: Now detects 5/6 issues ✓

Iteration 3: From 5/6 baseline
- Theory C: Add line number format validation → Implement
- Result: Achieves 6/6 detection ✓
```

## Key Features

1. **Integration Chain Analysis**: Automatically maps all files involved in command execution
2. **Evidence-Based Theories**: Requires supporting/contradicting evidence for each theory
3. **Flexible Edit Scope**: Can specify exactly which files may be modified
4. **Systematic Reversion**: Automatically reverts changes that don't improve performance
5. **Utility Integration**: Leverages `/utilities:map-integration-chain` for comprehensive analysis

## Input Format Guidelines

### Minimal Input
```
/rewrite:command
/command:name @input-file achieves [specific measurable goal]
```

### With Edit Constraints
```
/rewrite:command
/command:name @input-file achieves [goal]. Only edit @specific-file.md
```

### With Multiple Allowed Edits
```
/rewrite:command
/command:name @input-file achieves [goal]. You may edit @file1.md @file2.md @file3.md
```

## Best Practices

1. **Specific Goals**: Use measurable criteria like "detect all 6 issues" rather than "improve detection"
2. **Reference Targets**: Point to specific sections or files containing expected outputs
3. **Constrain Edits**: When appropriate, limit which files can be modified to focus improvements
4. **Provide Context**: Include example inputs that demonstrate the current limitations

## Common Evaluation Criteria

- **Detection Parity**: "Find all issues identified in [reference]"
- **Performance Matching**: "Match the analysis quality of [benchmark]"
- **Feature Completeness**: "Support all use cases documented in [spec]"
- **Accuracy Improvement**: "Reduce false positives to match [baseline]"

## Troubleshooting

**Command times out during testing:**
- The command uses up to 600-second timeouts for complex analyses
- Consider breaking down complex commands into smaller, focused components

**No improvement after multiple iterations:**
- Check if the evaluation criteria is too broad or vague
- Ensure the reference/target provides concrete, achievable goals
- Consider expanding the editable file list

**Theories lack evidence:**
- Review the integration chain to understand all components
- Examine similar successful commands for patterns
- Check if the command has access to necessary tools

## Advanced Usage

### Chaining Improvements
First improve a subagent, then the command that uses it:
```
/rewrite:command
/security:scan @test-app matches @pen-test-report.md. Only edit @.claude/agents/security-scanner.md

/rewrite:command  
/security:scan @test-app matches @pen-test-report.md. Only edit @.claude/commands/security/scan.md
```

### Comparative Improvement
Improve one command to match another's capabilities:
```
/rewrite:command
Make `/analyze:new @src` as thorough as `/analyze:legacy @src` based on @reports/analysis-comparison.md
```