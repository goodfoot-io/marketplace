# Hook Migration Plan

## Objective

Promote `@goodfoot/claude-code-hooks` through genuine upstream contributions
that replace ad-hoc shell and Python hooks in TypeScript repositories with
typed, compiled equivalents built on the SDK.

## Prerequisites

Before the team begins execution:

- `GITHUB_TOKEN` must be set as an environment variable with `repo` scope
  (for forking and pushing). If the token also has `delete_repo` scope,
  abandoned forks can be cleaned up automatically; otherwise they require
  manual deletion.
- Node.js 20+ must be available on the build machine.
- The skills `github:github`, `claude-code-hooks:sdk`, `browser:browser`,
  and `goodfoot:typescript-metrics` must be loadable.
- **GitHub API rate awareness**: Automated forking, cloning, and code search
  can trigger GitHub's abuse detection on personal accounts. Space fork
  operations at least 30 seconds apart. If any API call returns a `403`
  with an `abuse-rate-limits` or `secondary-rate-limit` message, back off
  for the duration specified in the `Retry-After` header before continuing.
  Do not retry immediately.

## Target Criteria

Repositories must meet all of the following:

- Hosted on GitHub as a public repository.
- Primary language is TypeScript (or the repository is a TypeScript-dominant
  monorepo).
- Contains Claude Code hook implementations using shell scripts, Python scripts,
  inline commands in `.claude/settings.json`, or raw untyped TypeScript without
  an SDK.
- Does not already use `@goodfoot/claude-code-hooks`.
- Shows evidence of active maintenance (commits within the last 90 days, or
  responsive issue tracker).
- The repository's license is compatible with the `@goodfoot/claude-code-hooks`
  license and does not prohibit the kind of changes being proposed.

No minimum star count. Process every repository that qualifies.

## Expected Yield

The Claude Code hooks ecosystem is Python-dominated (~40%) with TypeScript
at ~14%. Of the estimated 15-25 TypeScript hook repositories, most already
use TypeScript for their hooks. After applying the target criteria,
disqualification rules, parity checks, and validation gates, the realistic
number of repositories that will produce a pushed branch and PR draft is
**1 to 5**.

This yield is acceptable. The objective is quality over quantity: each
submitted migration must be polished enough to be accepted by the upstream
maintainer. A single well-received contribution establishes credibility for
the SDK. If the yield is zero, the team's output is still valuable -- the
target backlog, target briefs, and migration guide provide a reusable
foundation for future runs when the ecosystem grows.

If the yield from shell/Python hooks in TypeScript repos is exhausted,
consider a secondary pass targeting:

- TypeScript repos with raw, untyped TypeScript hooks (no SDK). These
  benefit from the typed factory pattern even though they are already
  TypeScript.
- Repos with inline command hooks in `.claude/settings.json` that could
  be extracted into typed, testable hook files.

These secondary targets have a different value proposition (type safety and
testability rather than language migration) and require adjusted PR messaging.

## Deliverables

For each qualifying repository, the team produces:

1. A forked repository on the GitHub account associated with `GITHUB_TOKEN`,
   with a feature branch containing the migrated hooks.
2. A local clone at `/home/node/repos/[REPO_NAME]` with the migration committed.
3. A pull request draft document at
   `/workspace/reports/hook-repo-pr-drafts/[REPO_NAME].md`.

The team does not submit pull requests. A human reviews the deliverables,
opens a courtesy issue on the upstream repository gauging maintainer interest
before submitting, and creates the PRs manually only after receiving a
positive signal.

## Tools Available

Agents have access to the following skills during execution:

- **`github:github`** -- GitHub API access via `tsx` + `octokit` with
  `GITHUB_TOKEN`. Used for repository search, forking, reading file contents,
  and verifying pushed branches.
- **`claude-code-hooks:sdk`** -- The `@goodfoot/claude-code-hooks` SDK
  reference. Provides the scaffold command, build pipeline, factory patterns,
  and output builders used in Step 4.
- **`browser:browser`** -- Web browser for searching the internet. Used as a
  supplementary discovery method when the GitHub Search API returns incomplete
  results, and for researching repository context (blog posts, discussions,
  maintainer preferences) that is not available through the API alone.
- **`goodfoot:typescript-metrics`** -- TypeScript code quality analysis.
  Measures complexity, coupling, duplication, cyclic dependencies, data flow,
  and swallowed errors. Used in Step 4f to assess the migrated hook code
  before committing.

Agents should prefer the GitHub API for structured repository queries (code
search, repo metadata, file contents) and use `browser:browser` for
unstructured research (finding repos mentioned in blog posts, awesome-lists,
or community discussions that may not surface through API queries alone).

---

## Step 1: Discovery

**Role**: Repository Scout

Search GitHub for qualifying repositories using the Search API. Run the
following queries and deduplicate results:

- `claude code hooks language:TypeScript` via repository search.
- `"hooks" path:.claude/settings.json language:JSON` via code search, then
  filter to repos where the primary language is TypeScript.
- `claude-hooks language:Shell path:.claude` via code search, cross-referenced
  against TypeScript repos.
- `claude hooks path:hooks language:Python` via code search, cross-referenced
  against TypeScript repos.

Supplement API results with `browser:browser` searches for repositories
mentioned in blog posts, awesome-lists, and community discussions that may
not surface through the GitHub Search API alone. Useful queries include:

- "claude code hooks TypeScript" on general web search.
- Awesome-list pages such as `awesome-claude-code` repositories.
- Developer blog posts or tutorials demonstrating Claude Code hook setups.

For each candidate, collect:

- Repository URL, owner, name, star count, last commit date.
- License type and compatibility with `@goodfoot/claude-code-hooks`.
- Existing hook implementation: list every hook file or inline hook command,
  note the language (Shell, Python, inline, raw TypeScript), and summarise
  what each hook does.
- Whether the repo has a `CONTRIBUTING.md`, a PR template
  (`.github/PULL_REQUEST_TEMPLATE.md`), or a stated contribution policy.
- Whether the repo's issue tracker or PR history shows responsiveness to
  external contributions.

Write a target brief for each candidate to
`/workspace/reports/targets/[REPO_NAME].md`.

Disqualify repositories where:

- The existing hooks already use `@goodfoot/claude-code-hooks`.
- The repository is itself a competing hooks SDK (the hooks are the product,
  not a development tool within a larger project).
- The repository is archived or has had no commits in the last 180 days.
- The repository's license is incompatible with the proposed changes.

Produce a ranked backlog at `/workspace/reports/target-backlog.md` ordered by
the size of the improvement gap (repositories with the most to gain from the
migration ranked highest).

## Step 2: Fork, Clone, and Baseline

**Role**: Integration Engineer

For each repository that passed discovery:

1. Fork the repository to the account authenticated by `GITHUB_TOKEN` using
   the GitHub API (`octokit.rest.repos.createFork`).
2. Wait for the fork to become available (poll until the fork's
   `created_at` field is populated, typically a few seconds).
3. Clone the fork to `/home/node/repos/[REPO_NAME]`.
4. **Record a validation baseline** on the unmodified default branch before
   making any changes. Run the repository's full validation suite (typecheck,
   lint, tests, any other scripts) and record which checks pass and which
   have pre-existing failures. Store results in the target brief under a
   "Baseline Validation" section. Pre-existing failures are not blocking;
   the migration must not introduce *new* failures beyond the baseline.
5. Create a feature branch named `refactor/claude-code-hooks-migration` from
   the default branch.

## Step 3: Audit Existing Hooks

**Role**: Integration Engineer

Before writing any code, produce a complete inventory of the existing hook
implementation:

1. Read `.claude/settings.json` (or equivalent configuration) and extract
   every hook entry: event type, command, timeout, and any matcher patterns.
2. For each hook backed by a script file, read the file and document:
   - The hook event type (PreToolUse, PostToolUse, Stop, etc.).
   - What the hook does in plain language.
   - Any external dependencies (binaries, environment variables, network
     calls).
   - The exit code / output contract (what it writes to stdout/stderr and
     what exit codes it uses).
3. For inline command hooks, document the command string and its behaviour.
4. Record findings in the target brief at
   `/workspace/reports/targets/[REPO_NAME].md` under an "Existing Hooks"
   section.

**Parity feasibility check**: For each hook, determine whether its behaviour
can be fully reproduced and verified in the migration environment. Where
possible, use executable checks rather than abstract reasoning: attempt to
run the original hook with a synthetic input in the container. If it fails
with `command not found`, `ModuleNotFoundError`, or similar availability
errors, mark the hook as unverifiable and record the specific missing
dependency.

A hook's parity is **unverifiable** if it depends on any of the following:

- Third-party services or APIs that require authentication credentials not
  available to the team (e.g., Slack webhooks, custom logging endpoints).
- System utilities that are not present on the build machine and cannot be
  installed as a dev dependency (e.g., platform-specific binaries, tools
  expected to be on `$PATH` that are not available).
- Runtime state that cannot be simulated in a test (e.g., reading from a
  database, querying a running service).
- Environment variables whose values are secret or project-specific and
  whose absence would cause the hook to behave differently.

**Partial migration is permitted.** Hooks with unverifiable parity are
excluded from the migration but left untouched in the repository. Their
original entries in `.claude/settings.json` remain as-is. Only hooks that
can be verified are rewritten.

**Minimum migration threshold**: Abandon the repository using the procedure
in Step 4f if the partial migration would leave the repository in a worse
state than the status quo. Specifically, abandon if:

- Fewer than 50% of hooks (by count) can be migrated, **or**
- The resulting hybrid state is incoherent -- for example, two hooks of the
  same event type would use different execution models (one SDK, one shell),
  forcing the maintainer to understand and maintain both systems for the
  same concern.

A migration that adds a devDependency and a build pipeline but only covers
one hook out of six does not justify the overhead.

Classify each hook as **migratable** or **excluded** in the target brief.

## Step 4: Implement Migration

**Role**: Integration Engineer

Rewrite every **migratable** hook using `@goodfoot/claude-code-hooks`. Hooks
classified as **excluded** in Step 3 are not touched.

### 4a: Produce Behaviour Specifications

Before writing TypeScript, produce a structured behaviour specification for
each migratable hook as a document in the target brief under "Behaviour
Specifications":

- **Trigger conditions**: What event type, matcher, and input conditions
  cause the hook to activate.
- **Decision branches**: For each distinct code path, what output does the
  hook produce (allow, deny, block, add context)?
- **Side effects**: Does the hook invoke subprocesses, write files, or call
  external services?
- **Environment contract**: What environment variables does the original
  hook read (`$TOOL_NAME`, `$TOOL_INPUT`, `$SESSION_ID`, etc.) in addition
  to the stdin JSON payload?

Write the TypeScript against the specification, not against the shell code.
This creates an auditable intermediate artifact the Quality Reviewer can
check.

### 4a-review: Adversarial Review of Behaviour Specifications

**Role**: Thought Leader and Hater

Before implementation begins, pass the complete set of behaviour
specifications to the `thought-leader-and-hater` agent. The agent will
search the web for recent criticism, drama, and cautionary tales related to
the technologies, patterns, and dependencies in the specifications, then
produce a hostile critique of the migration plan for this repository.

The purpose is to surface objections a skeptical maintainer would raise
before the team invests in implementation. Common findings include:

- The migration adds complexity without meaningful benefit for this
  specific repository.
- The dependency introduces supply-chain risk disproportionate to the
  value delivered.
- The behaviour specifications miss edge cases that the original scripts
  handle implicitly.
- The approach mirrors patterns that have been publicly criticised in the
  ecosystem.

Record the critique in the target brief under an "Adversarial Review
(Plan)" section. The Integration Engineer must address each substantive
point before proceeding to Step 4b. "Substantive" means the point
identifies a concrete technical risk or maintainer objection; pure
vibes-based dunks are recorded but do not block progress.

If the critique reveals that the migration does not represent a clear
improvement for this repository, abandon using the procedure in Step 4f.

### 4b: Set Up the Build Pipeline

If the repository does not already have a hooks build configuration:

1. Add `@goodfoot/claude-code-hooks` to `devDependencies` in the appropriate
   `package.json` (root or the relevant workspace package).
2. Add a build script:
   ```json
   "scripts": {
     "build:hooks": "claude-code-hooks -i \"hooks/*.ts\" -o \"dist/hooks.json\""
   }
   ```
   Adjust the `-i` and `-o` paths to match the repository's directory
   structure. For monorepos, use `-o` to target the correct plugin or config
   directory.
3. Install dependencies (`yarn install` or the repository's package manager).

If starting from scratch is cleaner than incremental migration, use the
scaffold:
```bash
npx @goodfoot/claude-code-hooks --scaffold ./hooks --hooks [HOOK_TYPES] -o ./dist/hooks.json
```
where `[HOOK_TYPES]` is a comma-separated list of the migratable event types
identified in Step 3.

### 4c: Rewrite Each Migratable Hook

For every migratable hook, create a TypeScript source file that:

1. Imports the correct factory and output builder from
   `@goodfoot/claude-code-hooks` (e.g., `preToolUseHook` and
   `preToolUseOutput`).
2. Uses `export default` with the factory function. This is mandatory.
3. Implements every decision branch from the behaviour specification.
4. Uses the `logger` context object for all logging. No `console.log` or
   `console.error` under any circumstances.
5. Uses typed overloads where the matcher targets a known tool (e.g.,
   `{ matcher: 'Bash' }` gives typed access to `tool_input.command`).
6. Uses type guards (`isWriteTool`, `isEditTool`, `getFilePath`, etc.) when
   the hook matches multiple tools.

### 4d: Verify Parity

Before removing any original files, verify that each replacement hook
produces semantically equivalent behaviour to the original.

For each migratable hook:

1. **Identify the decision space.** Enumerate the conditions under which
   the hook allows, denies, blocks, or adds context. This should already
   be documented in the behaviour specification from Step 4a.

2. **Construct test cases for each decision branch.** Create JSON payloads
   that exercise each branch. Include the required environment variables
   (`TOOL_NAME`, `TOOL_INPUT`, `SESSION_ID`, etc.) alongside the stdin
   JSON, since the original hook may read from either source.

3. **Compare semantic outcomes, not raw output.** For each test case verify:
   - The replacement hook makes the same allow/deny/block decision.
   - Any system messages or additional context are semantically equivalent
     (not necessarily identical strings). An original hook returning `{}`
     and a replacement returning `{ hookSpecificOutput: { permissionDecision:
     "allow" } }` are semantically equivalent -- Claude Code treats them
     the same.
   - For subprocess-invoking hooks (e.g., PostToolUse hooks that invoke
     `tsc` or `eslint`), verify the replacement invokes the same command
     with equivalent arguments. Do not require identical subprocess stdout.

4. **Side-effecting hooks require explicit exit-code and output mapping.**
   If a hook writes files, calls APIs, or modifies state, execution-based
   comparison may not be feasible. In this case, verify equivalence by
   structural comparison against the behaviour specification, with the
   following additional requirement: produce an explicit mapping table in
   the target brief showing each original exit code / stderr output and the
   corresponding SDK output builder call (e.g., `exit 1` with
   `"permission denied"` on stderr maps to `preToolUseOutput({ hookSpecificOutput:
   { permissionDecision: 'deny', permissionDecisionReason: '...' } })`).
   The Quality Reviewer must check this mapping table against both the
   original script and the replacement TypeScript. Document that parity was
   verified by review and explain why execution-based comparison was not
   feasible.

Record the parity verification results in the target brief at
`/workspace/reports/targets/[REPO_NAME].md` under a "Parity Verification"
section.

### 4e: Update Hook Configuration

For hooks that were migrated, update `.claude/settings.json` as follows:

1. Build hooks to produce the `hooks.json` manifest:
   ```bash
   npx -y @goodfoot/claude-code-hooks -i "hooks/*.ts" -o "dist/hooks.json"
   ```
2. Read the generated `dist/hooks.json` file.
3. Extract the `hooks` object from the manifest (excluding the `__generated`
   metadata).
4. In `.claude/settings.json`, replace the entries for migrated hooks with
   the corresponding entries from the generated `hooks` object. The format
   is the same: `{ EventType: MatcherEntry[] }`.
5. **Leave entries for excluded hooks untouched.** Their original inline
   commands or script references must remain exactly as they were.
6. Delete the original shell scripts, Python scripts, or inline hook
   commands that have been replaced. Do not delete scripts for excluded
   hooks.

**Do not use a path string reference in `settings.json`.** The `hooks` field
in `settings.json` takes an inline object, not a file path. The generated
`hooks.json` manifest's `hooks` object is structurally compatible with the
`settings.json` format and should be merged directly.

### 4f: Full Validation Gate

The migration must not introduce new failures beyond the baseline recorded
in Step 2.

1. **Build hooks**: Verify that the manifest and `bin/` executables exist.

2. **TypeScript type checking**: Run `tsc --noEmit` (or the repository's
   equivalent typecheck script). Compare against the baseline: zero new
   errors. Pre-existing errors from the baseline are not blocking.

3. **Linting**: Run the repository's linter. Zero new errors. Do not
   disable rules.

4. **Tests**: Run the full test suite. No new failures beyond the baseline.

5. **Any other validation**: Run any additional validation steps defined by
   the repository. No new failures beyond the baseline.

**If the migration introduces new failures that cannot be resolved**, the
repository must be abandoned:

1. Attempt to delete the fork from GitHub using the API
   (`octokit.rest.repos.delete({ owner, repo })`). If deletion fails
   (e.g., insufficient token permissions), log the failure in
   `/workspace/reports/submission-log.md` with a note that the fork
   at `https://github.com/{owner}/{repo}` requires manual deletion.
2. Remove the local clone (`rm -rf /home/node/repos/[REPO_NAME]`).
3. Record the abandonment in `/workspace/reports/submission-log.md` with the
   repository name, date, and a brief explanation of what failed and why.
4. Update the target brief at `/workspace/reports/targets/[REPO_NAME].md`
   with an "Abandoned" section documenting the failure.
5. Move on to the next repository in the backlog.

### 4g: Code Quality Assessment (Advisory)

After the validation gate passes, load the `goodfoot:typescript-metrics`
skill and run it against the migrated hook files. Record the metrics summary
in the target brief under a "Code Quality Metrics" section.

If the metrics report flags **critical** issues -- specifically swallowed
errors (empty `catch` blocks or `catch` blocks that neither log nor
re-throw) -- address those issues and re-run the validation gate.

For all other findings (complexity, duplication, coupling, unused
parameters), record them as recommendations in the target brief. Do not
refactor the code. The goal of this migration is a transparent upgrade,
not a code quality overhaul. Refactoring can be proposed in a follow-up
contribution after the migration PR is accepted.

### 4h: Commit

Commit the changes on the `refactor/claude-code-hooks-migration` branch.
Use conventional commit messages that explain the motivation:

```
refactor: migrate Claude Code hooks to typed TypeScript SDK

Replace shell/Python hook scripts with typed TypeScript implementations
using @goodfoot/claude-code-hooks. This provides compile-time validation,
structured logging, and consistent error handling across all hooks.
```

Keep commits atomic. If the migration touches multiple independent hooks,
consider one commit per hook plus a final commit for build configuration
and cleanup.

## Step 5: Draft Pull Request Document

**Role**: Technical Writer

Write a pull request draft to
`/workspace/reports/hook-repo-pr-drafts/[REPO_NAME].md`.

Check whether the target repository has a PR template at
`.github/PULL_REQUEST_TEMPLATE.md`. If it does, note which sections the
template requires and how the draft maps to them, in a comment block at
the top of the draft file. The Outreach Coordinator can use this to adapt
the draft when creating the actual PR.

The document must contain the following sections:

### Background

One to two paragraphs explaining what `@goodfoot/claude-code-hooks` is: a
typed TypeScript SDK for Claude Code hooks that replaces ad-hoc shell scripts
or hand-rolled hook code with factory functions, output builders, and a
compilation step that produces executable hook manifests. Explain it from
first principles for a reader who has not encountered the package before.

### Package Details

A brief factual summary to help the maintainer assess the dependency:

- npm package URL.
- Current version.
- License.
- Install size (run `npm pack --dry-run` and report the tarball size).
- Weekly npm download count.
- Number of GitHub contributors.
- The package is a third-party open-source project, not an official
  Anthropic tool.

This section must give the maintainer enough information to make an informed
decision about supply-chain risk. Do not omit unfavourable metrics (e.g.,
low download counts or a single maintainer). The maintainer will check the
npm page regardless; pre-empting with honest data builds trust.

### Motivation

One to two paragraphs explaining why this migration is worth doing for this
specific repository. Reference the repository's existing hook implementation
by name and describe the concrete improvements: type safety that catches
errors at compile time, structured logging via the `logger` context instead
of stdio, consistent error handling, and a build pipeline that validates
hook structure before deployment.

### Changes

A walkthrough of what changed, referencing specific files and directories in
the repository. Describe each rewritten hook briefly. Note any configuration
changes to `.claude/settings.json` or `package.json`.

### Hooks Not Migrated

If the migration is partial (some hooks were excluded), list each excluded
hook with a brief explanation of why it was left unchanged (e.g., "The
`notify-slack.sh` hook depends on a `SLACK_WEBHOOK_URL` environment variable
not available to us; we left it unchanged."). If all hooks were migrated,
omit this section.

### Verification

Step-by-step instructions the maintainer can follow to verify the migration:

1. Install dependencies.
2. Build hooks.
3. Run tests.
4. Manually test a specific hook scenario if applicable.

### Rollback

A one-line rollback instruction: "To revert this change, run
`git revert <commit-hash>` and reinstall dependencies."

### Style Requirements

- Written in International Business English.
- Natural paragraph structure. Avoid bullet-heavy formatting in the
  Background and Motivation sections.
- No emojis.
- No promotional language or unsubstantiated claims. Every assertion about
  the package must be backed by a concrete example from the migration.
- The 800-word limit applies to the draft document. The Outreach
  Coordinator may expand or contract based on the repository's conventions
  when creating the actual PR.

## Step 6: Quality Review

**Role**: Quality Reviewer

Review both the code and the document before the branch is pushed.

### Code Checklist

- [ ] Every migrated hook file uses `export default hookFactory(...)`.
- [ ] No `console.log` or `console.error` in any hook file.
- [ ] All logging uses the `logger` context object.
- [ ] Build produces a valid `hooks.json` manifest.
- [ ] Compiled executables exist in `bin/` directory adjacent to the manifest.
- [ ] `tsc --noEmit` introduces no new errors beyond the baseline.
- [ ] Linter introduces no new errors beyond the baseline.
- [ ] Test suite introduces no new failures beyond the baseline.
- [ ] Hook behaviour is semantically equivalent to the originals, as
      demonstrated by parity verification and behaviour specifications
      in the target brief.
- [ ] Excluded hooks (if any) are left completely untouched in
      `.claude/settings.json` and on disk.
- [ ] `.claude/settings.json` correctly merges migrated hook entries from
      the generated manifest with retained entries for excluded hooks.
- [ ] Commit messages are clear, conventional, and explain motivation.
- [ ] The branch is based on a recent commit from the upstream default branch.
- [ ] The contribution respects the target repository's coding style and
      directory conventions.

### Document Checklist

- [ ] Background section accurately describes the package.
- [ ] Package Details section includes npm URL, version, license, and size.
- [ ] Motivation section references the specific repository, not generic claims.
- [ ] Changes section matches the actual diff.
- [ ] Hooks Not Migrated section (if applicable) lists each excluded hook
      with a clear reason.
- [ ] Verification steps work when followed literally.
- [ ] Rollback section is present.
- [ ] Tone is professional, direct, and free of promotional language.
- [ ] No emojis.
- [ ] Under 800 words.

### Review Cycle Limits

- **Maximum 2 REVISE cycles** (for a total of up to 3 reviews). Each REVISE
  must include specific, actionable feedback -- no vague directives.
- **Split verdicts are permitted**: the Reviewer may issue PASS on code and
  REVISE on the document (or vice versa). A code PASS allows the Engineer
  to push the branch while the Writer revises the document.
- If the third review still results in REVISE:
  - **Abandon** if the issues are fundamental (parity cannot be demonstrated,
    the migration introduces behaviour changes that cannot be resolved).
  - **Escalate to the human** if the issues are stylistic or judgment calls.
    The human makes the final call.

### Verdict

- **PASS**: Proceed to Step 7.
- **REVISE**: Return to the Integration Engineer (code issues) or Technical
  Writer (document issues) with specific, actionable feedback.

The Quality Reviewer has veto power. No branch is pushed without a PASS
verdict (or a code-specific PASS in a split verdict). If the migration does
not represent a clear improvement over the original, the Quality Reviewer
should withdraw the candidate entirely.

## Step 6b: Adversarial Review of Final Implementation

**Role**: Thought Leader and Hater

After the Quality Reviewer issues a PASS verdict, pass the complete
migration -- the diff, the PR draft document, and the target brief -- to
the `thought-leader-and-hater` agent for a final adversarial review. The
agent will search the web for fresh ammunition and produce a critique of the
finished work as it would appear to a hostile observer on the receiving end
of the pull request.

This review simulates the worst-case maintainer reaction. Common findings
include:

- The PR reads as promotional despite the team's efforts to keep it
  neutral.
- The diff touches files or patterns that maintainers are known to be
  protective of.
- Recent ecosystem drama (supply-chain incidents, dependency controversies)
  makes the timing unfavourable for adding a new devDependency.
- The migration introduces a build step the maintainer did not ask for.
- Kevin could have done this with sed.

Record the critique in the target brief under an "Adversarial Review
(Final)" section. The team must review each point and decide:

- **Accept and address**: Modify the code, PR draft, or both before
  pushing. Return to the Quality Reviewer for re-validation if code
  changes are made.
- **Acknowledge in the PR**: Add a sentence to the PR draft that
  pre-emptively addresses the concern (e.g., "This migration adds a
  devDependency; if you prefer to keep the hook scripts dependency-free,
  we understand and will close this PR.").
- **Dismiss with rationale**: Record why the point does not apply and move
  on. Pure vibes-based dunks and Kevin references fall into this category.

The Thought Leader and Hater does not have veto power. The Quality
Reviewer's PASS verdict remains the gate for pushing. However, if the
adversarial review surfaces a concern that the Quality Reviewer agrees is
substantive, the Reviewer may retroactively downgrade to REVISE.

## Step 7: Push to Fork

**Role**: Integration Engineer

After the Quality Reviewer issues a PASS verdict (or a code PASS in a split
verdict) and the adversarial review in Step 6b has been dispositioned:

1. Push the feature branch to the forked repository on GitHub:
   ```bash
   git push -u origin refactor/claude-code-hooks-migration
   ```
2. Verify the branch appears on the fork's GitHub page.
3. Record the push in `/workspace/reports/submission-log.md` with the
   repository name, fork URL, branch name, and date.

The team's work on this repository is complete. A human will review the fork
and the PR draft document, then create the pull request on the upstream
repository when ready.

## Step 8: Update Migration Guide

**Role**: Integration Engineer

After every repository -- whether the migration succeeded or was abandoned --
update `/workspace/documentation/hook-migration-guide.md` with lessons learned.

This is a living document that accumulates best practices across all
implementations. It should contain:

### Quick Reference Checklist

A condensed, always-current list of the 5-10 most important lessons learned.
Updated each time a finding is promoted from repository-specific notes.
Agents should read this section before starting each new repository.

### Patterns That Work

Techniques, code patterns, and approaches that proved effective across
multiple repositories. For example: how to handle a specific hook type that
has a non-obvious factory mapping, a reliable way to integrate the build
pipeline into an existing monorepo, or a commit structure that reviewers
respond well to.

### Common Pitfalls

Recurring issues encountered during migrations. For example: repositories
that define hooks in a non-standard location, test suites that depend on
the hook scripts being shell-executable, linter configurations that conflict
with the SDK's output, or package managers that require special handling for
the `@goodfoot/claude-code-hooks` dependency.

### Repository-Specific Notes

A brief entry for each repository processed, noting:

- What hooks were migrated and which factory/builder was used for each.
- Which hooks were excluded and why.
- Any unexpected challenges and how they were resolved (or why the
  repository was abandoned).
- The validation steps that were run and any issues encountered.

### Update Protocol

- Read the existing guide before starting each new repository so that known
  pitfalls are avoided proactively.
- After completing Step 7 (or after abandoning in Step 4f), append new
  findings. Do not overwrite existing entries.
- Keep entries concise: one to three sentences per finding.

---

## Pipeline Execution

The steps above are described sequentially for clarity. The table below
shows the theoretical concurrency model. In practice, with a yield of 1-5
repositories, the pipeline is unlikely to reach steady state -- most runs
will process repositories sequentially through each role. The table
remains useful as a reference for dependency ordering:

| Slot | Repository Scout | Integration Engineer | Technical Writer | Quality Reviewer | Thought Leader and Hater |
|------|-----------------|---------------------|-----------------|-----------------|------------------------|
| T1 | Discovery (all repos) | -- | -- | -- | -- |
| T2 | -- | Repo A: Fork/Audit/Specs | -- | -- | -- |
| T3 | -- | (awaiting hater) | -- | -- | Repo A: Adversarial Review (Plan) |
| T4 | -- | Repo A: Implement | -- | -- | -- |
| T5 | -- | Repo B: Fork/Audit/Specs | Repo A: Draft PR | -- | -- |
| T6 | -- | (awaiting hater) | -- | Repo A: Review | Repo B: Adversarial Review (Plan) |
| T7 | -- | Repo B: Implement | -- | -- | Repo A: Adversarial Review (Final) |
| T8 | -- | Repo A: Push (if cleared) | Repo B: Draft PR | Repo B: Review | -- |

**Dependencies that block parallelism:**

- The Engineer cannot begin implementation (Step 4b) until the Thought
  Leader and Hater completes the adversarial review of behaviour
  specifications (Step 4a-review) and substantive points are addressed.
- The Writer cannot start a PR draft until the Engineer commits (Step 4h)
  for that repository.
- The Reviewer cannot start until both the code (Step 4h) and the PR draft
  (Step 5) are complete for that repository.
- The Thought Leader and Hater cannot perform the final adversarial review
  (Step 6b) until the Quality Reviewer issues a PASS verdict (Step 6).
- The Engineer cannot push (Step 7) until both the Quality Reviewer issues
  a PASS verdict (Step 6) and the adversarial review (Step 6b) has been
  dispositioned for that repository.
- Step 8 (Update Migration Guide) can be batched and performed after
  multiple repositories are processed, rather than strictly after each one.

**If a REVISE verdict is issued:** The Engineer or Writer addresses the
feedback for that repository in the next available slot, without blocking
work on other repositories.

## File Structure

After a full run, the workspace will contain:

```
/workspace/
  .claude/
    agents/
      repository-scout.md       # Agent definitions
      integration-engineer.md
      technical-writer.md
      quality-reviewer.md
      outreach-coordinator.md
  documentation/
    hook-migration-plan.md       # This document
    hook-migration-guide.md      # Best-practices guide (Step 8)
  reports/
    targets/
      [REPO_NAME].md            # Target brief with audit findings
    hook-repo-pr-drafts/
      [REPO_NAME].md            # PR draft document
    target-backlog.md            # Ranked list of all candidates
    submission-log.md            # Record of pushed/abandoned repos

/home/node/repos/
  [REPO_NAME]/                   # Cloned fork with migration branch
```

## Role Assignments

| Step | Role | Agent |
|------|------|-------|
| 1. Discovery | Repository Scout | `.claude/agents/repository-scout.md` |
| 2. Fork, Clone, Baseline | Integration Engineer | `.claude/agents/integration-engineer.md` |
| 3. Audit Existing Hooks | Integration Engineer | `.claude/agents/integration-engineer.md` |
| 4a. Behaviour Specifications | Integration Engineer | `.claude/agents/integration-engineer.md` |
| 4a-review. Adversarial Review (Plan) | Thought Leader and Hater | `.claude/agents/thought-leader-and-hater.md` |
| 4b-4h. Implement Migration | Integration Engineer | `.claude/agents/integration-engineer.md` |
| 5. Draft PR Document | Technical Writer | `.claude/agents/technical-writer.md` |
| 6. Quality Review | Quality Reviewer | `.claude/agents/quality-reviewer.md` |
| 6b. Adversarial Review (Final) | Thought Leader and Hater | `.claude/agents/thought-leader-and-hater.md` |
| 7. Push to Fork | Integration Engineer | `.claude/agents/integration-engineer.md` |
| 8. Update Migration Guide | Integration Engineer | `.claude/agents/integration-engineer.md` |

The Outreach Coordinator role (`.claude/agents/outreach-coordinator.md`)
is not active during the automated run. It applies when a human begins
submitting the pull requests and managing maintainer interactions.
