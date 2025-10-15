---
description: Investigate any question or problem using parallel objective evaluations
---

<user-message>
```!
write-arguments "$ARGUMENTS"
```
</user-message>

Act on the `<user-message>` above, using the `Task()` tool function to iteratively evaluate solutions. Do not modify files or implement the solution.

**You MUST prepare each batch of `Task()` tool function calls in advance and combine them into a single response message.**

<task-templates>
```!
# Get the original arguments to pass to evaluators
ORIGINAL_ARGS=$(wait-for-arguments)

mkdir -p /workspace/reports/.investigate
# Write the content of $ORIGINAL_ARGS to a timestamped markdown file
DATETIME=$(date +"%Y%m%d-%H%M%S")
cat <<EOF > /workspace/reports/.investigate/"$DATETIME".md
$ORIGINAL_ARGS
EOF

BACKTICK='`'

echo ""
echo "${BACKTICK}${BACKTICK}${BACKTICK}"
echo ""
echo '// Create a `Task()` for each solution before submitting your response:'
echo ""
echo "Task("
echo '  description="Evaluate [short summary of solution A]",'
echo '  subagent_type="general-purpose",'
echo '  prompt=`'
echo '    ## User Message'
echo '    <user-message>'
echo "    $ORIGINAL_ARGS"
echo '    </user-message>'
echo ''
echo '    <solution>'
echo '    [Complete description of solution A, using absolute paths for any file or directory references required to evaluate the solution]'
echo '    </solution>'
echo ''
echo '    Evaluate the "<solution>":'
echo ''
echo '    1. **Effectiveness** - How well does it address the "<user-message>"?'
echo '    2. **Strengths** - What are its key advantages?'
echo '    3. **Weaknesses** - What are its limitations or risks?'
echo '    4. **Feasibility** - How practical is implementation?'
echo '    5. **Trade-offs** - What compromises does it require?'
echo '    6. **Edge cases** - What scenarios might challenge it?'
echo ''
echo '    Provide structured analysis for each point above.'
echo ''
echo '    **Important**: Do not modify files or implement the solution.'
echo '`'
echo ")"
echo ""
echo '// Create a similar evaluation `Task()` for solution B before submitting your response:'
echo ""
echo "Task("
echo '  description="Evaluate [short summary of solution B]",'
echo '  ...'
echo ")"
echo ""
echo '// Create a similar evaluation `Task()` for solution C before submitting your response:'
echo ""
echo "Task("
echo '  description="Evaluate [short summary of solution C]",'
echo '  ...'
echo ")"
echo ""
echo '// Now submit all `Task()` invocations together in a single response'
echo ""
echo "${BACKTICK}${BACKTICK}${BACKTICK}"
echo ""
echo 'Execute multiple evaluations in parallel by including all `Task()` tool calls in a single response message. **Never execute sequentially.**'
```
</task-templates>

<instructions>
## Step 1: Analyze Problem Deeply

1.1. Think intensely to understand the `<user-message>`
1.2. If the `<user-message>` contains specific issue(s), **definitively and unambiguously** identify the root cause(s) of the issue(s)
1.3. Identify key constraints, requirements, and success criteria
1.4. Determine what constitutes a good solution for this specific context

## Step 2: Generate 3 Diverse Solutions

- Solutions must be meaningfully different approaches
- Each solution should be complete and self-contained
- File and directory references must use absolute paths

2.1. Generate 3 distinct solutions
2.2. Ensure solutions address different aspects or use different approaches

## Step 3: Create Tasks to Evaluate Solutions

- Each evaluator independently assesses their assigned solution
- Evaluators receive the full problem context plus one specific solution
- Include file and directory paths required to evaluate the solution
- **Do not submit the `Task()` tool calls over multiple messages. This causes them to run sequentially.**

3.1. Create a `Task()` tool call for each evaluation, following the guidance in `<task-templates>`
3.2. Submit all `Task()` tool calls in a single response to execute the evaluations in parallel
3.3. Review all evaluation results

## Step 4: Synthesize and Iterate

4.1. Analyze the evaluation results:
  - If a solution fully satisfies the `<user-message>` and has no addressable weaknesses:
    - Move to "Step 5: Present Final Recommendation"
  - If there have been more than 3 iterations without meaningful improvement:
    - Designate the best solution as "optimal"
    - Move to "Step 5: Present Final Recommendation"
  - If solutions have complementary strengths:
    - Analyze the solutions' strengths and weaknesses
    - Generate 3 NEW hybrid solutions based on evaluation insights
    - Return to "Step 3: Create Tasks to Evaluate Solutions"
  - If NO solutions are adequately supported by evaluations:
    - Analyze why initial solutions failed
    - Generate 3 NEW solutions based on evaluation insights
    - Return to "Step 3: Create Tasks to Evaluate Solutions"

## Step 5: Present Final Recommendation

5.1. Present the optimal solution, including the agent's analysis:
  - **Effectiveness** - How well does it address the `<user-message>`?
  - **Strengths** - What are its key advantages?
  - **Weaknesses** - What are its limitations or risks?
  - **Feasibility** - How practical is implementation?
  - **Trade-offs** - What compromises does it require?
  - **Edge cases** - What scenarios might challenge it?
5.2. Explain why this solution emerged as best
</instructions>