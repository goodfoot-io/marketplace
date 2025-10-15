# Command Improvement Tips

Accumulated wisdom from improvement sessions. Update only when disproven.

## What Works

### 1. Short Beats Long
20-40 line commands outperform 100+ line commands.
Always test if removing sections improves detection.

### 2. Be Explicit
✓ "Check if Problem Statement exists as first section"
✗ "Analyze format compliance"

### 3. Extract Everything
"Extract the COMPLETE template, not snippets" - this phrase alone improves detection by ~40%.

### 4. Check After Title
80% of format issues occur in what comes immediately after the title.
Always check: "What comes IMMEDIATELY after the title?"

### 5. Use Comparison Tables
```
Element | Spec Says | Producer Creates | Consumer Expects
```
Tables catch 2-3x more issues than narrative descriptions.

### 6. One Theory Per Test
Test theories individually to know what worked.

### 7. Track Numbers
"Found 4/6 issues" > "improved detection"

## What Fails

- **Kitchen Sink**: Adding every possible check → worse performance
- **Overfitting**: Using exact phrases from test case → fails on variations
- **Complex Reports**: Nested sections → wasted tokens
- **Generic Checks**: "Find any other issues" → noise

## Improvement Sequence

1. **Add Spec Awareness** (+2 issues detected)
   Find canonical specification documents.

2. **Emphasize Completeness** (+1-2 issues)
   Extract COMPLETE templates and structures.

3. **Add Specific Checks** (+1 issue)
   Punctuation, exact names, format patterns.

4. **Prune** (maintain gains, reduce size)
   Remove what didn't help.

## Stop When

- 100% detection achieved
- 3 theories in a row show no improvement
- Size reduced 50% with no detection loss

## Key Insight

Explicit instructions work because they eliminate inference.
The LLM's struggle with vague requirements mirrors human confusion.

