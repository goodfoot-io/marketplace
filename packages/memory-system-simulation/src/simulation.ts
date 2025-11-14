#!/usr/bin/env tsx
/**
 * Memory System Plugin Simulation
 *
 * Models the memory system using topic-based scoring instead of actual LLM calls.
 * Each document has a 0-1 score for 20 arbitrary topics.
 * Agents aggregate child scores with 0.75 multiplier (lookup/calculation loss).
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const TEMP_DIR = './temp';
const MEMORY_SYSTEM_DIR = path.join(TEMP_DIR, 'memory-system');
const TRANSCRIPTS_DIR = path.join(TEMP_DIR, 'transcripts');

const MAX_AGENT_CAPACITY = 300; // tokens
const DOCUMENT_DESCRIPTION_FACTOR = 0.1; // 10% of document size
const MAX_REBALANCING_ITERATIONS = 50;
const AGENT_SCORE_MULTIPLIER = 0.75; // Loss during lookup/calculation

const ROOT_ADOPTION_CAPACITY_THRESHOLD = 0.8; // 80% - only offer root agents when root is at capacity pressure
const ROOT_LEVEL_IDENTIFIER = 'root'; // Special identifier for root-level releases

// 20 arbitrary topics
const TOPICS = [
  'react-performance',
  'typescript-patterns',
  'api-design',
  'database-optimization',
  'testing-strategies',
  'security-practices',
  'ui-components',
  'state-management',
  'authentication',
  'deployment',
  'error-handling',
  'code-review',
  'refactoring',
  'documentation',
  'debugging',
  'algorithms',
  'system-architecture',
  'git-workflows',
  'performance-monitoring',
  'accessibility'
] as const;

type Topic = (typeof TOPICS)[number];
type TopicScores = Record<Topic, number>;

// ============================================================================
// Data Structures
// ============================================================================

interface Document {
  path: string; // Original document path
  content: string;
  tokens: number;
  topicScores: TopicScores;
}

interface DocumentDescription {
  originalPath: string;
  description: string;
  tokens: number;
  agentSpecialization: string;
}

interface MemoryAgent {
  identifier: string;
  parentPath: string | null; // null = root level
  agentDescription: string;
  agentDescriptionTokens: number;
  documentDescriptions: Map<string, DocumentDescription>; // filename -> description
  childAgents: Set<string>; // child agent identifiers
  usageLedger: LedgerEntry[];
  usedInLastConversation: boolean;
  isNewThisSession: boolean;
  topicScores: TopicScores; // Aggregated from children

  // Track changes for deferred releases
  childrenChangedThisRebalancing: boolean;
}

interface LedgerEntry {
  type: 'query' | 'rebalancing';
  timestamp: number;
  details: string;
  childrenUsed?: string[];
  qualityScore?: number; // NEW: separate from similarity
  relevanceScore?: number; // NEW: similarity/relevance
}

interface PoolItem {
  type: 'document' | 'agent';
  itemIdentifier: string; // document path or agent identifier
  releasingAgent: string;
  description: string;
  topicScores: TopicScores;
  relevanceScore: number; // Relevance to releasing agent
  qualityScore: number; // Quality of releasing agent's response
}

interface AdoptionPlan {
  agent: MemoryAgent;
  poolItem: PoolItem;
  requiresRelease: boolean;
  itemToRelease?: { type: 'document' | 'agent'; identifier: string };
}

// ============================================================================
// Global State
// ============================================================================

const documents = new Map<string, Document>();
const agents = new Map<string, MemoryAgent>();
const currentConversationAgents = new Set<string>();

// Track pending releases (apply next iteration)
let pendingReleases: Array<{ agent: string; type: 'document' | 'agent'; item: string }> = [];

// ============================================================================
// Utility Functions
// ============================================================================

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const TOPIC_CLUSTERS = [
  ['react-performance', 'ui-components', 'state-management', 'typescript-patterns'],
  ['api-design', 'authentication', 'security-practices', 'database-optimization', 'system-architecture'],
  ['testing-strategies', 'debugging', 'error-handling', 'code-review', 'refactoring'],
  ['deployment', 'git-workflows', 'documentation', 'performance-monitoring']
];

function clusteredTopicScoresForCluster(clusterIndex: number): TopicScores {
  const cluster = TOPIC_CLUSTERS[clusterIndex];

  const scores = Object.fromEntries(
    TOPICS.map((topic) => [
      topic,
      cluster.includes(topic) ? 0.6 + Math.random() * 0.4 : Math.random() * 0.15 // 0.6-1.0 for cluster topics, 0.0-0.15 for others
    ])
  ) as TopicScores;

  return scores;
}

function aggregateTopicScores(
  documentDescriptions: Map<string, DocumentDescription>,
  childAgents: Set<string>
): TopicScores {
  const aggregated = Object.fromEntries(TOPICS.map((topic) => [topic, 0])) as TopicScores;

  // Aggregate from documents
  for (const docDesc of documentDescriptions.values()) {
    const doc = documents.get(docDesc.originalPath);
    if (doc) {
      for (const topic of TOPICS) {
        aggregated[topic] += doc.topicScores[topic];
      }
    }
  }

  // Aggregate from child agents
  for (const childId of childAgents) {
    const child = agents.get(childId);
    if (child) {
      for (const topic of TOPICS) {
        aggregated[topic] += child.topicScores[topic] * AGENT_SCORE_MULTIPLIER;
      }
    }
  }

  return aggregated;
}

function calculateAgentCapacity(agent: MemoryAgent): number {
  let used = 0;

  // Sum document description tokens
  for (const docDesc of agent.documentDescriptions.values()) {
    used += docDesc.tokens;
  }

  // Sum child agent description tokens
  for (const childId of agent.childAgents) {
    const child = agents.get(childId);
    if (child) {
      used += child.agentDescriptionTokens;
    }
  }

  return used;
}

/**
 * Utility function to add a value to a Map<K, Set<V>>.
 * Creates the Set if it doesn't exist for the given key.
 */
function addToMapSet<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const set = map.get(key) ?? new Set<V>();
  set.add(value);
  map.set(key, set);
}

function generateSemanticIdentifier(doc: Document, existingSiblings: string[]): string {
  // Find top 2 topics
  const sortedTopics = Object.entries(doc.topicScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);

  const baseName = sortedTopics.map(([topic]) => topic).join('-');

  // Check for collisions
  let identifier = baseName;
  let counter = 2;
  while (existingSiblings.includes(identifier)) {
    identifier = `${baseName}-${counter}`;
    counter++;
  }

  return identifier;
}

function topicSimilarity(scores1: TopicScores, scores2: TopicScores): number {
  // Cosine similarity
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const topic of TOPICS) {
    dotProduct += scores1[topic] * scores2[topic];
    mag1 += scores1[topic] * scores1[topic];
    mag2 += scores2[topic] * scores2[topic];
  }

  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * Evaluate whether releasing an item would improve the agent's expected query performance.
 *
 * In a real implementation, this would:
 * 1. Sample representative queries from the agent's domain (based on usage ledger)
 * 2. Simulate answering with current children vs. without this item
 * 3. Compare expected quality scores
 *
 * In the simulation, we approximate this by:
 * - Measuring if the item is misaligned with agent's core topics
 * - Checking if the item consistently produces low-quality responses
 * - Determining if removing it would improve average performance
 */
function evaluateReleaseQualityImprovement(
  agent: MemoryAgent,
  itemTopicScores: TopicScores,
  itemRelevance: number,
  itemQuality: number
): { shouldRelease: boolean; detriment: number; reason: string } {
  // Calculate agent's average quality on recent queries
  const recentQueries = agent.usageLedger.filter((e) => e.type === 'query').slice(-10);

  const currentAvgQuality =
    recentQueries.length > 0
      ? recentQueries.reduce((sum, e) => sum + (e.qualityScore || 0.5), 0) / recentQueries.length
      : 0.5;

  // Check if item is misaligned with agent's core topics
  const coreTopics = TOPICS.filter((t) => agent.topicScores[t] > 0.6);
  const itemCoversCoreTopics = coreTopics.some((t) => itemTopicScores[t] > 0.5);
  const misalignment = itemRelevance < 0.3; // Very low relevance to agent

  // Check if item has low quality
  const lowQuality = itemQuality < 0.3;

  // Check if removing this item would improve average
  const dragOnPerformance = itemQuality < currentAvgQuality * 0.7; // Significantly below average

  let detriment = 0;
  let reason = '';

  if (misalignment && !itemCoversCoreTopics) {
    detriment += 0.3;
    reason = 'misaligned';
  }

  if (lowQuality) {
    detriment += Math.max(0, currentAvgQuality - itemQuality) * 0.5;
    reason = reason ? `${reason}+low_quality` : 'low_quality';
  }

  if (dragOnPerformance) {
    detriment += 0.2;
    reason = reason ? reason : 'below_average';
  }

  const shouldRelease = detriment > 0.2; // Meaningful negative impact

  return {
    shouldRelease,
    detriment,
    reason: reason || 'none'
  };
}

/**
 * Evaluate whether adopting an item would improve the agent's expected query performance.
 *
 * In a real implementation, this would:
 * 1. Sample representative queries from the agent's domain (based on usage ledger)
 * 2. Simulate answering with current children vs. with item added
 * 3. Compare expected quality scores
 *
 * In the simulation, we approximate this by:
 * - Measuring how well the item covers topics the agent currently handles poorly
 * - Considering whether the item adds depth to existing expertise
 * - Weighing the item's quality score
 */
function evaluateAdoptionQualityImprovement(
  agent: MemoryAgent,
  itemTopicScores: TopicScores,
  itemQualityScore: number
): { shouldAdopt: boolean; improvement: number; reason: string } {
  // Get agent's current topic coverage (from all documents and child agents)
  const currentCoverage: TopicScores = { ...agent.topicScores };

  // Calculate agent's current average quality on recent queries
  const recentQueries = agent.usageLedger.filter((e) => e.type === 'query').slice(-10);

  const currentAvgQuality =
    recentQueries.length > 0
      ? recentQueries.reduce((sum, e) => sum + (e.qualityScore || 0.5), 0) / recentQueries.length
      : 0.5;

  // Identify gaps: topics where agent is queried but has low coverage
  // In real system: look at actual query patterns from ledger
  // In simulation: assume queries match agent's topic distribution
  const gaps: { topic: Topic; severity: number }[] = [];
  for (const topic of TOPICS) {
    const agentStrength = currentCoverage[topic];
    const itemStrength = itemTopicScores[topic];

    // Gap exists if: agent has some coverage but not strong, and item could help
    if (agentStrength > 0.2 && agentStrength < 0.7 && itemStrength > agentStrength + 0.1) {
      gaps.push({
        topic,
        severity: (0.7 - agentStrength) * itemStrength // How much this helps
      });
    }
  }

  // Calculate depth: does item strengthen existing strong topics?
  let depthImprovement = 0;
  for (const topic of TOPICS) {
    if (currentCoverage[topic] > 0.7 && itemTopicScores[topic] > 0.7) {
      depthImprovement += itemTopicScores[topic] * currentCoverage[topic];
    }
  }

  // Calculate expected quality improvement
  const gapFilling = gaps.reduce((sum, g) => sum + g.severity, 0);
  const qualityBonus = itemQualityScore > currentAvgQuality ? (itemQualityScore - currentAvgQuality) * 0.2 : 0;

  const totalImprovement = gapFilling + depthImprovement * 0.3 + qualityBonus;

  // Determine reason
  let reason = '';
  if (gapFilling > 0.3) {
    reason = 'fills_gaps';
  } else if (depthImprovement > 0.5) {
    reason = 'adds_depth';
  } else if (qualityBonus > 0.05) {
    reason = 'quality_upgrade';
  } else {
    reason = 'marginal';
  }

  // Adopt if improvement exceeds threshold
  const MIN_IMPROVEMENT = 0.15; // Require meaningful improvement
  const shouldAdopt = totalImprovement > MIN_IMPROVEMENT;

  return {
    shouldAdopt,
    improvement: totalImprovement,
    reason
  };
}

// ============================================================================
// Filesystem Operations
// ============================================================================

function wouldCreateCycle(childId: string, parentId: string): boolean {
  // Check if adopting childId as a child of parentId would create a cycle
  // This happens if parentId is a descendant of childId

  let currentId: string | null = parentId;
  const visited = new Set<string>();

  while (currentId !== null) {
    if (currentId === childId) {
      return true; // Found a cycle
    }

    if (visited.has(currentId)) {
      return true; // Infinite loop detected (shouldn't happen, but defensive)
    }
    visited.add(currentId);

    const currentAgent = agents.get(currentId);
    if (!currentAgent) break;

    currentId = currentAgent.parentPath;
  }

  return false;
}

function getAgentPath(identifier: string): string {
  const agent = agents.get(identifier);
  if (!agent) return '';

  if (agent.parentPath === null) {
    return path.join(MEMORY_SYSTEM_DIR, identifier);
  }

  const parent = agents.get(agent.parentPath);
  if (!parent) return '';

  return path.join(getAgentPath(parent.identifier), identifier);
}

function writeAgentToFilesystem(agent: MemoryAgent) {
  const agentPath = getAgentPath(agent.identifier);
  if (!agentPath) {
    console.error(`ERROR: Cannot write agent ${agent.identifier} - invalid path (parent may be dissolved)`);
    return;
  }
  ensureDir(agentPath);

  // Write agent.md
  const topTopics = Object.entries(agent.topicScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  fs.writeFileSync(
    path.join(agentPath, 'agent.md'),
    `# ${agent.identifier}\n\n${agent.agentDescription}\n\n## Topic Scores\n${topTopics
      .map(([topic, score]) => `- ${topic}: ${score.toFixed(2)}`)
      .join(
        '\n'
      )}\n\n## Capacity\n- Used: ${calculateAgentCapacity(agent)}/${MAX_AGENT_CAPACITY} tokens\n- Documents: ${agent.documentDescriptions.size}\n- Child Agents: ${agent.childAgents.size}`
  );

  // Write document descriptions
  for (const [filename, docDesc] of agent.documentDescriptions) {
    fs.writeFileSync(
      path.join(agentPath, filename),
      `---\noriginal_path: ${docDesc.originalPath}\nagent_specialization: ${docDesc.agentSpecialization}\ntokens: ${docDesc.tokens}\n---\n\n${docDesc.description}`
    );
  }

  // Write ledger
  if (agent.usageLedger.length > 0) {
    const ledgerContent = agent.usageLedger
      .map(
        (entry) =>
          `[${new Date(entry.timestamp).toISOString()}] ${entry.type}: ${entry.details}${
            entry.relevanceScore !== undefined
              ? ` (relevance: ${entry.relevanceScore.toFixed(2)}, quality: ${entry.qualityScore?.toFixed(2)})`
              : ''
          }`
      )
      .join('\n\n');
    fs.writeFileSync(path.join(agentPath, 'usage-ledger.md'), ledgerContent);
  }
}

function deleteAgentFromFilesystem(identifier: string) {
  const agentPath = getAgentPath(identifier);
  if (fs.existsSync(agentPath)) {
    fs.rmSync(agentPath, { recursive: true });
  }
}

// ============================================================================
// Document & Agent Creation
// ============================================================================

function createDocument(filename: string, topicScores: TopicScores): Document {
  const content = `This is a fictitious conversation about ${Object.entries(topicScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([topic]) => topic)
    .join(', ')}.`;

  const tokens = 100 + Math.floor(Math.random() * 400); // 100-500 tokens

  const doc: Document = {
    path: path.join(TRANSCRIPTS_DIR, filename),
    content,
    tokens,
    topicScores
  };

  documents.set(doc.path, doc);

  // Write to filesystem
  ensureDir(TRANSCRIPTS_DIR);
  fs.writeFileSync(doc.path, content);

  return doc;
}

function createDocumentDescription(doc: Document, agentSpecialization: string): DocumentDescription {
  const descTokens = Math.floor(doc.tokens * DOCUMENT_DESCRIPTION_FACTOR);

  const topTopics = Object.entries(doc.topicScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([topic]) => topic);

  return {
    originalPath: doc.path,
    description: `[${agentSpecialization} perspective] Document about ${topTopics.join(', ')}.`,
    tokens: descTokens,
    agentSpecialization
  };
}

function createNewAgentFromTranscript(doc: Document): MemoryAgent {
  // Get root-level siblings
  const rootSiblings = Array.from(agents.values())
    .filter((a) => a.parentPath === null)
    .map((a) => a.identifier);

  const identifier = generateSemanticIdentifier(doc, rootSiblings);

  const docDesc = createDocumentDescription(doc, identifier);

  const agentDesc = `Memory agent specializing in ${identifier}.`;
  const agentDescTokens = Math.ceil(agentDesc.length / 4); // ~4 chars per token

  const agent: MemoryAgent = {
    identifier,
    parentPath: null,
    agentDescription: agentDesc,
    agentDescriptionTokens: agentDescTokens,
    documentDescriptions: new Map([[path.basename(doc.path), docDesc]]),
    childAgents: new Set(),
    usageLedger: [],
    usedInLastConversation: false,
    isNewThisSession: true,
    topicScores: doc.topicScores,
    childrenChangedThisRebalancing: false
  };

  agents.set(identifier, agent);
  writeAgentToFilesystem(agent);

  return agent;
}

// ============================================================================
// Query Simulation
// ============================================================================

function simulateQuery(agentId: string, queryTopicScores: TopicScores): string {
  const agent = agents.get(agentId);
  if (!agent) return 'Agent not found';

  currentConversationAgents.add(agentId);
  agent.usedInLastConversation = true;

  // Calculate relevance (similarity)
  const relevance = topicSimilarity(agent.topicScores, queryTopicScores);

  // Simulate quality as relevance with some variance
  // Real system would use LLM to evaluate response quality
  const variance = (Math.random() - 0.5) * 0.3; // +/- 0.15
  const quality = Math.max(0, Math.min(1, relevance + variance));

  // Simulate querying children - mark them as used too (recursive activation)
  const childrenUsed: string[] = [];

  if (agent.documentDescriptions.size > 0) {
    childrenUsed.push(`${agent.documentDescriptions.size} documents`);
  }

  if (agent.childAgents.size > 0) {
    // Mark child agents as used (they would be queried to help answer)
    for (const childId of agent.childAgents) {
      const child = agents.get(childId);
      if (child) {
        child.usedInLastConversation = true;
        currentConversationAgents.add(childId);
      }
    }
    childrenUsed.push(`${agent.childAgents.size} child agents`);
  }

  const response = `Response based on ${agent.identifier} (relevance: ${relevance.toFixed(2)}, quality: ${quality.toFixed(2)})`;

  // Write to ledger with separate scores
  agent.usageLedger.push({
    type: 'query',
    timestamp: Date.now(),
    details: `Query processed`,
    childrenUsed,
    qualityScore: quality,
    relevanceScore: relevance
  });

  return response;
}

// ============================================================================
// Rebalancing
// ============================================================================

function evaluateHypotheticalTrade(agent: MemoryAgent, poolItem: PoolItem): AdoptionPlan | null {
  const itemTokens =
    poolItem.type === 'document'
      ? Math.floor((documents.get(poolItem.itemIdentifier)?.tokens || 0) * DOCUMENT_DESCRIPTION_FACTOR)
      : agents.get(poolItem.itemIdentifier)?.agentDescriptionTokens || 0;

  const availableCapacity = MAX_AGENT_CAPACITY - calculateAgentCapacity(agent);

  // If has capacity, adopt directly
  if (itemTokens <= availableCapacity) {
    return {
      agent,
      poolItem,
      requiresRelease: false
    };
  }

  const neededCapacity = itemTokens - availableCapacity;

  // Calculate similarity of new item to agent
  const newItemRelevance = topicSimilarity(poolItem.topicScores, agent.topicScores);

  // Find weakest item to release
  let weakestItem: {
    type: 'document' | 'agent';
    identifier: string;
    tokens: number;
    misalignmentScore: number;
    relevance: number;
  } | null = null;

  // Check documents
  for (const [_filename, docDesc] of agent.documentDescriptions) {
    const doc = documents.get(docDesc.originalPath);
    if (!doc) continue;

    const docRelevance = topicSimilarity(doc.topicScores, agent.topicScores);
    const misalignmentScore = 1 - docRelevance; // Higher score = less relevant

    if (docDesc.tokens >= neededCapacity && (!weakestItem || misalignmentScore > weakestItem.misalignmentScore)) {
      weakestItem = {
        type: 'document',
        identifier: docDesc.originalPath,
        tokens: docDesc.tokens,
        misalignmentScore,
        relevance: docRelevance
      };
    }
  }

  // Check child agents
  for (const childId of agent.childAgents) {
    const child = agents.get(childId);
    if (!child) continue;

    const childRelevance = topicSimilarity(child.topicScores, agent.topicScores);
    const misalignmentScore = 1 - childRelevance;

    if (
      child.agentDescriptionTokens >= neededCapacity &&
      (!weakestItem || misalignmentScore > weakestItem.misalignmentScore)
    ) {
      weakestItem = {
        type: 'agent',
        identifier: childId,
        tokens: child.agentDescriptionTokens,
        misalignmentScore,
        relevance: childRelevance
      };
    }
  }

  // Only release if new item is significantly better than what we'd be releasing
  // Require at least 0.05 improvement to prevent thrashing
  const MIN_UPGRADE_IMPROVEMENT = 0.05;
  if (weakestItem && newItemRelevance - weakestItem.relevance > MIN_UPGRADE_IMPROVEMENT) {
    return {
      agent,
      poolItem,
      requiresRelease: true,
      itemToRelease: { type: weakestItem.type, identifier: weakestItem.identifier }
    };
  }

  return null; // Can't make room or not a significant upgrade
}

/**
 * Evaluates and releases documents from an agent to the rebalancing pool.
 * Documents are released if they:
 * 1. Would improve agent performance if removed (low quality/relevance)
 * 2. Don't cluster with sibling documents
 * 3. Are the weakest for opportunistic upgrade
 */
function evaluateDocumentReleases(
  agent: MemoryAgent,
  avgQuality: number,
  rebalancingPool: PoolItem[],
  releasedByAgent: Map<string, Set<string>>,
  documents: Map<string, Document>
): void {
  // Always offer least-aligned document for potential upgrade
  let weakestDoc: { filename: string; docDesc: DocumentDescription; doc: Document; relevance: number } | null = null;

  for (const [filename, docDesc] of agent.documentDescriptions) {
    const doc = documents.get(docDesc.originalPath);
    if (!doc) continue;

    const docRelevance = topicSimilarity(doc.topicScores, agent.topicScores);

    // Track weakest document
    if (!weakestDoc || docRelevance < weakestDoc.relevance) {
      weakestDoc = { filename, docDesc, doc, relevance: docRelevance };
    }

    // Evaluate if releasing this document would improve agent's performance
    const releaseEval = evaluateReleaseQualityImprovement(agent, doc.topicScores, docRelevance, avgQuality);

    if (releaseEval.shouldRelease) {
      rebalancingPool.push({
        type: 'document',
        itemIdentifier: docDesc.originalPath,
        releasingAgent: agent.identifier,
        description: docDesc.description,
        topicScores: doc.topicScores,
        relevanceScore: docRelevance,
        qualityScore: avgQuality
      });
      // Track that this agent released this document during this rebalancing
      addToMapSet(releasedByAgent, agent.identifier, docDesc.originalPath);
      console.log(
        `  ${agent.identifier} offers document: ${path.basename(docDesc.originalPath)} (detriment: ${releaseEval.detriment.toFixed(2)}, reason: ${releaseEval.reason})`
      );
    }
    // Also release if document doesn't cluster with other documents
    else if (agent.documentDescriptions.size > 2) {
      // Calculate average similarity to sibling documents
      let totalSimilarity = 0;
      let siblingCount = 0;

      for (const [otherFilename, otherDocDesc] of agent.documentDescriptions) {
        if (otherFilename === filename) continue;
        const otherDoc = documents.get(otherDocDesc.originalPath);
        if (!otherDoc) continue;

        totalSimilarity += topicSimilarity(doc.topicScores, otherDoc.topicScores);
        siblingCount++;
      }

      const avgSimilarityToSiblings = siblingCount > 0 ? totalSimilarity / siblingCount : 1.0;

      // Release if this document doesn't overlap with siblings (avg similarity < 0.30)
      if (avgSimilarityToSiblings < 0.3) {
        rebalancingPool.push({
          type: 'document',
          itemIdentifier: docDesc.originalPath,
          releasingAgent: agent.identifier,
          description: docDesc.description,
          topicScores: doc.topicScores,
          relevanceScore: docRelevance,
          qualityScore: avgQuality
        });
        // Track that this agent released this document during this rebalancing
        if (!releasedByAgent.has(agent.identifier)) {
          releasedByAgent.set(agent.identifier, new Set());
        }
        releasedByAgent.get(agent.identifier)!.add(docDesc.originalPath);
        console.log(
          `  ${agent.identifier} offers document: ${path.basename(docDesc.originalPath)} (relevance: ${docRelevance.toFixed(2)}, doc_overlap: ${avgSimilarityToSiblings.toFixed(2)}, reason: no_cluster)`
        );
      }
    }
  }

  // Also offer weakest document for opportunistic upgrade (if not already offered)
  if (weakestDoc && agent.documentDescriptions.size > 0) {
    const alreadyOffered = rebalancingPool.some(
      (item) =>
        item.type === 'document' &&
        item.itemIdentifier === weakestDoc.docDesc.originalPath &&
        item.releasingAgent === agent.identifier
    );

    if (!alreadyOffered) {
      rebalancingPool.push({
        type: 'document',
        itemIdentifier: weakestDoc.docDesc.originalPath,
        releasingAgent: agent.identifier,
        description: weakestDoc.docDesc.description,
        topicScores: weakestDoc.doc.topicScores,
        relevanceScore: weakestDoc.relevance,
        qualityScore: avgQuality
      });
      // Track that this agent released this document during this rebalancing
      if (!releasedByAgent.has(agent.identifier)) {
        releasedByAgent.set(agent.identifier, new Set());
      }
      releasedByAgent.get(agent.identifier)!.add(weakestDoc.docDesc.originalPath);
      console.log(
        `  ${agent.identifier} offers document: ${path.basename(weakestDoc.docDesc.originalPath)} (relevance: ${weakestDoc.relevance.toFixed(2)}, quality: ${avgQuality.toFixed(2)}, reason: weakest_for_upgrade)`
      );
    }
  }
}

/**
 * Evaluates and releases child agents from a parent agent to the rebalancing pool.
 * Child agents are released if they:
 * 1. Would improve parent performance if removed (low quality/relevance)
 * 2. Don't cluster with sibling agents (lack topic overlap)
 */
function evaluateChildAgentReleases(
  agent: MemoryAgent,
  avgQuality: number,
  rebalancingPool: PoolItem[],
  agents: Map<string, MemoryAgent>
): void {
  for (const childId of agent.childAgents) {
    const child = agents.get(childId);
    if (!child) continue;

    const childRelevance = topicSimilarity(child.topicScores, agent.topicScores);

    // Get child agent's average quality from its ledger
    const childQueries = child.usageLedger.filter((e) => e.type === 'query').slice(-5);
    const childQuality =
      childQueries.length > 0
        ? childQueries.reduce((sum, e) => sum + (e.qualityScore || 0.5), 0) / childQueries.length
        : 0.5;

    // Evaluate if releasing this child agent would improve parent's performance
    const releaseEval = evaluateReleaseQualityImprovement(agent, child.topicScores, childRelevance, childQuality);

    if (releaseEval.shouldRelease) {
      rebalancingPool.push({
        type: 'agent',
        itemIdentifier: childId,
        releasingAgent: agent.identifier,
        description: child.agentDescription,
        topicScores: child.topicScores,
        relevanceScore: childRelevance,
        qualityScore: childQuality
      });
      console.log(
        `  ${agent.identifier} offers child agent: ${childId} (detriment: ${releaseEval.detriment.toFixed(2)}, reason: ${releaseEval.reason})`
      );
    }
    // Also release if child doesn't cluster with other children (lacks topic overlap)
    // This allows specialized agents to become independent roots
    else if (agent.childAgents.size > 1) {
      // Calculate average similarity to sibling agents
      let totalSimilarity = 0;
      let siblingCount = 0;

      for (const siblingId of agent.childAgents) {
        if (siblingId === childId) continue;
        const sibling = agents.get(siblingId);
        if (!sibling) continue;

        totalSimilarity += topicSimilarity(child.topicScores, sibling.topicScores);
        siblingCount++;
      }

      const avgSimilarityToSiblings = siblingCount > 0 ? totalSimilarity / siblingCount : 1.0;

      // Release if this child doesn't overlap with siblings (avg similarity < 0.35)
      if (avgSimilarityToSiblings < 0.35) {
        rebalancingPool.push({
          type: 'agent',
          itemIdentifier: childId,
          releasingAgent: agent.identifier,
          description: child.agentDescription,
          topicScores: child.topicScores,
          relevanceScore: childRelevance,
          qualityScore: avgQuality
        });
        console.log(
          `  ${agent.identifier} offers child agent: ${childId} (relevance: ${childRelevance.toFixed(2)}, sibling_overlap: ${avgSimilarityToSiblings.toFixed(2)}, reason: no_cluster)`
        );
      }
    }
  }
}

function rebalance(newTranscript: Document) {
  console.log('\n=== REBALANCING START ===\n');

  const newAgent = createNewAgentFromTranscript(newTranscript);
  console.log(`Created new agent: ${newAgent.identifier}`);

  let iteration = 0;
  let adoptionsOccurred = true;

  // Track items each agent has released during this entire rebalancing session
  // This prevents agents from re-adopting documents they released
  const releasedByAgent = new Map<string, Set<string>>(); // agentId -> Set of document/agent paths

  while (adoptionsOccurred && iteration < MAX_REBALANCING_ITERATIONS) {
    iteration++;
    console.log(`\n--- Iteration ${iteration} ---`);

    if (iteration > 1 && pendingReleases.length > 0) {
      console.log(`Applying ${pendingReleases.length} pending releases from previous iteration`);
      for (const release of pendingReleases) {
        const agent = agents.get(release.agent);
        if (agent) {
          if (release.type === 'document') {
            agent.documentDescriptions.delete(path.basename(release.item));
          } else {
            agent.childAgents.delete(release.item);
          }
          agent.childrenChangedThisRebalancing = true;
        }
      }
      pendingReleases = [];
    }

    const rebalancingPool: PoolItem[] = [];

    // Get participating agents (used in last conversation, not new)
    const participatingAgents = Array.from(agents.values())
      .filter((a) => a.usedInLastConversation && !a.isNewThisSession)
      .sort((a, b) => calculateAgentCapacity(a) - calculateAgentCapacity(b)); // Most capacity first (lowest usage)

    console.log(`Participating agents: ${participatingAgents.map((a) => a.identifier).join(', ') || 'none'}`);

    if (participatingAgents.length === 0) {
      console.log('No participating agents. Rebalancing complete.');
      break;
    }

    // Release phase
    for (const agent of participatingAgents) {
      // Identify weak items based on ledger
      const recentQueries = agent.usageLedger.filter((e) => e.type === 'query').slice(-5);

      const avgQuality =
        recentQueries.length > 0
          ? recentQueries.reduce((sum, e) => sum + (e.qualityScore || 0), 0) / recentQueries.length
          : 0.5;

      // Evaluate document releases
      evaluateDocumentReleases(agent, avgQuality, rebalancingPool, releasedByAgent, documents);

      // Evaluate child agent releases
      evaluateChildAgentReleases(agent, avgQuality, rebalancingPool, agents);
    }

    // Root-level agents (except new ones) can be adopted
    // This allows hierarchy formation
    // Only offer root agents when root level is at ≥80% capacity (prevents premature consolidation)
    const rootAgents = Array.from(agents.values()).filter((a) => a.parentPath === null);
    const totalRootCapacity = rootAgents.reduce((sum, a) => sum + calculateAgentCapacity(a), 0);
    const maxRootCapacity = MAX_AGENT_CAPACITY * rootAgents.length;
    const rootCapacityRatio = maxRootCapacity > 0 ? totalRootCapacity / maxRootCapacity : 0;

    console.log(`Root capacity: ${totalRootCapacity}/${maxRootCapacity} (${(rootCapacityRatio * 100).toFixed(1)}%)`);

    if (rootCapacityRatio >= ROOT_ADOPTION_CAPACITY_THRESHOLD) {
      console.log(
        `Root capacity threshold met (≥${(ROOT_ADOPTION_CAPACITY_THRESHOLD * 100).toFixed(0)}%). Offering ${rootAgents.filter((a) => !a.isNewThisSession).length} root agents to pool.`
      );
      for (const rootAgent of agents.values()) {
        if (rootAgent.parentPath !== null) continue; // Not a root agent
        if (rootAgent.isNewThisSession) continue; // New agents sit out first rebalancing

        // Root agent can be adopted if it would benefit another agent's specialization
        const recentQueries = rootAgent.usageLedger.filter((e) => e.type === 'query').slice(-5);
        const avgQuality =
          recentQueries.length > 0
            ? recentQueries.reduce((sum, e) => sum + (e.qualityScore || 0.5), 0) / recentQueries.length
            : 0.5;

        rebalancingPool.push({
          type: 'agent',
          itemIdentifier: rootAgent.identifier,
          releasingAgent: ROOT_LEVEL_IDENTIFIER, // Special case: no specific releasing agent
          description: rootAgent.agentDescription,
          topicScores: rootAgent.topicScores,
          relevanceScore: 1.0, // Root agents are maximally relevant to themselves
          qualityScore: avgQuality
        });
      }
    } else {
      console.log(
        `Root capacity below threshold (${(rootCapacityRatio * 100).toFixed(1)}% < ${(ROOT_ADOPTION_CAPACITY_THRESHOLD * 100).toFixed(0)}%). Root agents not offered.`
      );
    }

    if (rebalancingPool.length === 0) {
      console.log('No items in pool. Rebalancing complete.');
      break;
    }

    console.log(`Pool has ${rebalancingPool.length} items`);

    const adoptionPlans: AdoptionPlan[] = [];
    const childAgentAdoptions = new Map<string, AdoptionPlan[]>();

    for (const agent of participatingAgents) {
      for (const poolItem of rebalancingPool) {
        if (poolItem.releasingAgent === agent.identifier) continue;
        if (poolItem.type === 'agent' && poolItem.itemIdentifier === agent.identifier) continue; // Can't adopt yourself

        // Documents: can't re-adopt something you released during this rebalancing session
        if (poolItem.type === 'document') {
          const releasedItems = releasedByAgent.get(agent.identifier);
          if (releasedItems && releasedItems.has(poolItem.itemIdentifier)) {
            continue; // Skip - agent released this document earlier in this rebalancing
          }
        }

        // Evaluate if adoption would improve agent's query performance
        const qualityEval = evaluateAdoptionQualityImprovement(agent, poolItem.topicScores, poolItem.qualityScore);

        // For child agents, require higher improvement threshold to keep more at root level
        const improvementThreshold = poolItem.type === 'agent' ? 0.25 : 0.15;
        const shouldConsiderAdoption = qualityEval.improvement > improvementThreshold;

        if (shouldConsiderAdoption) {
          const plan = evaluateHypotheticalTrade(agent, poolItem);

          if (plan) {
            if (poolItem.type === 'document') {
              adoptionPlans.push(plan);
              console.log(
                `  ${agent.identifier} wants to adopt document ${path.basename(poolItem.itemIdentifier)} (improvement: ${qualityEval.improvement.toFixed(2)}, reason: ${qualityEval.reason}, doc_qual: ${poolItem.qualityScore.toFixed(2)}${plan.requiresRelease ? ', req_release' : ''})`
              );
            } else {
              if (!childAgentAdoptions.has(poolItem.itemIdentifier)) {
                childAgentAdoptions.set(poolItem.itemIdentifier, []);
              }
              childAgentAdoptions.get(poolItem.itemIdentifier)!.push(plan);
              console.log(
                `  ${agent.identifier} wants to adopt child agent ${poolItem.itemIdentifier} (improvement: ${qualityEval.improvement.toFixed(2)}, reason: ${qualityEval.reason}, doc_qual: ${poolItem.qualityScore.toFixed(2)}${plan.requiresRelease ? ', req_release' : ''})`
              );
            }
          }
        }
      }
    }

    for (const [_childId, competingPlans] of childAgentAdoptions) {
      if (competingPlans.length > 0) {
        // Winner = agent with most available capacity (after hypothetical release)
        const winner = competingPlans.sort((a, b) => {
          const capacityA =
            MAX_AGENT_CAPACITY -
            calculateAgentCapacity(a.agent) +
            (a.itemToRelease?.type === 'agent'
              ? (agents.get(a.itemToRelease.identifier)?.agentDescriptionTokens ?? 0)
              : 0);
          const capacityB =
            MAX_AGENT_CAPACITY -
            calculateAgentCapacity(b.agent) +
            (b.itemToRelease?.type === 'agent'
              ? (agents.get(b.itemToRelease.identifier)?.agentDescriptionTokens ?? 0)
              : 0);
          return capacityB - capacityA;
        })[0];

        adoptionPlans.push(winner);
        console.log(`  → ${winner.agent.identifier} wins adoption (most capacity)`);
      }
    }

    // Execute adoptions
    adoptionsOccurred = false;
    const releasedItems = new Set<string>();

    for (const plan of adoptionPlans) {
      const { agent, poolItem, requiresRelease, itemToRelease } = plan;

      // Execute hypothetical release if needed
      if (requiresRelease && itemToRelease) {
        pendingReleases.push({
          agent: agent.identifier,
          type: itemToRelease.type,
          item: itemToRelease.identifier
        });
        console.log(
          `  ${agent.identifier} will release ${itemToRelease.type} ${itemToRelease.type === 'document' ? path.basename(itemToRelease.identifier) : itemToRelease.identifier} next iteration`
        );
      }

      // Execute adoption
      if (poolItem.type === 'document') {
        const doc = documents.get(poolItem.itemIdentifier);
        if (!doc) continue;

        // Create agent-specific description
        const docDesc = createDocumentDescription(doc, agent.identifier);
        agent.documentDescriptions.set(path.basename(doc.path), docDesc);
        agent.childrenChangedThisRebalancing = true;

        // If adopted, releasing agent schedules removal (next iteration)
        if (!releasedItems.has(poolItem.itemIdentifier)) {
          pendingReleases.push({
            agent: poolItem.releasingAgent,
            type: 'document',
            item: poolItem.itemIdentifier
          });
          releasedItems.add(poolItem.itemIdentifier);
        }

        adoptionsOccurred = true;
        console.log(`  ✓ ${agent.identifier} adopted document ${path.basename(poolItem.itemIdentifier)}`);

        agent.usageLedger.push({
          type: 'rebalancing',
          timestamp: Date.now(),
          details: `Adopted document ${path.basename(poolItem.itemIdentifier)}${requiresRelease ? ' (released item to make room)' : ''}`
        });
      } else if (poolItem.type === 'agent') {
        if (releasedItems.has(poolItem.itemIdentifier)) continue; // Already adopted by someone else

        const childAgent = agents.get(poolItem.itemIdentifier);
        if (!childAgent) continue;

        // Check for cycles before adoption
        if (wouldCreateCycle(poolItem.itemIdentifier, agent.identifier)) {
          console.log(`  ✗ ${agent.identifier} cannot adopt ${poolItem.itemIdentifier} (would create cycle)`);
          continue;
        }

        // Check if parent has capacity to absorb all child's documents (agent dissolution)
        const childDocumentTokens = Array.from(childAgent.documentDescriptions.values()).reduce(
          (sum, docDesc) => sum + docDesc.tokens,
          0
        );
        const parentAvailableCapacity = MAX_AGENT_CAPACITY - calculateAgentCapacity(agent);

        if (childDocumentTokens <= parentAvailableCapacity && childAgent.childAgents.size === 0) {
          // Dissolve child agent: move all documents to parent
          for (const [filename, docDesc] of childAgent.documentDescriptions) {
            const doc = documents.get(docDesc.originalPath);
            if (doc) {
              const parentDocDesc = createDocumentDescription(doc, agent.identifier);
              agent.documentDescriptions.set(filename, parentDocDesc);
            }
          }

          // Remove child agent entirely
          if (poolItem.releasingAgent !== ROOT_LEVEL_IDENTIFIER) {
            pendingReleases.push({
              agent: poolItem.releasingAgent,
              type: 'agent',
              item: poolItem.itemIdentifier
            });
          }
          deleteAgentFromFilesystem(poolItem.itemIdentifier);
          agents.delete(poolItem.itemIdentifier);
          releasedItems.add(poolItem.itemIdentifier);
          agent.childrenChangedThisRebalancing = true;

          adoptionsOccurred = true;
          console.log(
            `  ✓ ${agent.identifier} dissolved child agent ${poolItem.itemIdentifier} (absorbed ${childAgent.documentDescriptions.size} docs)`
          );

          agent.usageLedger.push({
            type: 'rebalancing',
            timestamp: Date.now(),
            details: `Dissolved child agent ${poolItem.itemIdentifier}, absorbed ${childAgent.documentDescriptions.size} documents`
          });
        } else {
          // Keep child agent as separate entity
          if (poolItem.releasingAgent !== ROOT_LEVEL_IDENTIFIER) {
            pendingReleases.push({
              agent: poolItem.releasingAgent,
              type: 'agent',
              item: poolItem.itemIdentifier
            });
          }
          deleteAgentFromFilesystem(poolItem.itemIdentifier);

          agent.childAgents.add(poolItem.itemIdentifier);
          childAgent.parentPath = agent.identifier;
          releasedItems.add(poolItem.itemIdentifier);
          agent.childrenChangedThisRebalancing = true;

          adoptionsOccurred = true;
          console.log(`  ✓ ${agent.identifier} adopted child agent ${poolItem.itemIdentifier}`);

          agent.usageLedger.push({
            type: 'rebalancing',
            timestamp: Date.now(),
            details: `Adopted child agent ${poolItem.itemIdentifier}${requiresRelease ? ' (released item to make room)' : ''}`
          });
        }
      }
    }

    if (!adoptionsOccurred) {
      console.log('No adoptions occurred. Rebalancing complete.');
    }

    // Release unadopted child agents back to root level
    // If a child agent was offered but not adopted, it becomes a root agent
    for (const poolItem of rebalancingPool) {
      if (poolItem.type === 'agent' && !releasedItems.has(poolItem.itemIdentifier)) {
        const childAgent = agents.get(poolItem.itemIdentifier);
        if (childAgent && childAgent.parentPath !== null && poolItem.releasingAgent !== ROOT_LEVEL_IDENTIFIER) {
          // This child was offered but not adopted - release to root
          childAgent.parentPath = null;
          const parent = agents.get(poolItem.releasingAgent);
          if (parent) {
            parent.childAgents.delete(poolItem.itemIdentifier);
            parent.childrenChangedThisRebalancing = true;
          }
          console.log(`  → ${poolItem.itemIdentifier} released to root (unadopted)`);
        }
      }
    }
  }

  // Create new agents for unclaimed documents
  console.log('\n--- Processing Unclaimed Documents ---');

  // Track all documents currently held by agents
  const claimedDocuments = new Set<string>();
  for (const agent of agents.values()) {
    for (const docDesc of agent.documentDescriptions.values()) {
      claimedDocuments.add(docDesc.originalPath);
    }
  }

  // Find unclaimed documents
  const unclaimedDocuments: Document[] = [];
  for (const doc of documents.values()) {
    if (!claimedDocuments.has(doc.path)) {
      unclaimedDocuments.push(doc);
    }
  }

  if (unclaimedDocuments.length > 0) {
    console.log(`Found ${unclaimedDocuments.length} unclaimed documents`);

    // Calculate total root-level capacity
    const rootAgents = Array.from(agents.values()).filter((a) => a.parentPath === null);
    const totalRootCapacity = rootAgents.reduce((sum, a) => sum + calculateAgentCapacity(a), 0);
    const rootHasRoom = totalRootCapacity < MAX_AGENT_CAPACITY * rootAgents.length;

    if (rootHasRoom) {
      for (const doc of unclaimedDocuments) {
        // Create new agent for this document
        const allAgentIds = Array.from(agents.keys());
        const identifier = generateSemanticIdentifier(doc, allAgentIds);

        // Skip if this would create a duplicate (shouldn't happen, but defensive)
        if (agents.has(identifier)) {
          console.log(`  Skipping duplicate agent identifier: ${identifier}`);
          continue;
        }

        const docDesc = createDocumentDescription(doc, identifier);
        const agentDesc = `Memory agent specializing in ${identifier}.`;
        const agentDescTokens = Math.ceil(agentDesc.length / 4);

        const newAgent: MemoryAgent = {
          identifier,
          parentPath: null,
          agentDescription: agentDesc,
          agentDescriptionTokens: agentDescTokens,
          documentDescriptions: new Map([[path.basename(doc.path), docDesc]]),
          childAgents: new Set(),
          usageLedger: [],
          usedInLastConversation: false,
          isNewThisSession: true,
          topicScores: doc.topicScores,
          childrenChangedThisRebalancing: false
        };

        agents.set(identifier, newAgent);
        writeAgentToFilesystem(newAgent);

        console.log(`  Created new agent for unclaimed document: ${identifier} (${path.basename(doc.path)})`);
      }
    } else {
      console.log(
        `  No room at root level for new agents (capacity: ${totalRootCapacity}/${MAX_AGENT_CAPACITY * rootAgents.length})`
      );
    }
  } else {
    console.log('All documents are claimed by agents');
  }

  // Fix orphaned agents (parent was dissolved)
  for (const agent of agents.values()) {
    if (agent.parentPath !== null && !agents.has(agent.parentPath)) {
      console.log(`  Fixing orphaned agent: ${agent.identifier} (parent ${agent.parentPath} was dissolved)`);
      agent.parentPath = null; // Move to root
    }
  }

  // Post-rebalancing updates
  console.log('\n--- Post-Rebalancing Updates ---');

  for (const agent of agents.values()) {
    // Update topic scores
    agent.topicScores = aggregateTopicScores(agent.documentDescriptions, agent.childAgents);

    // Update descriptions if children changed
    if (agent.childrenChangedThisRebalancing) {
      // Re-generate description based on topic scores
      const topTopics = Object.entries(agent.topicScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([topic]) => topic);

      agent.agentDescription = `Memory agent specializing in ${topTopics.join(', ')}.`;
      agent.agentDescriptionTokens = Math.ceil(agent.agentDescription.length / 4);

      console.log(`  Updated ${agent.identifier} description`);

      agent.usageLedger.push({
        type: 'rebalancing',
        timestamp: Date.now(),
        details: `Updated description based on changed children`
      });
    }

    // Reset flags
    agent.childrenChangedThisRebalancing = false;

    // Write to filesystem
    writeAgentToFilesystem(agent);
  }

  console.log('\n=== REBALANCING COMPLETE ===\n');
  console.log(`Total iterations: ${iteration}`);
  console.log(`Total agents: ${agents.size}`);
  console.log(`Root-level agents: ${Array.from(agents.values()).filter((a) => a.parentPath === null).length}`);
}

// ============================================================================
// Main Simulation
// ============================================================================

function runSimulation() {
  console.log('Memory System Simulation\n');

  // Clean up temp directory
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
  }
  ensureDir(TEMP_DIR);
  ensureDir(MEMORY_SYSTEM_DIR);

  // Simulate 30 conversations (5 per cluster, repeated)
  for (let i = 1; i <= 30; i++) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CONVERSATION ${i}`);
    console.log('='.repeat(80));

    // Reset conversation state
    currentConversationAgents.clear();
    for (const agent of agents.values()) {
      agent.usedInLastConversation = false;
      agent.isNewThisSession = false;
    }

    // Create conversation in series: 5 consecutive conversations in same cluster
    const clusterIndex = Math.floor((i - 1) / 5) % 4;
    const transcript = createDocument(`conversation-${i}.md`, clusteredTopicScoresForCluster(clusterIndex));

    console.log(
      `\nConversation ${i} (cluster ${clusterIndex}) about: ${Object.entries(transcript.topicScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([topic, score]) => `${topic} (${score.toFixed(2)})`)
        .join(', ')}`
    );

    // Simulate some queries if agents exist
    const rootAgents = Array.from(agents.values()).filter((a) => a.parentPath === null);

    if (rootAgents.length > 0) {
      console.log('\n--- Queries ---');

      // Query top 3 most relevant agents (instead of just 1)
      const relevantAgents = rootAgents
        .map((agent) => ({
          agent,
          similarity: topicSimilarity(agent.topicScores, transcript.topicScores)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);

      for (const { agent, similarity } of relevantAgents) {
        if (similarity > 0.15) {
          console.log(`Querying: ${agent.identifier} (similarity: ${similarity.toFixed(2)})`);
          const response = simulateQuery(agent.identifier, transcript.topicScores);
          console.log(response);
        }
      }

      if (!relevantAgents.some(({ similarity }) => similarity > 0.15)) {
        console.log('No relevant agents found for query.');
      }
    }

    // SessionEnd: trigger rebalancing
    rebalance(transcript);

    // Print current state
    console.log('\n--- Current Memory Structure ---');
    const rootAgentsAfter = Array.from(agents.values()).filter((a) => a.parentPath === null);
    console.log(`Root agents (${rootAgentsAfter.length}):`);
    for (const agent of rootAgentsAfter) {
      const capacity = calculateAgentCapacity(agent);
      console.log(
        `  - ${agent.identifier} (${capacity}/${MAX_AGENT_CAPACITY} tokens, ${agent.documentDescriptions.size} docs, ${agent.childAgents.size} children)`
      );

      for (const childId of agent.childAgents) {
        const child = agents.get(childId);
        if (child) {
          const childCapacity = calculateAgentCapacity(child);
          console.log(
            `    - ${childId} (${childCapacity}/${MAX_AGENT_CAPACITY} tokens, ${child.documentDescriptions.size} docs)`
          );
        }
      }
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('SIMULATION COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nResults written to: ${TEMP_DIR}`);
  console.log(`Total agents created: ${agents.size}`);
  console.log(`Total documents: ${documents.size}`);
  console.log(`Final root-level agents: ${Array.from(agents.values()).filter((a) => a.parentPath === null).length}`);
}

// ============================================================================
// Run
// ============================================================================

runSimulation();
