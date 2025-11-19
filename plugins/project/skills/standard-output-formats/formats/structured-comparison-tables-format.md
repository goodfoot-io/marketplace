Use this component when:
- Comparing before/after states
- Evaluating multiple options or solutions
- Showing feature availability across tiers
- Documenting configuration differences
- Presenting pros and cons systematically

**Example user message:**
Compare the three database options we're considering with their trade-offs.

## Template

## [Comparison Title]

### Option Comparison Matrix
```text
┌─────────────────┬──────────────┬──────────────┬──────────────┐
│ Criteria        │ [Option A]   │ [Option B]   │ [Option C]   │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ [Criterion 1]   │ [✓/✗/Partial]│ [✓/✗/Partial]│ [✓/✗/Partial]│
│ [Criterion 2]   │ [✓/✗/Partial]│ [✓/✗/Partial]│ [✓/✗/Partial]│
│ [Criterion 3]   │ [✓/✗/Partial]│ [✓/✗/Partial]│ [✓/✗/Partial]│
│ Licensing       │ [License]    │ [License]    │ [License]    │
│ Architecture    │ [Pattern]    │ [Pattern]    │ [Pattern]    │
│ Scaling         │ [Approach]   │ [Approach]   │ [Approach]   │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ Recommendation  │ [Reason]     │ [Reason]     │ [Reason]     │
└─────────────────┴──────────────┴──────────────┴──────────────┘
```

### Before/After Comparison
```text
Aspect              Before                  After                   Change
────────────────────────────────────────────────────────────────────────────────
[Aspect 1]          [Old state]            [New state]             [Impact description]
[Aspect 2]          [Old approach]         [New approach]          [Qualitative change]
[Aspect 3]          [Old behavior]         [New behavior]          [Effect on system]
Architecture        [Pattern A]            [Pattern B]             [Architectural impact]
Dependencies        [Library set A]        [Library set B]         [Dependency changes]
Complexity          [Description]          [Description]           [Simplified/Added complexity]
```

### Feature Availability Matrix
```text
Feature                 Free    Pro     Enterprise   Notes
───────────────────────────────────────────────────────────────
[Feature 1]             ✓       ✓       ✓           [Limitations if any]
[Feature 2]             ✗       ✓       ✓           [Pro+ only]
[Feature 3]             Limited  ✓       ✓           [Free: up to X]
[Feature 4]             ✗       ✗       ✓           [Enterprise only]
API Rate Limit          100/hr  1000/hr 10000/hr    [Per endpoint]
Support                 Forum   Email   24/7 Phone   [Response time]
```
