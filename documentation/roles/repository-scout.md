# Repository Scout

## Purpose

The Repository Scout identifies, evaluates, and prioritises target repositories
for upstream contribution. This role executes Step 1 (Discovery) of the
migration plan. Nothing moves forward without a qualified target list.

## Responsibilities

### Search

Run the following queries against the GitHub Search API and deduplicate results:

- `claude code hooks language:TypeScript` via repository search.
- `"hooks" path:.claude/settings.json language:JSON` via code search, then
  filter to repositories where the primary language is TypeScript.
- `claude-hooks language:Shell path:.claude` via code search, cross-referenced
  against TypeScript repositories.
- `claude hooks path:hooks language:Python` via code search, cross-referenced
  against TypeScript repositories.

### Evaluate

For each candidate, collect:

- Repository URL, owner, name, star count, last commit date.
- License type.
- Existing hook implementation: list every hook file or inline hook command,
  note the language (Shell, Python, inline command, raw TypeScript), and
  summarise what each hook does.
- Whether the repository has a `CONTRIBUTING.md` or stated contribution policy.
- Whether the repository's issue tracker or PR history shows responsiveness to
  external contributions.

### Disqualify

Remove repositories where:

- The existing hooks already use `@goodfoot/claude-code-hooks`.
- The repository is itself a competing hooks SDK (the hooks are the product,
  not a development tool within a larger project).
- The repository is archived or has had no commits in the last 180 days.
- The repository's license prohibits the kind of changes being proposed.

No minimum star count. Process every repository that qualifies.

### Rank

Order the backlog by the size of the improvement gap: repositories with the
most to gain from the migration (e.g., complex shell scripts that would benefit
most from type safety and structured logging) ranked highest.

## Research Basis

The TODO Group's Salesforce Open Source Technical Evangelist job description
(https://github.com/todogroup/job-descriptions) emphasises "identifying strategic
upstream vendors" and prioritising projects with the largest business impact
before expanding systematically. The Linux Foundation's OSPO guide
(https://ospobook.todogroup.org/01-chapter/) similarly stresses that
organisations cannot contribute to all dependencies and must triage ruthlessly.

Otto's corporate contribution best practices
(https://optimizedbyotto.com/post/best-practices-corporate-open-source-contributions/)
note that starting with minor contributions in well-understood projects builds
reputation before larger proposals are attempted. The Scout's qualification
criteria should reflect this: prefer repositories where the delta between the
current implementation and the replacement is large enough to justify the
dependency addition, and where the maintainer culture is receptive to external
contributions.

GitHub's own guide to open source contribution
(https://opensource.guide/how-to-contribute/) recommends studying a project's
issue tracker, pull request history, and communication style before contributing.
The Scout should document these signals as part of each target brief.

## Agent Implementation Notes

When implemented as a Claude Code agent, the Scout should use the GitHub Search
API (`octokit.rest.search.code` and `octokit.rest.search.repos`) via the
`github:github` skill's `tsx` + `octokit` pattern. The agent should read
repository READMEs and CONTRIBUTING.md files via the GitHub Contents API to
assess maintainer receptiveness.

Supplement API results with `browser:browser` searches for repositories
mentioned in blog posts, awesome-lists, and community discussions that may not
surface through the GitHub Search API alone. The browser is also useful for
researching maintainer context (public blog posts, conference talks, stated
preferences about contributions) that informs the receptiveness assessment.

## Outputs

- `/workspace/reports/targets/[REPO_NAME].md` for each qualified repository
- `/workspace/reports/target-backlog.md` ranked by improvement gap
