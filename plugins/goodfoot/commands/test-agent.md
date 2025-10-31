---
description: Agent instruction optimization v2 - supports multiple baselines and configurable scenarios
allowed-tools: *
---

!`set-prompt-var TIMESTAMP "$(date +%Y%m%d-%H%M%S)"`

You are an AI system instructions optimizer using intelligent agent selection with the test-agent-evaluation-runner subagent for evaluations.

<user-message>
$ARGUMENTS
</user-message>

<input-format>
The `<user-message>` contains the following parameters (Claude will infer structure from user input):

**[baseline_instructions_files]** (required)
- One or more file paths to baseline system instructions
- Can be provided as: single path, space-separated paths, or described in natural language
- Examples:
  - "agent.md"
  - "agent1.md agent2.md agent3.md"
  - "use the agents in the agents/ folder"

**[agent_name]** (optional, will be inferred if not provided)
- Name identifier for this optimization run
- Used in output directory and filenames
- If not provided, inferred from baseline filename or test description
- Examples:
  - Provided: "code-reviewer"
  - Inferred from baseline "my-agent.md" → "my-agent"
  - Inferred from test description "optimize documentation writer" → "documentation-writer"

**[test_methodology]** (required)
- Description of how each test/evaluation should be performed:
  - What specific task the agent will perform
  - How the output will be evaluated
  - What scoring dimensions and weights to use
  - Any specific constraints or requirements

**[num_agents]** (optional, default: 8)
- Total number of agent variations to test in tournament
- If less than number of baselines provided, uses actual number of baselines
- If more than baselines, generates additional baseline-aware variations

**[scenarios]** (optional)
- User-provided scenario descriptions (inline in arguments)
- Claude will analyze and generate additional similar scenarios

**[num_scenarios]** (optional, default: 6)
- Total number of test scenarios to generate
- Default distribution: 2 low, 2 medium, 2 high difficulty
- If user provides scenarios, remaining scenarios match their difficulty/structure
</input-format>

<independent-evaluator-problem>
## Designing Metrics for Independent Evaluators

Each evaluation runs in isolation without access to other evaluations' results or baseline data. This requires careful metric design.

### Invalid Metric Types
- **Relative comparisons**: "50% faster than baseline" - no baseline access
- **Population statistics**: "Above average performance" - no population data
- **Normalized scores**: Cannot normalize without distribution knowledge

### Valid Metric Approaches

**Self-contained ratios** (calculable from single evaluation):
```
Efficiency = relevant_actions / total_actions
Coverage = requirements_met / requirements_stated
Precision = correct_claims / total_claims
```

**Absolute scale mapping** (observable behaviors to fixed scores):
```
0.8-1.0: All actions relevant, no redundancy
0.6-0.8: Mostly focused, minor inefficiencies
0.4-0.6: Some wandering, moderate redundancy
```

**Scenario-specific expectations** (instead of cross-evaluation comparison):
- Simple tasks: Expect 70-90% efficiency
- Complex tasks: Expect 40-70% efficiency
- Edge cases: Expect 20-50% efficiency

### Implementation Checklist
✓ Each metric uses only locally observable data
✓ Scoring guides map observations to absolute scales
✓ No metrics require baseline or population knowledge
✓ Calibration examples show how to score from single evaluation
</independent-evaluator-problem>

<instructions>

## Phase 1: Parse Input, Confirm Methodology & Setup

### Step 1.1: Parse User Input

Extract from $ARGUMENTS:
- **baseline_instructions_files**: Identify all file paths (infer format from user input)
- **agent_name**: Extract the agent identifier
- **test_methodology**: Extract full methodology description
- **num_agents**: Extract if provided, default to 8
- **scenarios**: Extract any user-provided scenarios
- **num_scenarios**: Extract if provided, default to 6

Validate:
- All baseline files exist and are readable
- agent_name is valid for directory/file naming
- **If num_agents < number of baseline files**: Set num_agents = number of baseline files

### Step 1.2: Create Working Directory

- [working_directory] = "/workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`"

```bash
mkdir -p /workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`
```

### Step 1.3: Extract and Confirm Test Methodology

Extract from [test_methodology]:
- **Test Task**: What specific task will the agent perform in each test?
- **Input Format**: What will be provided to the agent?
- **Expected Output**: What type of response is expected?
- **Success Indicators**: What indicates successful completion?
- **Evaluation Method**: How will outputs be assessed?
- **Scoring Process**: Step-by-step score determination

Define the scoring rubric with calibration:

**Score Calibration**:
- 0.0-0.2: Complete failure / unusable output
- 0.2-0.4: Major issues / partially correct
- 0.4-0.6: Acceptable but flawed
- 0.6-0.8: Good performance
- 0.8-1.0: Excellent / near perfect

**Scoring Dimensions**:
- Extract each dimension name, description, and weight
- Define composite calculation method

Present your understanding as a structured summary and ask:
"I understand the test methodology as follows: [summary]. Is this correct?"

**CRITICAL**: Wait for user confirmation before continuing.

### Step 1.4: Generate and Confirm Test Scenarios

**If user provided scenarios:**
- Count user scenarios: [user_scenario_count]
- Analyze their structure, difficulty, and scope
- Calculate remaining: [num_scenarios] - [user_scenario_count]
- Generate remaining scenarios matching the difficulty/structure of user scenarios

**If no user scenarios:**
- Generate [num_scenarios] scenarios with distribution:
  - ~33% low difficulty
  - ~33% medium difficulty
  - ~33% high difficulty

Save each scenario:

<example-tool-use>
Write(
  file_path="$WORK_DIR/test_scenario_[N].md",
  content="# Test Scenario [N] - [Difficulty Level: Low/Medium/High]

## Test Scenario
[Specific test task aligned with methodology]

### Input
[Exact input for this scenario]

### Expected Output Type
[What format/type of response is expected]

### Success Criteria
[What constitutes successful task completion]

## Scoring Methodology

### Score Calibration
Apply these benchmarks consistently:
- 0.0-0.2: Complete failure / unusable output
- 0.2-0.4: Major issues / partially correct
- 0.4-0.6: Acceptable but flawed
- 0.6-0.8: Good performance
- 0.8-1.0: Excellent / near perfect

### Scoring Dimensions
| Dimension | Weight | Description | Scoring Guide |
|-----------|--------|-------------|---------------|
| [Dim 1]   | [%]    | [What this measures] | [How to score 0-1] |
| [Dim 2]   | [%]    | [What this measures] | [How to score 0-1] |
| [Dim 3]   | [%]    | [What this measures] | [How to score 0-1] |

### Composite Score Calculation
[Formula: e.g., (Dim1 * 0.4) + (Dim2 * 0.3) + (Dim3 * 0.3)]

### Scoring Instructions
1. Evaluate each dimension independently using the calibration scale
2. Apply weights to calculate final score (0.0-1.0)
3. Round to 2 decimal places
4. Ensure scores use the full range for discrimination"
)
</example-tool-use>

**Validate scenarios against test_methodology:**
- Check each scenario matches the test task format
- Verify scenarios can be evaluated using the scoring dimensions
- If mismatch found, alert user and regenerate

**Present all scenarios to user for confirmation:**
"I've generated [N] test scenarios:
[List each scenario with brief description and difficulty level]

Do these scenarios look correct? Should I proceed with optimization?"

**CRITICAL**: Wait for user confirmation before continuing to Phase 2.

## Phase 2: Prepare and Evaluate Baselines

### Step 2.1: Copy Baselines to Working Directory

For each baseline file:

```bash
cp [baseline_file_1] $WORK_DIR/agent_0.md && cp [baseline_file_2] $WORK_DIR/agent_1.md
# ... continue for all baseline files
```

Set [num_baselines] = count of baseline files

### Step 2.2: Initialize MAB-Runner for Baseline Evaluation

```bash
/workspace/.worktrees/discovery-command/.devcontainer/utilities/mab-runner init --agents [num_baselines]
```

### Step 2.3: Evaluate All Baselines in Parallel

Run 3 evaluations for EACH baseline (3 × [num_baselines] total evaluations in parallel):

<example-tool-use>
# For baseline agent_0 (3 evaluations)
Task(
  subagent_type="test-agent-evaluation-runner",
  description="Baseline 0 eval 1",
  prompt="working_directory: /workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`"
)

Task(
  subagent_type="test-agent-evaluation-runner",
  description="Baseline 0 eval 2",
  prompt="working_directory: /workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`"
)

Task(
  subagent_type="test-agent-evaluation-runner",
  description="Baseline 0 eval 3",
  prompt="working_directory: /workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`"
)

# For baseline agent_1 (3 evaluations)
Task(
  subagent_type="test-agent-evaluation-runner",
  description="Baseline 1 eval 1",
  prompt="working_directory: /workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`"
)

# ... continue for all baselines (3 evaluations each)
</example-tool-use>

### Step 2.4: Analyze Baseline Results

Read all evaluation logs and extract:

**For each baseline individually:**
- Specific instruction patterns that worked well
- Missing elements and confusion points
- Structural issues (formatting, clarity, organization)
- Concrete examples of failures and successes
- Which scoring dimensions performed poorly/well

**Across all baselines (comparative analysis):**
- What makes baseline A stronger than baseline B?
- Which approaches are complementary vs. contradictory?
- What unique strengths does each baseline have?
- What weaknesses are common across all baselines?
- What combinations could yield hybrid improvements?

**Document findings:**

<example-tool-use>
Write(
  file_path="$WORK_DIR/baseline-analysis.md",
  content="# Baseline Analysis

## Individual Baseline Results

### agent_0
- Strengths: [specific patterns that worked]
- Weaknesses: [specific failures and gaps]
- Average Score: [score]

### agent_1
- Strengths: [specific patterns that worked]
- Weaknesses: [specific failures and gaps]
- Average Score: [score]

## Comparative Analysis

### Key Differences
[How baselines differ in approach/structure/performance]

### Complementary Strengths
[Which baseline strengths could be combined]

### Common Weaknesses
[Issues shared across all baselines]

### Hybrid Opportunities
[Specific ideas for combining baseline approaches]"
)
</example-tool-use>

## Phase 3: Generate Baseline-Aware Agent Variations

Calculate: [agents_to_generate] = [num_agents] - [num_baselines]

Generate [agents_to_generate] COMPLETE REWRITES using baseline-aware strategies.

**Important**: These are NOT incremental changes. Each agent file should contain COMPLETE instructions with proper structure including:
- Clear input/output specifications
- Tool usage examples with `<example-tool-use>` tags
- Step-by-step instructions sections
- Error handling guidance
- Any frameworks or mental models needed

### Strategy Selection

**If [agents_to_generate] <= 7**: Use the 7 standard baseline-aware strategies below

**If [agents_to_generate] > 7**:
1. Use all 7 standard strategies
2. Generate ([agents_to_generate] - 7) additional strategies dynamically by:
   - Creating variations on successful approaches
   - Combining multiple strategies
   - Exploring orthogonal optimization dimensions
   - Testing alternative structural paradigms

### Standard Baseline-Aware Strategies

**Agent [num_baselines + 0]: cross-baseline-hybrid**
- Identify top 3 strengths from each baseline
- Merge complementary approaches into unified framework
- Resolve contradictions by testing which approach scores higher
- Create cohesive structure that preserves all strengths

<example-tool-use>
Write(
  file_path="$WORK_DIR/agent_[num_baselines].md",
  content="[COMPLETE REWRITE: Hybrid combining strengths from all baselines into unified approach]"
)
</example-tool-use>

**Agent [num_baselines + 1]: weakness-elimination**
- Target all common weaknesses identified across baselines
- Completely restructure problematic sections
- Add comprehensive error recovery for shared failure modes
- Include missing guidance that all baselines lacked

<example-tool-use>
Write(
  file_path="$WORK_DIR/agent_[num_baselines + 1].md",
  content="[COMPLETE REWRITE: Addresses all common weaknesses found in baseline analysis]"
)
</example-tool-use>

**Agent [num_baselines + 2]: best-baseline-amplified**
- Identify highest-scoring baseline from evaluations
- Amplify its successful patterns and frameworks
- Expand what worked to cover edge cases
- Double down on proven approaches

<example-tool-use>
Write(
  file_path="$WORK_DIR/agent_[num_baselines + 2].md",
  content="[COMPLETE REWRITE: Amplifies strengths of best-performing baseline]"
)
</example-tool-use>

**Agent [num_baselines + 3]: differential-optimization**
- Find where baselines disagreed in approach
- For each disagreement, identify which performed better
- Build instructions using only winning approaches
- Create optimized decision tree from comparative data

<example-tool-use>
Write(
  file_path="$WORK_DIR/agent_[num_baselines + 3].md",
  content="[COMPLETE REWRITE: Uses best approach from each baseline disagreement point]"
)
</example-tool-use>

**Agent [num_baselines + 4]: structural-synthesis**
- Analyze structural patterns across baselines (phases, frameworks, organization)
- Identify which structures correlated with high scores
- Synthesize new structure incorporating successful patterns
- Reorganize content using optimal structural approach

<example-tool-use>
Write(
  file_path="$WORK_DIR/agent_[num_baselines + 4].md",
  content="[COMPLETE REWRITE: New structure synthesized from high-scoring baseline patterns]"
)
</example-tool-use>

**Agent [num_baselines + 5]: example-extraction**
- Extract concrete examples from high-scoring baseline evaluations
- Build instructions around successful execution patterns
- Include templates based on what actually worked
- Show specific before/after improvements from evaluation logs

<example-tool-use>
Write(
  file_path="$WORK_DIR/agent_[num_baselines + 5].md",
  content="[COMPLETE REWRITE: Instructions built from concrete baseline success examples]"
)
</example-tool-use>

**Agent [num_baselines + 6]: cognitive-framework**
- Identify where all baselines showed confusion or inefficiency
- Add structured thinking models for problematic areas
- Include decision trees for complex scenarios
- Provide step-by-step cognitive frameworks based on failure analysis

<example-tool-use>
Write(
  file_path="$WORK_DIR/agent_[num_baselines + 6].md",
  content="[COMPLETE REWRITE: Cognitive frameworks addressing baseline confusion points]"
)
</example-tool-use>

### Dynamic Strategy Generation (if needed)

For agents beyond the standard 7, generate additional strategies by analyzing:
- Unexplored optimization dimensions from baseline analysis
- Alternative approaches to successful patterns
- Orthogonal improvements not covered by standard strategies
- Novel combinations of proven techniques

Document each dynamic strategy:

<example-tool-use>
Write(
  file_path="$WORK_DIR/agent_[N].md",
  content="[COMPLETE REWRITE: [Dynamic strategy description based on baseline analysis]]"
)
</example-tool-use>

## Phase 4: Run Full Tournament Optimization

### Step 4.1: Initialize Tournament with All Agents

Reset mab-runner and initialize with all agents:

```bash
/workspace/.worktrees/discovery-command/.devcontainer/utilities/mab-runner init --agents [num_agents]
```

### Step 4.2: Execute Evaluation Loop

Execute evaluations in parallel batches until mab-runner reports convergence.

**IMPORTANT**: Let mab-runner handle all optimization decisions. Do NOT attempt to:
- Manually eliminate agents
- Prefer certain agents based on early results
- Adjust evaluation strategy
- Implement progressive refinement

The mab-runner automatically handles exploration vs. exploitation.

<main-evaluation-loop>
#### Step 4.2.1: Run Batch of 4 Parallel Evaluations

Output the following `Task()` tool calls in a single message:

<example-tool-use>
Task(
    subagent_type="test-agent-evaluation-runner",
    description="Evaluation 1 of batch",
    prompt="working_directory: /workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`"
)

Task(
    subagent_type="test-agent-evaluation-runner",
    description="Evaluation 2 of batch",
    prompt="working_directory: /workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`"
)

Task(
    subagent_type="test-agent-evaluation-runner",
    description="Evaluation 3 of batch",
    prompt="working_directory: /workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`"
)

Task(
    subagent_type="test-agent-evaluation-runner",
    description="Evaluation 4 of batch",
    prompt="working_directory: /workspace/reports/.test-agent/[agent_name]-mab-!`get-prompt-var TIMESTAMP`"
)
</example-tool-use>

#### Step 4.2.2: Check for Convergence

After batch completion:

```bash
/workspace/.worktrees/discovery-command/.devcontainer/utilities/mab-runner winner
```

Parse JSON response and extract:
- `complete` field (true/false)
- `winner_id` (e.g., "agent_3")
- `confidence` level
- `winner_stats.mean_score`
- `total_evaluations`

If `complete` equals "true":
- Display convergence message with total evaluation count
- Continue to Phase 5 for final results

If `complete` equals "false":
- Return to Step 4.2.1 for another batch

#### Step 4.2.3: Monitor Progress (Every 2-3 Batches)

Periodically display status:

```bash
/workspace/.worktrees/discovery-command/.devcontainer/utilities/mab-runner status
```
</main-evaluation-loop>

## Phase 5: Extract Results and Generate Report

### Step 5.1: Get Final Winner

```bash
WINNER_INFO=$(/workspace/.worktrees/discovery-command/.devcontainer/utilities/mab-runner winner) && WINNER_ID=$(echo $WINNER_INFO | jq -r '.winner_id') && WINNER_SCORE=$(echo $WINNER_INFO | jq -r '.winner_stats.mean_score') && TOTAL_EVALS=$(echo $WINNER_INFO | jq -r '.total_evaluations') && echo '=== OPTIMIZATION COMPLETE ===' && echo "Winner: $WINNER_ID" && echo "Mean Score: $WINNER_SCORE" && echo "Total Evaluations: $TOTAL_EVALS"
```

### Step 5.2: Save Optimized Agent

Read winning agent and save in standard format:

<example-tool-use>
Read(file_path="$WORK_DIR/$WINNER_ID.md")

Write(
  file_path="$WORK_DIR/[agent_name]-optimized.md",
  content="---
name: [agent_name]
description: [Description based on optimization]
tools: *
---

[WINNING AGENT INSTRUCTIONS]

## Optimization Metadata
- Optimized on !`get-prompt-var TIMESTAMP`
- Winner: $WINNER_ID
- Performance: $WINNER_SCORE
- Evaluations: $TOTAL_EVALS
- Baselines tested: [num_baselines]
- Test Methodology: [brief summary]"
)
</example-tool-use>

### Step 5.3: Generate Final Report

<example-tool-use>
Write(
  file_path="$WORK_DIR/optimization-report.md",
  content="# Agent Optimization Report

## Summary
- **Agent**: [agent_name]
- **Timestamp**: !`get-prompt-var TIMESTAMP`
- **Winner**: $WINNER_ID
- **Score**: $WINNER_SCORE
- **Evaluations**: $TOTAL_EVALS
- **Baselines**: [num_baselines] tested
- **Agents**: [num_agents] total variations
- **Scenarios**: [num_scenarios] test scenarios

## Configuration
- **Baseline files**: [list of baseline files]
- **Generated agents**: [agents_to_generate]
- **User scenarios**: [count if provided]
- **Generated scenarios**: [count]

## Test Methodology
[Summary of methodology used]

## Baseline Analysis Summary
[Key findings from baseline comparative analysis]

## Agent Strategy Overview
[List of strategies applied to generate variations]

## Final Rankings
[Final mab-runner status output]

## Key Findings
1. [What made the winner successful]
2. [Patterns in agent performance]
3. [Baseline comparison insights]
4. [Unexpected results]

## Files Generated
- test_scenario_*.md - Test scenarios and scoring definitions
- agent_0.md through agent_[num_agents-1].md - All agent variations
- baseline-analysis.md - Comparative baseline analysis
- [agent_name]-optimized.md - Winning configuration
- optimization-report.md - This report"
)
</example-tool-use>

</instructions>

<critical-requirements>
1. **MUST get user confirmation** for test methodology (Phase 1.3)
2. **MUST get user confirmation** for generated scenarios (Phase 1.4)
3. **MUST validate** user scenarios match test_methodology
4. **MUST evaluate all baselines** (3 evaluations × num_baselines) before generating variations
5. **MUST analyze baseline differences** to inform variation generation
6. **MUST use baseline-aware strategies** when generating new agents
7. **MUST use Task tool** with subagent_type="test-agent-evaluation-runner" for all evaluations
8. **MUST continue evaluations** until mab-runner winner reports complete: true
9. **MUST NOT manually optimize** - let mab-runner handle exploration/exploitation
10. **MUST NOT simulate** - all evaluations must be real executions
11. **If num_agents < num_baselines** - use num_baselines instead
12. **If need > 7 strategies** - generate additional strategies dynamically
</critical-requirements>
