# Memory System Simulation

A TypeScript simulation of the Memory System Plugin design using topic-based scoring instead of actual LLM calls.

## Overview

This simulation models the memory system's behavior using:

- **20 arbitrary topics** (react-performance, typescript-patterns, api-design, etc.)
- **Topic scores** (0-1) for each document instead of actual content
- **Cosine similarity** for relevance calculations
- **Agent score aggregation** with 0.75 multiplier (simulating lookup/calculation loss)

## Running the Simulation

```bash
cd packages/memory-system-simulation
yarn install
yarn simulate
```

## Development

```bash
# Run linting and type checking
yarn lint

# Build TypeScript
yarn build

# Run type checking only
yarn typecheck

# Format code
yarn prettier
```

## What It Does

1. **Creates 10 fictitious conversations** with random topic distributions
2. **Generates memory agents** for each conversation (automatic naming based on top topics)
3. **Simulates queries** by finding agents with highest topic similarity
4. **Runs rebalancing** after each conversation using the trading mechanism
5. **Writes results** to `./temp/` (gitignored)

## Simulation Results

After running, examine:

- `temp/memory-system/` - The memory agent hierarchy
- `temp/transcripts/` - Original conversation files
- Each agent directory contains:
  - `agent.md` - Agent description with top topic scores
  - `conversation-N.md` - Document descriptions (with frontmatter linking to original)
  - `usage-ledger.md` - Query and rebalancing history

## Key Observations

The simulation reveals several behaviors:

### Root-Level Explosion (as critiqued)

- Every conversation creates a new root-level agent
- After 10 conversations: 10 root-level agents
- No consolidation occurs because:
  - New agents sit out first rebalancing
  - Only used agents participate
  - Similarity thresholds prevent adoption

### Why No Trading Occurs

1. **High capacity**: MAX_AGENT_CAPACITY = 5000 tokens, but agents use <100 tokens
2. **Low similarity**: Random topic distributions rarely exceed 0.5 similarity threshold
3. **Quality thresholds**: Agents need low quality (<0.4) or low relevance (<0.3) to release

### What Would Enable Trading

- Lower capacity limits (forcing releases)
- More focused topic distributions (higher similarity)
- More conversations with same agents (building usage history)
- Longer simulation (more iterations to see consolidation)

## Simulation vs. Reality

**Similarities:**

- ✅ File system structure matches design
- ✅ Topic-based relevance mirrors semantic similarity
- ✅ Rebalancing loop with iterations
- ✅ Capacity-based adoption priority
- ✅ Usage ledger tracking

**Differences:**

- ❌ No actual LLM decisions (uses cosine similarity)
- ❌ No description generation (uses templates)
- ❌ No agent SDK integration
- ❌ Simplified quality evaluation (just similarity score)
- ❌ Single-file implementation (not production architecture)

## Modifying the Simulation

To see different behaviors, try adjusting:

```typescript
// In simulation.ts

const MAX_AGENT_CAPACITY = 500;  // Lower capacity → more trading
const AGENT_SCORE_MULTIPLIER = 0.9;  // Higher retention of child scores

// In topicSimilarity threshold checks
if (similarity > 0.3) {  // Lower threshold → more adoptions
```

Or create more focused topic distributions:

```typescript
function focusedTopicScores(primaryTopic: Topic): TopicScores {
  const scores = {} as TopicScores;
  for (const topic of TOPICS) {
    scores[topic] = topic === primaryTopic ? 0.9 : Math.random() * 0.2;
  }
  return scores;
}
```

## Next Steps

This simulation validates the core mechanics but highlights the issues raised in critiques:

1. **Root explosion** needs inbox pattern or consolidation mechanism
2. **Convergence** needs better tuning of thresholds and capacity
3. **Observability** - the console output shows what production would need in logs
4. **Real implementation** would need actual LLM integration via Claude Agent SDK
