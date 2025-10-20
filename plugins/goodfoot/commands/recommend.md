---
description: Recommend changes before proceeding with an update.
---

<user-message>
Recommend: $ARGUMENTS
</user-message>

1. Think deeply and analyze the request in  `<user-message>` to understand goals and constraints
2. Review any supporting files associated with the request
3. Generate three distinct approaches to achieve the goals
4. For each approach:
  - Identify supporting evidence (0-3 points)
  - Identify contradicting evidence (0-3 points)
  - Identify associated risks
  - Answer the question: "Will this approach **really** achieve the user's request?"
5. Select the most appropriate approach based on the evidence and risks
6. Present the recommendation to the user
7. Wait for **explicit approval** or **reqeuested changes or observations** from the user before proceeding
8. If the user **reqeuests changes or makes observations**, incorporate this feedback and return to step 3
