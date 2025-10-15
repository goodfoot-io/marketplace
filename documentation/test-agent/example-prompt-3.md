/test-agent-v2 `/workspace/.worktrees/discovery-command/.claude/agents/documenter.md` / documenter / Optimize the documenter agent to produce reports that serve as effective starting points for understanding codebases.

## Testing Methodology

### Step 1: Generate Documentation
Have the `documenter` agent create architectural documentation for different parts of the codebase using the test-agent MCP tool (e.g., `packages/models`, `packages/mcp-servers/src/codebase.ts`, `packages/website/server`).

<example-tool-use>
mcp__test-agent__task(
  description="`packages/models` documentation",
  prompt="Create architectural documentation for `packages/models`",
  system_instructions_file="[working_directory]/$AGENT_ID.md"
)
</example-tool-use>

### Step 2: Verify Output
After each documenter run:
- Confirm the report file was created
- Note the full path to the documentation file
- Check the file is not empty

### Step 3: Test with General-Purpose Agent
Spawn a `general-purpose` agent using the `mcp__test-agent__task` tool with:
- The documentation provided as context via `@/full/path/to/report.md` in the prompt
- A complex architectural question about the documented component
- Freedom to use the documentation as a starting point and explore further with any tools needed

#### Example General-Purpose Agent Invocation:

<example-tool-use>
mcp__test-agent__task(
  description="Test documentation with architectural question",
  prompt=`
    You have been provided with architectural documentation for packages/models as a starting point:
    @/workspace/reports/project-state/models.md

    Using this documentation as context, along with any tools you need, answer this question:

    "How does the User model handle authentication and session management? What are the key architectural decisions around user state persistence and security?"

    Please investigate thoroughly and provide:
    1. A comprehensive answer to the question
    2. Note what information came from the documentation vs your own investigation
    3. Report how many tools you used and which ones
    4. Record your start and end timestamps
  `
)
</example-tool-use>


### Step 4: Evaluate Quality with documenter-evaluator

After the general-purpose agent completes its response, use the `documenter-evaluator` agent to score the output using the `mcp__test-agent__task` tool:

```
mcp__test-agent__task(
  description="Evaluate general-purpose agent response",
  system_instructions_file="/workspace/.worktrees/discovery-command/.claude/agents/documenter-evaluator.md",
  prompt=`
    ## Evaluation Request

    [AGENT_OUTPUT]:
    <paste the complete general-purpose agent response here>

    [ORIGINAL_QUESTION]:
    "How does the User model handle authentication and session management? What are the key architectural decisions around user state persistence and security?"

    [DOCUMENTATION_PATH]:
    /workspace/reports/project-state/models.md

    [TOOL_LOGS]:
    <paste the tool usage logs from the general-purpose agent execution>

    [EXECUTION_TIME]:
    <total seconds taken by general-purpose agent>

    Please evaluate this general-purpose agent output according to your evaluation framework and provide:
    1. Overall score (0.00-1.00)
    2. Dimension breakdown with evidence
    3. Specific examples supporting each score
    4. Improvement recommendations
  `
)
```

The documenter-evaluator will provide a structured evaluation report with:
- **Overall Score**: Composite score from 0.00-1.00
- **Dimension Scores**:
  - Answer Accuracy (30% weight)
  - Hallucination Prevention (25% weight)
  - Tool Efficiency (25% weight)
  - Time to Insight (20% weight)
- **Evidence Analysis**: Verification of claims with evidence levels
- **Cognitive Assessment**: Quality of reasoning and documentation usage
- **Temporal Stability Check**: Consistency with calibration baselines

### Step 5: Compare Documenter Variations

For each documenter variation being tested:
1. Generate documentation using the variation
2. Run the general-purpose agent with the same architectural question
3. Evaluate using documenter-evaluator to get standardized scores
4. Compare scores across variations to identify the optimal approach

Test with TWO types of questions per variation:
1. **Well-documented areas** - Information that should be covered in good architectural documentation
2. **Edge cases or missing areas** - Information that might not be documented (e.g., asking about User authentication when documenting a logging module)

### Step 6: Aggregate Scores

For each documenter variation, calculate:
- **Mean Overall Score**: Average across all test scenarios
- **Consistency**: Standard deviation of scores
- **Dimension Performance**: Which dimensions improved/degraded
- **Edge Case Handling**: Performance on missing information scenarios

### Step 7: Iterate and Optimize

Create multiple variations of the documenter instructions testing different approaches:
- Information density (comprehensive vs minimal)
- Structural organization (flat vs hierarchical)
- Architectural focus (decisions vs implementation)
- Coverage reporting (what's included vs what's missing)
- Navigation aids (indices, cross-references, summaries)

## Success Criteria

The optimal documenter variation should achieve:
- **Overall Score > 0.80** on well-documented area questions
- **Overall Score > 0.60** on edge case questions
- **Low score variance** (< 0.15 standard deviation) across different scenarios
- **High Tool Efficiency scores** (> 0.75) indicating documentation reduces redundant exploration
- **Consistent scoring** across multiple evaluations of the same output

## Implementation Notes

- Use the current codebase (`/workspace/.worktrees/discovery-command`) as test material
- Test at least 3 different codebase sections
- Create at least 5 instruction variations
- Run documenter-evaluator at least twice per scenario to verify scoring consistency
- Save all evaluation reports for meta-analysis of scoring stability
- Track which documenter variations produce the highest and most consistent scores
