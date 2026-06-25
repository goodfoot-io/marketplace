# Question/action framework for organizing a documentation corpus

These question-and-action pairs form a practical framework for organizing a documentation corpus around findability, user intent, durable topic design, and long-term maintainability. Each question identifies a piece of information worth discovering about the corpus, its readers, or the underlying domain. Each corresponding action translates that discovery into a documentation decision: creating a source-of-truth topic, improving navigation, adding metadata, resolving terminology drift, strengthening information scent, routing readers through multiple paths, or validating the structure through observed behavior.

The framework treats a wiki as an organizing system rather than a loose collection of pages. It combines information architecture, topic-based technical communication, controlled vocabulary practice, faceted classification, information-foraging research, nonlinear search behavior, usability testing, search-log analysis, and documentation governance. Its purpose is to help readers find the right information through multiple paths, understand a page’s scope and authority, recover when they start from the wrong term or context, and trust that the corpus remains accurate over time.

The framework uses several distinct but related design dimensions. **Documentation mode** describes the reader’s intent: learning, doing, looking up, or understanding. **Topic type** describes the information structure: concept, task, reference, troubleshooting, glossary, and similar forms. **Page genre** describes how the content is used in practice: hub, runbook, migration guide, changelog, architecture overview, policy, checklist, or decision record. **Metadata** describes scope, ownership, applicability, status, version, and retrieval context. These dimensions can overlap, but they should not be collapsed into one undifferentiated page-type field.

The framework distinguishes several terms that are often conflated. A **source-of-truth page** is an editorial authority for a topic. A **preferred term** is the vocabulary-controlled label for a concept. A **stable permalink** or **durable ID** is a long-lived reference target. A **canonical URL** is an SEO and web-indexing mechanism for choosing a representative URL among duplicate or near-duplicate pages, and should be used only in that sense.

# Required reading for the question/action framework

| # | Reading | One-line description | Authors and background | Why it belongs | Supporting URL |
|---:|---|---|---|---|---|
| 1 | **The Discipline of Organizing** | A general theory of organizing resources, descriptions, categories, metadata, relationships, and interactions. | Edited by **Robert J. Glushko**, Adjunct Full Professor at UC Berkeley’s School of Information and coauthor of *Document Engineering*. | This is the deepest source for treating a wiki as an organizing system, not just a set of pages. It supports questions about resources, descriptions, categories, relationships, interactions, and governance. | https://mitpress.mit.edu/9780262518505/the-discipline-of-organizing/ |
| 2 | **Information Architecture: For the Web and Beyond** | The standard practical text on organizing, labeling, navigation, search, and content structure for digital environments. | **Louis Rosenfeld** is founder of Rosenfeld Media and a long-time IA consultant; **Peter Morville** is president of Semantic Studios and a major figure in IA/findability; **Jorge Arango** is an information architect, author, and educator. | This is the core source for the overall method: distinguish content, labels, navigation, search, users, and context. It underlies hubs, navigation projections, labeling, search, and corpus structure. | https://www.oreilly.com/library/view/information-architecture-4th/9781491913529/ |
| 3 | **Ambient Findability** | A book-length treatment of findability as a property of information environments shaped by search, navigation, metadata, and ubiquitous access. | **Peter Morville** is an information architect and findability consultant, coauthor of the “Polar Bear” IA book and founder/president of Semantic Studios. | This explains why documentation organization should optimize for being found through many paths, not merely written correctly. | https://dl.acm.org/doi/abs/10.5555/1121644 |
| 4 | **Information Foraging** | A theory of how people seek information by estimating value, effort, and cues in the environment. | **Peter Pirolli** is a cognitive scientist and researcher associated with PARC; **Stuart K. Card** was a Xerox PARC HCI pioneer whose work connected psychology, AI, and computer science. | This is the foundation for questions about link labels, cost of click, page summaries, search previews, and whether users can predict what lies behind a link. | https://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2012/12/280uir-1999-05-pirolli.pdf |
| 5 | **SNIF-ACT: A Cognitive Model of User Navigation on the World Wide Web** | A computational model of web navigation based on information scent and user goals. | **Wai-Tat Fu** was affiliated with the University of Illinois; **Peter Pirolli** continued the information-foraging research program at PARC. | This bridges abstract information scent to concrete navigation behavior: why users choose one link, ignore another, backtrack, or abandon a path. | https://www.tandfonline.com/doi/abs/10.1080/07370020701638806 |
| 6 | **The Design of Browsing and Berrypicking Techniques for the Online Search Interface** | A foundational paper arguing that real search is iterative, evolving, and nonlinear. | **Marcia J. Bates** is Professor Emerita at UCLA’s Department of Information Studies and a major scholar in information seeking, search strategy, and knowledge organization. | This supports the nonlinear-search model: users gather partial answers, reformulate, follow links, and recover from wrong paths rather than asking one fixed question. | https://pages.gseis.ucla.edu/faculty/bates/berrypicking.html |
| 7 | **Diátaxis** | A documentation framework that separates tutorials, how-to guides, reference, and explanation according to user need. | **Daniele Procida** is Director of Engineering at Canonical, author of Diátaxis, and a long-time documentation practitioner. | This is the clearest source for organizing documentation around user intent and separating different documentation modes instead of allowing every article to become a mixed-purpose page. | https://diataxis.fr/ |
| 8 | **Darwin Information Typing Architecture / DITA 1.3, Part 2: Technical Content Edition** | A formal standard for topic-based technical documentation, including concept, task, reference, troubleshooting, glossary, bookmap, and classification-map structures. | Published through **OASIS Open**; the technical-content edition is designed for authors who use information typing to document complex applications and devices. | This supports typed source-of-truth topics: concept pages, task pages, reference pages, troubleshooting pages, glossary structures, maps, and classification structures. | https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part2-tech-content.html |
| 9 | **Every Page Is Page One** | A topic-based writing philosophy for the web: every page may be a user’s first page, so topics must be self-contained and context-rich. | **Mark Baker** is a technical writer, publications manager, structured-authoring consultant, trainer, and author of books on structured writing and technical communication. | This supports the rule that source-of-truth articles should stand alone, include enough context, and not assume users arrived through the intended hierarchy. | https://xmlpress.net/publications/eppo/ |
| 10 | **ANSI/NISO Z39.19: Guidelines for the Construction, Format, and Management of Monolingual Controlled Vocabularies** | The key standard for monolingual controlled vocabularies, including lists, synonym rings, taxonomies, thesauri, term scope, and maintenance. | Published by **NISO**, the National Information Standards Organization, which develops information-management standards. | This supports preferred terms, nonpreferred terms, synonym rings, deprecated names, aliases, acronyms, homographs, taxonomy governance, and terminology drift in monolingual vocabularies. | https://www.niso.org/publications/ansiniso-z3919-2005-r2010 |
| 11 | **ISO 25964: Thesauri and Interoperability with Other Vocabularies** | An international standard for thesaurus development, multilingual thesauri, and mappings between vocabularies. | Published by **ISO** and described by NISO as a standard for thesauri and interoperability. | This complements Z39.19 when a corpus needs multilingual vocabulary control, vocabulary mapping, or interoperability among multiple vocabularies. | https://www.niso.org/standards-committees/iso-25964 |
| 12 | **Faceted Classification: Management and Use** | A practical and theoretical treatment of how faceted classifications work in online retrieval environments. | **Aida Slavic** is associated with the Universal Decimal Classification Consortium and works on classification systems and knowledge organization. The article was published in *Axiomathes* 18, 257–271, with an accessible arXiv copy. | This supports the idea that a wiki should not rely on one hierarchy; articles can be organized by component, role, task, lifecycle stage, version, failure mode, and other facets when those facets are usable, governable, and exposed in retrieval systems. | https://arxiv.org/abs/1705.07047 |
| 13 | **Faceted Classification as the Basis of All Information Retrieval** | A defense of facet analysis as a general foundation for retrieval, classification, and knowledge organization. | **Vanda Broughton** is a senior scholar in Library and Information Studies at UCL and a long-time author on classification, controlled vocabularies, and faceted systems. | This supports the faceted-classification theory behind alternate projections. A matrix view is an applied design pattern over facets, not a claim made directly by the source and not the whole architecture. | https://discovery.ucl.ac.uk/10038742/3/Broughton_final_Faceted%20classification.pdf |
| 14 | **Information Scent: How Users Decide Where to Go Next** | A practical UX explanation of how users evaluate links, labels, and surrounding cues before clicking. | Published by **Nielsen Norman Group**; the article is by **Raluca Budiu**, Senior Director of Data Strategy at NN/g, with a PhD from Carnegie Mellon and expertise in cognitive psychology, HCI, usability methods, and data analysis. | This is the practical source for page titles, summaries, link labels, headings, previews, and whether users can predict a destination before clicking. | https://www.nngroup.com/articles/information-scent/ |
| 15 | **Card Sorting vs. Tree Testing** | A practical distinction between discovering users’ mental categories and testing whether a proposed IA works. | Published by **Nielsen Norman Group**, a UX research and consulting firm founded by Jakob Nielsen and Don Norman. | This supports validation: use card sorting to generate candidate groupings, tree testing to evaluate proposed structures, and observed behavior to revise the IA. | https://www.nngroup.com/articles/card-sorting-tree-testing-differences/ |
| 16 | **Search-Log Analysis: The Most Overlooked Opportunity in Web UX Research** | A practical guide to using internal search logs to understand user language, content gaps, and search-result failures. | **Susan Farrell** is a UX researcher and former senior UX specialist at Nielsen Norman Group. | This supports questions about failed searches, reformulated searches, nonpreferred terms, obsolete results, missing pages, and vocabulary gaps, while treating logs as diagnostic evidence rather than complete proof of intent. | https://www.nngroup.com/articles/search-log-analysis/ |
| 17 | **Performance-Based Usability Testing: Metrics That Have the Greatest Impact for Improving a System’s Usability** | Research on usability metrics and performance-based evaluation, including navigation-choice evidence in scenario-based testing. | **Robert W. Bailey**, **Cari A. Wolfson**, **Janice Nall**, and **Sanjay Koyani** are associated with performance-based usability research. | This supports first-click and navigation-choice measures as useful empirical signals while avoiding the claim that any single first-click metric universally determines success. | https://link.springer.com/chapter/10.1007/978-3-642-02806-9_1 |
| 18 | **Correct First Click Leads to 3x Higher Task Success** | A large tree-testing analysis showing a strong relationship between correct first clicks and task success. | Published by **Optimal Workshop**, a research platform focused on IA testing methods such as tree testing and card sorting. | This provides practical evidence for first-click testing in IA evaluation, while the exact multiplier should be treated as context-dependent rather than universal. | https://www.optimalworkshop.com/blog/correct-first-click-lead-to-3x-higher-task-success |
| 19 | **Docs for Developers** | A modern field guide to creating, measuring, and maintaining developer documentation across the software lifecycle. | **Jared Bhatti**, **Sarah Corleissen**, **Jen Lambourne**, **David Nunez**, and **Heidi Waterhouse** are practitioners in developer documentation; Bhatti co-founded Google’s Cloud documentation team and later worked on Waymo engineering documentation. | This is the practical developer-docs bridge: it translates user needs, templates, publishing, measurement, and maintenance into software-team workflows. | https://docsfordevelopers.com/ |
| 20 | **What is URL Canonicalization / How to Specify a Canonical URL** | Google Search Central guidance on canonicalization and duplicate-URL consolidation. | Published by **Google Search Central**, the official documentation for Google Search crawling, indexing, and ranking behavior. | This belongs because documentation teams often misuse “canonical URL” to mean any authoritative page. It distinguishes SEO canonicalization from editorial source-of-truth status, stable permalinks, redirects, and durable IDs. | https://developers.google.com/search/docs/crawling-indexing/canonicalization |
| 21 | **Filter with Metadata Search** | Official guidance on schema-based metadata search for RAG retrieval, including metadata schemas, attached metadata, and retrieval-time filtering. | Published by **Google Cloud** for Gemini Enterprise Agent Platform and RAG Engine. | This belongs because metadata helps AI retrieval only when the ingestion and retrieval pipeline stores, indexes, filters, ranks, grounds, or exposes the relevant fields. | https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/use-metadata-search |

---

# 1. Organize around user intent

## Audience and role questions

- **Who are the primary reader groups?** → Make them the main audience segments for hubs, paths, examples, permissions, and terminology.
- **Who are the secondary reader groups?** → Serve them through secondary paths, filters, “also useful for” links, or alternate entry points.
- **Which groups read the wiki frequently?** → Optimize navigation depth, shortcuts, page density, and reference precision for them.
- **Which groups read it only during onboarding, incidents, audits, or handoffs?** → Create situational entry points for those episodic use cases.
- **What does each reader already know?** → Keep their main path compact while making prerequisites explicit and linkable.
- **What does each reader falsely assume?** → Add corrections, warnings, and disambiguation near likely wrong turns.
- **Which readers are internal experts?** → Give them direct access to precise reference, schemas, runbooks, and operational shortcuts.
- **Which readers are new team members?** → Build guided learning paths while ensuring individual pages remain understandable when reached directly.
- **Which readers are operators under time pressure?** → Create short, high-scent operational and incident paths with verification and escalation.
- **Which readers are external customers, vendors, auditors, or partners?** → Separate external-safe content from internal implementation detail and mark visibility boundaries.
- **Which readers have permission to act, and which are only trying to understand?** → Separate explanatory pages from action pages that require authority or credentials.
- **Which readers need conceptual understanding versus exact procedural instruction?** → Route them to explanation/concept pages or task/runbook pages according to intent.
- **Which readers need evidence rather than instruction?** → Create audit, compliance, or policy pages that identify source, owner, scope, and version.

## Intent questions

- **What are users usually trying to do when they arrive?** → Make common intents the dominant navigation structure.
- **Are they trying to learn a concept?** → Create or link to an explanation or concept page.
- **Are they trying to complete a task?** → Create or link to a procedural how-to page with prerequisites and verification.
- **Are they trying to debug a problem?** → Create or link to symptom-led troubleshooting pages.
- **Are they trying to operate a system under pressure?** → Create concise runbooks with diagnosis, safe actions, verification, rollback, and escalation.
- **Are they trying to make a decision?** → Provide decision criteria, tradeoffs, constraints, and links to decision records.
- **Are they trying to compare alternatives?** → Build comparison tables and “choose this when” guidance.
- **Are they trying to verify a detail?** → Make the relevant reference page fast to reach and precise within its declared scope.
- **Are they trying to understand why something was designed a certain way?** → Link current docs to design rationale and decision records.
- **Are they trying to onboard themselves?** → Create a progressive path from concepts to tasks, but keep each linked topic self-contained.
- **Are they trying to recover from a failure?** → Prioritize diagnosis, rollback, known-good state restoration, and escalation thresholds.
- **Are they trying to answer a compliance, security, or audit question?** → Create evidence-oriented pages with ownership, scope, applicability, and versioning.
- **Are they trying to hand off responsibility to another person or team?** → Provide owner, dependency, state, and next-action context.

## Task and workflow questions

- **What are the top recurring tasks?** → Give them short paths from hubs, search, and matrix views.
- **What are the rare but high-stakes tasks?** → Create carefully reviewed runbooks with warnings, approvals, rollback limits, and evidence capture.
- **Which tasks are performed during normal operations?** → Place them in standard workflow hubs and recurring-operations paths.
- **Which tasks are performed only during incidents?** → Place them in incident hubs and recovery paths.
- **Which tasks require multiple systems or teams?** → Show handoffs, dependencies, ownership boundaries, and escalation points.
- **Which tasks have prerequisites?** → Put prerequisites before steps and link to setup docs.
- **Which tasks have irreversible consequences?** → Add warnings, approvals, backups, and rollback limits before the risky step.
- **Which tasks are frequently done incorrectly?** → Rewrite them with stronger scent, examples, guardrails, and verification checks.
- **Which tasks require decision points?** → Add branching logic and decision tables.
- **Which tasks require context before action?** → Pair task pages with concise concept prerequisites rather than embedding long explanations.
- **Which tasks need a checklist?** → Convert them into checklist-style operational content with completion criteria.
- **Which tasks need a runbook?** → Structure them around symptoms, actions, verification, rollback, and escalation.
- **Which tasks need reference tables?** → Split stable lookup data into a linked reference page or generated table.
- **Which tasks should not be attempted by some readers?** → Add role, permission, environment, and escalation markers.
- **Which tasks vary by environment, version, customer, or configuration?** → Add applicability metadata and branch the procedure only where behavior actually differs.

## Situation questions

- **Under what conditions does the user need this information?** → Create entry points based on situation, not only topic.
- **Is the user calm and exploratory, or under incident pressure?** → Choose between explanatory depth and terse operational guidance.
- **Is the user reading before doing, while doing, or after something went wrong?** → Sequence the page around preparation, execution, or recovery.
- **Is the user looking from memory, from a ticket, from an alert, from a customer report, or from a code path?** → Add aliases and entry links matching those origins.
- **Is the user likely to know the official term?** → Add synonyms, redirects, glossary entries, and “also called” labels.
- **Is the user likely to search by symptom, error message, system component, or business concept?** → Index pages by all likely search frames.
- **Does the user need a quick answer or a full explanation?** → Put the quick answer first and link to depth.
- **Does the user need confidence, context, or exact syntax?** → Match the page mode to the user’s uncertainty.
- **Is the user likely to arrive directly from search or AI retrieval?** → Include enough local context for the page to function without the intended navigation path.
- **Is the user likely to act in the wrong environment?** → Surface environment and version markers before instructions.

## Prioritization questions

- **Which intents are most common?** → Give them the shortest and clearest paths.
- **Which intents are most valuable to support?** → Elevate them even when they are not the most frequent.
- **Which intents are most costly when unsupported?** → Treat them as high-priority documentation gaps.
- **Which intents currently produce the most support interruptions?** → Convert repeated support answers into source-of-truth pages or FAQ entries with clear ownership and scope.
- **Which intents are blocked by missing documentation?** → Create new source-of-truth topics, hub links, or backlog items after confirming the missing intent.
- **Which intents are blocked by confusing documentation?** → Rewrite labels, split overloaded pages, or improve routing.
- **Which intents are blocked by documents being organized around teams instead of user needs?** → Re-map pages into user-task and lifecycle views.
- **Which intents are low-frequency but compliance-critical, incident-critical, or safety-critical?** → Promote them despite low volume and review them more rigorously.
- **Which intents need stable URLs because they are cited from tickets, alerts, changelogs, or external systems?** → Create source-of-truth pages with stable permalinks or durable IDs, and preserve access through redirects when names or locations change.

---

# 2. Use typed, source-of-truth topics

Typed topics combine two complementary ideas. Diátaxis separates documentation by user need: tutorials, how-to guides, reference, and explanation. DITA and topic-based technical communication provide more formal topic structures such as concept, task, reference, troubleshooting, and glossary. A healthy corpus can use both: user intent determines why the reader is here; topic type determines how the information should be structured. A source-of-truth topic is the editorial authority for a subject, not merely the page with the best ranking or the URL selected by search-engine canonicalization.

## Topic identity questions

- **What is the smallest meaningful topic?** → Make that the unit of source-of-truth documentation when it can stand alone, has distinct retrieval value, and can carry enough local context.
- **What deserves its own source-of-truth page?** → Create a source-of-truth topic page for subjects that are reusable, frequently linked, disputed, operationally important, independently searchable, or needed for durable references.
- **What is merely a section inside another page?** → Keep it embedded when it lacks independent user intent, ownership, or retrieval value.
- **What is a reusable concept that appears in many places?** → Extract it into a concept or explanation page and cross-link it.
- **What is a task that should be separated from its conceptual explanation?** → Separate “why” from “how” structurally; split into linked pages when combining them harms usability.
- **What is reference data that should be separated from prose?** → Move it to a scoped reference page, schema, generated table, or API reference.
- **What is troubleshooting information that should be separated from normal operation?** → Create symptom-led troubleshooting pages and link to them from risky tasks.
- **What is decision history that should be separated from current instructions?** → Move it to decision records linked from current docs.
- **What is obsolete but historically important?** → Archive it with status, date, scope, and replacement links.
- **What is duplicated across multiple pages?** → Pick one source-of-truth page, migrate useful content there, and replace duplicates with contextual links, redirects, or explicit historical/archive markers.
- **What is a stable topic but volatile data?** → Keep the topic page stable and generate or link the volatile data from an authoritative source.

## Documentation-mode and page-genre questions

- **Is this an explanation or concept topic?** → Optimize it for mental model, purpose, examples, prerequisites, and related tasks.
- **Is this a how-to or task topic?** → Optimize it for steps, prerequisites, outcomes, permissions, and verification.
- **Is this a reference topic?** → Optimize it for precise lookup, structured data, completeness within scope, versioning, and authority.
- **Is this a troubleshooting topic?** → Optimize it for symptoms, diagnosis, likely causes, fixes, evidence, and escalation.
- **Is this a runbook?** → Optimize it for time pressure, safety, rollback, verification, and operational handoff.
- **Is this a decision record?** → Optimize it for context, options, decision, consequences, date, and links to current implementation.
- **Is this a glossary entry?** → Optimize it for preferred term, definition, synonyms, scope, disambiguation, and related terms.
- **Is this an onboarding page?** → Optimize it as a sequenced path through prerequisite topics while keeping each destination page self-contained.
- **Is this a hub page?** → Optimize it for orientation, scope, routing, and link quality rather than detailed facts.
- **Is this a changelog?** → Optimize it for chronology, affected scope, versions, and links to changed docs.
- **Is this an architecture overview?** → Optimize it for system boundaries, relationships, conceptual maps, and links to component pages.
- **Is this a policy page?** → Optimize it for authority, applicability, requirements, exceptions, and evidence.
- **Is this a checklist?** → Optimize it for completion, order, ownership, confirmation, and reviewability.
- **Is this a migration guide?** → Optimize it for before/after states, steps, risks, dependencies, and rollback.
- **Is it combining multiple modes, topic types, or genres?** → Separate the intents structurally; split into separate pages only when the combined page weakens findability, usability, ownership, or maintainability.

## Concept and explanation questions

- **What concept does this explain?** → Make the concept the title and opening promise.
- **Why does the concept exist?** → Explain the problem it solves before implementation details.
- **What problem does it solve?** → Anchor the explanation in user-relevant purpose.
- **What should the reader understand after reading?** → State the learning outcome near the top.
- **What should the reader not try to do from this page?** → Link to task pages instead of embedding full procedures.
- **What examples clarify the concept?** → Add examples that match real use cases.
- **What concepts are prerequisites?** → Link them before the main explanation and include enough context for direct arrivals.
- **What concepts are commonly confused with it?** → Add comparison notes and disambiguating links.
- **What tasks depend on understanding it?** → Link forward to relevant how-to pages.
- **What reference pages define its formal details?** → Link to precise schemas, APIs, state tables, or policy definitions.
- **What scope limits the explanation?** → State what systems, versions, environments, or audiences the explanation covers.

## Task and how-to questions

- **What action does this page help the user perform?** → Make the action the page title and goal.
- **What is the desired end state?** → Define success before the steps.
- **Who is allowed to perform it?** → Add role and permission requirements.
- **What prerequisites must be true?** → Put prerequisites before instructions.
- **What inputs are required?** → List required inputs before the procedure.
- **What tools, permissions, environments, or credentials are needed?** → Add a preparation section.
- **What are the steps?** → Write ordered, testable instructions.
- **How does the user verify success?** → Add verification commands, checks, screenshots, metrics, or expected outputs.
- **What can go wrong?** → Link to troubleshooting paths at the point of failure.
- **Where should the user go if it fails?** → Add failure routing and escalation.
- **What should the user avoid?** → Add warnings at the point of risk.
- **Is the task reversible?** → Include rollback or state that no rollback exists.
- **Does the task need a rollback path?** → Add rollback steps before risky execution.
- **Does the procedure branch by version, customer, environment, or configuration?** → Branch only where behavior differs and label each branch clearly.

## Reference questions

- **What exact facts does this page define?** → Make the scope precise and structured.
- **Are the values complete within the declared scope?** → Fill gaps or mark incompleteness explicitly.
- **Are the values authoritative?** → Label the source of truth and owner.
- **Are there schemas, fields, states, commands, endpoints, permissions, limits, or error codes?** → Represent them as structured reference data.
- **Are examples normative or illustrative?** → Mark whether examples are required patterns or helpful samples.
- **Is the reference versioned?** → Add version applicability and change history.
- **Does the page distinguish current, deprecated, and experimental values?** → Label status for each value.
- **Is this information better represented as a table, schema, enum, generated doc, or API reference?** → Convert prose into structured or generated form.
- **Who owns the accuracy of this reference?** → Assign a named owner and review cadence.
- **What is out of scope for this reference?** → Add scope boundaries and links to adjacent references.
- **What generated source could reduce manual drift?** → Generate from code, schema, API definitions, configuration, or authoritative data when possible, with provenance, generation time, and owner review rules.

## Troubleshooting and runbook questions

- **What symptom, alert, error, or failure mode starts this page?** → Title the page from the user-visible symptom.
- **How does the user confirm the problem?** → Add diagnostic checks before fixes.
- **What are the likely causes?** → Order causes by probability, severity, and cost of investigation.
- **What should be checked first?** → Put the cheapest and highest-yield checks first.
- **What should be checked only after common causes are eliminated?** → Move rare or risky checks later.
- **What actions are safe?** → Mark safe actions clearly.
- **What actions are risky?** → Add warnings, approvals, and rollback notes.
- **When should the user escalate?** → Define escalation thresholds and contacts.
- **What evidence should the user collect?** → List logs, metrics, IDs, screenshots, traces, and timestamps needed.
- **What is the rollback or recovery path?** → Include recovery steps and success criteria.
- **How does the user know the system is healthy again?** → Add post-fix verification.
- **Are there known false positives?** → Add “not actually this problem” notes.
- **Are there known lookalike symptoms?** → Link to neighboring troubleshooting pages.
- **What should the user do after recovery?** → Add post-incident documentation, cleanup, and follow-up actions.

## Canonicality questions

- **Which page is the source of truth for this topic?** → Mark it as the source-of-truth page and route links, references, and maintenance workflows to it.
- **Which pages should link to it instead of duplicating it?** → Replace repeated content with contextual links.
- **Are there multiple competing explanations?** → Merge, archive, or reconcile them.
- **Which page should be merged, split, archived, or redirected?** → Apply the appropriate content lifecycle action.
- **Is the source-of-truth page clearly marked?** → Add visible source-of-truth status where authority, freshness, or conflict resolution affects reader trust.
- **Does the title make the topic obvious?** → Rename it to the stable preferred term; use metadata or page chrome, not the title alone, to signal source-of-truth status.
- **Does the page have an owner?** → Assign ownership and review responsibility.
- **Does the page have a review date?** → Add freshness metadata.
- **Does the page have version applicability?** → Label supported versions, environments, or systems.
- **Does the page say what systems, releases, or environments it applies to?** → Add applicability metadata and scope notes.
- **Does the page need a stable identifier?** → Add a durable ID or stable permalink when it is cited from tickets, alerts, code, AI indexes, or external systems; reserve canonical URL language for duplicate-URL consolidation.

---

# 3. Make hubs orientation and routing layers

Hubs are authoritative about orientation, scope, and navigation. They should not duplicate volatile technical facts that belong in source-of-truth articles, generated references, or owned runbooks. A good hub explains where the reader is, which path to choose, and why a link matters before the click.

## Hub necessity questions

- **Which domain areas need hubs?** → Create hubs for high-volume or high-complexity domains.
- **Which workflows need hubs?** → Create workflow hubs for multi-step user journeys.
- **Which roles need hubs?** → Create role hubs when different audiences need different paths.
- **Which lifecycle stages need hubs?** → Create lifecycle hubs for onboarding, deployment, operation, migration, and retirement.
- **Which incident categories need hubs?** → Create incident hubs for major failure classes.
- **Which product areas need hubs?** → Create product-area hubs where product language drives discovery.
- **Which architectural layers need hubs?** → Create architecture hubs where system structure aids understanding.
- **Which hubs already exist?** → Audit them for overlap, freshness, routing quality, and link accuracy.
- **Which hubs are missing?** → Create hubs where users currently rely on search, memory, tickets, or tribal knowledge.
- **Which hubs overlap?** → Merge, clarify scope, or cross-link them.
- **Which hubs are obsolete?** → Archive or redirect them.
- **Which hubs are really just long articles pretending to be hubs?** → Split orientation from source-of-truth content.
- **Which hubs are authoritative for routing decisions?** → Assign ownership for link selection, grouping, and scope language.

## Hub scope questions

- **What is this hub about?** → State the hub’s scope in the opening line.
- **What is explicitly out of scope?** → Add exclusions and links to adjacent hubs.
- **Who is this hub for?** → Label the audience and expected prior knowledge.
- **What should a reader be able to find from this hub?** → Ensure the hub covers those discovery paths.
- **What should a reader not expect to find here?** → Prevent wrong turns with disambiguation.
- **Does the hub represent a domain, a workflow, a role, a lifecycle stage, or a problem class?** → Make that organizing frame explicit.
- **Does the hub have a clear organizing principle?** → Reorganize around one dominant frame.
- **Is the organizing principle visible to the reader?** → Use headings that reveal the frame.
- **Does the hub contain facts that belong in owned source-of-truth pages?** → Replace volatile detail with short summaries and links.
- **Does the hub need its own owner separate from topic owners?** → Assign ownership for navigation quality even when technical facts are owned elsewhere.

## Orientation questions

- **Does the hub explain where the reader is?** → Add a short orientation paragraph.
- **Does it explain when to use the hub?** → Add “use this when” guidance.
- **Does it explain the most common starting points?** → Elevate start-here links.
- **Does it distinguish beginner paths from expert paths?** → Separate learning paths from direct reference.
- **Does it distinguish normal operation from emergency operation?** → Split routine and incident links.
- **Does it distinguish learning paths from action paths?** → Group concept links apart from task links.
- **Does it distinguish current systems from legacy systems?** → Label current, legacy, and deprecated paths.
- **Does it explain common confusions?** → Add “not the same as” notes.
- **Does it tell readers what to read first?** → Add a recommended first step.
- **Does it tell readers what they can skip?** → Reduce cognitive load with skip guidance.
- **Does it support direct arrivals from search?** → Make the hub’s purpose and scope clear without assuming prior navigation context.

## Link-selection questions

- **Which links belong on the hub?** → Include only links serving the hub’s stated scope.
- **Which links are too detailed for the hub?** → Move them to lower-level pages.
- **Which links are missing?** → Add missing source-of-truth and high-intent paths.
- **Which links are redundant?** → Remove duplicates or merge link groups.
- **Which links are stale?** → Update, archive, or redirect them.
- **Which links point to non-source-of-truth pages?** → Replace them with source-of-truth, current, replacement, or intentionally historical destinations as appropriate.
- **Which links need explanatory context?** → Add short descriptions before the click.
- **Which links should be grouped?** → Cluster them by intent, lifecycle stage, role, system, or failure mode.
- **Which links should be elevated as “start here”?** → Move them to the top of the hub.
- **Which links should be demoted to “related”?** → Move them out of the primary path.
- **Which links should be removed because they create noise?** → Delete them or move them to reference indexes.
- **Which links need risk, permission, version, or environment cues?** → Add those cues before the reader commits to the destination.

## Hub content questions

- **Should the hub contain a short overview?** → Add only enough overview to orient decisions.
- **Should it include a map of the domain?** → Add a diagram or conceptual map when relationships matter.
- **Should it include common tasks?** → Add task links grouped by user intent.
- **Should it include common failure modes?** → Add troubleshooting entry points.
- **Should it include key concepts?** → Add concept links for prerequisite understanding.
- **Should it include key reference pages?** → Add reference links for exact lookup.
- **Should it include decision records?** → Link to decisions when rationale affects use.
- **Should it include ownership/contact information?** → Add owner and escalation metadata where useful.
- **Should it include maturity/status indicators?** → Label beta, deprecated, legacy, experimental, or stable areas.
- **Should it include “new here?” guidance?** → Add an onboarding path.
- **Should it include “under incident pressure?” guidance?** → Add an emergency path.
- **Should it include source-of-truth indicators?** → Point to the pages that own the facts instead of turning the hub into the source of truth.

## Anti-duplication questions

- **Is the hub restating content that belongs in source-of-truth articles?** → Replace detail with summaries and links.
- **Is the hub likely to go stale because it duplicates details?** → Move volatile facts to source-of-truth pages or generated references.
- **Can details be replaced with links?** → Link out and preserve hub focus.
- **Can summaries be made deliberately short?** → Condense to orientation-level descriptions.
- **Are there excerpts that need transclusion or generated inclusion?** → Use reusable snippets or generated indexes where governance supports them.
- **Is the hub authoritative about navigation but not about the underlying technical facts?** → Define hub authority as routing, orientation, and scope rather than source-of-truth detail.
- **Does the hub duplicate status, ownership, or version data already stored in metadata?** → Generate those fields or link to authoritative metadata rather than copying them manually, while showing provenance and freshness where the values affect trust or safety.

---

# 4. Provide multiple paths to the same topic

A documentation corpus rarely has one natural hierarchy. A matrix, hub family, search result page, glossary, or tag filter is a projection over a richer faceted model. The goal is not to create every possible path; it is to create enough high-scent paths for the ways readers actually seek information.

## Facet questions

- **What are the major ways users think about this corpus?** → Turn those perspectives into facets or hub families.
- **By product area?** → Create product-area paths where product names drive discovery.
- **By system component?** → Create component paths for technical users.
- **By user role?** → Create role paths when permissions or goals differ.
- **By task?** → Create task paths for action-oriented users.
- **By lifecycle stage?** → Create lifecycle paths for setup, operation, migration, and retirement.
- **By environment?** → Add environment metadata and filters.
- **By customer type?** → Add customer applicability labels if behavior differs.
- **By failure mode?** → Create symptom-led troubleshooting paths.
- **By release version?** → Add version facets and deprecation markers.
- **By API surface?** → Create API-centered reference and task paths.
- **By operational responsibility?** → Add ownership and escalation facets.
- **By compliance domain?** → Create audit, security, privacy, or risk views.
- **By data object?** → Create entity-centered concept and reference paths.
- **By business process?** → Create workflow hubs matching business language.
- **By source system or repository?** → Add code, schema, dashboard, or service links when technical users start there.

## Hierarchy questions

- **What is the primary hierarchy?** → Choose one default navigation backbone.
- **Is there more than one legitimate hierarchy?** → Use facets, hubs, filters, and cross-links for alternatives.
- **Which hierarchy reflects the system’s architecture?** → Use it for architecture and component views.
- **Which hierarchy reflects user workflows?** → Use it for task and onboarding views.
- **Which hierarchy reflects operational ownership?** → Use it for escalation and maintenance views.
- **Which hierarchy reflects learning order?** → Use it for guided learning paths.
- **Which hierarchy reflects troubleshooting paths?** → Use it for symptom and incident navigation.
- **Which hierarchy should be visible in the main navigation?** → Promote the hierarchy that best balances common intent, business value, risk, onboarding needs, and operational urgency.
- **Which should be represented as hubs, filters, tags, or related links instead?** → Demote secondary hierarchies into alternate projections.
- **Which hierarchy is only meaningful to maintainers?** → Keep it backstage unless readers use it to find information.

## Cross-linking questions

- **Which pages should link to this page?** → Add inbound links from all likely entry contexts.
- **Which pages should this page link to?** → Add outbound links for prerequisites, next steps, reference, and recovery.
- **Which links are prerequisite links?** → Put them before instructions or explanations.
- **Which links are next-step links?** → Put them after the main answer or procedure.
- **Which links are related-concept links?** → Put them in “related concepts” sections.
- **Which links are troubleshooting links?** → Put them near failure points and symptoms.
- **Which links are reference links?** → Put them near exact values, commands, schemas, or policy requirements.
- **Which links are decision-history links?** → Put them near rationale or tradeoff claims.
- **Which links are “do not confuse with” links?** → Put them in disambiguation notes.
- **Which links are missing because authors assumed readers already knew the connection?** → Add explicit bridge links.
- **Which links should use stable IDs rather than volatile titles?** → Use durable identifiers when links are generated, cited externally, or consumed by AI retrieval systems.

## Entry-point questions

- **How might a novice try to find this page?** → Add beginner labels and onboarding links.
- **How might an expert try to find this page?** → Add direct technical names and reference paths.
- **How might an operator try to find this page during an incident?** → Add symptom, alert, and runbook links.
- **How might a developer try to find it from code?** → Add API, module, class, function, repository, schema, and config aliases.
- **How might a support person try to find it from a customer issue?** → Add customer-facing terms and issue labels.
- **How might a product person try to find it from a feature name?** → Add product and feature synonyms.
- **How might a security or compliance reviewer try to find it?** → Add control, policy, risk, evidence, and audit metadata.
- **How might someone search for it using the wrong term?** → Add redirects, synonyms, and glossary entries.
- **How might someone arrive from a ticket, alert, dashboard, or error message?** → Link those artifacts back to source-of-truth docs.
- **How might an AI retrieval system retrieve it without nearby navigation context?** → Add clear headings, scoped aliases, explicit scope, source-of-truth links, and enough local context in each chunk; ensure the retrieval pipeline preserves headings, permissions, metadata, and relationship fields.

## Matrix-view questions

- **What should the rows represent?** → Use the facet that best helps the target users compare choices in this view; prefer stable dimensions only when they also improve comprehension and findability.
- **What should the columns represent?** → Use a complementary, user-meaningful facet; do not assume the column dimension must always be user intent.
- **Are rows domains, components, workflows, roles, or lifecycle stages?** → Choose the row facet from observed browsing behavior, task evidence, and corpus structure; allow alternate projections when more than one facet is legitimate.
- **Are columns intents, documentation modes, topic types, maturity levels, or operational states?** → Choose columns that help users decide where to click; collapse or replace columns that create artificial distinctions.
- **Does each cell link to a source-of-truth article, a hub, or both?** → Link to hubs for orientation and source-of-truth pages for facts, and make empty or ambiguous cells explicit rather than implying coverage.
- **Are empty cells meaningful?** → Label them as missing, not applicable, intentionally absent, or not yet classified.
- **Do empty cells indicate missing documentation?** → Turn them into backlog items.
- **Do empty cells indicate that the combination does not apply?** → Mark them explicitly as not applicable.
- **Does the matrix create too many artificial categories?** → Collapse categories that do not match real user paths.
- **Does the matrix expose duplicate or competing pages?** → Resolve duplicates into source-of-truth topics.
- **Does the matrix help users choose, or does it overwhelm them?** → Simplify until the next click is obvious.
- **Can the matrix be generated from metadata?** → Generate it from controlled, validated fields where possible, with provenance, exception handling, and review so metadata drift does not create misleading cells.

## Orphan and dead-end questions

- **Which pages have no inbound links?** → Link, redirect, archive, or delete them.
- **Which pages have no useful outbound links?** → Add next-step, prerequisite, and related links.
- **Which pages are only discoverable by search?** → Add them to relevant hubs or matrix cells if they are important.
- **Which important pages are buried too deep?** → Promote them to hubs, shortcuts, or top search results.
- **Which pages are linked from too many irrelevant places?** → Remove noisy links and preserve contextual links.
- **Which hubs link to stale pages?** → Update hub destinations and archive stale targets.
- **Which pages should redirect to source-of-truth or replacement pages?** → Redirect duplicate, renamed, merged, or superseded pages to the source-of-truth or replacement page; use SEO canonicalization only when duplicate URLs must coexist.
- **Which pages are dead ends after the user completes a task?** → Add verification, next steps, and related operations.
- **Which pages need “next step” or “related” links?** → Add links matching likely follow-up intent.
- **Which pages are dead ends for AI retrieval because they lack context or source-of-truth links?** → Add summaries, stable identifiers, explicit relationships, and source-of-truth links in forms the retrieval system actually indexes.

---

# 5. Use controlled vocabulary and structured metadata

Controlled vocabulary and metadata serve different audiences. Some fields help readers choose the right page; some help search and filtering; some help maintainers govern ownership, freshness, and lifecycle; some help AI retrieval systems preserve scope and context. Do not expose every metadata field as a navigation facet. Prefer controlled values for navigation-critical metadata and backstage fields for maintenance-only data.

## Vocabulary questions

- **What are the preferred terms?** → Use them consistently in titles, headings, metadata, and links, and maintain them through vocabulary governance.
- **What are the common synonyms?** → Map them to preferred terms for retrieval; use redirects only when the synonym is equivalent within the relevant scope.
- **What are the acronyms?** → Define them, expand them at first use where needed, and attach them as scoped alternate labels rather than automatically making them preferred terms.
- **What are the deprecated names?** → Mark them as historical or deprecated, record the replacement term and date, and redirect only when the old term has a clear current equivalent.
- **What are the informal names people actually use?** → Add them as searchable aliases after validating meaning, scope, and safety.
- **What are the product names?** → Use them as product facets and entry paths.
- **What are the internal code names?** → Map them to public or preferred names only where the equivalence is valid and safe to expose; otherwise keep them as scoped internal aliases.
- **What are the customer-facing names?** → Include or map them where external users search or browse, and explain distinctions when the customer-facing term is not equivalent to the internal preferred term.
- **What terms are overloaded?** → Disambiguate them with qualifiers and glossary entries.
- **What terms mean different things in different contexts?** → Scope each meaning by domain or component.
- **What terms are commonly confused?** → Add comparison notes and “not the same as” links.
- **What terms changed over time?** → Record old/new names and migration dates.
- **Which terms should never be used?** → Add linting rules or editorial guidance.
- **Which terms should redirect to preferred terms?** → Redirect exact equivalents, renamed terms, and deprecated terms with clear replacements; use synonym rings or disambiguation for broader, ambiguous, or near-equivalent terms.
- **Does the vocabulary need multilingual support or mapping to external vocabularies?** → Use vocabulary-mapping practices and standards suitable for multilingual or interoperable thesauri.

## Entity questions

- **What are the core entities in the domain?** → Make them first-class glossary and metadata objects.
- **What systems exist?** → Create system pages and system metadata values.
- **What components exist?** → Create component facets and architecture links.
- **What services exist?** → Create service pages with owners and dependencies.
- **What data objects exist?** → Create entity reference pages and schema links.
- **What actors exist?** → Create role and permission vocabulary.
- **What workflows exist?** → Create workflow hubs and task chains.
- **What states exist?** → Create state reference tables and lifecycle diagrams.
- **What events exist?** → Create event reference pages and troubleshooting links.
- **What APIs exist?** → Create API reference and usage paths.
- **What permissions exist?** → Create permission reference and role-based task gating.
- **What environments exist?** → Add environment metadata and warnings.
- **What customers, tenants, or deployment types exist?** → Add applicability metadata where behavior differs.
- **What error codes, alerts, logs, or metrics exist?** → Link observability signals to troubleshooting pages.
- **What external controls, policies, or contracts refer to these entities?** → Map internal entities to compliance, audit, or customer-facing vocabulary.

## Metadata-field questions

- **Article type or topic type?** → Use it to drive templates, quality checks, and search filters where readers benefit.
- **Documentation mode?** → Use it to distinguish learning, doing, lookup, and explanation needs.
- **Page genre?** → Use it to distinguish hubs, runbooks, ADRs, policies, checklists, migration guides, and changelogs.
- **Domain?** → Use it for domain hubs and ownership.
- **Component?** → Use it for architecture paths and component-specific search.
- **Product?** → Use it for product hubs and product-facing navigation.
- **Feature?** → Use it for feature discovery and release impact.
- **Role?** → Use it for role-based routing and permissions.
- **Audience?** → Use it to target language, assumptions, and visibility.
- **Lifecycle stage?** → Use it for onboarding, operation, migration, and retirement paths.
- **Environment?** → Use it to prevent wrong-environment actions.
- **Version?** → Use it to distinguish current, legacy, deprecated, and future behavior.
- **Status?** → Use it to mark draft, stable, deprecated, obsolete, experimental, or archived content.
- **Owner?** → Use it for accountability and review routing; show it publicly only when useful and safe.
- **Review date?** → Use it to trigger freshness checks; surface it where freshness affects trust or safety.
- **Last verified date?** → Use it to signal trust and operational safety where readers need confidence.
- **Source of truth?** → Use it to suppress duplicates and resolve conflicts.
- **Related systems?** → Use it to generate dependency and cross-system links.
- **Related APIs?** → Use it to connect tasks, concepts, and reference.
- **Related error codes?** → Use it to connect symptoms to troubleshooting.
- **Related metrics?** → Use it to connect observability to runbooks.
- **Related runbooks?** → Use it to connect concepts and failures to operations.
- **Sensitivity or access level?** → Use it to control visibility and warnings; do not expose sensitive metadata casually.
- **Maturity level?** → Use it to signal experimental, stable, legacy, or unsupported behavior.
- **Deprecation status?** → Use it to route users to replacements.
- **Replacement page?** → Use it for redirects and migration paths.
- **Applicable customers or configurations?** → Use it to prevent overgeneralized guidance.
- **Stable identifier, stable permalink, or durable ID?** → Use it for durable linking, generated indexes, external references, and AI retrieval; keep it distinct from SEO canonical URL signals.

## Metadata-governance questions

- **Who defines valid metadata values?** → Assign taxonomy ownership.
- **Who can create a new tag?** → Limit tag creation to prevent vocabulary drift.
- **Who can rename a preferred term?** → Require controlled approval and redirects.
- **Who maintains synonyms?** → Assign vocabulary maintenance responsibility.
- **Who approves deprecations?** → Route deprecations through owners and stakeholders.
- **How are old names redirected?** → Create alias, redirect, and migration rules based on equivalence, replacement status, scope, and date.
- **How is vocabulary enforced?** → Use templates, validation, linting, or review.
- **Are tags free-form or controlled?** → Prefer controlled tags for navigation-critical metadata.
- **Are some fields required?** → Require fields needed for findability, governance, safety, or lifecycle management.
- **Are some fields generated automatically?** → Generate metadata from authoritative systems where possible, but validate values, record source and generation time, and define override rules.
- **Are metadata values validated?** → Validate values against controlled vocabularies.
- **Are owners alerted when required metadata is missing?** → Add governance reports or notifications.
- **How are stale pages detected?** → Use review dates, analytics, release changes, incidents, and owner checks.
- **How are deprecated terms found and replaced?** → Use search, redirects, synonym maps, linting, and terminology audits while distinguishing preferred terms, nonpreferred terms, deprecated terms, and scoped aliases.
- **How are multilingual or cross-vocabulary mappings governed?** → Assign authority for equivalence, near-equivalence, broader/narrower mappings, and translation scope.

## Retrieval questions

- **Which metadata fields should power search filters?** → Expose fields users actually use to narrow intent.
- **Which metadata fields should power hub pages?** → Generate hub membership from controlled, validated, user-meaningful classification fields with provenance.
- **Which metadata fields should power matrix views?** → Use controlled, validated metadata facets that users understand and maintainers can keep accurate.
- **Which metadata fields should power ownership reports?** → Use owner, domain, status, and review fields.
- **Which metadata fields should power freshness reports?** → Use review date, last verified date, version, and release impact.
- **Which metadata fields should appear visibly on the page?** → Show fields that affect user trust, applicability, safety, or next action.
- **Which metadata fields should remain backstage?** → Hide fields useful only for maintenance, security, or internal governance.
- **Which fields help readers?** → Surface them in headers, filters, search results, and hub summaries.
- **Which fields only help maintainers?** → Keep them in admin views and reports.
- **Which metadata would make the corpus easier for AI agents to retrieve from accurately?** → Add stable identifiers, scoped aliases, scope, type, applicability, owner, freshness, and relationship fields when the retrieval pipeline stores and uses them for filtering, ranking, grounding, or citation.
- **Which non-metadata structures improve AI retrieval?** → Use clear headings, self-contained chunks, explicit scope statements, source-of-truth links, duplicate suppression, and freshness signals, and configure chunking/indexing so those signals are retained.
- **Which fields should not be available to AI retrieval or public search?** → Exclude, redact, or permission-gate sensitive, internal-only, or misleading maintenance metadata, and verify the retrieval system enforces those controls at query time.

---

# 6. Maximize information scent at every click

Information scent is the set of cues that helps a reader predict what lies behind a link, heading, search result, hub section, or matrix cell. Strong scent reduces wasted clicks, backtracking, pogo-sticking, and abandonment. Weak scent makes even accurate content hard to find.

## Title questions

- **Does the title clearly describe the page?** → Rename it until its promise is obvious.
- **Does the title use the preferred term?** → Use preferred terminology in the title where it improves clarity, while preserving aliases for search and routing.
- **Does the title distinguish concept, task, reference, or troubleshooting intent?** → Add action or topic-type cues.
- **Does the title match what users search for?** → Include common search language in titles, subtitles, aliases, or metadata.
- **Does the title avoid internal shorthand?** → Replace shorthand with recognizable terms.
- **Does the title avoid ambiguous nouns?** → Add qualifiers that disambiguate scope.
- **Does the title include the object and action where appropriate?** → Use verb-object titles for tasks.
- **Would the title make sense out of context?** → Rewrite it for search-result and link-list visibility.
- **Would the title make sense in search results?** → Add enough specificity for result scanning.
- **Would the title make sense as a link on another page?** → Make it self-describing as link text.
- **Does the title hide version, environment, or status differences?** → Add qualifiers where choosing the wrong page would matter.

## Link-label questions

- **Does the link text predict the destination?** → Rewrite it to name the destination’s value.
- **Is the link text specific enough?** → Add object, action, or scope.
- **Does the link text include the user’s likely goal?** → Phrase it around the user’s intended outcome.
- **Does the link text avoid “click here,” “more,” “details,” or “advanced”?** → Replace vague labels with descriptive labels.
- **Does the link label distinguish similar destinations?** → Add qualifiers that separate near-neighbor pages.
- **Does the link label match the title of the destination page?** → Align link labels and page titles unless context requires variation.
- **Does the surrounding sentence explain why the reader should click?** → Add enough context to raise information scent.
- **Are related links grouped under meaningful headings?** → Group links by intent, decision, lifecycle stage, or role.
- **Are high-value links visually or structurally emphasized?** → Promote them in placement and hierarchy.
- **Are low-value links creating noise?** → Remove or demote them.
- **Does the link context disclose risk, permissions, or applicability?** → Add warnings or scope cues before the click when needed.

## Summary and preview questions

- **Does each page start with a useful one-sentence summary?** → Add a summary that states scope and value.
- **Does each hub explain its scope immediately?** → Put scope in the first paragraph.
- **Does each search result preview show enough context?** → Improve summaries and metadata used in previews.
- **Does each matrix cell give enough information before the click?** → Add concise labels or descriptions.
- **Does each link group explain its purpose?** → Add heading text that frames the choice.
- **Does each article say who it is for?** → Add audience or role cues where audience affects interpretation.
- **Does each article say when to use it?** → Add “use this when” guidance.
- **Does each article say what it does not cover?** → Add exclusions and alternate links.
- **Does each article distinguish current from legacy information?** → Add status and version labels.
- **Does each article distinguish normal from exceptional cases?** → Split routine guidance from exceptions.
- **Does each article support direct arrivals?** → Include enough context for readers who bypassed the intended hierarchy.

## Heading questions

- **Do headings support scanning?** → Rewrite headings as informative signposts.
- **Do headings match user questions?** → Use question- or task-shaped headings where useful.
- **Are headings action-oriented where appropriate?** → Use verbs for procedural sections.
- **Are headings consistent across topic types or page genres?** → Standardize templates by mode and genre.
- **Do headings expose the structure of the answer?** → Make the outline reveal the page logic.
- **Are important answers buried under vague headings?** → Promote answers or rename sections.
- **Are sections too long?** → Split them into scannable subsections.
- **Are there enough signposts for readers who skim?** → Add headings, callouts, summaries, and examples.
- **Could a reader use only the table of contents to predict whether the page is relevant?** → Rewrite headings until the ToC carries meaning.
- **Could an AI retrieval chunk retain useful context from the heading path?** → Use specific headings that preserve scope when extracted.

## Disambiguation questions

- **What pages are easy to confuse?** → Add comparison notes and cross-links.
- **What concepts are easy to confuse?** → Create glossary entries and “not X” sections.
- **What names are overloaded?** → Qualify names by domain, system, product, or context.
- **What tasks sound similar but differ in risk?** → Add warnings and decision guidance.
- **What reference pages have similar titles?** → Rename or namespace them.
- **Where do you need “not the same as” notes?** → Add them near confusing terms and links.
- **Where do you need comparison tables?** → Use tables when alternatives share many attributes.
- **Where do you need redirects?** → Redirect from old, renamed, or informal terms only when the destination is the correct replacement; route wrong or ambiguous terms through disambiguation.
- **Where do you need glossary definitions?** → Define terms at first use and in the glossary.
- **Where do you need warning labels?** → Place warnings before risky choices or commands.
- **Where do aliases need scope?** → Map synonyms, acronyms, and informal names only within the domain where the equivalence is valid.

## Cost-of-click questions

- **How many clicks does it take to reach high-value content?** → Shorten paths to common, valuable, critical, or high-risk pages.
- **Are users forced through generic pages before reaching useful pages?** → Bypass generic hubs with direct links.
- **Are there unnecessary intermediate hubs?** → Collapse or remove low-value navigation layers.
- **Are there too many links competing for attention?** → Prune and group links around intent.
- **Are the most common paths shortest?** → Reorder navigation around frequency and value.
- **Are emergency paths especially short?** → Create direct incident shortcuts.
- **Are reference facts quickly accessible?** → Put exact facts in scannable reference pages.
- **Are task prerequisites visible before the user commits?** → Show prerequisites before step one and before risky links.
- **Are risky actions clearly marked before the user clicks through?** → Put risk cues in link context and page openings.
- **Are low-frequency but high-consequence paths too hidden?** → Promote safety, compliance, and incident-critical links even if they are not common.

---

# 7. Design for nonlinear information seeking

Readers rarely move through documentation in the order authors intend. They search, skim, collect partial answers, reformulate their question, follow related links, backtrack, compare conflicting pages, arrive from external systems, and ask another person or AI agent to retrieve information for them. The corpus should support these nonlinear journeys without abandoning source-of-truth structure.

## Journey questions

- **What are the common information-seeking journeys?** → Model them as paths through hubs, topics, search, cross-links, and external entry points.
- **What does a beginner journey look like?** → Create progressive learning and onboarding paths.
- **What does an expert journey look like?** → Create shortcuts to reference and runbooks.
- **What does a debugging journey look like?** → Create symptom-to-cause-to-fix chains.
- **What does an incident journey look like?** → Create fast recovery paths with escalation.
- **What does an onboarding journey look like?** → Sequence concepts, tasks, and practice checkpoints.
- **What does a design-decision journey look like?** → Link current state to alternatives and rationale.
- **What does a compliance-review journey look like?** → Create evidence trails and policy mappings.
- **What does a migration journey look like?** → Create before/after states, steps, risks, dependencies, and rollback paths.
- **What does a customer-support journey look like?** → Link customer language to internal source-of-truth topics.
- **What does a direct-arrival journey look like?** → Ensure each page explains context, scope, and next steps without assuming prior reading.

## Berrypicking questions

- **What partial answers might users collect along the way?** → Add summaries, snippets, examples, and related links to support accumulation.
- **Where are users likely to change their question after learning more?** → Provide reformulation cues and next links.
- **What pages should help users reformulate their search?** → Add glossary, comparison, and “you may mean” pages.
- **What clues tell users they are in the right neighborhood?** → Add scope, examples, familiar terminology, and related signals.
- **What clues tell users they are in the wrong place?** → Add exclusions and alternate destinations.
- **What related questions naturally arise from each page?** → Add follow-up links.
- **What should the page suggest next?** → Add next-step links based on likely intent.
- **What should the page suggest instead?** → Add alternative paths for adjacent intents.
- **What alternate paths should exist for users who started with the wrong term?** → Add scoped aliases, disambiguation pages, synonym mappings, and redirects where equivalence is confirmed.
- **What snippets should be meaningful when extracted by search or AI?** → Make summaries and headings context-rich enough to stand alone, and ensure extraction/indexing includes relevant title, scope, and source-of-truth context.

## Recovery questions

- **Where do users commonly get lost?** → Add clearer labels, local navigation, breadcrumbs, and recovery links.
- **Where do users reach dead ends?** → Add related, next-step, and back-to-hub links.
- **Where do users need a “back to overview” link?** → Add overview links on deep or complex pages.
- **Where do users need “related tasks”?** → Add task links after concepts and references.
- **Where do users need “common problems”?** → Add troubleshooting links near risky tasks.
- **Where do users need “underlying concepts”?** → Add prerequisite concept links before instructions.
- **Where do users need “reference details”?** → Add reference links near exact values.
- **Where do users need “decision history”?** → Add ADR links near design rationale.
- **Where do users need escalation guidance?** → Add escalation thresholds and owners.
- **Where do users need “you may be looking for…” disambiguation?** → Add it where search, support, or analytics show wrong turns.
- **Where do users need to recover from obsolete terms?** → Add redirects, banners, replacement links, and old/new terminology notes.

## Search-behavior questions

- **What exact terms do users search?** → Add validated terms to titles, subtitles, aliases, metadata, or search tuning as appropriate; avoid putting nonpreferred or ambiguous terms into titles just because they appear in logs.
- **What incorrect terms do users search?** → Investigate the intended meaning, then add disambiguation, scoped aliases, query suggestions, or redirects only when the incorrect term reliably maps to one destination.
- **What acronyms do users search?** → Define and alias acronyms.
- **What error messages do users paste into search?** → Link error text to troubleshooting pages.
- **What log lines do users search?** → Index log phrases and map them to runbooks.
- **What dashboard labels do users search?** → Use dashboard labels as aliases.
- **What customer-facing terms do users search?** → Map them to internal preferred terms only where the equivalence is valid; otherwise explain the distinction or route through disambiguation.
- **What old product names do users search?** → Redirect to the current name only when the product was renamed or superseded; otherwise add historical notes or disambiguation.
- **Which searches produce no results?** → Investigate whether content, synonyms, redirects, or search ranking need improvement.
- **Which searches produce too many results?** → Improve metadata, titles, summaries, ranking, and filters.
- **Which searches produce misleading results?** → Retitle, demote, redirect, archive, or improve summaries after confirming the mismatch.
- **Which searches lead users to obsolete pages?** → Add deprecation banners and replacement redirects.
- **Which searches reveal ambiguous intent?** → Add disambiguation pages or result-grouping logic.

## Cross-reference questions

- **Does each concept link to related tasks?** → Add task paths from explanation to action.
- **Does each task link to prerequisite concepts?** → Add concept links before the procedure.
- **Does each task link to relevant reference pages?** → Add reference links near exact inputs and outputs.
- **Does each reference page link to examples?** → Add example and usage links.
- **Does each troubleshooting page link to normal-operation docs?** → Link fixes back to healthy-state explanations.
- **Does each runbook link to escalation paths?** → Add escalation contacts and criteria.
- **Does each decision record link to the current implementation?** → Link rationale to present-state docs.
- **Does each deprecated page link to the replacement?** → Add replacement links and redirects.
- **Does each page help the reader continue after their immediate question is answered?** → Add next-step and related-intent links.
- **Does each page expose enough relationship context for retrieval systems?** → Add source-of-truth, prerequisite, related, replacement, applicability, and evidence links in page text and, where supported, machine-readable metadata.

## Progressive-disclosure questions

- **What information should appear first?** → Put the highest-intent answer at the top.
- **What information should be hidden until needed?** → Move detail into expandable sections or linked references where the platform supports it.
- **What information should be linked rather than embedded?** → Link stable source-of-truth topics instead of duplicating, especially when ownership or freshness differs.
- **What details overwhelm beginners?** → Move them below the basic path.
- **What details frustrate experts when buried?** → Promote them into reference sections or quick links.
- **Which pages need beginner and expert paths?** → Add dual paths or role-based sections.
- **Which pages need “quick fix” and “deep explanation” sections?** → Separate immediate action from conceptual depth.
- **Which pages need summaries before full details?** → Add executive summaries or quick answers.
- **Which pages need diagrams before prose?** → Lead with visual structure where relationships matter.
- **Which pages need examples before formal reference?** → Put representative examples before exhaustive tables.
- **Which details should remain visible because they affect safety or correctness?** → Keep warnings, prerequisites, and applicability constraints visible before action.

---

# 8. Validate and iterate using observed behavior

Validation evidence should be treated as diagnostic, not magical. Card sorting suggests possible groupings; tree testing evaluates proposed structures in an isolated hierarchy; first-click data is a strong signal but not a universal guarantee; search logs reveal user language and likely gaps but do not fully prove intent; analytics show behavior but require task context. Use multiple signals together and revise the IA when they converge.

## Baseline audit questions

- **How many pages exist?** → Establish corpus size and cleanup scope.
- **How many are stale?** → Prioritize review, archival, or replacement.
- **How many have no owner?** → Assign ownership or mark for removal.
- **How many have no inbound links?** → Link, redirect, archive, or delete them.
- **How many have no outbound links?** → Add recovery, prerequisite, and next-step links.
- **How many duplicate another page?** → Merge into source-of-truth pages.
- **How many contradict another page?** → Resolve conflict and mark the source of truth.
- **How many are obsolete?** → Archive, redirect, or label as historical.
- **How many lack topic-type, documentation-mode, or page-genre classification?** → Classify them and apply appropriate templates.
- **How many lack required metadata?** → Add required metadata before reorganizing.
- **How many are frequently visited?** → Protect, improve, and elevate them.
- **How many are never visited?** → Reassess, link, archive, or delete them based on value and risk.
- **How many are highly searched but rarely clicked?** → Improve titles, summaries, ranking, aliases, or result grouping.
- **How many are clicked but quickly abandoned?** → Investigate relevance, opening summary, routing, and whether the quick exit actually indicates success.
- **How many are linked from tickets, alerts, dashboards, code, or external systems?** → Protect their stability, redirects, and source-of-truth status.

## Card-sorting questions

- **How do users naturally group the topics?** → Use their groupings as candidates for navigation, facets, and labels.
- **Do novices group topics differently from experts?** → Create separate beginner and expert paths where the difference matters.
- **Do operators group topics differently from developers?** → Create role-specific hubs or filters.
- **Do support people group topics differently from product people?** → Add support and product-facing navigation projections.
- **Which labels do users invent?** → Add them as aliases or candidate preferred labels.
- **Which groupings are stable across participants?** → Consider them as candidates for primary navigation, then test them against representative tasks, content constraints, and governance requirements.
- **Which topics are consistently hard to place?** → Clarify, split, rename, or cross-list them.
- **Which topics belong in multiple groups?** → Represent them with facets and multiple inbound links.
- **Which existing categories do users ignore?** → Remove, demote, rename, or hide those categories.
- **Which internal categories do users not understand?** → Rename or hide them behind user-facing labels.
- **Which groupings conflict with governance, ownership, or security boundaries?** → Use alternate projections or backstage metadata rather than forcing the user-facing IA to mirror internal constraints.

## Tree-testing questions

- **Can users find the right article from the proposed structure?** → Treat successful tree-test results as evidence for the proposed hierarchy, then confirm with realistic page context, search behavior, and task observation.
- **Where do they click first?** → Use first-click data to improve labels and placement.
- **Where do they backtrack?** → Fix misleading categories or missing scent.
- **Which labels mislead them?** → Rename labels to match destination expectations.
- **Which branches are too broad?** → Split them into clearer subgroups.
- **Which branches are too narrow?** → Merge or simplify them.
- **Which branches contain unexpected content?** → Move content to expected locations or cross-list it through facets.
- **Which tasks fail because the structure is wrong?** → Redesign the hierarchy or facet model.
- **Which tasks fail because labels are wrong?** → Rewrite labels and summaries.
- **Which tasks fail because the target page is missing?** → Create the missing source-of-truth page.
- **Which tasks succeed only after backtracking?** → Improve the first-choice path even if eventual success is acceptable.

## First-click questions

- **For each common task, what is the expected first click?** → Define the intended path for testing.
- **What percentage of users choose it?** → Use the percentage as a findability signal, not as a complete measure of success or a universal threshold.
- **What wrong first clicks are most common?** → Identify misleading labels, categories, or competing paths.
- **Are wrong first clicks caused by bad labels?** → Rewrite labels for stronger scent.
- **Are wrong first clicks caused by bad grouping?** → Move items to expected groups.
- **Are wrong first clicks caused by missing synonyms?** → Add aliases and redirects.
- **Are wrong first clicks caused by ambiguous hub pages?** → Rewrite hub orientation and link groups.
- **Which first-click failures strongly predict task failure?** → Prioritize paths where wrong first clicks correlate with failed tasks, low confidence, long completion time, repeated backtracking, or unsafe outcomes.
- **Which first-click failures are recoverable?** → Add recovery links and disambiguation.
- **Which correct first clicks still lead to failure?** → Inspect destination content, page opening, task instructions, and follow-on links.
- **Which incorrect first clicks still lead to success?** → Decide whether the alternate path should be legitimized as another valid route.

## Search-log questions

- **What are the top searches?** → Treat top searches as diagnostic signals; optimize result sets after confirming the likely intent and source-of-truth destination.
- **What are the top failed searches?** → Investigate whether to create missing content, synonyms, redirects, or better ranking.
- **What are the top reformulated searches?** → Investigate why users reformulate, then add query suggestions, vocabulary mapping, scoped aliases, or clearer result previews.
- **What are the top searches that lead to immediate exits?** → Determine whether the page answered the question quickly or caused abandonment.
- **What are the top searches that produce obsolete pages?** → Add deprecation banners and replacement links; redirect only when the obsolete page has a clear current replacement.
- **What are the top searches using nonpreferred terms?** → Add those terms as scoped aliases or synonym mappings after confirming their intended meaning and equivalence.
- **What are the top searches using customer language?** → Map customer terms to internal docs where the equivalence is valid.
- **What searches reveal missing pages?** → Add candidate pages to the documentation backlog.
- **What searches reveal bad synonyms?** → Fix synonym rings, redirects, scoped aliases, or disambiguation rules after validating the mismatch.
- **What searches reveal bad titles?** → Rename pages only after confirming the search language reflects intended meaning; otherwise add aliases, summaries, or disambiguation.
- **What searches reveal duplicate topics?** → Merge duplicate topics into source-of-truth pages or route competing pages through replacement links and redirects.
- **What search patterns conflict with support, analytics, or user interviews?** → Treat the pattern as a hypothesis and validate it with additional evidence.

## Analytics questions

- **Which pages are most visited?** → Treat them as critical paths and maintain them tightly.
- **Which pages have high exits?** → Determine whether they successfully satisfy terminal intent or cause abandonment.
- **Which pages have long dwell time?** → Determine whether they are useful, complex, or confusingly dense.
- **Which pages have very short dwell time?** → Check for quick-answer success, mismatch, weak scent, or immediate abandonment using task context.
- **Which hubs generate successful onward clicks?** → Preserve their structure as reusable patterns.
- **Which hubs produce pogo-sticking?** → Improve labels, grouping, summaries, and disambiguation.
- **Which pages are found mostly through search?** → Add navigation links if they are important.
- **Which pages are found mostly through links?** → Ensure inbound contexts are accurate.
- **Which pages are found mostly through external references?** → Protect source-of-truth status, stable permalinks, durable IDs, and redirects.
- **Which pages are used during incidents?** → Harden them as runbooks with verification.
- **Which pages are used during onboarding?** → Improve sequencing and prerequisite links.
- **Which pages spike after releases?** → Link them from changelogs and release notes.
- **Which pages spike after failures?** → Link them from incident hubs and alerts.
- **Which analytics signals require qualitative review?** → Combine metrics with task analysis, support evidence, and user observation before restructuring.

## Support and operations questions

- **What questions are repeatedly asked in Slack, tickets, email, or meetings?** → Convert them into source-of-truth docs or FAQ entries after confirming scope, owner, and reuse value.
- **Which wiki pages do people paste in response?** → Promote and maintain those pages as support assets.
- **Which wiki pages should exist but do not?** → Add them to the content backlog.
- **Which pages are known to be distrusted?** → Review, rewrite, or archive them.
- **Which pages cause follow-up questions?** → Add missing context, examples, troubleshooting, or links.
- **Which pages reduce support burden?** → Elevate and use them as templates.
- **Which pages are ignored because people do not know they exist?** → Improve linking, titles, search ranking, and hub placement.
- **Which pages are ignored because they are too hard to use?** → Rewrite for intent, scent, and topic structure.
- **Which incidents revealed documentation gaps?** → Create post-incident documentation tasks.
- **Which postmortems include documentation action items?** → Track them to completion in the wiki backlog.
- **Which support answers conflict with source-of-truth pages?** → Resolve the contradiction against the source-of-truth page, then update the page, the support answer, or both.
- **Which support phrases reveal the language people actually use?** → Add candidate aliases, glossary entries, and search terms after validating meaning and scope.

## Governance questions

- **Who owns each page?** → Assign accountability for accuracy and updates.
- **Who owns each hub?** → Assign accountability for routing and link quality.
- **Who owns the taxonomy?** → Assign authority over terms, facets, and metadata.
- **Who owns the metadata model?** → Assign authority over required fields and values.
- **Who can approve structural changes?** → Define review rights for navigation changes.
- **How often are pages reviewed?** → Set review cadence by risk, volatility, and usage.
- **What triggers review?** → Trigger review from releases, incidents, ownership changes, stale dates, or high-risk changes.
- **What triggers archival?** → Archive pages when superseded, obsolete, unused, or misleading.
- **What triggers redirect creation?** → Create redirects after renames, merges, deleted pages, and deprecated terms when the target is a clear replacement; use disambiguation when it is not.
- **What triggers glossary updates?** → Update glossary when terms emerge, change, or confuse users.
- **What triggers hub updates?** → Update hubs when source-of-truth topics, workflows, ownership, status, redirects, or high-value user paths change.
- **What metrics define findability improvement?** → Track successful search, first-click quality, task success, reduced backtracking, reduced pogo-sticking, and reduced support asks as a portfolio of signals.
- **What metrics define documentation health?** → Track ownership, freshness, duplication, orphan rate, metadata completeness, contradiction rate, source-of-truth coverage, and provenance for generated or imported data.
- **What is the process for resolving contradictions?** → Use source-of-truth ownership, source hierarchy, date/version applicability, and stakeholder review rules.
- **What is the process for merging duplicates?** → Pick a source-of-truth page, migrate useful content, preserve scoped aliases, and redirect exact replacements while archiving or disambiguating non-equivalent material.
- **What is the process for handling deprecated terminology?** → Maintain preferred terms, deprecated terms, scoped aliases, redirects, warnings, replacement terms, migration dates, and scope notes.
- **What is the process for changing the IA itself?** → Require a documented rationale, expected user impact, migration plan, redirects, and validation criteria.
