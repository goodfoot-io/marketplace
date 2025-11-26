---
name: refactoring
description: Decision routing for complex refactoring scenarios. Directs to supplementary methodology documents when nuanced judgment is needed during plan-aware code cleanup.
---

Select and load the relevant methodology document based on the refactoring scenario you encounter:

- Read `methodology/complexity-assessment.md` if you need to determine whether complexity is essential or accidental. Provides a systematic framework for evaluating whether sophisticated code addresses genuine domain requirements or was introduced unnecessarily during implementation. Use when code seems over-engineered, implementation appears sophisticated for the problem scope, or abstractions exist without clear justification in the plan.
- Read `methodology/duplication-judgment.md` if you need to decide whether to consolidate or tolerate duplicated code. Provides guidance for distinguishing harmful duplication that requires parallel updates from acceptable similarity representing different concepts. Use when similar code exists in multiple locations, uncertain whether abstraction would help or harm, or weighing maintenance burden against readability.
- Read `methodology/test-refinement.md` if you need to refactor tests or evaluate test structure quality. Provides guidance for improving test code clarity and maintainability while ensuring tests verify behaviour over implementation. Use when tests appear coupled to implementation details, test suite has redundant or overlapping coverage, or uncertain whether to consolidate or separate test cases.
- Read `methodology/protective-heuristics.md` if you need safeguards before removing code you do not fully understand. Provides a framework for avoiding destructive refactoring by establishing investigation techniques and safe removal criteria. Use when code purpose is not immediately clear, no obvious tests or plan references exist for the code, or uncertain whether removal would break subtle requirements.
