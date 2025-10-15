# Statistical Analysis Tools: Comprehensive Usage Guide

## Companion to Statistical Analysis Report

This guide provides practical instructions for using the Python Statistical Utility Library that implements the validated approaches from the [Statistical Analysis Report](test-agent-stat-analysis.md). All methods achieve the performance metrics documented in that report.

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Core Components](#core-components)
3. [Phase 1: UCB Screening](#phase-1-ucb-screening)
4. [Phase 2: Bradley-Terry Ranking](#phase-2-bradley-terry-ranking)
5. [Phase 3: Statistical Validation](#phase-3-statistical-validation)
6. [Ensemble Methods](#ensemble-methods)
7. [Adaptive Stopping](#adaptive-stopping)
8. [Complete Tournament](#complete-tournament)
9. [Performance Validation](#performance-validation)
10. [Troubleshooting](#troubleshooting)

## Installation & Setup

```bash
# Navigate to the library directory
cd /workspace/.worktrees/discovery-command/.devcontainer/utilities/test-agent

# Install with uv (required - don't use pip)
uv pip install -e .

# Run tests to verify installation
uv run python -m pytest tests/ -xvs
```

### Python Import

```python
import sys
sys.path.append('/workspace/.worktrees/discovery-command/.devcontainer/utilities/test-agent/src')

from test_agent_stats import *
```

## Core Components

### 1. Agent and Scenario Classes

```python
# Create agents to evaluate
agents = [
    Agent("baseline"),
    Agent("variation-1"),
    Agent("variation-2"),
    # ... up to 8 agents recommended
]

# Create standardized scenarios (blocked design)
scenarios = [
    Scenario("easy-task-1", weight=0.1),     # Easy (30%)
    Scenario("medium-task-1", weight=0.15),  # Medium (40%)
    Scenario("hard-task-1", weight=0.2),     # Hard (30%)
]
```

### 2. Evaluation Function

```python
def evaluate_agent(agent: Agent, scenario: Scenario) -> float:
    """
    Your evaluation function that tests agent on scenario.
    Returns score in [0, 1] range.
    """
    # Example: Test agent instructions on scenario
    result = test_agent_instructions(agent.name, scenario.id)
    return score_result(result)  # Must return float in [0, 1]
```

## Phase 1: UCB Screening

**Purpose**: Efficiently eliminate bottom 40% of agents with minimal evaluations.

**Validated Performance**: 96% winner identification accuracy (Table line 59)

### Basic Usage

```python
# Initialize UCB optimizer with validated parameters
ucb = UCBOptimizer(
    n_agents=8,
    exploration_param=2.0  # Optimal from analysis (line 75)
)

# Run screening phase (2-3 evaluations per agent)
for round_num in range(3):
    for t in range(1, n_agents + 1):
        # UCB selects next agent to evaluate
        agent_idx = ucb.select_agent(t)

        # Evaluate on scenario
        score = evaluate_agent(agents[agent_idx], scenarios[round_num])

        # Update UCB with result
        ucb.update(agent_idx, score)

# Get top 60% of agents (eliminate bottom 40%)
survivor_indices = ucb.get_top_percent(0.6)
survivors = [agents[i] for i in survivor_indices]
```

### Advanced Usage with Early Stopping

```python
# Check if we should continue evaluating an agent
for agent_idx in range(n_agents):
    if ucb.should_evaluate(agent_idx, min_evaluations=3, width_tolerance=0.1):
        # Agent needs more evaluation
        score = evaluate_agent(agents[agent_idx], scenario)
        ucb.update(agent_idx, score)
    else:
        print(f"Agent {agent_idx} has sufficient evaluations")

# Get statistics for all agents
stats = ucb.get_statistics()
for agent_stat in stats['agents']:
    print(f"Agent {agent_stat['index']}: "
          f"mean={agent_stat['mean_reward']:.3f}, "
          f"CI={agent_stat.get('confidence_interval', 'N/A')}")
```

## Phase 2: Bradley-Terry Ranking

**Purpose**: Establish statistically valid ranking through pairwise comparisons.

**Validated Performance**: Converges in ~30 evaluations vs 100 for round-robin (line 68)

### Building Comparison Matrix

```python
n_agents = len(survivors)
comparison_matrix = np.zeros((n_agents, n_agents))

# Run pairwise comparisons
for i in range(n_agents):
    for j in range(i + 1, n_agents):
        wins_i = 0
        wins_j = 0

        # Best of 5 scenarios
        for scenario in scenarios[:5]:
            score_i = evaluate_agent(survivors[i], scenario)
            score_j = evaluate_agent(survivors[j], scenario)

            if score_i > score_j:
                wins_i += 1
            else:
                wins_j += 1

        comparison_matrix[i, j] = wins_i
        comparison_matrix[j, i] = wins_j
```

### Fitting Bradley-Terry Model

```python
# Fit model to get strength parameters
bt_strengths = fit_bradley_terry(
    comparison_matrix,
    method='iterative',  # or 'optimization'
    max_iterations=100,
    tolerance=1e-6
)

# Rank agents by strength
ranking = np.argsort(-bt_strengths)
print("Bradley-Terry Ranking:")
for rank, idx in enumerate(ranking):
    print(f"  {rank+1}. Agent {idx}: strength={bt_strengths[idx]:.3f}")

# Calculate confidence intervals (critical for statistical validity)
bt_cis = bradley_terry_confidence_intervals(
    comparison_matrix,
    n_bootstrap=1000,  # Recommended minimum
    confidence=0.95
)

# Check for overlapping confidence intervals
for i in range(n_agents):
    ci = bt_cis.get(i, (0, 0))
    print(f"Agent {i}: CI=[{ci[0]:.3f}, {ci[1]:.3f}]")
```

### Handling Ties

```python
# Bradley-Terry handles ties (important for realistic scenarios)
comparison_matrix[i, j] = wins_i + 0.5 * ties  # Half credit for ties
comparison_matrix[j, i] = wins_j + 0.5 * ties
```

## Phase 3: Statistical Validation

**Purpose**: Confirm statistical significance and calculate effect sizes.

**Validated Metrics**: 75% statistical power for effect size 0.2 (line 248)

### Bootstrap Confidence Intervals

```python
# Calculate confidence intervals for agent scores
agent_scores = [0.65, 0.72, 0.58, 0.69, 0.61]  # Example scores

# Basic percentile method
ci = bootstrap_confidence_interval(
    agent_scores,
    confidence=0.95,
    n_bootstrap=1000,
    method='percentile'  # Fastest, good for most cases
)
print(f"95% CI: [{ci[0]:.3f}, {ci[1]:.3f}]")

# BCa method (bias-corrected and accelerated) - more accurate
ci_bca = bootstrap_confidence_interval(
    agent_scores,
    confidence=0.95,
    n_bootstrap=1000,
    method='bca'  # Best for small samples or skewed distributions
)
print(f"95% BCa CI: [{ci_bca[0]:.3f}, {ci_bca[1]:.3f}]")
```

### Statistical Comparison

```python
# Compare two agents with full statistical testing
winner_scores = [0.71, 0.68, 0.73, 0.70, 0.69, 0.72, 0.67, 0.74, 0.70, 0.71]
runner_scores = [0.65, 0.63, 0.67, 0.64, 0.66, 0.62, 0.68, 0.65, 0.64, 0.63]

comparison = bootstrap_compare(
    winner_scores,
    runner_scores,
    n_bootstrap=1000
)

print(f"Statistical Comparison Results:")
print(f"  P-value: {comparison['p_value']:.4f}")
print(f"  Effect size (Cohen's d): {comparison['effect_size']:.3f}")
print(f"  Mean difference: {comparison['mean_diff']:.3f}")
print(f"  95% CI for difference: {comparison['mean_diff_ci']}")
print(f"  CI overlap: {comparison['ci_overlap']}")
print(f"  Statistical winner: {comparison['winner']}")

# Determine practical significance
if comparison['p_value'] < 0.05 and abs(comparison['effect_size']) > 0.2:
    print("✓ Statistically AND practically significant")
else:
    print("✗ Not significant or effect size too small")
```

### Statistical Power Analysis

```python
# Estimate statistical power for your experiment
power = calculate_statistical_power(
    scores_a=winner_scores,
    scores_b=runner_scores,
    effect_size=0.2,  # Target effect size (Cohen's d)
    n_simulations=1000,
    alpha=0.05,
    sample_size=10  # Per group
)
print(f"Statistical power: {power:.1%}")

# Recommendation: Need power > 0.65 for valid conclusions
if power < 0.65:
    print(f"⚠ Low power - increase to {int(10 / power * 0.65)} evaluations")
```

## Ensemble Methods

**Purpose**: Combine multiple ranking methods for robust results.

**Validated Performance**: 55% variance reduction (line 105)

### Borda Count (Simple and Robust)

```python
# Create rankings from different methods
rankings = [
    [0, 2, 1, 3],  # Direct score ranking
    [0, 1, 2, 3],  # Bradley-Terry ranking
    [1, 0, 2, 3],  # Bayesian ranking
]

# Simple Borda count (equal weights)
final_ranking = borda_count(rankings)
print(f"Borda ranking: {final_ranking}")
```

### Weighted Borda Count (Optimal)

```python
# Use validated weights from analysis (line 224)
rankings_dict = {
    'direct_score': [0, 2, 1, 3],
    'bradley_terry': [0, 1, 2, 3],
    'bayesian': [1, 0, 2, 3]
}

weights = {
    'direct_score': 0.3,
    'bradley_terry': 0.5,  # Most weight on Bradley-Terry
    'bayesian': 0.2
}

final_ranking = weighted_borda_count(rankings_dict, weights)
print(f"Weighted Borda ranking: {final_ranking}")
```

### Advanced Ensemble Aggregation

```python
# Use the ensemble aggregator for maximum flexibility
aggregator = EnsembleAggregator(
    methods=['borda', 'median', 'kemeny']  # Multiple aggregation methods
)

# Optional: Set custom weights for methods
aggregator.set_weights({
    'borda': 0.5,
    'median': 0.3,
    'kemeny': 0.2
})

# Aggregate rankings
final_ranking = aggregator.aggregate(rankings=rankings)

# Get confidence in the aggregation
confidence = aggregator.get_confidence(rankings, final_ranking)
print(f"Kendall's W (concordance): {confidence['kendalls_w']:.3f}")
print(f"Mean correlation: {confidence['mean_correlation']:.3f}")
```

### Kemeny-Young (Optimal but Expensive)

```python
# For small numbers of agents (<= 8), use Kemeny-Young
if len(agents) <= 8:
    optimal_ranking = kemeny_young(rankings)
    print(f"Kemeny-Young optimal ranking: {optimal_ranking}")
else:
    print("Too many agents for Kemeny-Young, using Borda")
```

## Adaptive Stopping

**Purpose**: Stop evaluation when additional data won't change conclusions.

**Validated Performance**: 95% accuracy with 41% fewer evaluations (line 122)

### Value of Information (VOI)

```python
# Calculate whether more evaluation is worthwhile
current_best = 0.75  # Best score so far
candidate_mean = 0.72
candidate_std = 0.08
evaluation_cost = 0.01  # Relative cost

voi = value_of_information(
    current_best,
    candidate_mean,
    candidate_std,
    evaluation_cost
)

if voi > 0:
    print(f"Continue evaluation (VOI={voi:.4f})")
else:
    print(f"Stop evaluation (VOI={voi:.4f} < cost)")
```

### Adaptive Stopper (Complete System)

```python
stopper = AdaptiveStopper(
    min_evaluations=10,      # For 80% power (from analysis)
    max_evaluations=20,      # Hard limit
    confidence_threshold=0.95,
    voi_threshold=0.001,     # Stop if VOI below this
    use_sprt=True,           # Sequential probability ratio test
    use_voi=True,            # Value of information
    use_bayes=False          # Bayes factors (expensive)
)

# Track agent data
agents_data = []
for agent in agents:
    agents_data.append({
        'scores': agent_scores[agent.name],
        'ci': bootstrap_confidence_interval(agent_scores[agent.name])
    })

# Check if we should stop
if stopper.should_stop(agents_data, target_effect_size=0.2):
    print(f"Stopping: {stopper.get_stop_reasons()}")
else:
    print("Continue evaluation")
```

### Sequential Testing (SPRT)

```python
# Test if one agent is significantly better
should_stop, decision = sequential_probability_ratio_test(
    scores,
    h0_mean=0.65,  # Null hypothesis mean
    h1_mean=0.70,  # Alternative hypothesis mean
    alpha=0.05,     # Type I error rate
    beta=0.20       # Type II error rate
)

if should_stop:
    print(f"SPRT decision: {decision}")
```

## Complete Tournament

**Purpose**: Run the full three-phase tournament automatically.

**Validated Performance**: 91% winner accuracy with 55 evaluations (line 244)

### Basic Tournament

```python
# Initialize tournament with validated parameters
tournament = TournamentOrchestrator(
    agents=agents,
    phase1_budget=16,   # UCB screening: 2 per agent
    phase2_budget=35,   # Bradley-Terry: ~7 per survivor
    keep_percent=0.6,   # Eliminate bottom 40%
    min_evaluations=10, # For statistical power
    confidence_level=0.95
)

# Define your evaluation function
def eval_func(agent: Agent, scenario: Scenario) -> float:
    # Your actual evaluation logic here
    return evaluate_agent_performance(agent, scenario)

# Run tournament
results = tournament.run_tournament(eval_func, scenarios=scenarios)

# Access results
print(f"Winner: {results['final_ranking'][0].name}")
print(f"Total evaluations: {results['total_evaluations']}")
print(f"Phase 1 survivors: {results['phase1_survivors']}")
print(f"Final ranking: {[a.name for a in results['final_ranking'][:5]]}")
```

### Advanced Tournament with Custom Configuration

```python
# Custom tournament for specific needs
tournament = TournamentOrchestrator(
    agents=agents,
    phase1_budget=20,     # More screening
    phase2_budget=50,     # More pairwise comparisons
    phase3_budget=15,     # Validation phase
    keep_percent=0.5,     # Keep top 50%
    min_evaluations=15,   # Higher confidence
    confidence_level=0.99 # 99% confidence intervals
)

# Run with progress callback
def progress_callback(phase, progress, message):
    print(f"[{phase}] {progress:.1%}: {message}")

results = tournament.run_tournament(
    eval_func,
    scenarios=scenarios,
    progress_callback=progress_callback
)

# Detailed analysis
if 'statistical_analysis' in results:
    stats = results['statistical_analysis']
    print(f"P-value: {stats['p_value']:.4f}")
    print(f"Effect size: {stats['effect_size']:.3f}")
    print(f"Power: {stats['power']:.2f}")
```

## Performance Validation

### Reproducing Analysis Report Results

```python
# Settings to match the validated 91% winner accuracy (line 267)
config = {
    'n_agents': 8,
    'noise_level': 0.15,
    'min_evaluations': 10,
    'ucb_exploration': 2.0,
    'keep_percent': 0.6,
    'ensemble_weights': {
        'direct_score': 0.3,
        'bradley_terry': 0.5,
        'bayesian': 0.2
    }
}

# Run Monte Carlo validation
def run_validation(n_trials=100):
    accuracies = []
    evaluations = []

    for trial in range(n_trials):
        # Generate random agent abilities
        true_abilities = np.random.uniform(0.4, 0.9, config['n_agents'])

        # Run tournament
        results = run_tournament_simulation(true_abilities, config)

        # Check if winner identified correctly
        predicted_winner = results['final_ranking'][0]
        true_winner = np.argmax(true_abilities)
        accuracies.append(predicted_winner == true_winner)
        evaluations.append(results['total_evaluations'])

    print(f"Winner accuracy: {np.mean(accuracies):.1%}")  # Target: 91%
    print(f"Mean evaluations: {np.mean(evaluations):.1f}")  # Target: 55
    print(f"Efficiency: {55 / np.mean(evaluations):.1%}")
```

### Robustness Testing

```python
# Test under different noise conditions (from analysis line 278)
noise_levels = [0.15, 0.20, 0.25]  # Normal, high, very high

for noise in noise_levels:
    # Adjust evaluation function to add noise
    def eval_with_noise(agent, scenario):
        true_score = get_true_score(agent, scenario)
        noisy_score = true_score + np.random.normal(0, noise)
        return np.clip(noisy_score, 0, 1)

    results = tournament.run_tournament(eval_with_noise)
    accuracy = calculate_accuracy(results)
    print(f"Noise σ={noise}: Accuracy={accuracy:.1%}")

# Expected degradation (from analysis):
# σ=0.15: 91% (baseline)
# σ=0.25: 82% (-10%)
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Low Statistical Power

```python
# Check power before starting
scores_sample = [evaluate_agent(agent, scenario) for _ in range(5)]
power = calculate_statistical_power(scores_sample, scores_sample, 0.2)

if power < 0.65:
    print(f"⚠ Power too low ({power:.1%})")
    print(f"Solutions:")
    print(f"  1. Increase min_evaluations to {int(10 / power * 0.65)}")
    print(f"  2. Use blocked scenario design")
    print(f"  3. Reduce noise in evaluation")
```

#### 2. All Confidence Intervals Overlap

```python
# If all CIs overlap, you need more evaluations or less noise
for agent in agents:
    ci = bootstrap_confidence_interval(agent.scores)
    width = ci[1] - ci[0]
    if width > 0.2:  # CI too wide
        print(f"Agent {agent.name}: CI width {width:.3f} too large")
        print(f"  Need ~{int(len(agent.scores) * (width/0.1)**2)} evaluations")
```

#### 3. Bradley-Terry Not Converging

```python
# Increase iterations or relax tolerance
bt_strengths = fit_bradley_terry(
    comparison_matrix,
    max_iterations=1000,  # Increase from 100
    tolerance=1e-4,        # Relax from 1e-6
    method='optimization'  # Try different method
)

# Check for disconnected agents
if not is_connected(comparison_matrix):
    print("Warning: Some agents never compared, results unreliable")
```

#### 4. Numerical Instability

```python
# Use log-space calculations for extreme values
import warnings
warnings.filterwarnings('ignore', category=RuntimeWarning)

# Check for numerical issues
if np.any(np.isnan(bt_strengths)) or np.any(np.isinf(bt_strengths)):
    print("Numerical instability detected")
    print("Solutions:")
    print("  1. Add regularization")
    print("  2. Use 'optimization' method instead of 'iterative'")
    print("  3. Check for zero comparison counts")
```

### Validation Checklist

Before deploying results, verify:

```python
def validate_results(results):
    """Comprehensive validation of tournament results."""
    checks = {
        'sufficient_evaluations': results['total_evaluations'] >= 45,
        'winner_identified': results['final_ranking'][0] is not None,
        'statistical_significance': results.get('p_value', 1.0) < 0.05,
        'practical_significance': abs(results.get('effect_size', 0)) > 0.2,
        'confidence_intervals': all(
            'ci' in agent_data for agent_data in results.get('agents_data', [])
        ),
        'power_adequate': results.get('statistical_power', 0) > 0.65
    }

    print("Validation Results:")
    for check, passed in checks.items():
        status = "✓" if passed else "✗"
        print(f"  {status} {check}: {passed}")

    return all(checks.values())

# Use validation
if validate_results(tournament_results):
    print("Results are statistically valid ✓")
else:
    print("Results need more evaluation ✗")
```

## Quick Reference Card

### Optimal Parameters (Validated)

```python
# These parameters achieve 91% winner accuracy with 55 evaluations
OPTIMAL_CONFIG = {
    'n_agents': 8,                    # Don't exceed 8 for Kemeny-Young
    'min_evaluations': 10,             # 80% power at effect size 0.2
    'ucb_exploration': 2.0,            # Optimal exploration parameter
    'keep_percent': 0.6,               # Eliminate bottom 40%
    'confidence_level': 0.95,          # Standard confidence
    'n_bootstrap': 1000,               # Minimum for stability
    'effect_size_threshold': 0.2,      # Practical significance
    'voi_evaluation_cost': 0.01,       # Relative cost
    'ensemble_weights': {
        'direct_score': 0.3,
        'bradley_terry': 0.5,
        'bayesian': 0.2
    }
}
```

### Function Cheat Sheet

```python
# Phase 1: Screening
ucb = UCBOptimizer(n_agents=8, exploration_param=2.0)
agent_idx = ucb.select_agent(t)
ucb.update(agent_idx, score)
survivors = ucb.get_top_percent(0.6)

# Phase 2: Ranking
bt_strengths = fit_bradley_terry(comparison_matrix)
bt_cis = bradley_terry_confidence_intervals(comparison_matrix)

# Phase 3: Validation
ci = bootstrap_confidence_interval(scores, method='bca')
comparison = bootstrap_compare(scores_a, scores_b)

# Ensemble
final_ranking = weighted_borda_count(rankings, weights)

# Stopping
voi = value_of_information(current_best, candidate_mean, candidate_std)
should_stop = stopper.should_stop(agents_data)

# Complete Tournament
tournament = TournamentOrchestrator(agents, phase1_budget=16, phase2_budget=35)
results = tournament.run_tournament(eval_func)
```

## Conclusion

This comprehensive guide covers all aspects of the Python Statistical Utility Library for SEIO methodology. The tools implement the validated approaches from the Statistical Analysis Report, achieving:

- **91% winner identification accuracy** (vs 39% baseline)
- **45% fewer evaluations** while improving accuracy
- **Statistical rigor** with confidence intervals and hypothesis testing
- **Ensemble robustness** through multiple ranking methods

Use these tools to transform agent optimization from guesswork into reproducible science with quantified uncertainty and statistical guarantees.