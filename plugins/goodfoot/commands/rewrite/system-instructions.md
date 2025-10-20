---
description: Rewrite as Claude 4 Opus–style system instructions
---

<user>
$ARGUMENTS
</user>

Transform the documents the user has specified into comprehensive **Claude 4 Opus–style system instructions** while preserving every substantive element (algorithms, code, directory structures, numeric heuristics). Do not add or remove any information, instructions, or constraints.

**Document Processing:**
- Create new version-incremented files containing appropriate frontmatter and system instructions, rewritten from scratch
- **Critical**: Do not add or remove information or instructions—only rewrite, refactor, and reorganize according to the embedded transformation rules

## File Versioning Standard

**Pattern**: `[original-name]-v[N].[ext]`
- First rewrite: `example.md` → `example-v2.md`  
- Subsequent: `example-v2.md` → `example-v3.md`
- Never overwrite existing versions
- If version exists, increment until available number found
- This versioning applies to iterative refinement during transformation

**Document Output Format:**
Generate markdown documents with YAML frontmatter containing:
```markdown
---
name: [agent-name-here] # lowercase with hyphens, 2-4 words
description: |
  Use this agent when [specific triggering condition].
  
  <example>
  user: "[request that triggers this agent]"
  assistant: "[response acknowledging the task]"
  <commentary>
  Since [reason for using agent], invoke the [agent-name] agent
  </commentary>
  assistant: "Let me use the [agent-name] agent to [action]"
  </example>
tools: [Tool1, Tool2, Tool3] # CamelCase from available tools, omit to inherit all
color: [purple/blue/green/red/yellow/orange/pink/cyan]
---
```

**Available Tools Reference:**
Common tools include: Task, Bash, Glob, Grep, LS, Read, Edit, MultiEdit, Write, WebFetch, WebSearch, TodoWrite, plus any MCP-provided tools (start with "mcp__")

Follow each rule below without exception. If any rule conflicts with an explicit higher-level mandate from the project owner, prioritize the higher-level mandate and clearly explain the trade-off.

**Dynamic Context Strategies by Type:**
- **User prompts**: Use bash execution (&#33;`command`) for real-time context
- **Agent instructions**: Instruct use of available tools ("Examine the directory structure using LS")
- **System instructions**: Declare capabilities ("You have access to filesystem analysis tools")

---

### Claude 4 Capabilities Note

Claude 4 excels at maintaining consistent identity and behavior through well-structured system instructions. System instructions establish persistent behavioral frameworks that guide all interactions, unlike user prompts which handle specific tasks.

### Transformation Rules

Rules are grouped by category: Identity (1-3), Structure (4-6), Language Style (7-8), Content Organization (9-11), Technical Accuracy (12-13), Quality (14), and Tool Awareness (15).

#### Identity Rules

1. **Transform to second-person perspective**
   *System instructions always use "You are...", "You will..." constructions.*
   **Why** — Establishes Claude's persistent identity and behavioral framework.
   **Examples**
   *Source* `"Act as a senior Python developer"`
   *Target*
   ```
   You are a senior Python developer with deep expertise in code architecture, best practices, and performance optimization.
   ```
   *Source* `"The agent should analyze security"`
   *Target*
   ```
   You are a security analyst who systematically examines code for vulnerabilities.
   ```

2. **Preserve and enhance triggering conditions**
    *Maintain clear activation patterns with Task tool invocation examples.*
    **Why** — Enables proper agent selection and autonomous system operation.
    **Required format for agents:**
    ```yaml
    description: |
      Use this agent when [specific condition with clear triggers].
      
      <example>
      Context: [Situation that triggers agent]
      user: "[User's actual request]"
      assistant: "[Assistant acknowledges task]"
      <commentary>
      Since [reasoning for agent selection], invoke the [agent-name] agent
      </commentary>
      assistant: "Let me use the [agent-name] agent to [specific action]"
      </example>
    ```

3. **Convert tasks to persistent behavioral patterns**
    *Transform one-time instructions into ongoing behavioral characteristics.*
    **Why** — System instructions define continuous behavior, not single actions.
    **Examples**
    *Source*: "Check code for security issues"
    *Target*: "You continuously analyze code for security vulnerabilities, examining every function for potential attack vectors, unsafe operations, and data exposure risks."
    
    *Source*: "Respond helpfully to questions"
    *Target*: "You maintain a helpful demeanor, providing thorough and accurate responses while anticipating follow-up needs."

#### Structure Rules

4. **Apply type-appropriate organization**
   *Structure varies by instruction type and complexity.*
   **Why** — Different purposes require different organizational patterns.
   
   **Simple Agent (single focused behavior):**
   ```markdown
   You are [specific expertise].
   
   You [core behavior pattern].
   
   When [trigger condition], you [specific response].
   ```
   
   **Standard Agent (multiple related behaviors):**
   ```markdown
   You are [identity and expertise].
   
   ## Core Responsibilities
   - [Primary function 1]
   - [Primary function 2]
   
   ## Methodology
   [Detailed approach]
   
   ## Proactive Behaviors
   [Autonomous actions]
   ```
   
   **Complex Agent (full behavioral system):**
   ```markdown
   You are [comprehensive identity].
   
   ## Expertise
   [Detailed capability description]
   
   ## Core Responsibilities
   [Primary functions]
   
   ## Methodology
   [Step-by-step approach]
   
   ## Decision Framework
   [How you prioritize and choose actions]
   
   ## Proactive Behaviors
   [Autonomous patterns]
   
   ## Constraints
   [Operational boundaries]
   ```

5. **Embed XML tags strategically**
   *Use tags to highlight key sections without disrupting flow.*
   **Why** — Improves parsing while maintaining readability.
   **Example**
   ```markdown
   You are an expert code reviewer.
   
   <core-expertise>
   - Design pattern recognition and improvement
   - Performance optimization strategies  
   - Security vulnerability detection
   - Code maintainability assessment
   </core-expertise>
   
   When reviewing code, you follow a systematic approach...
   ```

6. **Ensure complete and valid metadata**
   *All required fields must be present and properly formatted.*
   **Why** — Enables system integration and agent discovery.
   **Complete validation checklist:**
   - `name`: lowercase, hyphens, 2-4 words, descriptive
   - `description`: Starts with "Use this agent when...", includes examples
   - `tools`: Valid tool names in CamelCase, or omitted for all tools
   - `color`: One of the eight specified options
   
#### Language Style Rules

7. **Preserve instructional depth and nuance**
   *Maintain comprehensive behavioral specifications.*
   **Why** — Autonomous agents need detailed guidance.
   **Examples**
   *Too terse*: "Review code for issues"
   *Appropriate*: "You systematically review code for bugs, security vulnerabilities, performance bottlenecks, and maintainability concerns. You examine logic flow, error handling, edge cases, and adherence to established patterns."

8. **Remove only genuine redundancy**
    *Eliminate repetition while preserving necessary emphasis.*
    **Why** — Some repetition reinforces important behaviors.
    **Example**
    *Source*: "Always be very, very careful to thoroughly check each and every input"
    *Target*: "You thoroughly validate all inputs" (preserves emphasis through "thoroughly" and "all")

#### Content Organization Rules

9. **Create behavioral demonstration examples**
   *Show agent invocation patterns and behavioral templates.*
   **Why** — Examples guide both system and users.
   **Required format for agent examples:**
   ```markdown
   <example>
   Context: [Specific scenario]
   user: "[Actual user message]"
   assistant: "[Natural acknowledgment]"
   <commentary>
   [Reasoning for agent selection]
   </commentary>
   assistant: "I'll use the [agent-name] agent to [action]"
   </example>
   ```

10. **Integrate constraints contextually**
   *Place limitations within their operational context.*
   **Why** — Constraints are clearer when connected to actions.
   **Example**
   ```markdown
   When analyzing production systems:
   - **Never** execute commands that modify data
   - **Always** use read-only operations
   - **Require** explicit confirmation for any suggested changes
   ```

11. **Define proactive patterns explicitly**
   *Specify autonomous behaviors with clear triggers.*
   **Why** — Proactive behavior enables advanced agent capabilities.
   **Example**
   ```markdown
   ## Proactive Behaviors
   
   You automatically:
   - Suggest security reviews when you detect authentication-related changes
   - Recommend performance profiling upon finding O(n²) or worse algorithms
   - Propose adding tests when code coverage is insufficient
   - Alert to deprecated dependencies with known vulnerabilities
   
   You initiate these actions without waiting for explicit requests.
   ```

#### Technical Accuracy Rules

12. **Preserve technical content with absolute fidelity**
   *Never modify code, configurations, or technical specifications.*
   **Why** — Technical accuracy is paramount.
   
13. **Apply appropriate dynamic content strategies**
    *Choose strategy based on instruction type.*
    **Why** — Different contexts require different approaches.
    
    **Dynamic strategies by type:**
    - **User prompts**: `Current status: &#33;`git status``
    - **Agent instructions**: `Use the Bash tool to check git status`
    - **System instructions**: `You can examine repository state using git commands`
    - **CLAUDE.md integration**: Reference project-specific patterns when present

#### Quality and Tool Awareness Rules

14. **Calibrate quality emphasis to role**
    *Match quality directives to specific responsibilities.*
    **Why** — Different roles prioritize different aspects.
    **Examples by role:**
    - **Security**: "You prioritize comprehensive vulnerability detection over speed"
    - **Performance**: "You focus on optimization opportunities with measurable impact"
    - **Documentation**: "You ensure accuracy and completeness over brevity"
    - **Testing**: "You aim for thorough coverage including edge cases"

15. **Include role-appropriate tool awareness**
    *Reference capabilities without implementation details.*
    **Why** — Agents need to understand their capabilities.
    **Example for code review agent:**
    ```markdown
    ## Available Capabilities
    
    You utilize these tools to accomplish your objectives:
    - **File Analysis**: Read and Grep for examining code
    - **Project Navigation**: LS and Glob for understanding structure
    - **Code Modification**: Edit and MultiEdit for improvements
    - **Research**: WebSearch for best practices and documentation
    - **Task Management**: TodoWrite for tracking review progress
    
    Select tools based on the specific needs of each review task.
    ```

### Transformation Process Workflow

1. **Extract core information**
   - Identify primary purpose and responsibilities
   - Note any constraints or special requirements
   - Recognize implicit behavioral patterns
   - Consider CLAUDE.md context if present

2. **Determine instruction type and complexity**
   - **Simple**: Single focused behavior → Concise format
   - **Standard**: Multiple related behaviors → Structured sections
   - **Complex**: Full system with decisions → Comprehensive framework

3. **Transform content systematically**
   - Convert to second-person perspective
   - Transform tasks to behavioral patterns
   - Create triggering conditions with examples
   - Integrate constraints contextually
   - Add proactive behaviors where appropriate

4. **Structure appropriately**
   - Apply type-specific organization
   - Use XML tags for key sections
   - Ensure logical flow
   - Balance detail with clarity

5. **Add metadata and tool awareness**
   - Complete YAML frontmatter
   - Include tool capabilities section
   - Add version information
   - Ensure description includes examples

6. **Validate and refine**
   - Check against quality checklist
   - Verify technical accuracy
   - Ensure examples use Task tool
   - Confirm all source content preserved

### System Instruction Type Guidelines

**Agent Instructions:**
- Start with "You are [expertise]"
- Include "Use this agent when..." in description
- Provide Task tool invocation examples
- Define proactive behaviors
- Specify tool usage patterns

**System-Level Instructions:**
- Begin with "You are Claude, created by Anthropic"
- Establish global behavioral patterns
- Define interaction principles
- Set ethical boundaries
- Avoid task-specific details

**Workflow Instructions:**
- Start with "You execute [workflow name]"
- Provide step-by-step methodology
- Include decision trees
- Define success criteria
- Specify error handling

### Quality Assurance Checklist

**Before finalizing, verify:**
- [ ] All source information preserved without additions/deletions
- [ ] Second-person perspective used throughout ("You are/do/will")
- [ ] YAML frontmatter complete with all required fields
- [ ] Description starts with "Use this agent when..." (for agents)
- [ ] Examples show Task tool invocation pattern
- [ ] Tool names are valid and in CamelCase
- [ ] Constraints integrated within operational context
- [ ] Proactive behaviors explicitly defined
- [ ] Technical content preserved exactly
- [ ] Appropriate complexity level chosen
- [ ] File naming follows versioning standard

### Common Pitfalls to Avoid

1. **Perspective confusion**
   *Wrong*: Mixing "Claude should..." with "You are..."
   *Right*: Consistent second-person throughout

2. **Missing invocation examples**
   *Wrong*: Description without Task tool examples
   *Right*: Clear examples showing when and how to invoke

3. **Over-condensing complex behaviors**
   *Wrong*: Reducing nuanced behavior to single lines
   *Right*: Preserving necessary detail for autonomous operation

4. **Invalid tool names**
   *Wrong*: "read, write, search" (lowercase)
   *Right*: "Read, Write, WebSearch" (CamelCase)

5. **Hardcoding dynamic content**
   *Wrong*: "The src/ directory contains app.js, index.js..."
   *Right*: "Examine the src/ directory structure using LS"

6. **Forgetting CLAUDE.md context**
   *Wrong*: Ignoring project-specific patterns
   *Right*: Incorporating relevant project conventions

### Edge Cases and Special Handling

**Incomplete source material:**
- Preserve what exists
- Note gaps in comments: `# Note: Source did not specify [missing element]`
- Avoid inventing missing information

**Conflicting requirements:**
- Document both requirements
- Provide decision framework
- Example: "When [condition A], prioritize [requirement 1]. When [condition B], prioritize [requirement 2]."

**Multi-purpose content:**
- Create separate files for each purpose
- Cross-reference related instructions
- Maintain single responsibility principle

**Creative or non-technical agents:**
- Adapt patterns to domain
- Focus on judgment criteria
- Example: "You evaluate writing based on clarity, engagement, and adherence to specified tone"

### Quick Reference

**Transformation Formula:**
1. Task → Behavioral pattern
2. "Do X" → "You continuously/systematically do X"
3. Requirements → Integrated constraints
4. Examples → Invocation demonstrations
5. Tools needed → Capability awareness

**Complexity Indicators:**
- **Simple**: 1 core behavior, <50 lines
- **Standard**: 2-5 related behaviors, 50-150 lines
- **Complex**: Full system, decision trees, >150 lines

**Essential Patterns:**
- Identity: "You are [expertise]"
- Behavior: "You [action verb] [object] [method]"
- Proactive: "You automatically [action] when [trigger]"
- Constraint: "When [context], you [limitation]"
- Example: Shows Task tool invocation

Remember: System instructions define persistent behavioral frameworks. Every transformation should produce instructions that enable consistent, autonomous operation while preserving all source content and maintaining appropriate complexity for the role.