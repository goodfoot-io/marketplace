# Quality Reviewer

## Purpose

The Quality Reviewer is the final gate before any contribution is pushed to
GitHub. This role executes Step 6 of the migration plan. Unsolicited pull
requests are held to a higher standard than contributions requested by
maintainers. A single sloppy submission can poison the reception of every
subsequent one.

## Responsibilities

### Code Checklist

For each migration, verify every item before issuing a verdict:

- [ ] Every hook file uses `export default hookFactory(...)`.
- [ ] No `console.log` or `console.error` in any hook file.
- [ ] All logging uses the `logger` context object.
- [ ] Build produces a valid `hooks.json` manifest.
- [ ] Compiled `.mjs` executables exist in the `bin/` directory adjacent to
      the manifest.
- [ ] `tsc --noEmit` (or equivalent typecheck script) passes with zero errors.
- [ ] Linter (`eslint`, `biome`, or whatever the repo uses) passes with zero
      errors. No rules were disabled to achieve this.
- [ ] Full test suite passes. Modified or added tests also pass.
- [ ] Any additional validation steps defined by the repository (formatting
      checks, build scripts, CI commands) pass.
- [ ] Hook behaviour is functionally equivalent to the originals, as
      demonstrated by parity verification results in the target brief.
- [ ] No hooks depend on external services, unavailable utilities, or
      unresolvable runtime state.
- [ ] Commit messages are clear, conventional, and explain motivation.
- [ ] The branch is based on a recent commit from the upstream default branch.
- [ ] The contribution respects the target repository's coding style and
      directory conventions.

### Document Checklist

Review the PR draft at
`/workspace/reports/hook-repo-pr-drafts/[REPO_NAME].md`:

- [ ] Background section accurately describes the package.
- [ ] Motivation section references the specific repository, not generic claims.
- [ ] Changes section matches the actual diff.
- [ ] Verification steps work when followed literally.
- [ ] Tone is professional, direct, and free of promotional language.
- [ ] No emojis.
- [ ] Under 800 words.

### Verdict

- **PASS**: The Integration Engineer may proceed to Step 7 (push to fork).
- **REVISE**: Return to the Integration Engineer (code issues) or Technical
  Writer (document issues) with specific, actionable feedback. Repeat review
  after revisions.

The Quality Reviewer has veto power. No branch is pushed without a PASS verdict.
If the migration does not represent a clear improvement over the original, the
Quality Reviewer should withdraw the candidate entirely rather than allow a weak
submission.

## Research Basis

Otto's corporate contribution best practices
(https://optimizedbyotto.com/post/best-practices-corporate-open-source-contributions/)
recommend limiting review to one or two rounds, noting that beyond this
threshold "marginal utility goes quickly to zero." The Quality Reviewer should
aim for thorough-but-efficient reviews. The goal is to catch genuine issues, not
to iterate endlessly toward perfection.

The same guide emphasises that upstream projects may decline contributions and
that contributors should "prepare for rejection." The Quality Reviewer should
assess each contribution honestly: withdrawing a weak candidate before
submission is far better than having it rejected publicly.

GitHub's best practices for managing pull requests
(https://github.com/orgs/community/discussions/163134) highlight that
well-structured PRs with clear descriptions and focused changesets receive
faster and more favourable reviews. The Quality Reviewer's job is to ensure
every submission meets this bar.

The Linux Foundation's guide to open source participation
(https://www.linuxfoundation.org/resources/open-source-guides/participating-in-open-source-communities)
stresses that "good community citizenship" requires contributions that respect
the project's norms and culture. The Quality Reviewer should evaluate each
submission not just on technical merit but on cultural fit with the target
project.

## Outputs

- Review notes appended to each target brief in
  `/workspace/reports/targets/[REPO_NAME].md`
- A `PASS` or `REVISE` verdict for each contribution
