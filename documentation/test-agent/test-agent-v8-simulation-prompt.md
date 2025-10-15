Simulate the test-agent tournament process using Thompson Sampling (Multi-Armed Bandit) to validate the optimization methodology. This simulation uses predetermined agent performance profiles instead of actual agent evaluations, allowing you to verify that Thompson Sampling correctly identifies the best performing agent with minimal evaluations.

The mab-runner executable is located at `/workspace/.worktrees/discovery-command/.devcontainer/utilities/mab-runner`

Do not create a Python or Bash script to encapsulate the simulation, instead use the bash tool to call the `mab-runner` command directly as it would be during an actual evaluation.

## Setup

### 1. Generate Random Agent Profiles

Create 8 simulated agents with varying performance levels. Each agent should have:
- A **mean performance score** between 0 and 1
- A **standard deviation** representing consistency (lower is more consistent)
- A **performance tier** for categorization

**Distribution across tiers:**
- 1 Excellent performer (mean: 0.78-0.85, low variance σ=0.05-0.08)
- 2 Good performers (mean: 0.71-0.77, low-medium variance σ=0.08-0.12)
- 2 Average performers (mean: 0.63-0.70, medium variance σ=0.12-0.15)
- 2 Weak performers (mean: 0.55-0.62, medium-high variance σ=0.15-0.18)
- 1 Very Weak performer (mean: 0.45-0.55, high variance σ=0.18-0.25)

**Process:**
1. Assign each agent (agent_0 through agent_7) to a random tier
2. Within each tier, randomly select the exact mean and standard deviation
3. Store these profiles for consistent scoring throughout the simulation
4. Display the generated profiles so you know which agents should perform best

### 2. Score Generation

When the tournament requires an agent evaluation score, generate a simulated score based on:

**Agent characteristics:**
- Use the agent's predetermined mean and standard deviation
- Sample from a normal distribution: score = N(mean, std_dev)
- Clip to [0, 1] range

**Scenario difficulty modifiers (for Phase 3 baseline evaluation):**
- Scenarios 1-3 (Standard): Agents perform at their baseline mean
- Scenarios 4-6 (Challenging): Agents perform 5-8% below their mean
- Scenarios 7-10 (Expert): Agents perform 10-15% below their mean

**MAB Tournament scoring (Phase 5):**
- Early evaluations (first 30): Add more noise (×1.5 std_dev) to simulate exploration uncertainty
- Later evaluations: Use normal noise to simulate exploitation phase

**Score calculation:**
1. Start with the agent's mean performance
2. If baseline evaluation (Phase 3), apply scenario difficulty modifier
3. Add Gaussian noise based on agent's std_dev
4. For MAB tournament, increase noise early to encourage exploration
5. Ensure final score stays within [0, 1] range

## Running the Simulation

### Implementation Instructions

1. **Follow the workflow in** @.claude/commands/test-agent-v8.md Phase 5
2. **Generate agent profiles** at the start using the setup instructions above
3. **Skip Phases 1-4** (no methodology confirmation, scenarios, baseline evaluation, or variation development needed)
4. **Replace agent evaluations** with simulated scores:
   - When test-agent-v8.md says to run `mcp__test-agent__task`, instead generate a score based on the agent's profile
   - Use the score generation formula from the Setup section above
   - All other commands remain exactly as specified in test-agent-v8.md

### Key Simulation Substitution

**Instead of Phase 5.2 Step 3** (Run the test):
- Don't execute `mcp__test-agent__task`
- Generate a simulated score using the agent's profile (mean, std_dev) and scenario difficulty
- Apply the scoring formula from Setup section 2 above

**Everything else**: Follow test-agent-v8.md Phase 5 exactly as written

## Thompson Sampling Specific Behavior

### Expected Convergence Pattern

Thompson Sampling should exhibit these phases:

1. **Exploration Phase (0-20 evaluations):**
   - Frequent switching between agents
   - Each agent tested at least once
   - High uncertainty in Beta distributions

2. **Focusing Phase (20-50 evaluations):**
   - Selection narrows to top 2-3 performers
   - Poor performers rarely selected
   - Beta distributions start separating

3. **Exploitation Phase (50+ evaluations):**
   - Primarily selects the best agent
   - Occasional exploration of close competitors
   - Clear winner emerges

### Convergence Criteria

The simulation should stop when:
- `mab-runner winner` returns `"complete": true`
- OR the best agent is selected 80%+ of the time in last 10 selections
- OR maximum evaluations (200) reached

## Verification and Reporting

After the tournament completes, generate a detailed report including:

### Initial Setup Report
- **Agent Profiles Table:** List all 8 agents with their:
  - Agent ID (agent_0 through agent_7)
  - Performance tier (Excellent/Good/Average/Weak/Very Weak)
  - Mean score (0-1 scale)
  - Standard deviation
  - Expected rank based on mean
- **Tier Distribution:** Confirm the distribution matches expectations

### MAB Tournament Results Report
- **Winner:** Which agent was selected by Thompson Sampling
- **Final Statistics:** From `mab-runner status`:
  - Total evaluations performed
  - Wins/evaluations per agent
  - Mean scores per agent
  - Convergence progress
- **Winner Details:** From `mab-runner winner`:
  - Winner ID and confidence
  - Winner's evaluation count and win rate
  - Confidence interval

### Thompson Sampling Analysis
- **Convergence Speed:** How many evaluations until convergence
- **Exploration Efficiency:** How quickly poor agents were eliminated
- **Selection Pattern:** Graph showing which agents were selected over time
- **Beta Distribution Evolution:** How agent beliefs evolved

### Performance Validation
- **Accuracy:** Did Thompson Sampling identify the agent with highest mean?
- **Efficiency Comparison:**
  - Total evaluations used
  - Compare to theoretical minimum (50 × 8 = 400 for exhaustive testing)
  - Compare to test-agent-stats three-phase approach
- **Robustness:** How it handled agents with similar means

### Edge Case Analysis
- **Close Competition:** If top 2-3 agents have means within 0.05
- **High Variance Impact:** How high-variance agents affected selection
- **Early Convergence:** If it stopped too early on a suboptimal agent

## Key Differences from test-agent-stats Simulation

1. **Single Algorithm:** Only Thompson Sampling, no phase switching
2. **Simpler State:** Beta distribution parameters instead of complex statistics
3. **Natural Convergence:** Algorithm self-balances exploration/exploitation
4. **Faster Resolution:** Should converge in 30-200 evaluations (vs 50-300+)
5. **Binary Success Model:** Scores > 0.5 are "wins" for Beta distribution updates

## Complete Simulation Workflow

1. **Generate Agent Profiles**
   - Create 8 agents with performance characteristics as described in Setup
   - Record each agent's mean, standard deviation, and tier
   - Display profiles to track expected outcomes

2. **Run test-agent-v8.md Phase 5**
   - Follow Phase 5.1 through 5.4 exactly as written
   - When Phase 5.2 says to run an agent test, generate a simulated score instead
   - Use all mab-runner commands exactly as specified

3. **Generate Report**
   - Compare winner to highest mean agent
   - Analyze convergence efficiency
   - Document selection patterns
   - Validate Thompson Sampling effectiveness

## Important Notes

- The test-agent-v8.md file contains the exact workflow, but we skip Phases 1-4 for simulation
- Focus on Phase 5 (Thompson Sampling Tournament) for the core simulation
- Use consistent agent profiles throughout to ensure fair comparison
- The Beta distribution in Thompson Sampling naturally handles the exploration/exploitation tradeoff
- Convergence should be faster than the three-phase statistical approach
- Random seed ensures reproducible results when debugging

## Expected Outcomes

- **Clear Winner:** Thompson Sampling should identify the Excellent performer
- **Efficiency:** Convergence in 50-150 evaluations for clear winner
- **Robustness:** May need 150-250 evaluations if top agents are very close
- **Poor Agent Elimination:** Weak/Very Weak agents tested < 5 times after initial exploration
- **Focused Exploitation:** 60-80% of evaluations on top 3 agents

This simulation validates that Thompson Sampling efficiently identifies high-performing agents with minimal evaluations, making it ideal for expensive evaluation scenarios.

*** 

Note numpy is not installed. Do not write a shell script to automate the evaluation loop, use the Bash tool to run `mab-runner` each time