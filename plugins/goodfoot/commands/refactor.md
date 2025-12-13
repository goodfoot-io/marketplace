---
description: Refactor code with checkpoints
---

<user-message>
$ARGUMENTS
</user-message>

<input-format>
Extract from `<user-message>` or recent conversation:
- [REFACTOR_TARGET] = Files, directories, or code areas to refactor (required)
- [REFACTOR_INTENT] = What improvement is desired: clarity, simplification, pattern alignment, dead code removal (optional)
- [SCOPE_CONSTRAINTS] = Boundaries or areas to avoid touching (optional)

Resolve [REFACTOR_TARGET] to [TARGET_FILES]:
- If file path → use directly
- If directory → find all .ts, .tsx, .js, .jsx files within
- If glob pattern (e.g., `src/**/*.ts`) → expand to matching files
- If git range (e.g., `HEAD~3..HEAD`) → extract changed files via `git diff --name-only`
- If description (e.g., "auth module") → search codebase for matching files

Variables set during execution:
- [TARGET_FILES] = Resolved list of absolute file paths to analyze
- [VALIDATION_COMMANDS] = Discovered validation commands (typecheck, test, lint) for affected packages
- [BASELINE_TAG] = `goodfoot-refactor/baseline` git tag marking pre-refactor state
</input-format>

<philosophy>
**Holistic Understanding First**: Build a mental model of the code before examining individual lines. Review the diff in context—examine how modified code interacts with the surrounding system. The first step is to understand *what the code does* and *why*.

**Clarity Over Cleverness**: Focus on making code understandable to future readers. If code works but is convoluted, simplify it. As Martin Fowler noted: *"Any fool can write code that a computer can understand. Good programmers write code that humans can understand."*

**Preserve Intent, Improve Expression**: Refactoring changes how code is written, not what it does. Every change must maintain observable behavior while improving internal quality.

**Earn Every Abstraction**: John Carmack observed that *"it is hard for less experienced developers to appreciate how rarely architecting for future requirements turns out net-positive."* Remove abstractions that don't justify their existence with current usage.

**Duplication Over Wrong Abstraction**: Sandi Metz's insight that *"duplication is far easier to maintain than the wrong abstraction"* guides decisions. It's easier to abstract later when patterns emerge than to de-abstract a premature generalization.
</philosophy>

<refactoring-actions>
## Refactoring Actions

<dead-code-removal>
### Dead Code Removal

**Principle**: Code that isn't executed provides no value but still costs maintenance attention. Every line a developer reads that doesn't contribute to behavior is cognitive overhead. Dead code also creates false signals—developers may assume unused functions are needed or wonder why variables exist.

**Examples**:
- Functions never called
- Variables never read
- Parameters always passed the same value
- Branches that never execute
- Commented-out code blocks
- Leftover debugging statements

**Instruction**: Search for code with no execution path. Use static analysis, grep for references, and trace call graphs. If code has no callers and no tests exercising it, it's dead. Remove it—version control preserves history if needed later. Be thorough: removing one dead function may reveal others that only it called.
</dead-code-removal>

<naming-improvements>
### Naming Improvements

**Principle**: Names are the primary documentation developers read. A good name eliminates the need to read implementation to understand purpose. Names should reveal intent, not implementation details. When names accurately describe behavior, code becomes self-documenting and misunderstandings decrease.

**Examples**:
- Replace placeholder names (`processData`, `handleStuff`)
- Update old names that no longer fit behavior
- Standardize terminology across the codebase
- Make names reveal intent without needing comments

**Instruction**: Read each identifier and ask: "Does this name tell me what this does without reading further?" Replace vague names with specific ones. Ensure names match current behavior—code evolves but names often don't. Use domain terminology consistently. If you need a comment to explain what something does, the name is wrong.
</naming-improvements>

<logic-simplification>
### Logic Simplification

**Principle**: Complex code is hard to understand, test, and modify. Each level of nesting, each branch, each indirection adds cognitive load. Simple code expresses the same behavior with fewer concepts to hold in working memory. The goal is code where the reader can predict what happens next.

**Examples**:
- Break 50+ line functions into smaller helpers
- Use guard clauses to exit early instead of nested if/else
- Replace complex loops with clear library calls
- Reduce cyclomatic complexity
- Inline unnecessary indirection

**Instruction**: Look for code where understanding requires tracing multiple paths or holding many states in mind. Flatten nested conditionals with early returns. Extract cohesive blocks into well-named functions. Replace clever algorithms with straightforward ones unless performance requires otherwise. Ask: "Can I understand this function without scrolling?"
</logic-simplification>

<over-engineering-removal>
### Over-Engineering Removal

**Principle**: Abstractions have costs: indirection makes code harder to trace, interfaces obscure concrete behavior, and flexibility adds complexity. An abstraction earns its place only when it serves multiple current use cases. Speculative generalization—building for imagined future needs—usually creates maintenance burden without payoff.

**Examples**:
- Strategy pattern frameworks for single strategies
- Factory abstractions with one implementation
- Configurable options that never vary
- Generalized interfaces serving single concrete types
- "Future-proof" extension points with no current users

**Instruction**: For each abstraction (interface, factory, strategy, configuration option), count its concrete uses. If there's only one implementation or one configuration value, the abstraction may be premature. Inline single-use abstractions. Remove configuration that never varies. Keep asking: "What breaks if I remove this layer?"
</over-engineering-removal>

<pattern-harmonization>
### Pattern Harmonization

**Principle**: Consistency reduces cognitive load. When similar problems are solved differently throughout a codebase, developers must learn multiple approaches and can't transfer understanding. Harmonized code lets developers predict how unfamiliar areas work based on patterns they've seen elsewhere.

**Examples**:
- Use existing utilities instead of reinventing
- Follow project layering conventions
- Match error handling approach
- Solve similar problems consistently

**Instruction**: Identify how the codebase already solves common problems: error handling, logging, data transformation, API calls. When new code diverges from established patterns without good reason, refactor to match. Use existing utilities rather than writing new ones. The goal is code where any team member can work in any area without learning new conventions.
</pattern-harmonization>

<test-refinement>
### Test Refinement

**Principle**: Tests are code too—they require maintenance and can accumulate complexity. Tests coupled to implementation details break on refactoring even when behavior is preserved. Redundant tests slow the suite without adding confidence. Good tests describe behavior, run fast, and fail only when something is actually wrong.

**Examples**:
- Consolidate redundant test cases
- Focus tests on behavior over implementation
- Simplify overly elaborate test setup
- Align test organization with refactored code

**Instruction**: After refactoring production code, review affected tests. Remove tests that duplicate coverage. Rewrite tests that assert implementation details to assert outcomes instead. Simplify elaborate setup by questioning whether all that complexity is necessary for the behavior being tested. Ensure test organization matches the refactored code structure.
</test-refinement>

</refactoring-actions>

<exploration>
## Tool Selection

**Use Explore agent (haiku) for:**
- Simple file/pattern discovery
- Listing what exists in a directory
- Quick searches without deep analysis

**Use mcp__plugin_vscode_codebase__ask for:**
- Dead code analysis (requires reference tracing)
- Complexity analysis (requires understanding call patterns)
- Abstraction analysis (requires counting implementations)
- Purpose discovery (requires understanding system context)

**Important**: Neither the Explore agent nor the `mcp__plugin_vscode_codebase__ask` function have conversation context. Include FULL paths and specific questions in every invocation.

## Initial Discovery (Parallel)

Run these in parallel to gather basic information:

```xml
<!-- PATTERN DISCOVERY - Use Explore for quick pattern listing -->
<invoke name="Task">
<parameter name="description">Discover patterns</parameter>
<parameter name="subagent_type">Explore</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">What patterns and conventions are used in [TARGET_FILES] and surrounding code? Look for: naming conventions, error handling patterns, abstraction levels, utility usage, and architectural approaches.</parameter>
</invoke>
```

```bash
# DEPENDENCY ANALYSIS - Run in parallel
print-dependencies [TARGET_FILES]
print-inverse-dependencies [TARGET_FILES]
```

## Deep Analysis (After Initial Discovery)

After dependency analysis completes, run these targeted analyses with full context:

```xml
<!-- DEAD CODE ANALYSIS - Requires reference tracing -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">Analyze [TARGET_FILES] for dead code. For each function, variable, and parameter: trace ALL references using VSCode LSP. List findings with file:line for: functions with zero callers (excluding exports), variables never read after assignment, parameters always passed the same value, branches that never execute based on type analysis. Show evidence for each finding.</parameter>
</invoke>

<!-- COMPLEXITY ANALYSIS - Requires understanding call patterns -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">Analyze complexity in [TARGET_FILES]. For each function: count lines, measure nesting depth, identify cyclomatic complexity. List functions over 30 lines or with nesting > 3 levels. For each finding, show the code structure and suggest specific simplification (guard clauses, extraction, etc.) with file:line references.</parameter>
</invoke>

<!-- ABSTRACTION ANALYSIS - Requires counting implementations -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">Analyze abstractions in [TARGET_FILES] for over-engineering. For each interface, abstract class, and factory: count ALL implementations using VSCode references. Flag: interfaces with exactly 1 implementation, factories producing 1 product, configurable options with 1 value used. Show evidence with file:line references.</parameter>
</invoke>

<!-- PURPOSE DISCOVERY - Requires understanding system context -->
<invoke name="mcp__plugin_vscode_codebase__ask">
<parameter name="question">What is the purpose of [TARGET_FILES]?

Dependencies: [DEPENDENCIES]
Inverse dependencies (callers): [INVERSE_DEPENDENCIES]

Describe: (1) What problem this code solves, (2) Its role in the larger system based on callers and callees, (3) Key responsibilities, (4) Any non-obvious design decisions that might have good reasons—don't assume complexity is accidental.</parameter>
</invoke>
```
</exploration>

<establish-baseline>
## Establishing Git Baseline

Before making changes, establish a rollback point:

1. Check git state: `git status --porcelain`

2. **If dirty and files overlap with [TARGET_FILES]:** Ask user how to proceed:
   - "Stash changes" → `git stash push -m "pre-refactor"`
   - "Commit first" → Exit for user to handle
   - "Proceed anyway" → Continue (warn: limited rollback)

   **If clean or changes don't overlap:** Continue.

3. Create baseline tag:
   ```bash
   git tag -f goodfoot-refactor/baseline HEAD
   ```

4. **If baseline validation fails:** Report issues and ask user whether to:
   - "Fix first" → Exit for user to handle
   - "Proceed anyway" → Continue with warning

Set [BASELINE_TAG] = `goodfoot-refactor/baseline`
</establish-baseline>

<validation-discovery>
## Discovering Validation Commands

For each package containing target files, discover available validation in the associated package.json file.

Map discovered scripts to validation commands:
- `typecheck` or `tsc` → Type checking
- `test` or `vitest` or `jest` → Tests
- `lint` or `eslint` → Linting

These are typically `yarn typecheck`, `yarn lint`, and `yarn test`.

During development you should run linting and targeted tests early and often, i.e. `yarn tests ./path/to/target/file.ts`
</validation-discovery>

<instructions>

## Phase 1: Explore and Analyze

1. Launch parallel exploration following `<exploration>`
2. Wait for all subagents to complete
3. Synthesize findings into **all six categories** from `<refactoring-actions>`
4. Apply categories in this order (safest first):
   1. Dead code removal
   2. Naming improvements
   3. Logic simplification
   4. Over-engineering removal
   5. Pattern harmonization
   6. Test refinement

**Important**: Apply all categories that have findings. Do not stop after the first category—work through all six in order.

## Phase 2: Refactoring Actions

For each category in order, apply all refactorings identified in Phase 1.

For each change:
1. **Document intent** - State what will change, why it improves the code, and what behavior is preserved
2. **Make change** - Apply the refactoring using Edit tool
3. **Validate** - Run [VALIDATION_COMMANDS] and check VSCode diagnostics for faster feedback
4. **Handle result** - If validation passes, proceed to next change. If validation fails, revert that specific change and continue with remaining changes.

## Phase 3: Final Validation

Run full validation suite using [VALIDATION_COMMANDS] (typecheck, test, lint for all affected packages).

**If all pass:** Proceed to Phase 4

**If failures:**
- Report which validations fail
- Revert to baseline: `git checkout [BASELINE_TAG] -- .`
- Report what refactorings were attempted but failed validation

## Phase 4: Generate Report

Gather changes:
```bash
git diff [BASELINE_TAG] --stat
```

Output report:

<report-template>
## Refactoring Complete

### Target
[REFACTOR_TARGET]

### Changes Applied

#### Dead Code Removed
- [file:line] - [description]

#### Naming Improved
- [file:line] - [old_name] → [new_name]

#### Logic Simplified
- [file:line] - [description]

#### Over-Engineering Removed
- [file:line] - [description]

#### Patterns Harmonized
- [file:line] - [description]

### Skipped (Failed Validation)
- [description] - [reason]

### Validation Results
- Type check: [PASS/FAIL]
- Tests: [PASS/FAIL]
- Lint: [PASS/FAIL]

### Rollback
To undo all changes:
```bash
git checkout goodfoot-refactor/baseline -- .
```

To remove baseline tag:
```bash
git tag -d goodfoot-refactor/baseline
```
</report-template>

</instructions>
