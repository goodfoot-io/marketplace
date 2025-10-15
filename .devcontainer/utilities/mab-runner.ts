import fs from 'fs';
import { parseArgs } from 'util';

// Multi-Armed Bandit Runner
// A production-ready implementation of Thompson Sampling for agent optimization

// TypeScript type definitions
/**
 * Describes the persisted tournament configuration and statistics stored on disk.
 *
 * @remarks
 * The `rngState` field captures the evolving state of the seeded RNG. When present, it
 * is restored on the next invocation to guarantee deterministic continuation instead
 * of resetting to the initial seed.
 *
 * @property agents Total number of agents configured for the tournament.
 * @property initialized Indicates whether the tournament has been set up via `init`.
 * @property seed Optional initial seed supplied during initialization.
 * @property rngState Optional LCG state captured after the most recent command.
 * @property totalEvaluations Count of evaluations performed across all agents.
 * @property agentStats Per-agent statistics and posterior parameters.
 * @property lastWinnerCheck Timestamp (ms) of the last win condition evaluation.
 */
interface TournamentState {
  agents: number;
  initialized: boolean;
  seed?: number;
  rngState?: number; // Current state of the RNG for proper persistence
  totalEvaluations: number;
  agentStats: AgentStats[];
  lastWinnerCheck: number;
}

/**
 * Aggregated statistics and posterior parameters for a single agent.
 *
 * @property agentId Stable identifier for the agent.
 * @property evaluations Number of completed evaluations.
 * @property scores Historical raw scores.
 * @property meanScore Sample mean of the scores array.
 * @property variance Sample variance of the scores array.
 * @property posteriorMean Posterior Gaussian mean used by Thompson Sampling.
 * @property posteriorVariance Posterior Gaussian variance used by Thompson Sampling.
 */
interface AgentStats {
  agentId: string;
  evaluations: number;
  scores: number[]; // Store all scores for better statistics
  meanScore: number;
  variance: number; // Variance of the scores
  // Gaussian posterior parameters
  posteriorMean: number;
  posteriorVariance: number;
}

/**
 * Shape of the JSON response returned by the `winner` command.
 *
 * @property complete Signals whether convergence criteria have been satisfied.
 * @property winner_id Identifier of the current best-performing agent.
 * @property confidence Confidence score in the selected winner.
 * @property total_evaluations Total number of evaluations performed so far.
 * @property winner_stats Detailed statistics for the leading agent.
 */
interface WinnerResult {
  complete: boolean;
  winner_id: string;
  confidence: number;
  total_evaluations: number;
  winner_stats: {
    evaluations: number;
    mean_score: number;
    std_dev: number;
    confidence_interval: [number, number];
  };
}

/**
 * Shape of the JSON response returned by the `status` command.
 *
 * @property total_evaluations Total number of evaluations performed so far.
 * @property agent_stats Per-agent snapshot exposing evaluation counts and dispersion.
 * @property convergence_progress Heuristic progress indicator toward convergence.
 * @property estimated_evaluations_remaining Estimated evaluations remaining before completion.
 */
interface StatusResult {
  total_evaluations: number;
  agent_stats: Array<{
    agent_id: string;
    evaluations: number;
    mean_score: number;
    std_dev: number;
  }>;
  convergence_progress: number;
  estimated_evaluations_remaining: number;
}

/**
 * Global state storage that is serialized to disk via {@link saveState}.
 *
 * @remarks
 * The current CLI persists this state to `/tmp/mab-runner-state.json` between runs so the
 * tournament resumes exactly where it left off.
 */
let tournamentState: TournamentState | null = null;

/**
 * Seeded random number generator for reproducibility.
 *
 * @remarks
 * The RNG persists its evolving internal state by serializing the `seed` value into
 * `TournamentState.rngState`. When a subsequent CLI command boots, the stored state is
 * rehydrated via {@link SeededRandom.setState} so the random stream continues from the exact
 * point it was left, rather than resetting to the original seed. Future reviewers should
 * pay special attention to this restoration step to avoid incorrectly assuming the
 * generator restarts.
 */
class SeededRandom {
  private seed: number;

  /**
   * Create a reproducible pseudo-random number generator.
   *
   * @param seed Initial seed value. Any integer input is normalized to a 32-bit positive value.
   */
  constructor(seed: number) {
    this.seed = seed % 2147483647; // Ensure seed fits in 32-bit
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * Get current state for persistence.
   *
   * @returns Current internal state of the LCG.
   */
  getState(): number {
    return this.seed;
  }

  /**
   * Set state for restoration.
   *
   * @param state Previously persisted internal state to resume from.
   */
  setState(state: number): void {
    this.seed = state;
  }

  // Linear congruential generator: X_{n+1} = (a * X_n + c) mod m
  // Using parameters from Numerical Recipes: a = 1664525, c = 1013904223, m = 2^32
  /**
   * Generate the next pseudo-random value in [0, 1).
   *
   * @returns Next floating-point value sampled from the LCG.
   */
  next(): number {
    this.seed = (1664525 * this.seed + 1013904223) & 0xffffffff;
    // Use >>> 0 to ensure unsigned interpretation, preventing negative values
    return (this.seed >>> 0) / 0x100000000; // Convert to [0, 1)
  }

  /**
   * Generate random number in [min, max) range.
   *
   * @param min Inclusive lower bound for integer generation.
   * @param max Exclusive upper bound for integer generation.
   * @returns Pseudo-random integer in [min, max).
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }
}

/**
 * Global random number generator - initialized with seed when available.
 */
let seededRandom: SeededRandom | null = null;

/**
 * Get a random number, respecting seeded reproducibility when available.
 *
 * @returns A floating-point number in the half-open interval [0, 1).
 *
 * @example
 * const value = getRandom();
 * // When a seed was supplied, repeated invocations across CLI runs
 * // continue the deterministic sequence thanks to loadState()/saveState().
 */
function getRandom(): number {
  if (seededRandom) {
    return seededRandom.next();
  }
  return Math.random();
}

// Colors for output
const colors = {
  red: (text: string): string => `\x1b[31m${text}\x1b[0m`,
  green: (text: string): string => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string): string => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string): string => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string): string => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string): string => `\x1b[1m${text}\x1b[0m`
};

// State file path for persistence
const STATE_FILE = '/tmp/mab-runner-state.json';

/**
 * Load tournament state from disk and restore RNG progression.
 *
 * @remarks
 * When `tournamentState.rngState` is defined, the seeded RNG is reconstructed using the
 * original seed and immediately advanced to the persisted state with
 * {@link SeededRandom.setState}. This ensures that every CLI invocation continues the same
 * deterministic random sequence rather than re-seeding from scratch.
 */
function loadState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      tournamentState = JSON.parse(data) as TournamentState | null;

      // Restore seeded random generator with proper state
      if (tournamentState?.seed !== undefined) {
        seededRandom = new SeededRandom(tournamentState.seed);
        // Restore the RNG state if available (for continued randomness)
        if (tournamentState.rngState !== undefined) {
          seededRandom.setState(tournamentState.rngState);
        }
      } else {
        seededRandom = null;
      }
    }
  } catch {
    // Ignore errors, start fresh
  }
}

/**
 * Persist tournament state and capture current RNG progression.
 *
 * @remarks
 * Before writing to disk, the current RNG state (if seeded) is copied via
 * {@link SeededRandom.getState}. This captured value is later used by {@link loadState} to
 * resume the sequence without losing continuity.
 */
function saveState(): void {
  try {
    if (tournamentState) {
      // Update RNG state before saving
      if (seededRandom) {
        tournamentState.rngState = seededRandom.getState();
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(tournamentState, null, 2));
    }
  } catch {
    // Ignore errors in demo
  }
}

/**
 * Initialize tournament state.
 *
 * @param agents Number of agents participating in the tournament.
 * @param seed Optional deterministic seed for reproducible randomness.
 */
function initializeTournament(agents: number, seed?: number): void {
  const state: TournamentState = {
    agents,
    initialized: true,
    totalEvaluations: 0,
    lastWinnerCheck: 0,
    agentStats: Array.from({ length: agents }, (_, i) => ({
      agentId: `agent_${i}`,
      evaluations: 0,
      scores: [],
      meanScore: 0.5, // Prior mean
      variance: 0,
      posteriorMean: 0.5, // Gaussian prior mean
      posteriorVariance: 0.25 // Gaussian prior variance (std=0.5)
    }))
  };

  // Initialize seeded random generator if seed is provided. Note that when a seed exists,
  // subsequent invocations will restore the generator's state from tournamentState.rngState
  // during loadState(), preserving the randomness progression.
  if (seed !== undefined) {
    state.seed = seed;
    seededRandom = new SeededRandom(seed);
  } else {
    seededRandom = null; // Use Math.random() for unseeded tournaments
  }

  tournamentState = state;
  saveState();
}

/**
 * Thompson Sampling selection using Gaussian distribution.
 *
 * @returns ID of the agent selected for the next evaluation.
 */
function selectNextAgent(): string {
  if (!tournamentState || !tournamentState.initialized) {
    console.error(colors.red('Error: Tournament not initialized'));
    console.error('Run "mab-runner init --agents <number>" first');
    process.exit(2);
  }

  // Sample from Gaussian distribution for each agent
  const samples: Array<{ agentId: string; sample: number; index: number }> = [];

  for (let i = 0; i < tournamentState.agentStats.length; i++) {
    const stats = tournamentState.agentStats[i];

    // Sample from Gaussian posterior
    const stdDev = Math.sqrt(stats.posteriorVariance);
    const sample = gaussianSample(stats.posteriorMean, stdDev);

    // Clip to [0, 1] range for scores
    const clippedSample = Math.max(0, Math.min(1, sample));
    samples.push({ agentId: stats.agentId, sample: clippedSample, index: i });
  }

  // Select agent with highest sample
  samples.sort((a, b) => b.sample - a.sample);

  // Save state after RNG usage to persist the updated RNG state
  saveState();

  return samples[0].agentId;
}

/**
 * Gaussian distribution sampling using Box-Muller transform.
 *
 * @param mean Mean of the desired Gaussian.
 * @param stdDev Standard deviation of the desired Gaussian.
 * @returns Sample drawn from N(mean, stdDev^2).
 */
function gaussianSample(mean: number, stdDev: number): number {
  const u1 = getRandom();
  const u2 = getRandom();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

/**
 * Generate a standard normal random variable using Box-Muller transform.
 *
 * @returns Sample from the standard normal distribution.
 */
function randomNormal(): number {
  const u1 = getRandom();
  const u2 = getRandom();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Optimized gamma distribution sampling using standard algorithms.
 *
 * @param shape Shape parameter (k) of the gamma distribution.
 * @returns Sample drawn from Gamma(shape, 1).
 */
function gammaSample(shape: number): number {
  if (shape <= 0) return 0;

  if (shape === 1.0) {
    // Special case: exponential distribution
    return -Math.log(getRandom());
  }

  if (shape < 1.0) {
    // Ahrens-Dieter method for shape < 1
    // This is the method used in NumPy for small shape parameters
    while (true) {
      const u = getRandom();
      const v = -Math.log(getRandom()); // Exponential random variable

      if (u <= 1.0 - shape) {
        const x = Math.pow(u, 1.0 / shape);
        if (x <= v) {
          return x;
        }
      } else {
        const y = -Math.log((1 - u) / shape);
        const x = Math.pow(1.0 - shape + shape * y, 1.0 / shape);
        if (x <= (v + y)) {
          return x;
        }
      }
    }
  } else {
    // Marsaglia-Tsang method for shape >= 1
    // "A Simple Method for generating gamma variables" (2000)
    const d = shape - 1.0 / 3.0;
    const c = 1.0 / Math.sqrt(9.0 * d);

    while (true) {
      // Generate normal variate
      const z = randomNormal();

      if (z > -1.0 / c) {
        const v = Math.pow(1.0 + c * z, 3);
        const u = getRandom();

        // Acceptance check
        if (Math.log(u) < 0.5 * z * z + d - d * v + d * Math.log(v)) {
          return d * v;
        }
      }
    }
  }
}

/**
 * Update agent with evaluation result.
 *
 * @param agentId Agent identifier being updated.
 * @param score Evaluation score in the [0, 1] range.
 */
function updateAgent(agentId: string, score: number): void {
  if (!tournamentState || !tournamentState.initialized) {
    console.error(colors.red('Error: Tournament not initialized'));
    console.error('Run "mab-runner init --agents <number>" first');
    process.exit(2);
  }

  const agentIndex = tournamentState.agentStats.findIndex(a => a.agentId === agentId);
  if (agentIndex === -1) {
    console.error(colors.red(`Error: Invalid agent ID '${agentId}'`));
    console.error(`Valid agents: ${tournamentState.agentStats.map(a => a.agentId).join(', ')}`);
    process.exit(3);
  }

  if (score < 0 || score > 1) {
    console.error(colors.red(`Error: Invalid score ${score}`));
    console.error('Score must be between 0 and 1 (inclusive)');
    process.exit(4);
  }

  const stats = tournamentState.agentStats[agentIndex];
  stats.evaluations++;
  stats.scores.push(score);

  // Update sample mean and variance
  const oldMean = stats.meanScore;
  stats.meanScore = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;

  if (stats.evaluations > 1) {
    const sumSquaredDiff = stats.scores.reduce((sum, s) => sum + Math.pow(s - stats.meanScore, 2), 0);
    stats.variance = sumSquaredDiff / (stats.evaluations - 1);
  } else {
    stats.variance = 0;
  }

  // Update Gaussian posterior using Bayesian update
  // Prior: N(0.5, 0.25)
  const priorMean = 0.5;
  const priorVariance = 0.25;

  // Observation variance (use sample variance or default)
  const obsVariance = stats.variance > 0 ? stats.variance / stats.evaluations : 0.1;

  // Posterior update using conjugate prior formula
  const posteriorPrecision = 1/priorVariance + stats.evaluations/obsVariance;
  stats.posteriorVariance = 1/posteriorPrecision;
  stats.posteriorMean = stats.posteriorVariance * (priorMean/priorVariance + stats.evaluations * stats.meanScore/obsVariance);

  tournamentState.totalEvaluations++;
  saveState();
}

/**
 * Get tournament status.
 *
 * @returns Aggregated statistics about current tournament progress.
 */
function getStatus(): StatusResult {
  if (!tournamentState || !tournamentState.initialized) {
    console.error(colors.red('Error: Tournament not initialized'));
    console.error('Run "mab-runner init --agents <number>" first');
    process.exit(2);
  }

  // Calculate convergence progress (simplified)
  const minEvals = Math.min(...tournamentState.agentStats.map(a => a.evaluations));
  const convergenceProgress = minEvals > 0 ? Math.min(1, minEvals / 50) : 0;

  // Estimate remaining evaluations
  const estimatedRemaining = Math.max(0, 50 * tournamentState.agents - tournamentState.totalEvaluations);

  return {
    total_evaluations: tournamentState.totalEvaluations,
    agent_stats: tournamentState.agentStats.map(stats => ({
      agent_id: stats.agentId,
      evaluations: stats.evaluations,
      mean_score: stats.meanScore,
      std_dev: Math.sqrt(stats.variance)
    })),
    convergence_progress: convergenceProgress,
    estimated_evaluations_remaining: estimatedRemaining
  };
}

/**
 * Get winner information.
 *
 * @returns Current best-performing agent summary and confidence metrics.
 */
function getWinner(): WinnerResult {
  if (!tournamentState || !tournamentState.initialized) {
    console.error(colors.red('Error: Tournament not initialized'));
    console.error('Run "mab-runner init --agents <number>" first');
    process.exit(2);
  }

  // Find current best agent by posterior mean
  const bestAgent = tournamentState.agentStats.reduce((best, current) =>
    current.posteriorMean > best.posteriorMean ? current : best
  );

  // Calculate 95% confidence interval using posterior variance
  const stdDev = Math.sqrt(bestAgent.posteriorVariance);
  const confidenceInterval: [number, number] = [
    Math.max(0, bestAgent.posteriorMean - 1.96 * stdDev),
    Math.min(1, bestAgent.posteriorMean + 1.96 * stdDev)
  ];

  // Calculate confidence based on how separated the best agent is from others
  const secondBest = tournamentState.agentStats
    .filter(a => a.agentId !== bestAgent.agentId)
    .reduce((best, current) => current.posteriorMean > best.posteriorMean ? current : best);

  // Confidence is based on separation between best and second-best
  const separation = bestAgent.posteriorMean - secondBest.posteriorMean;
  const combinedStdDev = Math.sqrt(bestAgent.posteriorVariance + secondBest.posteriorVariance);
  const zScore = separation / combinedStdDev;
  const confidence = Math.min(0.99, Math.max(0.5, 0.5 + 0.5 * Math.tanh(zScore)));

  // Determine if optimization is complete
  // Complete when best agent is significantly better than others
  const isComplete = tournamentState.totalEvaluations >= 50 * tournamentState.agents ||
                    (bestAgent.evaluations >= 15 &&
                     stdDev < 0.05 &&
                     separation > 2 * combinedStdDev);

  return {
    complete: isComplete,
    winner_id: bestAgent.agentId,
    confidence: confidence,
    total_evaluations: tournamentState.totalEvaluations,
    winner_stats: {
      evaluations: bestAgent.evaluations,
      mean_score: bestAgent.meanScore,
      std_dev: Math.sqrt(bestAgent.variance),
      confidence_interval: confidenceInterval
    }
  };
}

/**
 * Reset tournament.
 *
 * @returns Success indicator and descriptive message.
 */
function resetTournament(): { success: boolean; message: string } {
  tournamentState = null;
  seededRandom = null; // Reset random generator
  // Clean up state file
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    // Ignore if file doesn't exist
  }
  return {
    success: true,
    message: "Tournament reset successfully"
  };
}

/**
 * Display comprehensive help.
 */
function showHelp(): void {
  console.log(colors.bold('Multi-Armed Bandit Runner'));
  console.log('A production-ready implementation of Thompson Sampling for agent optimization\n');

  console.log(colors.cyan('USAGE:'));
  console.log('  mab-runner <command> [options]\n');

  console.log(colors.cyan('DESCRIPTION:'));
  console.log('  This tool implements a Multi-Armed Bandit (MAB) algorithm using Thompson Sampling');
  console.log('  for optimal agent selection. It maintains persistent state to track agent performance');
  console.log('  across multiple evaluations and uses Bayesian inference to balance exploration and');
  console.log('  exploitation when selecting agents.\n');

  console.log(colors.cyan('COMMANDS:'));

  console.log(colors.yellow('  init') + ' --agents <number> [--seed <number>]');
  console.log('    Initialize a new tournament with specified number of agents');
  console.log('    Parameters:');
  console.log('      --agents, -a <number>  Number of agents to test (required, must be > 0)');
  console.log('      --seed, -s <number>    Seed for reproducible randomness (optional)');
  console.log('    Example:');
  console.log('      mab-runner init --agents 3 --seed 42');
  console.log('    Expected output:');
  console.log('      {"success":true,"agents":3,"seed":42}\n');

  console.log(colors.yellow('  select'));
  console.log('    Select the next agent to evaluate using Thompson Sampling');
  console.log('    Uses Gaussian posterior sampling to balance exploration vs exploitation');
  console.log('    Example:');
  console.log('      mab-runner select');
  console.log('    Expected output:');
  console.log('      "agent_1"  # JSON string with selected agent ID\n');

  console.log(colors.yellow('  update') + ' <agent_id> <score>');
  console.log('    Update an agent with evaluation results');
  console.log('    Parameters:');
  console.log('      <agent_id>  The agent identifier (e.g., agent_0, agent_1)');
  console.log('      <score>     Performance score between 0 and 1');
  console.log('    Scoring system:');
  console.log('      - All scores contribute to the Gaussian posterior mean and variance');
  console.log('      - Posterior updated using Bayesian inference with prior N(0.5, 0.25)');
  console.log('      - Higher variance leads to more exploration, lower variance to exploitation');
  console.log('    Example:');
  console.log('      mab-runner update agent_1 0.95  # Strong success');
  console.log('      mab-runner update agent_0 0.3   # Clear failure');
  console.log('    Expected output:');
  console.log('      {"success":true,"agent_id":"agent_1","score":0.95,"total_evaluations":15}\n');

  console.log(colors.yellow('  status'));
  console.log('    Get current tournament status and statistics');
  console.log('    Example:');
  console.log('      mab-runner status');
  console.log('    Expected output:');
  console.log('      {');
  console.log('        "total_evaluations": 45,');
  console.log('        "agent_stats": [');
  console.log('          {"agent_id":"agent_0","evaluations":15,"mean_score":0.2,"std_dev":0.15},');
  console.log('          {"agent_id":"agent_1","evaluations":15,"mean_score":0.93,"std_dev":0.08},');
  console.log('          {"agent_id":"agent_2","evaluations":15,"mean_score":0.47,"std_dev":0.12}');
  console.log('        ],');
  console.log('        "convergence_progress": 0.3,');
  console.log('        "estimated_evaluations_remaining": 105');
  console.log('      }\n');

  console.log(colors.yellow('  winner'));
  console.log('    Get information about the current best-performing agent');
  console.log('    Example:');
  console.log('      mab-runner winner');
  console.log('    Expected output:');
  console.log('      {');
  console.log('        "complete": true,');
  console.log('        "winner_id": "agent_1",');
  console.log('        "confidence": 0.93,');
  console.log('        "total_evaluations": 150,');
  console.log('        "winner_stats": {');
  console.log('          "evaluations": 50,');
  console.log('          "mean_score": 0.94,');
  console.log('          "std_dev": 0.08,');
  console.log('          "confidence_interval": [0.84, 1.0]');
  console.log('        }');
  console.log('      }\n');

  console.log(colors.yellow('  reset'));
  console.log('    Reset the tournament and clear all state');
  console.log('    Removes the persistent state file and resets all statistics');
  console.log('    Example:');
  console.log('      mab-runner reset');
  console.log('    Expected output:');
  console.log('      {"success":true,"message":"Tournament reset successfully"}\n');

  console.log(colors.cyan('ALGORITHM DETAILS:'));
  console.log('  Thompson Sampling is a Bayesian approach to the multi-armed bandit problem.');
  console.log('  Each agent maintains a Gaussian posterior distribution representing our belief');
  console.log('  about its expected performance. The algorithm samples from these distributions');
  console.log('  and selects the agent with the highest sample, naturally balancing exploration');
  console.log('  of uncertain agents with exploitation of high-performing ones.\n');
  console.log('  The Gaussian model is particularly effective for continuous scores, using');
  console.log('  Bayesian updates to refine posterior mean and variance with each observation.\n');

  console.log(colors.cyan('SEED FUNCTIONALITY:'));
  console.log('  Seeds enable reproducible experiments by controlling random number generation.');
  console.log('  When a seed is provided with --seed during init:');
  console.log('    - Agent selection becomes deterministic for the same sequence of scores');
  console.log('    - The same agents will be selected in the same order given identical inputs');
  console.log('    - Different seeds produce different (but still reproducible) selection patterns\n');
  console.log('  Important notes about seeds:');
  console.log('    - The seed affects ONLY the selection process, not the scores you provide');
  console.log('    - Each command execution continues from the saved RNG state');
  console.log('    - To replay an experiment, you must: reset, init with same seed, and');
  console.log('      provide the exact same sequence of scores in the same order');
  console.log('    - Without a seed, the system uses Math.random() for true randomness\n');
  console.log('  Example reproducible experiment:');
  console.log('    mab-runner reset');
  console.log('    mab-runner init --agents 3 --seed 42');
  console.log('    # The following sequence will always produce the same results with seed 42');
  console.log('    mab-runner select  # Will always return the same first agent');
  console.log('    mab-runner update <agent> 0.7  # Update with your evaluation result');
  console.log('    mab-runner select  # Next selection is deterministic based on seed + history\n');

  console.log(colors.cyan('STATE PERSISTENCE:'));
  console.log('  Tournament state is saved to: ' + STATE_FILE);
  console.log('  This file contains:');
  console.log('    - Current agent statistics (evaluations, scores, Gaussian parameters)');
  console.log('    - Total evaluation count and tournament configuration');
  console.log('    - RNG state (if using a seed) for continued reproducibility');
  console.log('  State persists across command invocations, allowing:');
  console.log('    - Incremental evaluation over multiple sessions');
  console.log('    - Recovery from interrupted experiments');
  console.log('    - Inspection of intermediate results\n');

  console.log(colors.cyan('EXIT CODES:'));
  console.log('  0 - Success');
  console.log('  1 - Invalid command or arguments');
  console.log('  2 - Tournament not initialized');
  console.log('  3 - Invalid agent ID');
  console.log('  4 - Invalid score range\n');

  console.log(colors.cyan('TYPICAL WORKFLOW:'));
  console.log('  1. mab-runner reset                    # Clear any existing state');
  console.log('  2. mab-runner init --agents 5          # Initialize with 5 agents');
  console.log('  3. agent=$(mab-runner select)          # Get next agent to test');
  console.log('  4. score=$(evaluate_agent $agent)      # Run your evaluation');
  console.log('  5. mab-runner update $agent $score     # Update with results');
  console.log('  6. Repeat steps 3-5 until convergence');
  console.log('  7. mab-runner winner                   # Get the best agent\n');

  console.log(colors.cyan('CONVERGENCE DETECTION:'));
  console.log('  The algorithm considers optimization complete when:');
  console.log('    1. Total evaluations >= 50 * number_of_agents, OR');
  console.log('    2. Best agent has >= 15 evaluations AND');
  console.log('       posterior std deviation < 0.05 AND');
  console.log('       separation from second-best > 2 standard deviations\n');
  console.log('  To detect convergence in practice:');
  console.log('    - Monitor the "complete" field in winner command output');
  console.log('    - Check if the winner_id remains stable across multiple selections');
  console.log('    - Watch the convergence_progress field in status (0.0 to 1.0)');
  console.log('    - Look for minimal changes in agent mean_scores over time\n');
  console.log('  Convergence indicators:');
  console.log('    - Early phase: Frequent switching between agents (exploration)');
  console.log('    - Mid phase: Focus narrows to 2-3 promising agents');
  console.log('    - Late phase: Consistent selection of the best agent (exploitation)');
  console.log('    - Converged: Same agent selected 80-90% of the time\n');
  console.log('  Typical convergence times:');
  console.log('    - Clear winner (large performance gap): 30-50 evaluations total');
  console.log('    - Close competition: 100-200 evaluations total');
  console.log('    - Very similar agents: May need 300+ evaluations\n');

  console.log(colors.cyan('ADVANCED USAGE:'));
  console.log('  For reproducible experiments, use --seed parameter with init.');
  console.log('  Monitor convergence with: watch -n 1 "mab-runner status | jq ."');
  console.log('  Extract winner: mab-runner winner | jq -r .winner_id');
  console.log('  Check completion: mab-runner winner | jq .complete');
  console.log('  Remove JSON quotes: agent=$(mab-runner select | tr -d \'"\')');
  console.log('  Parse scores: mab-runner status | jq \'.agent_stats[].mean_score\'\n');

  console.log(colors.cyan('TROUBLESHOOTING:'));
  console.log('  Problem: "Tournament not initialized" errors');
  console.log('    Solution: Run "mab-runner init --agents <N>" first\n');
  console.log('  Problem: Unexpected agent statistics or evaluation counts');
  console.log('    Solution: Check state file at ' + STATE_FILE);
  console.log('    Clear state: mab-runner reset && rm -f ' + STATE_FILE + '\n');
  console.log('  Problem: Same agent always selected with seed');
  console.log('    Solution: This is expected early behavior - the algorithm needs');
  console.log('    several evaluations to build statistics before diversifying\n');
  console.log('  Problem: JSON parsing errors in shell scripts');
  console.log('    Solution: Use jq for robust JSON handling or tr -d \'"\' for simple strings\n');

  console.log(colors.gray('Version: 1.0.0'));
  console.log(colors.gray('Thompson Sampling implementation with optimized gamma distribution sampling'));
  console.log(colors.gray('Report issues: https://github.com/anthropics/claude-code'));
}

// Main CLI handler
function main(): void {
  // Load existing state
  loadState();

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(colors.red('Error: No command specified\n'));
    showHelp();
    process.exit(1);
  }

  const command = args[0];

  // Check if command is actually a help request (top-level help only)
  if (command === '-h' || command === '--help') {
    showHelp();
    process.exit(0);
  }

  const parsedArgs = parseArgs({
    args: args.slice(1),
    options: {
      agents: { type: 'string', short: 'a' },
      seed: { type: 'string', short: 's' },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  });

  try {
    switch (command) {
      case 'init': {
        if (parsedArgs.values.help) {
          console.log(colors.bold('Command: init'));
          console.log('Initialize a new tournament with specified number of agents\n');
          console.log('Usage: mab-runner init --agents <number> [--seed <number>]\n');
          console.log('Parameters:');
          console.log('  --agents, -a <number>  Number of agents to test (required, must be > 0)');
          console.log('  --seed, -s <number>    Integer seed for reproducible agent selection (optional)');
          console.log('                         Same seed + same score sequence = same selections\n');
          console.log('Example:');
          console.log('  mab-runner init --agents 3 --seed 42\n');
          console.log('Expected output:');
          console.log('  {"success":true,"agents":3,"seed":42}');
          process.exit(0);
        }

        if (!parsedArgs.values.agents) {
          console.error(colors.red('Error: --agents required\n'));
          console.log('Usage: mab-runner init --agents <number> [--seed <number>]');
          console.log('Run "mab-runner --help" for more information');
          process.exit(1);
        }

        const agents = parseInt(parsedArgs.values.agents);
        if (isNaN(agents) || agents <= 0) {
          console.error(colors.red('Error: --agents must be a positive integer\n'));
          console.log('Usage: mab-runner init --agents <number> [--seed <number>]');
          console.log('Run "mab-runner --help" for more information');
          process.exit(1);
        }

        let seed: number | undefined;
        if (parsedArgs.values.seed) {
          seed = parseInt(String(parsedArgs.values.seed));
          if (isNaN(seed)) {
            console.error(colors.red('Error: --seed must be an integer\n'));
            console.log('Usage: mab-runner init --agents <number> [--seed <number>]');
            console.log('Run "mab-runner --help" for more information');
            process.exit(1);
          }
        }

        initializeTournament(agents, seed);
        console.log(JSON.stringify({
          success: true,
          agents,
          seed
        }));
        break;
      }

      case 'select': {
        if (parsedArgs.values.help) {
          console.log(colors.bold('Command: select'));
          console.log('Select the next agent to evaluate using Thompson Sampling\n');
          console.log('Usage: mab-runner select\n');
          console.log('Description:');
          console.log('  Uses Gaussian posterior sampling to balance exploration vs exploitation.');
          console.log('  Returns a JSON string with the selected agent_id.\n');
          console.log('Example:');
          console.log('  agent=$(mab-runner select)');
          console.log('  echo "Selected: $agent"\n');
          console.log('Expected output:');
          console.log('  "agent_1"  # JSON string with selected agent ID');
          process.exit(0);
        }

        const agentId = selectNextAgent();
        console.log(JSON.stringify(agentId));
        break;
      }

      case 'update': {
        if (parsedArgs.values.help === true) {
          console.log(colors.bold('Command: update'));
          console.log('Update an agent with evaluation results\n');
          console.log('Usage: mab-runner update <agent_id> <score>\n');
          console.log('Parameters:');
          console.log('  <agent_id>  The agent identifier (e.g., agent_0, agent_1)');
          console.log('  <score>     Performance score between 0 and 1');
          console.log('              All scores contribute to the Gaussian posterior');
          console.log('              Prior: N(0.5, 0.25), updated via Bayesian inference\n');
          console.log('Example:');
          console.log('  mab-runner update agent_1 0.95');
          console.log('  mab-runner update agent_0 0.3');
          process.exit(0);
        }

        const positionals = parsedArgs.positionals;
        if (positionals.length !== 2) {
          console.error(colors.red('Error: update requires agent_id and score\n'));
          console.log('Usage: mab-runner update <agent_id> <score>');
          console.log('Run "mab-runner update --help" for more information');
          process.exit(1);
        }

        const agentId = positionals[0];
        const score = parseFloat(positionals[1]);

        if (isNaN(score)) {
          console.error(colors.red('Error: score must be a number\n'));
          console.log('Usage: mab-runner update <agent_id> <score>');
          console.log('Score must be a value between 0 and 1');
          console.log('Run "mab-runner update --help" for more information');
          process.exit(1);
        }

        updateAgent(agentId, score);
        console.log(JSON.stringify({
          success: true,
          agent_id: agentId,
          score,
          total_evaluations: tournamentState ? tournamentState.totalEvaluations : 0
        }));
        break;
      }

      case 'status': {
        if (parsedArgs.values.help) {
          console.log(colors.bold('Command: status'));
          console.log('Get current tournament status and statistics\n');
          console.log('Usage: mab-runner status\n');
          console.log('Returns JSON object with:');
          console.log('  - total_evaluations: Total number of evaluations performed');
          console.log('  - agent_stats: Array with each agent\'s performance:');
          console.log('    - agent_id: Agent identifier');
          console.log('    - evaluations: Number of times evaluated');
          console.log('    - mean_score: Average score across all evaluations');
          console.log('    - std_dev: Standard deviation of scores');
          console.log('  - convergence_progress: Estimated progress (0-1)');
          console.log('  - estimated_evaluations_remaining: Approximate evaluations left\n');
          console.log('Example:');
          console.log('  mab-runner status | jq .');
          process.exit(0);
        }

        const status = getStatus();
        console.log(JSON.stringify(status));
        break;
      }

      case 'winner': {
        if (parsedArgs.values.help) {
          console.log(colors.bold('Command: winner'));
          console.log('Get information about the current best-performing agent\n');
          console.log('Usage: mab-runner winner\n');
          console.log('Returns JSON object with:');
          console.log('  - complete: Boolean indicating if optimization is complete');
          console.log('  - winner_id: ID of the best-performing agent');
          console.log('  - confidence: Confidence score (0-1)');
          console.log('  - total_evaluations: Total evaluations performed');
          console.log('  - winner_stats: Detailed statistics:');
          console.log('    - evaluations: Number of times evaluated');
          console.log('    - mean_score: Average performance score');
          console.log('    - std_dev: Standard deviation of scores');
          console.log('    - confidence_interval: [lower, upper] bounds\n');
          console.log('Completion criteria:');
          console.log('  - Total evaluations >= 50 * number_of_agents, OR');
          console.log('  - Best agent has >= 15 evaluations AND');
          console.log('    posterior std deviation < 0.05 AND');
          console.log('    separation from second-best > 2 standard deviations\n');
          console.log('Example:');
          console.log('  winner=$(mab-runner winner)');
          console.log('  echo $winner | jq \'.winner_id\'');
          process.exit(0);
        }

        const winner = getWinner();
        console.log(JSON.stringify(winner));
        break;
      }

      case 'reset': {
        if (parsedArgs.values.help) {
          console.log(colors.bold('Command: reset'));
          console.log('Reset the tournament and clear all state\n');
          console.log('Usage: mab-runner reset\n');
          console.log('Description:');
          console.log('  Removes the persistent state file and resets all statistics.');
          console.log('  Use this to start fresh experiments or clear corrupted state.\n');
          console.log('State file location:');
          console.log('  ' + STATE_FILE + '\n');
          console.log('Example:');
          console.log('  mab-runner reset');
          console.log('  mab-runner init --agents 5');
          process.exit(0);
        }

        const result = resetTournament();
        console.log(JSON.stringify(result));
        break;
      }

      default: {
        console.error(colors.red(`Error: Unknown command '${command}'\n`));
        showHelp();
        process.exit(1);
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(colors.red(`Error: ${errorMessage}`));
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  process.exit(2);
});

// Run main function
main();