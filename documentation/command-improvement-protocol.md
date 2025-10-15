# Command Improvement Protocol

This protocol describes how to iteratively improve slash commands, subagents, and utilities to achieve detection parity with reference analyses.

## Input Format

```
/improve-command
Target: Key Inconsistencies section of @reports/output-mismatch.md
Inputs: @.claude/commands/project/create.md
Command: @.claude/commands/review/producer-consumer.md
Goal: All 6 key inconsistencies from the target
```

This will run: `/review:producer-consumer @.claude/commands/project/create.md`

Input examples:
- Target: "Security vulnerabilities from pen test report"
- Inputs: "src/**/*.ts --exclude tests" (arguments for the command)
- Command: "@.claude/agents/security-scanner.md" (source file to improve)
- Goal: "All OWASP Top 10 vulnerabilities identified"

## Improvement Process

### 1. Initial Analysis
- Extract specific findings from the reference analysis
- Run baseline test to measure current detection rate
- Calculate detection parity score (found patterns / total patterns)

### 2. Theory Development (Per Cycle)
Create 3 theories about why patterns are missed:
- Theory A: Missing explicit instructions for specific patterns
- Theory B: Too much/too little context in prompt
- Theory C: Wrong level of abstraction or focus

### 3. Testing Protocol
For each theory:
1. Modify the command based on the theory
2. Determine which tools the command needs, disallow all others
3. Test using exact same inputs with appropriate timeout
4. Measure detection rate
5. Keep changes if improved, revert if not

### 4. Refinement Principles
- **Prune aggressively**: Remove sections that don't contribute
- **Be specific**: Explicit pattern checks often outperform generic instructions  
- **Focus on structure**: Complete template/example extraction is crucial
- **Avoid overfitting**: Don't use exact phrases from test cases

### 5. Performance Tracking
Document results like:
```
Cycle 1: Baseline 2/6 patterns found
- Theory A (add spec awareness): 4/6 ✓ Keep
- Theory B (verbose instructions): 3/6 ✗ Revert  
- Theory C (remove boilerplate): 4/6 → No change

Cycle 2: Starting from 4/6
...
```

## Common Patterns That Work

1. **Explicit extraction instructions**: "Extract the COMPLETE template, not snippets"
2. **Comparison matrices**: Side-by-side structure comparisons
3. **Focus on beginnings**: "Pay attention to what comes immediately after [header]"
4. **Check contradictions**: "Compare documentation vs implementation"
5. **Multiple passes**: Structure extraction → Comparison → Validation

## Anti-patterns to Avoid

1. **Over-generalization**: Trying to handle every possible case
2. **Excessive verbosity**: Long instructions often perform worse
3. **Vague directives**: "Find issues" vs "Check if X matches Y"
4. **Complex report formats**: Simple output formats work better

## Example Improvement Session

```bash
# Cycle 1: Test baseline
# First check what tools the command uses, then disallow all others
claude -p "/review/producer-consumer ..." --disallowedTools "Bash, Edit, MultiEdit, Write, TodoWrite"
# Results: Found 2/6 issues

# Cycle 1, Theory A: Add specification awareness
# Edit command to look for canonical spec documents
# Retest: Found 4/6 issues ✓

# Cycle 2: Starting from improved version
# Theory D: Add template completeness check
# Edit to emphasize COMPLETE template extraction
# Retest: Found 5/6 issues ✓

# Continue until diminishing returns...
```

## Final Optimization

After 3-5 cycles:
1. Combine best elements from successful theories
2. Remove any remaining unnecessary sections
3. Create final streamlined version
4. Verify detection parity achieved (finding all reference patterns)
5. Test on different inputs to ensure no overfitting

## Success Definition

**Detection Parity**: Your improved command finds all the same specific issues/patterns that the reference analysis identified. This means matching the analytical capabilities demonstrated in the target output, not just finding "similar" issues.