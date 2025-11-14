# Memory System Plugin - Design Specification v2

## Executive Summary

A Claude Code plugin that creates a self-organizing, hierarchical memory system for Claude. The system automatically captures conversation transcripts, organizes them through specialized memory agents, and makes them queryable through a natural interface. Memory agents autonomously trade documents and reorganize themselves based on usage patterns, creating an evolving knowledge graph optimized for the user's actual query patterns.

## Core Architecture

### Graph Structure

The memory system is a **directional graph** with two node types:

- **Memory Agents**: Claude instances that specialize in specific domains and answer queries
- **Documents**: Conversation transcripts and other files (PDFs, images, markdown)

**Parent Relationship Rules:**
- Documents can have **multiple parent agents** (many-to-many with agents)
- Memory agents can have **only one parent agent** (many-to-one with agents)
- Root level contains only memory agents (no documents at root)

### Filesystem Representation

The graph is mirrored in a hierarchical filesystem under `memory-system/`:

```
memory-system/
  react-performance/              # Root-level agent (identifier: react-performance)
    agent.md                      # Agent's self-description
    usage-ledger.md               # Usage tracking for rebalancing
    transcript-2024-11-01.md      # Document description (React-focused)
    typescript-patterns/          # Child agent
      agent.md
      usage-ledger.md
      transcript-2024-11-01.md    # Same doc, TypeScript-focused description
  api-design/                     # Root-level agent
    agent.md
    usage-ledger.md
    transcript-2024-11-13.md      # Different document
```

**Key Properties:**
- Directory name = Memory Agent Identifier (unique among siblings)
- `agent.md` = Agent's self-description of capabilities
- `usage-ledger.md` = Usage tracking for rebalancing decisions
- Other `.md` files = Agent-specific document descriptions
- Subdirectories = Child memory agents

### Document Storage

**Original documents** remain in their filesystem locations:
- Conversation transcripts stay in Claude Code's default transcript directory
- PDFs, images, etc. stay wherever they exist
- All document types converted to markdown for analysis

**Document descriptions** live in agent directories:
- Each parent agent creates its own specialized description
- Same document can have multiple descriptions under different agents
- Descriptions tailored to each agent's specialization focus

## User-Facing Workflow

### SessionStart

1. SessionStart hook scans `memory-system/` root directory
2. Reads each root-level agent's identifier and description
3. Injects as `additionalContext` via `hookSpecificOutput.additionalContext`
4. Claude receives context: "You have access to these memory agents: [list]"

**User Experience:** Claude is aware of available memory and can proactively suggest using it.

### During Session - Query Flow

1. User asks question (or Claude proactively queries memory)
2. Claude calls `memory:agent->prompt` tool with agent identifier and prompt
3. Memory agent receives **only the prompt** (no conversation context)
4. Agent lists its directory to see children:
   - Document description files
   - Child agent subdirectories
5. Agent decides using **its own discretion**:
   - Read document descriptions/original documents
   - Query child agents (recursively)
6. Agent returns response to Claude
7. Agent writes query entry to its usage ledger (for rebalancing)

**User Experience:** Transparent memory queries, feels like Claude "remembering" past conversations.

### SessionEnd - Automatic Capture

1. Claude Code saves conversation transcript (automatic)
2. SessionEnd hook fires, triggers rebalancing (fire-and-forget, asynchronous)
3. User session ends immediately, rebalancing happens in background

**User Experience:** No waiting, conversations automatically become part of memory.

## Memory Agent Behavior

### Capacity Management

**Token Threshold (uniform across all agents):**
- Maximum total tokens of direct children descriptions only:
  - Sum of all document descriptions in directory
  - Sum of all child agent descriptions (`agent.md` files)
  - Excludes: grandchildren, usage ledger, own description

**When at capacity:**
- Agent must release items to adopt new ones
- Releases are conditional (only occur if someone adopts)

### Query Response

**During normal queries:**
1. Receive prompt (no conversation context)
2. List directory to see available children
3. Decide whether to:
   - Read document descriptions/contents
   - Query child agents
   - Some combination
4. Formulate response based on available information
5. Self-evaluate response quality
6. Write entry to usage ledger:
   - Which children were used and for what
   - Quality of child responses/documents
   - Self-evaluated quality of own response

**Ledger is NOT accessed during queries** (only during rebalancing).

### Identifier Management

**Creating Identifiers:**
- New agents analyze their content to generate semantic identifiers
- Examples: `react-performance`, `api-design-patterns`, `reddit-writing-style`
- Must check for collisions with siblings (same directory level)
- If collision, regenerate while aware of sibling descriptions

**Updating Identifiers:**
- Agents can rename themselves after rebalancing
- Triggered by: children changed OR ledger grew
- New identifier must be unique among siblings
- Directory name updated to match

## Rebalancing System

### Trigger and Timing

**When:** After every SessionEnd (when new transcript available)

**How:**
- SessionEnd hook spawns rebalancing process
- Fire-and-forget (hook returns immediately)
- Rebalancing runs asynchronously in background

### New Agent Creation

**Every transcript gets its own agent:**

1. Document description generated (constant factor × transcript markdown tokens)
2. New agent analyzes description + document
3. Generates semantic identifier (checking for root-level collisions)
4. Creates agent description based on:
   - Content (what the transcript contains)
   - Capabilities (what queries it could answer)
   - Specialization (what domain/category)
5. New agent placed at root level
6. **New agent sits out first rebalancing session:**
   - Cannot adopt items
   - Cannot be adopted
   - Becomes eligible for normal rebalancing in future sessions

### Iterative Trading Loop

Rebalancing runs **sequential iterations** until no more trades occur:

**Shared State:**
- Temporary `rebalancing-pool.json` tracks items available for adoption
- Persists across iterations, deleted when rebalancing completes

**Turn Order (each iteration):**
- Agents sorted by **available capacity** (most free space first)
- Agents with more capacity have priority to adopt

**Participation:**
- Only agents **used in previous conversation** participate
- "Used" means: agent was queried OR agent's children were used (recursive activation)
- Example: If query goes Root → Child → Grandchild, all three participate in rebalancing
- Newly created agents sit out (marked ineligible for first rebalancing)
- Unused agents don't trade

**Each Agent's Turn (in capacity order):**

1. **Release Evaluation:**
   - Review usage ledger
   - **Can release: Only immediate children** (documents and child agents)
   - Evaluate each item's performance impact:
     - **Quality-based assessment:** Would removing this item improve expected query performance?
       - Misalignment: Item doesn't cover agent's core topics (relevance < 0.3)
       - Low quality: Item has poor absolute quality (< 0.3)
       - Below average: Item drags down performance (quality < 70% of agent average)
     - **Clustering:** Document/agent doesn't have topic overlap with siblings
       - Documents: If avg similarity to other documents < 0.30 (requires 3+ docs)
       - Child agents: If avg similarity to sibling agents < 0.35 (requires 2+ children)
     - **Opportunistic upgrade:** Always offer weakest document for potential swap
   - Mark items as "available for adoption" in pool
   - Items remain with agent (release is conditional)
   - Can release unlimited items
   - **Cannot re-adopt items released during this rebalancing session**
     - Tracked across all iterations within the same rebalancing
     - Prevents cycling where documents bounce between agents
   - **Root-level agents** (except newly created) are also offered to pool for adoption
     - Only when root level is at ≥80% capacity (prevents premature consolidation)
     - Root capacity = sum of all root agents' token usage / (MAX_CAPACITY × num_root_agents)

2. **Adoption Evaluation:**
   - Review items in pool
   - **Quality-based assessment:** Would adopting this item improve expected query performance?
     - Gap filling: Item strengthens topics with moderate coverage (0.2-0.7)
     - Depth building: Item adds expertise to strong topics (>0.7)
     - Quality upgrade: Item has higher quality than current average
   - For documents: read description + actual content
   - For child agents: read description only (not subtree)
   - Calculate adoption decisions:
     - **Has capacity:** adopt directly if quality improvement exceeds threshold
     - **At capacity:** identify what to release to make room (hypothetical trade)

3. **Adoption Execution (after all agents evaluated):**
   - **Documents:**
     - Multiple agents can adopt same document
     - Each creates own specialized description
     - Original stays with releasing parent (unless adopted)
   - **Child Agents:**
     - Only one agent can adopt (single-parent constraint)
     - If multiple want it: agent with **most available capacity** wins
     - **Agent Dissolution:** If parent has capacity to absorb all child's documents:
       - Child agent is dissolved (deleted)
       - All child's documents adopted directly by parent
       - Only applies if child has no sub-agents of its own
       - Prevents unnecessary hierarchy depth
     - Otherwise: Entire subtree moves to new parent as-is
     - Releasing parent keeps it if nobody adopts
   - Releasing parent frees capacity in **next iteration** (not current)

4. **Convergence Check:**
   - If any adoptions occurred → continue to next iteration
   - If no adoptions occurred → rebalancing complete

5. **Unclaimed Document Recovery:**
   - After rebalancing loop completes, check for documents not held by any agent
   - If root level has capacity: create new agents for unclaimed documents
   - If root level is at capacity: documents remain orphaned (error condition)
   - New agents created with single document, marked as new for next rebalancing

6. **Orphaned Agent Repair:**
   - Detect agents whose parent no longer exists (dissolved during rebalancing)
   - Promote orphaned agents to root level (set parentPath = null)
   - Ensures no broken references after aggressive dissolution

### Post-Rebalancing Updates

**After trading loop completes:**

1. **Metadata Updates** (only agents with changes):
   - Changed children (successful trades) → update `agent.md`
   - Ledger growth (answered queries) → update `agent.md`
   - Unsuccessful releases only → NO update
   - Updates based on:
     - Current children (documents + child agents)
     - Usage patterns from ledger

2. **Identifier Updates:**
   - Agents with changes can rename themselves
   - Based on evolved specialization
   - Must remain unique among siblings

3. **Ledger Updates:**
   - Agents write rebalancing entries:
     - Items released and reasoning
     - Items adopted and reasoning
     - Overall outcome (what changed)
   - These entries inform future rebalancing

4. **Filesystem Writes:**
   - All changes written directly to disk
   - No automatic git commits
   - User can commit manually later

## Usage Ledger

### Purpose

Ledgers track agent behavior to inform rebalancing decisions.

**Used During:**
- Rebalancing (primary purpose)

**NOT Used During:**
- Normal query responses

### Entry Types

**1. Query Response Entries:**
- Which children used (documents/agents)
- What they were used for (purpose/query)
- Quality of child responses/documents
- Self-evaluated quality of own response

**2. Rebalancing Entries:**
- Items released + reasoning
- Items adopted + reasoning
- Overall outcome (children changes)

### Maintenance

**Growth:**
- Query entries added during sessions
- Rebalancing entries added during rebalancing

**Pruning:**
- Triggered when ledger reaches size threshold (tokens)
- Old entries compressed into representative examples
- Similar entries combined while preserving insights
- Ledger does NOT count toward agent capacity

## Content Generation

### Document Descriptions

**Length:** Constant factor × source document markdown token count

**Generation Scenarios:**

1. **New Agent Creation:**
   - Generate description from transcript
   - New agent analyzes description + document
   - Creates agent description

2. **Document Adoption:**
   - Adopting agent generates specialized description
   - Tailored to agent's focus area
   - Same length ratio as new creation

**All documents converted to markdown first** (PDFs → markdown, images → markdown description).

### Agent Descriptions

**New Agents:**
- Analyze initial document + its description
- Write `agent.md` covering:
  - Content (what's in the document)
  - Capabilities (queries it can answer)
  - Specialization (domain/category)

**Existing Agents (updates):**
- Triggered by: children changed OR ledger grew
- Based on:
  - Current children (documents + child agents)
  - Usage patterns from ledger
- Describes evolved specialization

## Technical Considerations

### Concurrency

- **SessionEnd:** Fire-and-forget async rebalancing
- **Rebalancing:** Sequential agent processing (no parallelism needed)
- **No conflicts:** Single rebalancing process, filesystem is source of truth

### Data Integrity

**Document Orphaning Prevention:**
- Documents only released when adopted
- If no adopter, stays with current parent
- Multi-parent documents: only one parent's description deleted

**Agent Orphaning Prevention:**
- Child agents only released when adopted
- If no adopter, stays with current parent
- Single-parent constraint enforced at adoption

**Identifier Uniqueness:**
- Checked at creation/rename time
- Only needs uniqueness among siblings (same directory level)
- Collision detection before writing

### Performance Characteristics

**SessionStart:**
- Fast: read root-level agent identifiers/descriptions only
- O(n) where n = number of root agents

**Query Time:**
- Agent-controlled depth (can query recursively)
- Worst case: traverse entire subtree
- Optimized by agent discretion (read descriptions before full documents)

**Rebalancing:**
- O(iterations × participating_agents × pool_size)
- Converges when no beneficial trades remain
- Bounded by: agents can't re-adopt own releases

**Storage:**
- Linear in number of agents + documents
- Document descriptions: small (constant factor of source)
- Agent descriptions: based on children count
- Ledgers: bounded by pruning threshold

## Open Questions / Configuration

1. **Token threshold value:** What's the max capacity per agent?
2. **Document description factor:** What ratio (e.g., 10%, 20%)?
3. **Ledger size threshold:** When to trigger pruning?
4. **Ledger pruning ratio:** How much to compress (e.g., reduce by 50%)?
5. **Memory agent SDK configuration:** Model selection, timeout, etc.

## Example Scenarios

### Scenario 1: First Conversation

**User talks about React performance optimization**

1. SessionStart: No agents exist, no context injected
2. During session: No memory available
3. SessionEnd:
   - Transcript saved by Claude Code
   - Rebalancing triggered
   - Document description generated
   - New agent created: `react-performance-optimization`
   - Agent analyzes transcript, writes `agent.md`
4. Next session: Claude sees "react-performance-optimization" agent in context

### Scenario 2: Second Conversation (Related Topic)

**User talks about React hooks patterns**

1. SessionStart: Claude sees existing `react-performance-optimization` agent
2. During session:
   - Claude queries agent for relevant background
   - Agent reads transcript, responds
   - Writes query entry to ledger
3. SessionEnd:
   - New transcript saved
   - New agent created: `react-hooks-patterns`
   - Rebalancing starts:
     - `react-performance-optimization` was used (participates)
     - `react-hooks-patterns` sits out (new)
   - `react-performance-optimization` might adopt the hooks transcript as a document
   - Creates specialized description focused on performance aspects
4. Next session: Both agents available, hooks transcript accessible from performance agent

### Scenario 3: Specialization Emergence

**After many React conversations**

1. Multiple root-level React agents exist
2. During rebalancing:
   - Agents discover they share common patterns
   - Higher-capacity agent adopts related smaller agents as children
   - Hierarchy emerges: `react-frontend/` with children `hooks-patterns/`, `performance/`, `state-management/`
3. Query routing becomes more efficient:
   - Claude queries `react-frontend` agent
   - Agent delegates to specialized child based on query type
4. Agents evolve descriptions based on usage:
   - Parent focuses on routing and high-level concepts
   - Children specialize in their domains

### Scenario 4: Memory Reorganization

**User shifts from React to API design**

1. SessionStart: Many React agents, few API agents
2. Over time:
   - React agents unused in conversations
   - Don't participate in rebalancing
   - Become stale
3. API agents actively used:
   - Participate in rebalancing
   - Adopt relevant documents
   - Build specialized hierarchy
4. Graph naturally reflects current focus:
   - Active domains have rich, well-organized structure
   - Inactive domains remain but don't churn

## Success Metrics

**System Working Well When:**
1. Claude proactively uses memory without prompting
2. Query responses improve over time (leverage past conversations)
3. Related concepts cluster under specialized agents
4. Inactive agents stabilize (stop churning)
5. Active domains develop hierarchical structure
6. Users can see meaningful organization in `memory-system/` directory

**System Needs Tuning When:**
1. Rebalancing never converges (infinite iteration)
2. All documents end up under one mega-agent
3. Agents thrash (constantly re-adopting same items)
4. Too many root-level agents (no hierarchy emerges)
5. Documents orphaned (should never happen)
6. Queries consistently miss relevant information
