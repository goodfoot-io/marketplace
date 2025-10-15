# Current Inventory Analysis

This document provides a comprehensive analysis of the existing `.claude/` directory structure and content, forming the foundation for plugin organization.

## Directory Structure

```
.claude/
├── agents/                               # 12 agent files
│   ├── CLAUDE.md                        # Agent documentation
│   ├── codebase-explainer.md
│   ├── documenter.md
│   ├── test-agent-evaluation-runner.md
│   ├── test-evaluator.md
│   ├── test-issue-reproducer.md
│   └── project/                          # Project-focused agents
│       ├── assumption-tester.md
│       ├── implementation-evaluator.md
│       ├── project-implementer.md
│       ├── project-plan-assessor.md
│       └── sledgehammer.md
├── commands/                             # 35+ command files
│   ├── CLAUDE.md                        # Command documentation
│   ├── document.md
│   ├── investigate.md
│   ├── genius.md
│   ├── jsdoc.md
│   ├── plan-then-implement.md
│   ├── recommend.md
│   ├── second-opinion.md
│   ├── test-agent.md
│   ├── iterate-on/
│   │   ├── command.md
│   │   └── command-with-memory.md
│   ├── project/
│   │   ├── create.md
│   │   ├── begin.md
│   │   ├── worktree.md
│   │   └── describe.md
│   ├── review/
│   │   ├── complexity.md
│   │   ├── chain.md
│   │   ├── linting.md
│   │   ├── language.md
│   │   ├── tests-v2.md
│   │   └── producer-consumer.md
│   ├── rewrite/
│   │   ├── complexity.md
│   │   ├── integrate.md
│   │   ├── headers.md
│   │   ├── pov.md
│   │   ├── language.md
│   │   ├── system-instructions.md
│   │   ├── prompt.md
│   │   └── tests-v2.md
│   └── utilities/
│       ├── map-integration-chain.md
│       └── echo.md
├── memory/
│   └── command-improvement-tips.md       # Guidance for command iteration
├── output-styles/
│   └── forensic-investigator.md          # Custom output style
├── shared/
│   ├── codebase-tool-patterns.md         # Tool usage patterns
│   ├── jest-mocking-guide.md             # Testing guidance
│   └── project-plan-annotated-example.md # Example documentation
├── cleanup-tsserver.sh                   # Utility script
└── settings.json                         # Claude Code settings
```

## Detailed Component Analysis

### Commands (35+ files)

#### Investigation & Analysis Commands

| File | Command | Purpose | Plugin Target |
|------|---------|---------|---------------|
| `investigate.md` | `/investigate` | Parallel evaluation of solutions | investigation-toolkit |
| `second-opinion.md` | `/second-opinion` | Multiple objective perspectives | investigation-toolkit |
| `genius.md` | `/genius` | Deep thinking for complex problems | investigation-toolkit |

**Characteristics:**
- Use Task() tool for parallel agent invocation
- Focus on decision-making and analysis
- Create evaluation reports in `/workspace/reports/.investigate`

#### Project Management Commands

| File | Command | Purpose | Plugin Target |
|------|---------|---------|---------------|
| `project/create.md` | `/project:create` | Create project plans | project-orchestrator |
| `project/begin.md` | `/project:begin` | Begin project execution | project-orchestrator |
| `project/worktree.md` | `/project:worktree` | Create project worktree | project-orchestrator |
| `project/describe.md` | `/project:describe` | Generate impact descriptions | project-orchestrator |
| `plan-then-implement.md` | `/plan-then-implement` | Plan and implement with validation | project-orchestrator |

**Characteristics:**
- Comprehensive planning and orchestration
- Multi-phase workflows
- Quality assessment and validation
- Integration with git worktrees

#### Code Review Commands

| File | Command | Purpose | Plugin Target |
|------|---------|---------|---------------|
| `review/complexity.md` | `/review:complexity` | Identify complexity drivers | code-quality-suite |
| `review/chain.md` | `/review:chain` | Analyze component chains | code-quality-suite |
| `review/linting.md` | `/review:linting` | Run and analyze linting | code-quality-suite |
| `review/language.md` | `/review:language` | Review natural language | code-quality-suite |
| `review/tests-v2.md` | `/review:tests-v2` | Test failure analysis | code-quality-suite |
| `review/producer-consumer.md` | `/review:producer-consumer` | Integration compatibility | code-quality-suite |
| `recommend.md` | `/recommend` | Recommend before updates | code-quality-suite |

**Characteristics:**
- Comprehensive analysis capabilities
- Report generation
- Integration with linting/testing tools
- Natural language analysis

#### Code Rewriting Commands

| File | Command | Purpose | Plugin Target |
|------|---------|---------|---------------|
| `rewrite/complexity.md` | `/rewrite:complexity` | Resolve complexity issues | code-quality-suite |
| `rewrite/integrate.md` | `/rewrite:integrate` | Integrate new instructions | code-quality-suite |
| `rewrite/headers.md` | `/rewrite:headers` | Optimize document headers | code-quality-suite |
| `rewrite/pov.md` | `/rewrite:pov` | Update point of view | code-quality-suite |
| `rewrite/language.md` | `/rewrite:language` | Resolve language issues | code-quality-suite |
| `rewrite/system-instructions.md` | `/rewrite:system-instructions` | Rewrite system prompts | code-quality-suite |
| `rewrite/prompt.md` | `/rewrite:prompt` | Transform to user prompts | code-quality-suite |
| `rewrite/tests-v2.md` | `/rewrite:tests-v2` | Fix test failures | code-quality-suite |

**Characteristics:**
- Transformation and improvement focus
- Document and code rewriting
- Standardization and consistency
- Integration with review commands

#### Documentation Commands

| File | Command | Purpose | Plugin Target |
|------|---------|---------|---------------|
| `document.md` | `/document` | Generate project documentation | developer-utilities |
| `jsdoc.md` | `/jsdoc` | Add/update JSDoc | developer-utilities |

**Characteristics:**
- Documentation generation
- TypeScript/JavaScript focused
- Comprehensive doc coverage

#### Testing Commands

| File | Command | Purpose | Plugin Target |
|------|---------|---------|---------------|
| `test-agent.md` | `/test-agent` | Agent instruction optimization | test-automation |

**Characteristics:**
- Agent testing and evaluation
- Multiple baselines support
- Configurable scenarios

#### Utility Commands

| File | Command | Purpose | Plugin Target |
|------|---------|---------|---------------|
| `utilities/map-integration-chain.md` | `/utilities:map-integration-chain` | Map integration chains | developer-utilities |
| `utilities/echo.md` | `/utilities:echo` | Echo utility | developer-utilities |
| `iterate-on/command.md` | `/iterate-on:command` | Iteratively improve commands | developer-utilities |
| `iterate-on/command-with-memory.md` | `/iterate-on:command-with-memory` | Improve with memory | developer-utilities |

**Characteristics:**
- Development workflow helpers
- Command improvement tools
- Integration analysis

### Agents (12 files)

#### Testing Agents

| File | Agent Name | Purpose | Plugin Target |
|------|------------|---------|---------------|
| `test-issue-reproducer.md` | test-issue-reproducer | Run tests and analyze failures | test-automation |
| `test-evaluator.md` | test-evaluator | Evaluate test quality | test-automation |
| `test-agent-evaluation-runner.md` | test-agent-evaluation-runner | Run agent evaluations | test-automation |

**Characteristics:**
- Tools: `*` (all tools)
- Comprehensive test failure analysis
- Hypothesis-driven reproduction
- Report generation

**Key Features:**
- Static analysis with type checking
- Test execution and parsing
- Minimal reproduction test creation
- Detailed failure reports

#### Project Management Agents

| File | Agent Name | Purpose | Plugin Target |
|------|------------|---------|---------------|
| `project/assumption-tester.md` | assumption-tester | Test project assumptions | project-orchestrator |
| `project/implementation-evaluator.md` | implementation-evaluator | Evaluate implementations | project-orchestrator |
| `project/project-implementer.md` | project-implementer | Implement project plans | project-orchestrator |
| `project/project-plan-assessor.md` | project-plan-assessor | Assess project plans | project-orchestrator |
| `project/sledgehammer.md` | sledgehammer | Heavy-duty implementation | project-orchestrator |

**Characteristics:**
- Tools: `*` (all tools)
- Project lifecycle management
- Quality assessment
- Implementation execution

#### Documentation Agents

| File | Agent Name | Purpose | Plugin Target |
|------|------------|---------|---------------|
| `documenter.md` | documenter | Generate minimal documentation | developer-utilities |
| `codebase-explainer.md` | codebase-explainer | Explain technical subjects | developer-utilities |

**Characteristics:**
- Tools: `*` (all tools)
- Natural language and diagram generation
- Architecture documentation
- Technical explanation

### Supporting Files

#### Memory System

**File:** `memory/command-improvement-tips.md`

**Purpose:** Guidance for iterative command improvement

**Usage:** Referenced by iterate-on commands to provide context for improvements

**Plugin Target:** developer-utilities (as shared resource)

#### Output Styles

**File:** `output-styles/forensic-investigator.md`

**Purpose:** Custom output style for forensic investigation mode

**Note:** Output styles are user-level customizations, may not be suitable for plugin distribution

**Recommendation:** Document separately, not included in plugins

#### Shared Resources

| File | Purpose | Usage |
|------|---------|-------|
| `codebase-tool-patterns.md` | MCP tool usage patterns | Reference for agent implementation |
| `jest-mocking-guide.md` | Jest mocking best practices | Testing guidance |
| `project-plan-annotated-example.md` | Example project plan | Template for project commands |

**Plugin Target:** Copy to relevant plugins as shared resources

#### Configuration Files

**File:** `settings.json`

**Contents:**
- Permission settings
- Environment variables
- Hook configurations (PreToolUse, PostToolUse, Stop)

**Note:** Settings are environment-specific, not suitable for plugin distribution

**Recommendation:** Document hook patterns in plugin guides, but don't distribute settings.json

#### Utility Scripts

**File:** `cleanup-tsserver.sh`

**Purpose:** TypeScript server cleanup utility

**Note:** Environment-specific utility script

**Recommendation:** Not suitable for plugin distribution

## Content Statistics

### By Category

| Category | Commands | Agents | Total Components |
|----------|----------|--------|------------------|
| Investigation | 3 | 0 | 3 |
| Project Management | 5 | 5 | 10 |
| Code Review | 7 | 0 | 7 |
| Code Rewriting | 8 | 0 | 8 |
| Testing | 1 | 3 | 4 |
| Documentation | 2 | 2 | 4 |
| Utilities | 4 | 0 | 4 |
| **Total** | **30** | **10** | **40** |

### Complexity Analysis

#### High Complexity (1000+ lines)

- `commands/investigate.md` - 139 lines (medium-high)
- `commands/project/create.md` - Complex workflow
- `agents/test-issue-reproducer.md` - 243 lines (high complexity)

#### Medium Complexity (500-1000 lines)

- Most review and rewrite commands
- Project management commands
- Agent definitions

#### Low Complexity (<500 lines)

- Utility commands
- Simple wrappers
- Documentation commands

## Dependencies and Relationships

### Command-to-Agent Relationships

```
/investigate → general-purpose agent (parallel invocation)
/test-agent → test-agent-evaluation-runner
/project:begin → project-* agents
/review:tests-v2 → test-issue-reproducer (conceptually related)
```

### Shared Resource Usage

```
iterate-on commands → memory/command-improvement-tips.md
project commands → shared/project-plan-annotated-example.md
test commands → shared/jest-mocking-guide.md
all components → shared/codebase-tool-patterns.md
```

### Tool Usage Patterns

**Common tool sets:**
- Investigation: Task (parallel agent invocation)
- Project: All tools (`*`)
- Review: Read, Grep, Glob, Bash
- Rewrite: Read, Write, Edit
- Testing: All tools (`*`)
- Documentation: Read, Write, Grep, Glob

## Recommended Plugin Organization

Based on analysis, here's the recommended plugin structure:

### Plugin 1: investigation-toolkit

**Components:**
- Commands: investigate.md, second-opinion.md, genius.md
- Agents: None (uses general-purpose)
- Shared: None specific

**Rationale:** Cohesive decision-making toolkit with clear purpose

### Plugin 2: project-orchestrator

**Components:**
- Commands: project/*.md, plan-then-implement.md
- Agents: project/*.md (5 agents)
- Shared: project-plan-annotated-example.md

**Rationale:** Complete project management lifecycle

### Plugin 3: code-quality-suite

**Components:**
- Commands: review/*.md (6), rewrite/*.md (8), recommend.md
- Agents: None
- Shared: None specific

**Rationale:** Comprehensive code quality toolset

### Plugin 4: test-automation

**Components:**
- Commands: test-agent.md
- Agents: test-*.md (3 agents)
- Shared: jest-mocking-guide.md

**Rationale:** Complete testing workflow

### Plugin 5: developer-utilities

**Components:**
- Commands: document.md, jsdoc.md, utilities/*.md, iterate-on/*.md
- Agents: documenter.md, codebase-explainer.md
- Shared: codebase-tool-patterns.md, command-improvement-tips.md

**Rationale:** General-purpose development helpers

## Migration Complexity Assessment

### Low Risk Components

- ✅ Investigation commands (self-contained)
- ✅ Documentation commands (minimal dependencies)
- ✅ Utility commands (standalone)

### Medium Risk Components

- ⚠️ Review commands (may reference each other)
- ⚠️ Rewrite commands (related to review commands)
- ⚠️ Project commands (shared resources)

### High Risk Components

- ⚠️ Test agents (complex, many dependencies)
- ⚠️ Project agents (interconnected workflow)
- ⚠️ Shared resources (used by multiple components)

## Compatibility Considerations

### File References

Many commands use `@file` references for including content:
- Ensure shared resources are available in plugin structure
- Update paths if file locations change
- Consider copying shared resources to each plugin

### Bash Command Execution

Commands using `!`command`` syntax:
- Verify allowed-tools frontmatter includes Bash
- Ensure script paths are updated if moved
- Test execution in plugin context

### Agent Invocations

Commands invoking agents via Task():
- Ensure agent names remain consistent
- Verify agents are in same plugin or available globally
- Test cross-plugin agent access if needed

## Special Considerations

### CLAUDE.md Files

- `agents/CLAUDE.md` - Documentation, not an agent
- `commands/CLAUDE.md` - Documentation, not a command

**Action:** Include as README or docs in plugins, not as components

### Output Styles

- User-specific customizations
- Not standard plugin components

**Action:** Document separately, provide as examples

### Settings and Hooks

- Environment-specific configurations
- Hooks reference local scripts

**Action:** Document hook patterns in guides, don't distribute settings.json

### Memory System

- `memory/command-improvement-tips.md` provides context for iteration

**Action:** Include in developer-utilities as shared resource

## Quality Metrics

### Documentation Coverage

- ✅ All commands have descriptions
- ✅ All agents have clear purposes
- ⚠️ Some commands need better argument-hint
- ⚠️ Some agents need tool specification updates

### Completeness

- ✅ Commands are complete and functional
- ✅ Agents have comprehensive prompts
- ✅ Frontmatter is mostly complete
- ⚠️ Some missing keywords for discoverability

### Maintainability

- ✅ Clear naming conventions
- ✅ Logical directory structure
- ⚠️ Some circular dependencies
- ⚠️ Shared resources need consolidation

## Recommendations

1. **Preserve Structure**: Keep namespace organization (review/*, rewrite/*, etc.)
2. **Copy Shared Resources**: Include relevant shared files in each plugin
3. **Update Paths**: Modify file references to match new structure
4. **Test Thoroughly**: Verify all commands work after migration
5. **Document Dependencies**: Clearly note inter-plugin dependencies
6. **Version Carefully**: Start with v1.0.0, iterate based on feedback
7. **Monitor Usage**: Track which commands are most valuable

## Next Steps

1. Review this inventory for completeness
2. Validate plugin organization decisions
3. Begin migration following the strategy in 05-migration-strategy.md
4. Test migrated components
5. Document plugin-specific details
