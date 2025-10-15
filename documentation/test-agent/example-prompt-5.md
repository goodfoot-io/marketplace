/test-agent-v2 `/workspace/.worktrees/discovery-command/.claude/agents/documenter.md` / documenter / Optimize the documenter agent to produce reports that serve as effective starting points for understanding codebases.

## Testing Methodology

### Test Task
The documenter agent will generate architectural documentation for a specified codebase component. A general-purpose agent will then use this documentation to answer complex architectural questions. Success is measured by how effectively the documentation enables rapid, accurate understanding.

### Input Format
Each test scenario will provide:
- A codebase component path (e.g., `packages/models`, `packages/mcp-servers/src/codebase.ts`)
- The instruction to create architectural documentation
- A complex architectural question to test documentation effectiveness

### Expected Output
- Documenter: A comprehensive architectural report saved to `/workspace/reports/project-state/[component].md`
- General-purpose agent: A detailed answer using the documentation as context
- Combined execution time and tool usage metrics

### Success Indicators
- Documentation provides high leverage (>50% of claims answered directly from docs)
- Architectural questions answered accurately with evidence
- Clear distinction between documented vs discovered information
- Efficient exploration patterns (minimal redundant tool use)

## Evaluation Method

### Step 1: Generate Documentation
Execute the documenter agent on the target component:

<example-tool-use>
mcp__test-agent__task(
  description="Generate documentation for component",
  prompt="Create architectural documentation for `packages/models`",
  system_instructions_file="[working_directory]/$AGENT_ID.md"
)
</example-tool-use>

Capture the documentation file path from the output.

### Step 2: Test Documentation Effectiveness
Execute a general-purpose agent with the documentation as context:

<example-tool-use>
mcp__test-agent__task(
  description="Test documentation with architectural question",
  prompt=`
    You have been provided with architectural documentation as a starting point:
    @[documentation_file_path]

    Using this documentation as context, along with any tools you need, answer:
    "How does the User model handle authentication and session management? What are the key architectural decisions around user state persistence and security?"

    Please provide:
    1. A comprehensive answer to the question
    2. Note what information came from the documentation vs your own investigation
    3. Report how many tools you used and which ones
    4. Record your start and end timestamps
  `,
  system_instructions_file="/workspace/.worktrees/discovery-command/.claude/agents/general-purpose.md"
)
</example-tool-use>

### Step 3: Analyze and Score Output
Extract from the general-purpose agent's response and logs:
- The complete answer to the architectural question
- Tool usage logs showing which tools were used and when
- Distinction between documented vs discovered information
- Total execution time

## Scoring Methodology

### Score Calibration
Apply these benchmarks consistently across all evaluations:
- 0.0-0.2: Complete failure / unusable output
- 0.2-0.4: Major issues / partially correct
- 0.4-0.6: Acceptable but flawed
- 0.6-0.8: Good performance
- 0.8-1.0: Excellent / near perfect

### Scoring Dimensions

| Dimension | Weight | Description | Scoring Guide |
|-----------|--------|-------------|---------------|
| **Answer Accuracy** | 30% | Correctness and completeness of architectural understanding | 0.9-1.0: All verifiable facts correct, complete coverage<br>0.7-0.8: Minor gaps, core correct<br>0.5-0.6: Mixed accuracy, some errors<br>0.3-0.4: Significant errors<br>0.0-0.2: Fundamental misunderstandings |
| **Hallucination Prevention** | 25% | Accuracy of claims and explicit uncertainty handling | 0.9-1.0: All claims evidenced<br>0.7-0.8: Most claims verified<br>0.5-0.6: Some unverified claims<br>0.3-0.4: Multiple hallucinations<br>0.0-0.2: Extensive fabrication |
| **Documentation Leverage** | 25% | Ratio of doc-sourced claims to total claims | 0.8-1.0: ≥80% from documentation<br>0.6-0.8: 60-79% from documentation<br>0.4-0.6: 40-59% from documentation<br>0.2-0.4: 20-39% from documentation<br>0.0-0.2: <20% from documentation |
| **Exploration Efficiency** | 20% | Ratio of relevant tool uses to total tool uses | 0.8-1.0: ≥80% relevant (focused)<br>0.6-0.8: 60-79% relevant<br>0.4-0.6: 40-59% relevant<br>0.2-0.4: 20-39% relevant<br>0.0-0.2: <20% relevant (unfocused) |

### Composite Score Calculation
`(Answer Accuracy × 0.30) + (Hallucination Prevention × 0.25) + (Documentation Leverage × 0.25) + (Exploration Efficiency × 0.20)`

### Scoring Instructions

#### Evidence Level Classification
For each claim in the general-purpose agent's response, classify evidence:
- **Level 1** (Direct code reference with file:line): Weight 1.0x
- **Level 2** (Tool output confirmation): Weight 0.9x
- **Level 3** (Documentation statement): Weight 0.7x
- **Level 4** (Reasonable inference): Weight 0.5x
- **Level 5** (Assumption or guess): Weight 0.2x

#### Scoring Process
1. **Extract all factual claims** from the general-purpose agent's response
2. **Classify evidence level** for each claim based on logs and output
3. **Calculate dimension scores**:
   - **Answer Accuracy**: Verify claims against codebase reality
   - **Hallucination Prevention**: Check for unfounded statements
   - **Documentation Leverage**: Calculate `doc_sourced_claims / total_claims`
   - **Exploration Efficiency**: Calculate `relevant_tool_uses / total_tool_uses`
4. **Apply weights** to calculate final score (0.0-1.0)
5. **Round to 2 decimal places** for consistency

### Revised Metrics for Independent Evaluation

#### Documentation Leverage Calculation
```
Documentation Leverage = doc_sourced_claims / total_claims
```
Where:
- `doc_sourced_claims` = Claims answered directly from documentation (Level 3 evidence)
- `total_claims` = All factual claims in the answer

This metric is independently calculable by examining the agent's response and noting which claims cite the documentation versus require additional investigation.

#### Exploration Efficiency Calculation
```
Exploration Efficiency = relevant_tool_uses / total_tool_uses
```
Where:
- `relevant_tool_uses` = Tools that contributed facts to the final answer
- `total_tool_uses` = All tools used during exploration

A tool use is "relevant" if information from it appears in the final answer. This can be determined by matching tool outputs to claims in the response.

### Calibration Examples

#### High-Quality Response (Score: 0.85-1.0)
"The documentation indicates JWT authentication is used. Let me verify this in the code...
[reads auth.service.ts:45] Confirmed: jwt.sign() with 24hr expiry.
[reads sessions.table.sql] Sessions stored in PostgreSQL with user_id foreign key.
[grep Redis] Found Redis used for active session cache at cache.service.ts:23.
The User model implements JWT authentication with PostgreSQL persistence and Redis caching for performance."

**Scoring**:
- Accuracy=0.95 (L1 evidence)
- Hallucination=1.0 (all verified)
- Documentation Leverage=0.25 (1 of 4 claims from docs)
- Exploration Efficiency=1.0 (all 3 tools contributed to answer)
- **Composite**: (0.95×0.30) + (1.0×0.25) + (0.25×0.25) + (1.0×0.20) = 0.80

#### Medium-Quality Response (Score: 0.50-0.70)
"Documentation mentions User authentication. Searching for implementation...
[searches broadly across multiple directories]
[reads 10 files]
[greps for 'auth' 5 times]
Found auth files. Appears to use tokens of some kind, probably JWT based on imports.
Session storage unclear but likely database based on project structure."

**Scoring**:
- Accuracy=0.60 (partial correctness)
- Hallucination=0.65 (some assumptions)
- Documentation Leverage=0.20 (1 of 5 claims from docs)
- Exploration Efficiency=0.27 (4 of 15 tools were relevant)
- **Composite**: (0.60×0.30) + (0.65×0.25) + (0.20×0.25) + (0.27×0.20) = 0.45

#### Low-Quality Response (Score: 0.20-0.40)
"Based on standard practices, the User model likely uses OAuth2 with JWT tokens.
Session management typically involves Redis for performance in modern applications."

**Scoring**:
- Accuracy=0.30 (assumptions)
- Hallucination=0.20 (unfounded claims)
- Documentation Leverage=0.0 (no documentation referenced)
- Exploration Efficiency=0.0 (no tools used)
- **Composite**: (0.30×0.30) + (0.20×0.25) + (0.0×0.25) + (0.0×0.20) = 0.14

### Scenario Complexity Adjustments

For each scenario, define expected ranges based on complexity:

#### Simple/Well-Documented Areas
- Expected Documentation Leverage: 0.70-0.90
- Expected Exploration Efficiency: 0.70-1.0
- Score interpretation: Adjust expectations upward

#### Complex/Cross-Component Questions
- Expected Documentation Leverage: 0.40-0.70
- Expected Exploration Efficiency: 0.50-0.80
- Score interpretation: Standard expectations

#### Edge Cases/Implementation Details
- Expected Documentation Leverage: 0.20-0.50
- Expected Exploration Efficiency: 0.30-0.60
- Score interpretation: Adjust expectations downward

## Test Scenarios

Generate 5-10 test scenarios covering different aspects:

### Scenario Types
1. **Well-Documented Areas** - Information that should be in good architectural documentation
2. **Cross-Component Questions** - Requiring understanding of interactions
3. **Implementation Details** - Balance between architecture and code specifics
4. **Edge Cases** - Information that might not be documented
5. **System-Wide Patterns** - Architectural decisions affecting multiple components

### Example Test Questions
- "How does the User model handle authentication and session management?"
- "What are the data flow patterns between the API and database layers?"
- "How does error handling propagate through the middleware stack?"
- "What caching strategies are employed and why?"
- "How are real-time updates handled across the system?"

## Success Criteria

The optimal documenter variation should achieve:
- **Overall Score > 0.75** on well-documented area questions
- **Overall Score > 0.55** on edge case questions
- **Low score variance** (< 0.15 standard deviation) across scenarios
- **High Documentation Leverage** (> 0.60) on standard scenarios
- **Consistent scoring** across multiple evaluations of the same scenario

## Implementation Notes

- Use the current codebase (`/workspace/.worktrees/discovery-command`) as test material
- Test at least 3 different codebase sections for robustness
- Create diverse test questions that challenge different aspects
- Ensure scoring uses the full 0.0-1.0 range for discrimination
- Track which instruction patterns correlate with high scores
- Document specific examples of effective vs ineffective documentation
- All metrics must be independently calculable without shared state or baseline comparisons