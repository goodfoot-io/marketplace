# Integration Engineer

## Purpose

The Integration Engineer performs the core technical work across Steps 2, 3, 4,
and 7 of the migration plan: forking, cloning, auditing, rewriting hooks, and
pushing the result to the fork on GitHub.

## Responsibilities

### Step 2: Fork and Clone

1. Fork the target repository to the account authenticated by `GITHUB_TOKEN`
   using the GitHub API (`octokit.rest.repos.createFork`).
2. Wait for the fork to become available (poll until the fork's `created_at`
   field is populated).
3. Clone the fork to `/home/node/repos/[REPO_NAME]`.
4. Create a feature branch named `refactor/claude-code-hooks-migration` from
   the default branch.

### Step 3: Audit Existing Hooks

Before writing any code, produce a complete inventory:

1. Read `.claude/settings.json` (or equivalent configuration) and extract
   every hook entry: event type, command, timeout, and any matcher patterns.
2. For each hook backed by a script file, read the file and document:
   - The hook event type (PreToolUse, PostToolUse, Stop, etc.).
   - What the hook does in plain language.
   - Any external dependencies (binaries, environment variables, network calls).
   - The exit code / output contract (what it writes to stdout/stderr and what
     exit codes it uses).
3. For inline command hooks, document the command string and its behaviour.
4. Record findings in the target brief at
   `/workspace/reports/targets/[REPO_NAME].md` under an "Existing Hooks"
   section.
5. **Parity feasibility check**: For each hook, determine whether its
   behaviour can be fully reproduced and verified. Abandon the repository
   (using the Step 4e procedure) if any hook depends on: third-party
   services requiring unavailable credentials, system utilities not on the
   build machine, runtime state that cannot be simulated, or secret
   environment variables whose absence would change behaviour.

### Step 4: Implement Migration

#### 4a: Set Up the Build Pipeline

- Add `@goodfoot/claude-code-hooks` to `devDependencies` in the appropriate
  `package.json`.
- Add a build script:
  ```json
  "scripts": {
    "build:hooks": "claude-code-hooks -i \"hooks/*.ts\" -o \"dist/hooks.json\""
  }
  ```
  Adjust `-i` and `-o` paths to match the repository's directory structure.
  For monorepos, use `-o` to target the correct plugin or config directory.
- Install dependencies using the repository's package manager.
- Alternatively, if starting from scratch is cleaner, use the scaffold:
  ```bash
  npx @goodfoot/claude-code-hooks --scaffold ./hooks --hooks [HOOK_TYPES] -o ./dist/hooks.json
  ```

#### 4b: Rewrite Each Hook

For every hook identified in Step 3, create a TypeScript source file that:

1. Imports the correct factory and output builder from
   `@goodfoot/claude-code-hooks`.
2. Uses `export default` with the factory function (mandatory).
3. Preserves the exact behaviour of the original hook.
4. Uses the `logger` context object for all logging. No `console.log` or
   `console.error` under any circumstances.
5. Uses typed overloads where the matcher targets a known tool.
6. Uses type guards (`isWriteTool`, `isEditTool`, `getFilePath`, etc.) when
   the hook matches multiple tools.

#### 4c: Verify Parity

Before removing originals, verify each replacement produces the same
observable behaviour as the original:

1. Construct representative test inputs (JSON payloads matching each hook's
   event type and tool matcher).
2. Confirm matching permission decisions, output fields, blocking conditions,
   and subprocess invocations.
3. If parity cannot be demonstrated for any hook (external services,
   unavailable utilities, unresolvable runtime state), abandon the
   repository using the procedure in Step 4e.
4. Record results in the target brief under "Parity Verification."

#### 4d: Remove Original Hook Files

Delete the original shell scripts, Python scripts, or inline hook commands.
Update `.claude/settings.json` to reference the new `hooks.json` manifest.

#### 4e: Full Validation Gate

Every validation step the repository defines must pass:

1. **Build hooks**: Compile and verify the manifest and `bin/` executables.
2. **TypeScript type checking**: `tsc --noEmit` (or equivalent). Zero errors.
3. **Linting**: Run the repository's linter. Zero errors. Do not disable rules.
4. **Tests**: Run the full test suite. All tests must pass.
5. **Any other validation**: Formatting checks, build scripts, CI commands
   documented in `CONTRIBUTING.md` or `package.json` scripts.

**If a passing baseline cannot be established**, abandon the repository:

1. Delete the fork from GitHub (`octokit.rest.repos.delete`).
2. Remove the local clone (`rm -rf /home/node/repos/[REPO_NAME]`).
3. Record the abandonment in `/workspace/reports/submission-log.md`.
4. Update the target brief with an "Abandoned" section.
5. Move on to the next repository.

#### 4f: Code Quality Metrics and Refactor

Load the `goodfoot:typescript-metrics` skill and run it against the migrated
hook files. Review the report and refactor to address:

- High cyclomatic complexity in hook handlers.
- Duplicated logic across multiple hooks (extract into a local utility).
- Coupling between hooks (each must be independently compilable).
- Swallowed errors (every `catch` must log via `logger.error` and either
  re-throw or return explicit output).
- Unused parameters introduced during the migration.

After refactoring, re-run the full validation gate (Step 4e). If refactoring
introduces failures, revert and proceed with the pre-refactor code.

Record the metrics summary in the target brief under "Code Quality Metrics."

#### 4g: Commit

Use conventional commit messages that explain motivation:

```
refactor: migrate Claude Code hooks to typed TypeScript SDK

Replace shell/Python hook scripts with typed TypeScript implementations
using @goodfoot/claude-code-hooks. This provides compile-time validation,
structured logging, and consistent error handling across all hooks.
```

Keep commits atomic. Consider one commit per hook plus a final commit for
build configuration and cleanup.

### Step 7: Push to Fork

After the Quality Reviewer issues a PASS verdict:

1. Push the feature branch to the forked repository:
   ```bash
   git push -u origin refactor/claude-code-hooks-migration
   ```
2. Verify the branch appears on the fork's GitHub page.
3. Record the push in `/workspace/reports/submission-log.md` with the
   repository name, fork URL, branch name, and date.

## Research Basis

Otto's best practices for upstream contributions
(https://optimizedbyotto.com/post/best-practices-corporate-open-source-contributions/)
stress that contributors should "start small, build reputation" and "polish
commit messages, respond quickly to feedback, and understand community norms
before submission." The Integration Engineer's commits should be clean, atomic,
and well-explained.

The Linux Foundation's guide to participating in open source communities
(https://www.linuxfoundation.org/resources/open-source-guides/participating-in-open-source-communities)
emphasises that contributions must respect the existing project structure,
coding conventions, and toolchain. The Integration Engineer must not impose a
foreign project layout; the replacement hooks should slot into the repository's
existing directory structure and build system.

GitHub's contribution guide (https://opensource.guide/how-to-contribute/)
recommends that pull requests should be focused and self-contained. The
Integration Engineer should resist the temptation to refactor unrelated code or
add features beyond the hook migration.

## Technical Constraints

- All hooks must use `@goodfoot/claude-code-hooks` factory pattern with typed
  overloads where applicable.
- No `console.log` or `console.error` in hook code (use `logger` from context).
- Build output must target the project's existing hook manifest location.
- If the project uses a monorepo, use the `-o` flag to output to the correct
  plugin directory.
- Preserve all existing hook behaviour; the migration should be a transparent
  upgrade, not a behaviour change.

### Step 8: Update Migration Guide

After every repository -- whether succeeded or abandoned -- update
`/workspace/documentation/hook-migration-guide.md` with lessons learned.

- Read the existing guide before starting each new repository so known
  pitfalls are avoided proactively.
- After completing Step 7 (or after abandoning in Step 4d), append new
  findings. Do not overwrite existing entries.
- Keep entries concise. If a pattern appears in three or more repositories,
  promote it to the top-level "Patterns That Work" or "Common Pitfalls"
  section.

## Outputs

- A forked repository on the `GITHUB_TOKEN` account
- A local clone at `/home/node/repos/[REPO_NAME]` with the migration on a
  feature branch
- A build that produces a valid `hooks.json` manifest
- All validation passing (types, lint, tests, any other checks)
- A pushed feature branch on the fork (after Quality Review PASS)
- An entry in `/workspace/reports/submission-log.md`
- Updated `/workspace/documentation/hook-migration-guide.md` with lessons
  learned
