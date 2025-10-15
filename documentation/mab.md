# Multi-Armed Bandit Runner (mab-runner)

A simple, effective multi-armed bandit framework for agent optimization using proven bandit algorithms.

## Overview

mab-runner implements Thompson Sampling, a Bayesian multi-armed bandit algorithm that provides optimal performance for agent evaluation problems. Thompson Sampling uses probabilistic sampling from posterior distributions to naturally balance exploration vs exploitation, often outperforming deterministic methods in practice.

## Quick Start

```bash
# Initialize MAB tournament (uses Thompson Sampling by default)
./mab-runner init --agents 8

# Run optimization loop
while true; do
    agent_id=$(./mab-runner select | jq '.agent_id')
    score=$(evaluate_agent $agent_id)
    ./mab-runner update $agent_id $score

    # Check completion using jq
    status=$(./mab-runner winner)
    if [[ $(echo $status | jq '.complete') == "true" ]]; then
        winner=$(echo $status | jq -r '.winner_id')
        break
    fi
done

# Get final winner with statistics
result=$(./mab-runner winner --stats)
echo "Winner: $(echo $result | jq -r '.winner_id')"
```

## Commands

### init [OPTIONS]
Initialize a new MAB tournament with optimal defaults.

**Options:**
- `--agents, -a INTEGER` - Number of agents/arms (required)
- `--seed, -s INTEGER` - Random seed for reproducibility
- `--help` - Show this help message

**Output (JSON):**
```json
{
  "success": true,
  "agents": 8,
  "seed": 42
}
```

**Usage:**
```bash
result=$(./mab-runner init --agents 8)
echo "Initialized: $(echo $result | jq '.success')"
./mab-runner init --agents 5 --seed 42
```

### select
Select the next agent to evaluate using Thompson Sampling algorithm.

**Output:**
Agent ID as string (e.g., "agent_3")

**Usage:**
```bash
agent_id=$(./mab-runner select)
echo "Evaluate agent: $agent_id"
```

### update AGENT_ID SCORE
Update the bandit with an evaluation result.

**Arguments:**
- `AGENT_ID` - The agent that was evaluated (0-indexed)
- `SCORE` - Evaluation score (0.0 to 1.0)

**Output (JSON):**
```json
{
  "success": true,
  "agent_id": "agent_3",
  "score": 0.85,
  "total_evaluations": 45
}
```

**Usage:**
```bash
result=$(./mab-runner update agent_3 0.85)
echo "Updated: $(echo $result | jq '.success')"
```

### status
Show current tournament status with detailed agent statistics.

**Output (JSON):**
```json
{
  "total_evaluations": 45,
  "agent_stats": [
    {"agent_id": "agent_0", "evaluations": 8, "wins": 3, "mean_score": 0.62},
    {"agent_id": "agent_1", "evaluations": 6, "wins": 2, "mean_score": 0.58},
    {"agent_id": "agent_2", "evaluations": 7, "wins": 4, "mean_score": 0.71},
    {"agent_id": "agent_3", "evaluations": 12, "wins": 9, "mean_score": 0.85},
    {"agent_id": "agent_4", "evaluations": 5, "wins": 1, "mean_score": 0.45},
    {"agent_id": "agent_5", "evaluations": 4, "wins": 0, "mean_score": 0.32},
    {"agent_id": "agent_6", "evaluations": 2, "wins": 1, "mean_score": 0.68},
    {"agent_id": "agent_7", "evaluations": 1, "wins": 0, "mean_score": 0.23}
  ],
  "convergence_progress": 0.67,
  "estimated_evaluations_remaining": 25
}
```

**Usage:**
```bash
status=$(./mab-runner status)
echo "Progress: $(echo $status | jq '.convergence_progress')"
./mab-runner status | jq '.agent_stats[] | select(.mean_score > 0.7)'
```

### winner
Get the current winning agent and optimization status.

**Output always includes:**
- Current winner with confidence intervals
- Detailed winner statistics
- Completion status

**Output (JSON):**
```json
{
  "complete": false,
  "winner_id": "agent_3",
  "confidence": 0.78,
  "total_evaluations": 45,
  "winner_stats": {
    "evaluations": 8,
    "wins": 5,
    "mean_score": 0.78,
    "confidence_interval": [0.65, 0.91]
  }
}
```

**Complete Example (JSON):**
```json
{
  "complete": true,
  "winner_id": "agent_3",
  "confidence": 0.95,
  "total_evaluations": 67,
  "winner_stats": {
    "evaluations": 15,
    "wins": 12,
    "mean_score": 0.87,
    "confidence_interval": [0.82, 0.92]
  }
}
```

**Usage:**
```bash
# Check completion status (always includes confidence and stats)
status=$(./mab-runner winner)
if [[ $(echo $status | jq '.complete') == "true" ]]; then
    winner=$(echo $status | jq -r '.winner_id')
    echo "Winner found: $winner"
else
    echo "Still optimizing..."
fi

# Access winner statistics (always included)
status=$(./mab-runner winner)
echo $status | jq '.winner_stats'
```

### reset
Reset the tournament state.

**Output (JSON):**
```json
{
  "success": true,
  "message": "Tournament reset successfully"
}
```

**Usage:**
```bash
./mab-runner reset
```

## Algorithm

### Thompson Sampling
mab-runner uses the Thompson Sampling algorithm, a Bayesian approach that provides superior performance for agent evaluation problems.

- **Why Thompson Sampling?** Bayesian uncertainty quantification, often outperforms deterministic methods
- **Posterior Distribution:** Beta(α, β) for 0-1 scores (α = successes + 1, β = failures + 1)
- **Selection Method:** Samples from posterior distributions to balance exploration/exploitation
- **Best for:** Agent optimization with multiple evaluations, provides explicit confidence intervals
- **Configuration:** Uses uninformative Beta(1,1) prior, optimal for bounded score distributions

## Examples

### Basic Usage
```bash
# Initialize 8-agent tournament (uses Thompson Sampling by default)
./mab-runner init --agents 8

# Run until convergence
while true; do
    agent_id=$(./mab-runner select)  # Returns "agent_3", "agent_1", etc.
    score=$(evaluate_agent $agent_id)
    ./mab-runner update $agent_id $score

    # Check completion using JSON field
    status=$(./mab-runner winner)
    if [[ $(echo $status | jq '.complete') == "true" ]]; then
        winner=$(echo $status | jq -r '.winner_id')
        break
    fi
done

# Get final winner with confidence information (always included)
result=$(./mab-runner winner)
echo "Winner: $(echo $result | jq -r '.winner_id')"
```

### Detailed Monitoring
```bash
# Initialize with reproducible seed
./mab-runner init --agents 8 --seed 42

# Monitor progress
for i in {1..100}; do
    agent_id=$(./mab-runner select)
    score=$(evaluate_agent $agent_id)
    ./mab-runner update $agent_id $score

    if (( i % 10 == 0 )); then
        echo "Evaluation $i:"
        ./mab-runner status | jq '.agent_stats[] | {agent_id, mean_score, evaluations}'
        echo "---"
    fi

    # Check completion status
    status=$(./mab-runner winner)
    if [[ $(echo $status | jq '.complete') == "true" ]]; then
        echo "Optimization complete at evaluation $i!"
        winner=$(echo $status | jq -r '.winner_id')
        echo "Winner: agent $winner"
        break
    fi
done

# Get final results with statistics (always included)
echo "Final winner:"
./mab-runner winner | jq '.winner_stats'
```

## Configuration

### Default Parameters
- **Algorithm:** Thompson Sampling (fixed)
- **Prior Distribution:** Beta(1,1) (uninformative, optimal for 0-1 scores)
- **Minimum evaluations:** 50
- **Confidence level:** 0.95

### Environment Variables
- `MAB_SEED` - Random seed for reproducibility

## Performance Tips

1. **Pre-configured for reliability** - Thompson Sampling with Beta(1,1) prior is optimal for 0-1 scoring
2. **Monitor convergence** - check status regularly to see progress
3. **Use consistent scoring** - ensure evaluation scores are comparable
4. **Minimum evaluations** - at least 50 for reliable results
5. **Trust the algorithm** - Thompson Sampling provides explicit uncertainty quantification

## Exit Codes

- `0` - Success (optimization complete, winner returned)
- `1` - Error (invalid arguments, no tournament, etc.)
- `2` - Tournament not initialized
- `3` - Invalid agent ID
- `4` - Invalid score range
- `5` - Still optimizing (use winner command to check status)

## See Also

- `man mab-runner` - Full manual page
- `/examples/mab-runner/` - Usage examples
- `/docs/thompson-sampling.md` - Thompson Sampling algorithm background
