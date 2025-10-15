/test-agent-v7 `/workspace/.worktrees/discovery-command/.claude/agents/documenter.md` / documenter / Optimize the documenter agent to produce reports that serve as effective starting points for understanding codebases.

## Testing Methodology

### Step 1: Generate Documentation
Have the `documenter` agent create architectural documentation for different parts of the codebase (e.g., `packages/models`, `packages/mcp-servers/src/codebase.ts`, `packages/website/server`).

### Step 2: Verify Output
After each documenter run:
- Confirm the report file was created
- Note the full path to the documentation file
- Check the file is not empty

### Step 3: Test with General-Purpose Agent
Spawn a `general-purpose` agent with:
- The documentation provided as context via `@/full/path/to/report.md` in the prompt
- A complex architectural question about the documented component
- Freedom to use the documentation as a starting point and explore further with any tools needed

#### Example General-Purpose Agent Prompt:
```
You have been provided with architectural documentation for packages/models as a starting point:
@/workspace/reports/project-state/models.md

Using this documentation as context, along with any tools you need, answer this question:

"How does the User model handle authentication and session management? What are the key architectural decisions around user state persistence and security?"

Please investigate thoroughly and provide:
1. A comprehensive answer to the question
2. Note what information came from the documentation vs your own investigation
3. Report how many tools you used and which ones
4. Record your start and end timestamps
```

### Step 4: Evaluate Quality

Test with TWO types of questions:
1. **Well-documented areas** - Information that should be covered in good architectural documentation
2. **Edge cases or missing areas** - Information that might not be documented (e.g., asking about User authentication when documenting a logging module)

Score each variation based on:
- **Answer accuracy** (0-10): How correct and complete is the final answer?
- **Hallucination detection**: When the documentation contains gaps, does the agent recognize this and investigate further?
- **Tool efficiency**: Did the documentation reduce unnecessary tool usage or guide the agent to the right areas?
- **Time to insight**: How quickly did the agent reach accurate conclusions?

### Step 5: Iterate and Optimize
Create multiple variations of the documenter instructions testing different approaches:
- Information density (comprehensive vs minimal)
- Structural organization (flat vs hierarchical)
- Architectural focus (decisions vs implementation)
- Coverage reporting (what's included vs what's missing)
- Navigation aids (indices, cross-references, summaries)

## Success Criteria
The optimal documenter variation should:
- Provide useful architectural context that speeds up understanding
- Guide the agent toward important areas without limiting exploration
- Prevent false assumptions while encouraging investigation
- Reduce redundant tool usage by highlighting key insights

## Implementation Notes
- Use the current codebase (`/workspace/.worktrees/discovery-command`) as test material
- Test at least 3 different codebase sections
- Create at least 5 instruction variations
- The general-purpose agent should treat documentation as a helpful guide, not gospel
- Measure both positive impact (faster/better answers) and negative impact (misleading information)