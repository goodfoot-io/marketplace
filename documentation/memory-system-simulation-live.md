# Live Memory System Simulation

## Overview

This simulation validates the memory system design using the Claude Agent SDK to model realistic agent behavior. Unlike the topic-based simulation which uses algorithmic decisions, this simulation uses LLM agents to make release/adoption decisions based on document content and agent descriptions, mirroring production behavior.

## Architecture

The simulation consists of four phases:

1. **Transcript Generation**: Generate simulated conversations aligned to topic distributions
2. **New Agent Creation**: Create memory agents for new transcripts
3. **Rebalancing Loop**: Memory agents evaluate and trade documents/child agents until convergence
4. **Clustering Evaluation**: Measure how well agents organized documents by topic

## Phase 1: Transcript Generation

### Purpose

Generate realistic conversation transcripts between a user and assistant that cover specific topic areas. Topics guide generation but are never exposed to memory agents.

### Process

1. **Topic Distribution Setup**
   - Use the same 20 topics and 5 clusters as topic-based simulation
   - Generate topic scores for each transcript using `clusteredTopicScoresForCluster()`
   - Topic scores stored in parallel ground truth data structure (never passed to agents)

2. **Transcript Generation via SDK**
   - For each transcript to generate:
     - Create topic-aligned user prompt based on dominant topics
     - Use SDK to generate multi-turn conversation
     - Save transcript markdown file

3. **SDK Configuration**
   ```typescript
   const options = {
     systemPrompt: TRANSCRIPT_GENERATION_SYSTEM_PROMPT,
     model: 'sonnet',
     maxTurns: 100,
     includePartialMessages: true,
     abortController,
     permissionMode: 'bypassPermissions',
     disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'SlashCommand', 'Skill']
   };
   ```

4. **System Prompt Structure**
   ```
   You are simulating a conversation between a user and an AI assistant.

   Generate a realistic multi-turn conversation covering the following areas:
   {topic-aligned prompt - e.g., "React performance optimization and hooks patterns"}

   Requirements:
   - 5-10 exchanges between user and assistant
   - Natural conversational flow
   - Technical depth appropriate to the subject
   - User asks questions, assistant provides detailed answers

   Output the conversation in markdown format with clear speaker labels.
   ```

### Outputs

- Transcript markdown files (stored in simulation directory)
- Ground truth mapping: `{ transcriptUid: string, topicScores: TopicScores }`

## Phase 2: New Agent Creation

### Purpose

For each new transcript, create a memory agent with specialized description and document description.

### Process

1. **Document Description Generation**
   - SDK analyzes transcript content
   - Generates description at 10% of original token count
   - Description captures key topics and conversation themes

2. **Agent Description Generation**
   - SDK analyzes document description and full transcript
   - Generates `agent.md` covering:
     - Content summary (what the transcript contains)
     - Capabilities (what queries this agent could answer)
     - Specialization (domain/category focus)

3. **Identifier Generation**
   - SDK proposes semantic identifier (e.g., `react-performance-optimization`)
   - Check for collisions with existing root-level agents
   - Regenerate if collision detected

4. **Initial Placement**
   - New agent placed at root level
   - Agent marked as ineligible for first rebalancing session
   - Becomes eligible in subsequent rebalancing runs

### SDK Configuration

```typescript
const descriptionOptions = {
  systemPrompt: DOCUMENT_DESCRIPTION_SYSTEM_PROMPT,
  model: 'haiku',
  maxTurns: 100,
  includePartialMessages: true,
  abortController,
  permissionMode: 'bypassPermissions',
  disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'SlashCommand', 'Skill', 'Write']
};

const agentCreationOptions = {
  systemPrompt: AGENT_CREATION_SYSTEM_PROMPT,
  model: 'sonnet',
  maxTurns: 100,
  includePartialMessages: true,
  abortController,
  permissionMode: 'bypassPermissions',
  disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'SlashCommand', 'Skill', 'Write']
};
```

### System Prompts

**Document Description Generation:**
```
You are creating a concise description of a conversation transcript for a memory system.

Read the transcript and generate a description that:
- Summarizes the key topics discussed
- Highlights important technical details
- Captures the conversational themes
- Is approximately 10% the length of the original

Target length: {target_token_count} tokens

Transcript:
{transcript_content}

Output only the description, no additional commentary.
```

**Agent Creation:**
```
You are creating a memory agent that will specialize in content from a conversation transcript.

Based on the document description and full transcript, generate an agent description that includes:

1. **Content Summary**: What topics and information does this transcript contain?
2. **Capabilities**: What types of queries could this agent answer effectively?
3. **Specialization**: What domain or category does this agent focus on?

Also propose a semantic identifier for this agent (e.g., "react-performance-optimization").
The identifier should be lowercase with hyphens, descriptive, and specific.

Document Description:
{document_description}

Full Transcript:
{transcript_content}

Output in this format:
```markdown
# Identifier
{proposed_identifier}

# Agent Description
{agent_description}
```
```

### Outputs

- Document descriptions (agent-specific summaries)
- Agent descriptions (`agent.md` files)
- Agent identifiers (directory names)
- Initial usage ledgers (empty)

## Phase 3: Rebalancing Loop

### Purpose

Memory agents evaluate their children (documents and child agents) and make release/adoption decisions until the system converges.

### Process

1. **Shared State**
   - `rebalancing-pool.json`: Items available for adoption
   - Persists across iterations, deleted when rebalancing completes
   - Tracks: `{ itemUid, itemType, releasingParentUid, itemDescription }`

2. **Turn Order**
   - Sort agents by available capacity (most free space first)
   - Only agents used in previous conversation participate
   - Newly created agents sit out (marked ineligible)

3. **Each Agent's Turn**

   **A. Release Evaluation**
   - SDK receives prompt with:
     - Agent's own description
     - List of direct children (documents and child agents) with descriptions
     - Agent's usage ledger (past queries and rebalancing decisions)
   - Agent decides which children to release
   - Outputs: `{ releases: [{ itemUid, reason }] }`
   - Items added to pool but remain with agent (conditional release)
   - Agent cannot re-adopt items released during this rebalancing session

   **B. Adoption Evaluation**
   - SDK receives prompt with:
     - Agent's own description
     - Current children
     - Items available in pool
     - Agent's usage ledger
     - Agent's available capacity
   - For documents: Agent reads description and can request full content
   - For child agents: Agent reads description only (not subtree)
   - Agent decides which items to adopt
   - Outputs: `{ adoptions: [{ itemUid, reason, releaseToMakeRoom?: itemUid }] }`

   **C. Agent Dissolution Check**
   - When adopting a child agent, check if parent has capacity to absorb all child's documents
   - If true AND child has no sub-agents:
     - Dissolve child agent (delete)
     - Adopt all child's documents directly
     - Prevents unnecessary hierarchy depth

4. **Adoption Execution**
   - **Documents**: Multiple agents can adopt (multi-parent)
     - Each adopting agent generates specialized description via SDK
     - Original description stays with releasing parent unless all parents release
   - **Child Agents**: Single adopter wins (single-parent constraint)
     - If multiple agents want it: highest available capacity wins
     - Entire subtree moves to new parent
     - Releasing parent keeps it if nobody adopts

5. **Description Generation During Adoption**
   - When agent adopts document: SDK generates specialized description
   - Tailored to adopting agent's focus area
   - Same 10% size ratio as original description

6. **Convergence Check**
   - If any adoptions occurred: continue to next iteration
   - If no adoptions occurred: rebalancing complete

7. **Unclaimed Document Recovery**
   - After loop completes, check for documents not held by any agent
   - If root level has capacity: create new agents for unclaimed documents
   - If root at capacity: orphaned documents (error condition)

8. **Orphaned Agent Repair**
   - Detect agents whose parent no longer exists
   - Promote orphaned agents to root level

### SDK Configuration

```typescript
const releaseOptions = {
  systemPrompt: RELEASE_EVALUATION_SYSTEM_PROMPT,
  model: 'sonnet',
  maxTurns: 100,
  includePartialMessages: true,
  abortController,
  permissionMode: 'bypassPermissions',
  disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'SlashCommand', 'Skill', 'Write']
};

const adoptionOptions = {
  systemPrompt: ADOPTION_EVALUATION_SYSTEM_PROMPT,
  model: 'sonnet',
  maxTurns: 100,
  includePartialMessages: true,
  abortController,
  permissionMode: 'bypassPermissions',
  disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'SlashCommand', 'Skill']
};

const descriptionOptions = {
  systemPrompt: SPECIALIZED_DESCRIPTION_SYSTEM_PROMPT,
  model: 'haiku',
  maxTurns: 100,
  includePartialMessages: true,
  abortController,
  permissionMode: 'bypassPermissions',
  disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'SlashCommand', 'Skill', 'Write']
};
```

### System Prompts

**Release Evaluation:**
```
You are a memory agent evaluating which children to release during rebalancing.

Your Description:
{agent_description}

Your Current Children:
{children_list_with_descriptions}

Your Usage Ledger (past queries and decisions):
{usage_ledger_content}

Your Available Capacity: {available_capacity} / {max_capacity} tokens

Evaluate each child and decide whether to release it based on:
1. **Misalignment**: Child doesn't cover your core topics
2. **Low Quality**: Child has poor quality or usefulness
3. **Below Average**: Child's quality is below your average
4. **Clustering**: Child doesn't have topic overlap with sibling children
5. **Opportunistic Upgrade**: Always consider releasing weakest child for potential swap

You can release as many children as you want. Items remain with you unless adopted by another agent.

IMPORTANT: You cannot re-adopt items you release during this rebalancing session.

Output in this format:
```markdown
# Releases
- itemUid: {uid}, reason: {explanation}
- itemUid: {uid}, reason: {explanation}

# Reasoning
{overall reasoning for release decisions}
```

If no releases, output:
```markdown
# Releases
None

# Reasoning
{explanation of why keeping all children}
```
```

**Adoption Evaluation:**
```
You are a memory agent evaluating which items to adopt from the rebalancing pool.

Your Description:
{agent_description}

Your Current Children:
{children_list_with_descriptions}

Your Available Capacity: {available_capacity} / {max_capacity} tokens

Your Usage Ledger (past queries and decisions):
{usage_ledger_content}

Items Available for Adoption:
{pool_items_with_descriptions}

Evaluate each item and decide whether to adopt based on:
1. **Gap Filling**: Item strengthens topics with moderate coverage
2. **Depth Building**: Item adds expertise to strong topics
3. **Quality Upgrade**: Item has higher quality than current average
4. **Relevance**: Item aligns with your specialization

For documents, you can use the Read tool to view full content if needed.
For child agents, evaluate based on description only (you cannot see their subtree).

Capacity Rules:
- If you have capacity: adopt directly
- If at capacity: identify what to release to make room (must be in current children, cannot be newly adopted)

Output in this format:
```markdown
# Adoptions
- itemUid: {uid}, reason: {explanation}
- itemUid: {uid}, reason: {explanation}, releaseToMakeRoom: {uid_of_current_child}

# Reasoning
{overall reasoning for adoption decisions}
```

If no adoptions, output:
```markdown
# Adoptions
None

# Reasoning
{explanation of why not adopting}
```
```

**Specialized Description Generation:**
```
You are generating a specialized description of a document for a memory agent.

The agent is adopting this document and needs a description tailored to their focus area.

Agent Description:
{agent_description}

Original Document Description:
{original_description}

Full Document Content:
{document_content}

Generate a specialized description that:
- Emphasizes aspects relevant to the agent's specialization
- Maintains the same level of detail as the original description
- Is approximately 10% the length of the original document

Target length: {target_token_count} tokens

Output only the description, no additional commentary.
```

### Outputs

- Updated agent-document relationships
- Updated agent hierarchy (parent-child agent relationships)
- Specialized document descriptions (generated during adoption)
- Updated usage ledgers (rebalancing entries with decisions and reasoning)

## Phase 4: Clustering Evaluation

### Purpose

Measure how well memory agents organized documents by topic, using ground truth topic scores that were never exposed to agents.

### Process

1. **Extract Final Clustering**
   - Traverse memory agent hierarchy
   - For each agent, collect all documents it holds (directly or through descendants)
   - Build mapping: `{ agentUid: documentUids[] }`

2. **Calculate Clustering Metrics**

   **Purity:**
   - For each cluster (agent), find the dominant topic among its documents
   - Purity = (sum of documents in dominant topic per cluster) / total documents
   - Range: 0.0 (worst) to 1.0 (perfect)

   **Homogeneity:**
   - Measures if all clusters contain only members of a single topic
   - Uses entropy-based calculation: H(T|C) where T=topics, C=clusters
   - Formula: `homogeneity = 1 - H(T|C) / H(T)` if H(T) > 0, else 1.0
   - Range: 0.0 (worst) to 1.0 (perfect)

   **Completeness:**
   - Measures if all members of a topic are in the same cluster
   - Uses entropy-based calculation: H(C|T) where C=clusters, T=topics
   - Formula: `completeness = 1 - H(C|T) / H(C)` if H(C) > 0, else 1.0
   - Range: 0.0 (worst) to 1.0 (perfect)

   **V-measure:**
   - Harmonic mean of homogeneity and completeness
   - Formula: `v_measure = 2 * (homogeneity * completeness) / (homogeneity + completeness)`
   - Range: 0.0 (worst) to 1.0 (perfect)

3. **Entropy Calculations**

   ```typescript
   // Conditional entropy H(T|C) - uncertainty in topics given clusters
   function conditionalEntropyTopicsGivenClusters(
     clusters: Map<string, string[]>,  // agentUid -> documentUids
     groundTruth: Map<string, TopicScores>
   ): number {
     let totalEntropy = 0;
     let totalDocs = 0;

     for (const [agentUid, docUids] of clusters) {
       // For this cluster, calculate topic distribution
       const topicCounts = new Map<string, number>();

       for (const docUid of docUids) {
         const topicScores = groundTruth.get(docUid);
         const dominantTopic = getDominantTopic(topicScores);
         topicCounts.set(dominantTopic, (topicCounts.get(dominantTopic) || 0) + 1);
       }

       // Calculate entropy for this cluster
       const clusterSize = docUids.length;
       let clusterEntropy = 0;

       for (const count of topicCounts.values()) {
         const p = count / clusterSize;
         if (p > 0) {
           clusterEntropy -= p * Math.log2(p);
         }
       }

       totalEntropy += clusterSize * clusterEntropy;
       totalDocs += clusterSize;
     }

     return totalEntropy / totalDocs;
   }

   // Unconditional entropy H(T) - uncertainty in topics overall
   function entropyTopics(groundTruth: Map<string, TopicScores>): number {
     const topicCounts = new Map<string, number>();

     for (const topicScores of groundTruth.values()) {
       const dominantTopic = getDominantTopic(topicScores);
       topicCounts.set(dominantTopic, (topicCounts.get(dominantTopic) || 0) + 1);
     }

     const totalDocs = groundTruth.size;
     let entropy = 0;

     for (const count of topicCounts.values()) {
       const p = count / totalDocs;
       if (p > 0) {
         entropy -= p * Math.log2(p);
       }
     }

     return entropy;
   }

   // Helper: Get dominant topic from topic scores
   function getDominantTopic(topicScores: TopicScores): string {
     let maxTopic = '';
     let maxScore = -1;

     for (const [topic, score] of Object.entries(topicScores)) {
       if (score > maxScore) {
         maxScore = score;
         maxTopic = topic;
       }
     }

     return maxTopic;
   }
   ```

4. **Structural Metrics**
   - Tree depth distribution (min, max, average)
   - Documents per agent (min, max, average, std dev)
   - Root-level agents count
   - Total agents count
   - Convergence iterations

5. **Comparison to Topic-Based Simulation**
   - Run topic-based simulation with same document set
   - Compare clustering metrics (purity, homogeneity, completeness, V-measure)
   - Compare structural metrics (tree depth, convergence speed)

### Outputs

- Clustering metrics report
- Structural metrics report
- Comparison to topic-based simulation
- Visualization of agent hierarchy with topic distributions

## Configuration Parameters

```typescript
const CONFIG = {
  // Capacity
  MAX_AGENT_CAPACITY: 300,  // tokens
  DOCUMENT_DESCRIPTION_FACTOR: 0.1,  // 10% of original

  // Topics (same as topic-based simulation)
  TOPICS: [
    'react', 'typescript', 'api-design', 'testing', 'performance',
    'state-management', 'database', 'authentication', 'deployment', 'monitoring',
    'documentation', 'accessibility', 'security', 'caching', 'error-handling',
    'code-review', 'refactoring', 'architecture', 'devops', 'analytics'
  ],

  TOPIC_CLUSTERS: [
    ['react', 'typescript', 'state-management', 'performance'],
    ['api-design', 'database', 'authentication', 'security'],
    ['testing', 'code-review', 'refactoring', 'architecture'],
    ['deployment', 'monitoring', 'devops', 'caching'],
    ['documentation', 'accessibility', 'error-handling', 'analytics']
  ],

  // Simulation
  NUM_DOCUMENTS: 50,
  NUM_CLUSTERS: 5,

  // Rebalancing thresholds (same as topic-based)
  MISALIGNMENT_THRESHOLD: 0.3,
  LOW_QUALITY_THRESHOLD: 0.3,
  BELOW_AVERAGE_FACTOR: 0.7,
  CLUSTERING_THRESHOLD_DOCUMENTS: 0.30,
  CLUSTERING_THRESHOLD_AGENTS: 0.35,
  MIN_DOCUMENTS_FOR_CLUSTERING: 3,
  MIN_CHILDREN_FOR_CLUSTERING: 2,

  // Root capacity threshold for offering agents to pool
  ROOT_CAPACITY_THRESHOLD: 0.8,  // 80%

  // SDK
  DEFAULT_MODEL: 'sonnet',
  DESCRIPTION_MODEL: 'haiku',
  MAX_TURNS: 100
};
```

## Data Structures

### Ground Truth (Never Exposed to Agents)

```typescript
interface GroundTruth {
  documents: Map<string, {
    topicScores: TopicScores;
    clusterIndex: number;
  }>;
}

type TopicScores = Record<string, number>;  // topic -> score (0.0-1.0)
```

### Simulation State (Visible to System, Descriptions to Agents)

```typescript
interface SimulationState {
  documents: Map<string, Document>;
  agents: Map<string, MemoryAgent>;
  rebalancingPool: RebalancingPool;
  groundTruth: GroundTruth;
}

interface Document {
  uid: string;
  content: string;  // Full transcript
  descriptions: Map<string, string>;  // parentAgentUid -> specialized description
  quality: number;  // 0.0-1.0 (generated, not from topics)
  parentAgents: Set<string>;  // UIDs of agents holding this document
}

interface MemoryAgent {
  uid: string;
  identifier: string;  // Semantic identifier (directory name)
  description: string;  // From agent.md
  parentAgent: string | null;  // Single parent (null if root)
  childAgents: Set<string>;  // UIDs of child agents
  documents: Set<string>;  // UIDs of direct documents
  usageLedger: UsageLedgerEntry[];
  capacityUsed: number;  // Sum of children descriptions token count
  isNewlyCreated: boolean;  // Sits out first rebalancing
  releasedDuringSession: Set<string>;  // Cannot re-adopt these
}

interface RebalancingPool {
  items: Map<string, PoolItem>;
}

interface PoolItem {
  uid: string;
  type: 'document' | 'agent';
  releasingParent: string;
  description: string;
  content?: string;  // For documents, full content available on request
}

interface UsageLedgerEntry {
  type: 'query' | 'rebalancing';
  timestamp: string;
  content: string;  // Structured markdown with decisions and reasoning
}
```

## Success Criteria

The simulation validates the memory system design if:

1. **Convergence**: Rebalancing completes in finite iterations (typically 5-20)
2. **Clustering Quality**: V-measure comparable to topic-based simulation (within 10-20%)
3. **Hierarchical Structure**: Tree depth stabilizes to 2-4 levels
4. **Capacity Utilization**: Agents converge to 60-90% capacity usage
5. **Stability**: Re-running rebalancing with no new documents causes minimal changes
6. **No Orphans**: No documents or agents orphaned during rebalancing

## Implementation Notes

### Topic Hiding Enforcement

**Critical**: Topic scores must NEVER be passed to SDK agents.

```typescript
// ✓ CORRECT: Topics only in ground truth
const groundTruth = {
  documents: new Map([
    ['doc1', { topicScores: { react: 0.8, typescript: 0.6, ... }, clusterIndex: 0 }]
  ])
};

// Agent receives only content and descriptions
const agentPrompt = `
Your Description: ${agent.description}
Your Children: ${children.map(c => c.description).join('\n')}
`;

// ✗ INCORRECT: Never include topic scores in prompts
const badPrompt = `
Your topic scores: ${JSON.stringify(agent.topicScores)}
`;
```

### Output Parsing

Agents output structured markdown, not raw JSON, to avoid parsing fragility.

```typescript
function parseReleaseDecisions(output: string): Release[] {
  const lines = output.split('\n');
  const releases: Release[] = [];

  let inReleasesSection = false;
  for (const line of lines) {
    if (line.trim() === '# Releases') {
      inReleasesSection = true;
      continue;
    }
    if (line.startsWith('# ')) {
      inReleasesSection = false;
      continue;
    }

    if (inReleasesSection && line.trim().startsWith('-')) {
      // Parse: - itemUid: doc1, reason: misalignment
      const match = line.match(/itemUid:\s*(\S+),\s*reason:\s*(.+)/);
      if (match) {
        releases.push({ itemUid: match[1], reason: match[2].trim() });
      }
    }
  }

  return releases;
}
```

### Error Handling

```typescript
// Retry logic for SDK failures
async function queryWithRetry(
  prompt: string,
  options: QueryOptions,
  maxRetries = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      let fullOutput = '';
      for await (const message of query({ prompt, options })) {
        if (message.type === 'text') {
          fullOutput += message.text;
        }
      }
      return fullOutput;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`Query failed, retrying (${i + 1}/${maxRetries})...`, error);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Should not reach here');
}
```

### Logging and Debugging

```typescript
interface RebalancingLog {
  iteration: number;
  agentUid: string;
  agentIdentifier: string;
  phase: 'release' | 'adoption';
  prompt: string;
  response: string;
  decisions: Release[] | Adoption[];
  timestamp: string;
}

// Save all prompts and responses for debugging
function logRebalancingDecision(log: RebalancingLog) {
  const logDir = './simulation-logs';
  const filename = `${log.iteration}-${log.agentUid}-${log.phase}.md`;
  fs.writeFileSync(
    path.join(logDir, filename),
    `# ${log.agentIdentifier} - ${log.phase}\n\n` +
    `## Prompt\n\n${log.prompt}\n\n` +
    `## Response\n\n${log.response}\n\n` +
    `## Parsed Decisions\n\n${JSON.stringify(log.decisions, null, 2)}`
  );
}
```

## Expected Outcomes

### Clustering Performance

Based on topic-based simulation results, expected metrics:

- **Purity**: 0.70 - 0.90
- **Homogeneity**: 0.65 - 0.85
- **Completeness**: 0.60 - 0.80
- **V-measure**: 0.65 - 0.85

LLM-based decisions may vary by ±10-20% due to non-deterministic behavior.

### Structural Characteristics

- **Tree Depth**: 2-4 levels on average
- **Root Agents**: 3-8 agents (consolidation from initial 50)
- **Documents per Agent**: 5-15 documents
- **Convergence**: 5-20 iterations
- **Capacity Utilization**: 60-90% of MAX_AGENT_CAPACITY

### Comparison to Topic-Based

The live simulation should demonstrate:

1. **Similar clustering quality**: V-measure within 20% of topic-based
2. **Similar structural patterns**: Tree depth, consolidation rate
3. **Realistic decision-making**: Agents provide reasoning that mirrors production behavior
4. **Convergence reliability**: Completes without infinite loops or orphans

If these outcomes are achieved, the design is validated for production implementation.
