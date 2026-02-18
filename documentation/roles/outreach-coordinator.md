# Outreach Coordinator

## Purpose

The Outreach Coordinator manages the post-submission pipeline: creating pull
requests on upstream repositories, engaging with maintainer feedback, and
tracking outcomes. This role is performed by a human, not by the automated
team. It activates after the team has completed Steps 1 through 7 and
produced the deliverables (pushed forks and PR draft documents).

## When This Role Activates

The Outreach Coordinator is not active during the automated team run. The team
produces:

- Forked repositories with feature branches pushed to GitHub.
- PR draft documents at `/workspace/reports/hook-repo-pr-drafts/[REPO_NAME].md`.
- A submission log at `/workspace/reports/submission-log.md`.

The Outreach Coordinator reviews these deliverables and decides which pull
requests to submit, when, and in what order.

## Responsibilities

### Submission Management

- Create pull requests on target repositories using the PR draft documents as
  the body. Use the GitHub UI or `gh pr create`.
- Set an appropriate PR title: concise, descriptive, and framed around the
  improvement (e.g., "Migrate Claude Code hooks to typed SDK with compile-time
  validation"), not around the package name.
- Pace submissions to avoid the appearance of a coordinated campaign. Do not
  submit more than two or three pull requests in a single day. Space submissions
  across days or weeks depending on the size of the target list.

### Community Engagement

- Monitor submitted pull requests for maintainer feedback. Respond to comments
  promptly, professionally, and substantively.
- If a maintainer requests changes, coordinate with the team (or make the
  changes directly) to address the feedback.
- If a pull request is declined, accept the decision gracefully. Do not argue,
  re-submit, or escalate. Document the rejection reason in the target brief for
  future learning.
- Track the status of all submitted pull requests in
  `/workspace/reports/submission-log.md`.

### Pacing and Reputation

- Maintain a cadence that allows response to feedback on existing submissions
  before opening new ones. An unanswered comment on an open PR should take
  priority over submitting the next one.
- If contributions are consistently well-received, the pace can increase. If
  they are consistently declined, pause and reassess the approach.
- Consider engaging with the target community before submitting: starring the
  repository, contributing a small documentation fix, or filing a useful issue
  report. This builds context and credibility.

## Research Basis

The Developer Relations outreach model described by developerrelations.com
(https://developerrelations.com/talks/strategy-for-developer-outreach/) defines
four pillars: outreach, community, developer experience, and support. The
Outreach Coordinator operates primarily in the first two pillars, ensuring that
contributions serve as a genuine entry point into the target community rather
than a one-shot promotional action.

GitHub's guide on growing contributors
(https://docs.oscollective.org/guides/growing-your-contributors) emphasises
that "personally inviting individual users or potential contributors to
contribute" and responding within 24-48 hours are the most effective retention
mechanisms. The Outreach Coordinator should apply this same responsiveness in
reverse: when maintainers engage with the team's PRs, fast and thoughtful
responses signal respect for their time.

The Advocu guide to developer advocacy
(https://www.advocu.com/post/the-ultimate-guide-to-developer-advocacy)
describes how effective advocacy creates "widespread adoption and strong peer
support" through sustained engagement rather than one-time actions. Each pull
request should be viewed not as an end in itself but as the beginning of a
relationship with the target project.

Stack Overflow's guide to open source contribution
(https://stackoverflow.blog/2020/08/03/getting-started-with-contributing-to-open-source/)
notes that understanding a project's culture and contributing guidelines is
essential before submitting. The Outreach Coordinator should read each target
repository's CONTRIBUTING.md, CODE_OF_CONDUCT.md, and recent PR discussions
before submitting, and should adapt the submission style accordingly.

## Ethical Guidelines

- Every pull request must be transparent about what it does. No hidden
  dependencies, no obfuscated changes, no misleading descriptions.
- If a maintainer asks whether the contribution is part of a broader adoption
  effort, answer honestly.
- Do not create sockpuppet accounts or use multiple accounts to submit PRs.
- Do not submit PRs to repositories where the team has been previously asked
  not to contribute.

## Outputs

- Submitted pull requests on target repositories
- Updated `/workspace/reports/submission-log.md` with PR URLs and status
- Response comments on open pull requests as needed
