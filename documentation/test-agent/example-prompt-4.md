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
- Documentation reduces redundant exploration by >50%
- Architectural questions answered accurately with evidence
- Clear distinction between documented vs discovered information
- Optimal tool usage patterns

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
| **Tool Efficiency** | 25% | Documentation effectiveness in reducing exploration | 0.9-1.0: >70% reduction in redundant exploration<br>0.7-0.8: 50-70% efficiency gain<br>0.5-0.6: 30-50% efficiency gain<br>0.3-0.4: 10-30% efficiency gain<br>0.0-0.2: No benefit or negative |
| **Time to Insight** | 20% | Speed of convergence to correct answer | 0.9-1.0: Rapid convergence, optimal path<br>0.7-0.8: Efficient, minor detours<br>0.5-0.6: Steady, some wandering<br>0.3-0.4: Slow, significant detours<br>0.0-0.2: Failed to converge |

### Composite Score Calculation
`(Answer Accuracy × 0.30) + (Hallucination Prevention × 0.25) + (Tool Efficiency × 0.25) + (Time to Insight × 0.20)`

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
   - Answer Accuracy: Verify claims against codebase reality
   - Hallucination Prevention: Check for unfounded statements
   - Tool Efficiency: Compare tools used vs optimal path
   - Time to Insight: Measure convergence speed
4. **Apply weights** to calculate final score (0.0-1.0)
5. **Round to 2 decimal places** for consistency

### Calibration Examples

#### High-Quality Response (Score: 0.85-1.0)
"The documentation indicates JWT authentication is used. Let me verify this in the code...
[reads auth.service.ts:45] Confirmed: jwt.sign() with 24hr expiry.
[reads sessions.table.sql] Sessions stored in PostgreSQL with user_id foreign key.
[grep Redis] Found Redis used for active session cache at cache.service.ts:23.
The User model implements JWT authentication with PostgreSQL persistence and Redis caching for performance."

**Scoring**: Accuracy=0.95 (L1 evidence), Hallucination=1.0 (all verified), Efficiency=0.90 (minimal exploration), Time=0.85 (quick convergence)

#### Medium-Quality Response (Score: 0.50-0.70)
"Documentation mentions User authentication. Searching for implementation...
[searches broadly across multiple directories]
Found auth files. Appears to use tokens of some kind, probably JWT based on imports.
Session storage unclear but likely database based on project structure."

**Scoring**: Accuracy=0.60 (partial correctness), Hallucination=0.65 (some assumptions), Efficiency=0.45 (excessive searching), Time=0.60 (slow progress)

#### Low-Quality Response (Score: 0.20-0.40)
"Based on standard practices, the User model likely uses OAuth2 with JWT tokens.
Session management typically involves Redis for performance in modern applications."

**Scoring**: Accuracy=0.30 (assumptions), Hallucination=0.20 (unfounded claims), Efficiency=0.30 (no documentation leverage), Time=0.40 (no real investigation)

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
- **Overall Score > 0.80** on well-documented area questions
- **Overall Score > 0.60** on edge case questions
- **Low score variance** (< 0.15 standard deviation) across scenarios
- **High Tool Efficiency** (> 0.75) indicating documentation reduces redundant exploration
- **Consistent scoring** across multiple evaluations of the same scenario

## Implementation Notes

- Use the current codebase (`/workspace/.worktrees/discovery-command`) as test material
- Test at least 3 different codebase sections for robustness
- Create diverse test questions that challenge different aspects
- Ensure scoring uses the full 0.0-1.0 range for discrimination
- Track which instruction patterns correlate with high scores
- Document specific examples of effective vs ineffective documentation