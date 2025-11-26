---
name: refactoring
description: Decision routing for complex refactoring scenarios. Directs to supplementary methodology documents when nuanced judgment is needed during plan-aware code cleanup.
---

<routing-instructions>
This skill provides additional methodology for complex refactoring decisions. Load the relevant document when you encounter the corresponding situation.

## Complexity Decisions

**When unsure whether complexity is essential or accidental:**
Read @complexity-assessment.md

Indicators:
- Code seems over-engineered but you are uncertain
- Implementation appears sophisticated for the problem scope
- Abstractions exist without clear justification in the plan

## Duplication Decisions

**When deciding whether to consolidate or tolerate duplication:**
Read @duplication-judgment.md

Indicators:
- Similar code exists in multiple locations
- Uncertain whether abstraction would help or harm
- Weighing maintenance burden against readability

## Test Refactoring

**When refactoring tests or questioning test structure:**
Read @test-refinement.md

Indicators:
- Tests appear coupled to implementation details
- Test suite has redundant or overlapping coverage
- Uncertain whether to consolidate or separate test cases

## Removal Decisions

**When considering removing code you do not fully understand:**
Read @protective-heuristics.md

Indicators:
- Code purpose is not immediately clear
- No obvious tests or plan references for the code
- Uncertain whether removal would break subtle requirements
</routing-instructions>
