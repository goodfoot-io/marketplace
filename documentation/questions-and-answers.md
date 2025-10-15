
I'd like to create an AI agent that tracks several different types of world knowledge:

- To-do lists, which consist of a title, description, and an array of tasks.
- Tasks, which consist of a title and description, and a boolean "completed" status
- Notes, which consist of a title and a description

To-do lists, Tasks, and notes should all be nodes in a directional graph.

The cumulative set of nodes should be passed into the context window of the AI agent.

I suffer from ADHD, so the purpose of this AI agent is to create a conversational assistant that can help me prioritize my day.

Here are some existing questions I've considered.

```

> Should nodes (to-do lists, tasks, notes) have explicit relationships? For example, can one note link explicitly to another note or item, or are relationships mainly hierarchical (list → item)?

Explicit relationships are beneficial. Relationships can be hierarchical by default (list → item), but also allow flexible linking (e.g., notes linking to tasks or other notes directly) to reflect complex real-world associations.

> Do relationships have semantic meaning (e.g., dependencies, subtasks, prerequisites)?

Relationships has semantic meaning because of their structure. Perhaps we should add a short "description" to the relationship record?

For example Task A [is waiting on a callback from] Note B (which is information about a venue)

> How should priority be determined? Is it user-defined (high/medium/low), inferred based on deadlines, or context-driven (importance, urgency, personal energy level)?

Priority will only be managed through the ordering of the tasks in the to-do list. The agent should dynamically adjust priorities based on factors like approaching deadlines, time sensitivity, and user-indicated urgency or energy levels.

> Should the AI automatically reorder tasks based on real-time context (time of day, your energy level, task urgency)?

Yes, the AI should proactively reorder tasks based on context, including real-time awareness of deadlines, user's typical productivity patterns, and explicitly stated current mental/energy states.

> Would you like the AI to reference past notes or completed tasks when suggesting priorities or new tasks?

Yes, referencing past notes or completed tasks can provide valuable contextual awareness, ensuring that task suggestions remain informed, personalized, and coherent over time.

Stale information, for example a completed task, may need to be removed or recycled into a note. For example "On Tuesday, May 27th John went to the doctor"

> How often do you imagine interacting with this agent throughout the day? Should it proactively check in or primarily respond when prompted?

The agent should only respond when prompted. However the prompt might be something open ended like, "what should I work on next?"
 
> How conversational should interactions be? Would you prefer short commands ("add note"), or rich conversational interactions ("I’m overwhelmed—what should I prioritize next?")?

Rich conversational interactions are ideal, allowing natural language expressions of states ("feeling overwhelmed," "low energy") alongside short commands for rapid input.

> Should the agent summarize and narratively contextualize tasks (to make prioritization intuitive and engaging), or is concise enumeration preferable?

Narrative contextualization would help maintain motivation and clarity, making task management intuitive, engaging, and suited to ADHD-specific challenges with context-switching.

> Should it explicitly manage distractions—prompting you if too many tasks are unfinished or recognizing patterns when you deviate?

Explicit distraction management is highly valuable, gently prompting when it detects procrastination patterns or tasks becoming repeatedly deferred.

> Would it be beneficial if the agent monitored recurring difficulties (like repeatedly postponing certain types of tasks) to offer adaptive strategies?

Yes, tracking recurring difficulties and proactively offering adaptive strategies or alternative approaches would greatly enhance effectiveness and user engagement.

> Are there existing tools or frameworks you’d like to leverage (e.g., Neo4j, NetworkX, LangChain)?

My current plan is to dump all to-do lists, tasks, and notes, as well as their relationships into the AI context window. Because of this, only basic SQL is required. I'd like to start out with Postgres for simplicity.

> Should the graph support dynamic reconfiguration based on updates (task completion, postponement, new urgent notes)?

Dynamic reconfiguration is essential. The graph should automatically reflect real-time changes to tasks, priorities, dependencies, and context.

> Do you want the AI to provide explanations or reasoning when reprioritizing tasks?

Yes, clear explanations are valuable to reinforce trust, maintain motivation, and provide context. For example, "I've prioritized Task A because it's due tomorrow."

The AI should not try to closely track my energy levels.

> Should the agent proactively suggest breaking large tasks into smaller subtasks based on perceived complexity or recurring difficulty?

Yes, proactively suggesting task decomposition helps manage overwhelm, encourages progress, and matches ADHD-specific strategies that support incremental progress.

> Would it be helpful if the agent tracked your mood or energy explicitly over time to better anticipate your state?

No, the agent may make assumptions based on my feedback but should not proactively ask about my mood or energy.

> Should tasks or notes have optional metadata fields, such as deadlines, estimated completion times, location-specific relevance, or required resources?

No. The schema should be as simple and as high level as possible. Metadata such as locations and completion times can be stored in text and evaluated in context.

> Is there value in integrating external context like calendar events, weather, or location data to refine recommendations?

The LLM should be able to use a set of tool functions to query things like the weather.

> Would you benefit from the agent recognizing task categories (work, personal, health, errands) for better contextual prioritization?

The title and description of the to-do list will be used for categorizing the associated tasks.

> How should the agent handle historical information—should completed tasks simply disappear, become notes, or remain as historical context for pattern detection?

Tasks can be marked as completed. Information from completed tasks that are no longer relevant (i.e. walk the dog tonight) should be converted into notes. Or the task should be removed.

> Do you want the agent to periodically suggest archival or cleanup of older notes/tasks, or manage this automatically based on relevance or recency?

The agent should proactively and periodically cleanup or archival based on low relevance or staleness, allowing user confirmation rather than full automation.

This process should be automatic.

> Should the AI agent confirm before making significant rearrangements or reprioritizations, or should it confidently make these changes autonomously?

It should confidently make these changes autonomously.

> What level of manual override or locking mechanism should exist for certain tasks (e.g., “lock” a task's priority so it remains stable despite context shifts)?

There should be no locking mechanism, although the user might add to a task, list, or note's description that the task is important.

> Should the relationship metadata include timestamps or other contextual indicators (like the reason for linking two nodes at a specific time)?

Relationship metadata should include a "reason" or "description" and a timestamp.

> Would it be valuable to visualize the task/note graph occasionally for better situational awareness, or is textual output sufficient?

Graph visualization is beneficial as an occasional reference tool, offering intuitive situational awareness but not required as a primary interaction mode.

> Should the agent learn your productivity and attention patterns over weeks/months, or primarily react day-to-day?

The agent should track my productivity and attention patterns in notes and make it's best judgement day-to-day.

> Would personalized insights or reflections be helpful, summarizing trends, frequent blocks, or achievements (weekly/monthly)?

No, although the AI should be able to provide personal insights when requested.

> Should the agent support multi-turn conversations, remembering ongoing context across several exchanges (e.g., you say "I finished the first two tasks," and it adjusts immediately without explicit commands)?

Yes, multi-turn conversational memory enhances natural interaction, enabling the agent to seamlessly integrate recent context and adjust task priorities or notes without needing repetitive explicit instructions.

> Can the agent proactively reference relevant notes or tasks in conversation without being explicitly prompted, if it senses they might clarify the current query?

Yes, proactively referencing notes or tasks that provide useful context makes interactions smoother and richer, enhancing the quality of task prioritization. All notes, lists, and tasks will be embedded in the context window.

> Should the agent automatically simplify task descriptions or suggest clarifications if the descriptions become vague or overly complex?

The agent should proactively ask clarifying questions if task descriptions are ambiguous, vague, or overly complex, but it should not autonomously rewrite or simplify descriptions.

> When decomposing tasks into subtasks, should the agent automatically create explicit relationships like "is part of" or "is prerequisite for"?

Yes, explicitly labeling these relationships with clear semantic meaning (such as "is part of" or "prerequisite") will improve clarity, organizational understanding, and enable smarter task prioritization.

> Should the AI adjust tasks based on the day of the week, recognizing routines or habits (e.g., tasks more appropriate for weekends)?

Yes, incorporating temporal context like day-of-week routines enhances the agent's practical utility, aligning suggestions to habitual patterns, although explicit user confirmation is unnecessary.

> Would the agent benefit from understanding recurring or cyclical tasks (weekly or monthly) to automatically re-populate your lists?

Recurring tasks should not automatically repopulate; instead, the agent should suggest reminders based on historical task patterns and user-defined descriptions.

> How aggressively should the AI forget irrelevant or stale context? Would you prefer conservative archival (retain more) or aggressive cleanup (retain less)?

The AI should moderately and proactively clean up stale or irrelevant context, balancing historical relevance with simplicity, but maintain an accessible, searchable archive for future reference.

> Should archived or removed tasks and notes remain searchable, or would you prefer them permanently purged after a certain duration?

Tasks may be in a completed state, although they should be translated into notes containing information that might be helpful in the future periodically. This process should be automatic.

> Would you like explicit logs or records of when the AI autonomously adjusts priorities or archives items, to audit its decisions later?

Changes so the lists, tasks, and notes should be recorded in a re-playable fashion that can also be used for logging.

> Should the agent periodically check in to validate that prioritization feels correct, even if adjustments were made autonomously?

No, the agent should confidently prioritize autonomously without periodic validation, although it must transparently explain prioritization logic upon request. 

The user may re-prioritize.

> Do you anticipate scaling this graph-based model to include other data types or integrations (email summaries, Slack messages) later, even though it's currently simple?

No.

> Should relationships ever be bidirectional (mutual references), or will all relationships always be strictly directional?

Relationships should remain strictly directional, maintaining clarity of dependencies, hierarchies, and references, although mutual references could exist as two directional relationships if needed.

> Should the agent occasionally highlight critical tasks explicitly ("Today’s top priority is X because Y") even if not prompted directly?

No, explicit highlighting should only occur upon request, preserving user control and reducing unsolicited interruptions.

> Would you appreciate explicit acknowledgment or reinforcement after marking tasks complete ("Great job completing X! Now you might focus on Y.")?

No, explicit reinforcement or acknowledgments after task completion are unnecessary. Interactions should remain focused, purposeful, and neutral.


> Should the agent provide reminders or follow-ups if you explicitly set a future time (e.g., "Remind me tomorrow morning")?

Yes, the agent should handle explicit time-based reminders by creating dedicated tasks or notes reflecting this instruction, triggering a visible reminder only when explicitly queried (e.g., "What's on my agenda this morning?").

> How should the agent handle input errors or misunderstandings during conversations? Should it request immediate clarification or assume and log assumptions transparently?

The agent should immediately request clarification when encountering significant ambiguity or misunderstanding. For minor ambiguities, it should transparently log assumptions and proceed autonomously, allowing retrospective correction.

> Should the agent support bulk operations or queries (e.g., marking multiple tasks completed simultaneously)?

Yes, supporting efficient bulk operations through natural conversational commands (e.g., "Mark these three tasks as completed") significantly improves usability and workflow efficiency.

> If context or priorities shift dramatically (unexpected events), should the agent quickly reprioritize tasks across all lists, or focus adjustments on specific affected areas?

The agent should autonomously reprioritize tasks broadly when major shifts occur, clearly explaining its reasoning if requested, ensuring the user's task landscape remains coherent and actionable.

> Should the agent proactively create new tasks based on patterns or explicit cues ("You mentioned booking flights earlier—should I add that task now?")?

Yes, proactive task creation based on explicit conversational cues or clear patterns is beneficial, though the agent should explicitly confirm these creations conversationally to avoid unintended task accumulation.

> Would you prefer the agent to explicitly confirm the creation of these proactive tasks or create them autonomously and transparently log the reason?

The agent should create them autonomously and transparently log the reason.

> How long should completed tasks remain visible before becoming archived or converted into notes? Immediately, daily, weekly, or based on explicit user preferences?

Completed tasks should  be converted into notes when they are no longer relevant to other active tasks. Then the information in them should be stored as notes if relevant.

> Should the agent support bulk restoration of archived tasks/notes, or is manual retrieval sufficient?

Manual retrieval is sufficient for archived tasks or notes, prioritizing simplicity and clarity over extensive restoration capabilities.

> Should the AI differentiate tasks visually or narratively by urgency or complexity during summaries, even without explicit metadata?

Narrative differentiation by urgency or complexity enhances intuitive understanding and motivational engagement, though no explicit visual differentiation or structured metadata beyond task descriptions is required.

> How detailed should relationship descriptions be? Are short phrases sufficient, or would structured annotations (e.g., types like "waiting," "blocked by," "requires") be helpful?

Descriptive phrases are minimally sufficient, provided they clearly convey the relationship context and semantic intent. Structured annotations should not be used.

Annotations could be paragraph length if it's important to understand the relationship between the two items.

> Should the agent maintain a comprehensive log of all conversational interactions for later review or troubleshooting?

Yes, maintaining a comprehensive conversational interaction log supports troubleshooting, auditing, and retrospective clarity, available transparently upon user request.

> Would a periodic report summarizing key decisions (archivals, reprioritizations, proactive task creations) ever be useful, or should this be strictly on-demand?

This should be strictly on demand.

> Should the agent provide structured data exports (JSON, CSV) for your data for potential external use or migration?

No.

> Is there potential future interest in integrating voice interfaces (Alexa, Siri), or will text-based interaction remain sufficient indefinitely?

Interaction with the agent should be "voice first".

> Should the agent explicitly notify you if data inconsistencies or conflicts occur (e.g., duplicate tasks, circular dependencies), or quietly resolve them autonomously?

The agent should autonomously and quietly resolve minor inconsistencies or duplicates, transparently logging these decisions, but explicitly notify about significant conflicts (e.g., circular dependencies or serious data ambiguity).

> What safeguards should be present to prevent accidental data loss during autonomous cleanup or archiving?

The lists, tasks, notes, and edge annotations should be stored in a replayable journal/log to enable replay and time-travel.

```
