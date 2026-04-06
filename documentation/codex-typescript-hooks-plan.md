# Codex TypeScript Hooks Plan

## Goal

Add Codex-compatible equivalents of the existing hooks in `packages/typescript-hooks` and compile them to `codex-plugins/typescript-hooks/hooks.json`.

This plan assumes the current Codex limitation you noted: Codex plugins do not currently execute plugin-provided hooks. Because of that, the output under `codex-plugins/typescript-hooks/hooks.json` should be treated as a generated artifact for future compatibility, local validation, and documentation, not as a live integration path.

## Current State

- `packages/typescript-hooks` contains two Claude-oriented hooks built on `@goodfoot/claude-code-hooks`:
  - `src/eslint-typescript-bypass.ts`
  - `src/typescript-check.ts`
- Those hooks currently build to `plugins/typescript-hooks/hooks/hooks.json`.
- `packages/codex-hooks` exists and documents the actual Codex hook surface:
  - Supported events: `PreToolUse`, `PostToolUse`, `SessionStart`, `UserPromptSubmit`, `Stop`
  - `PreToolUse` and `PostToolUse` are Bash-only
- `codex-plugins/typescript-hooks/.codex-plugin/plugin.json` already exists, but there is no current runtime path for that plugin to auto-register hooks.

## Constraints

- The existing Claude hooks are matcher-based around `Write|Edit|MultiEdit`, which does not map directly to Codex's current Bash-only tool hook model.
- Any Codex version must inspect Bash command strings, not structured file-write tool payloads.
- The Codex build must use `@goodfoot/codex-hooks` and produce a `hooks.json` manifest plus generated `.mjs` executables.
- Guidance and docs must avoid implying that the generated hooks are automatically active through the Codex plugin system.

## Migration Approach

1. Create a Codex-specific source area for the new hooks.
   Use a separate source directory under `packages/typescript-hooks`, such as `src/codex/`, to avoid mixing Claude and Codex runtime assumptions in the same files.

2. Re-express each hook against Codex's real event model.
   - Convert the bypass-prevention hook into a Codex `PreToolUse` hook with matcher `Bash`.
   - Convert the validation hook into a Codex `PostToolUse` hook with matcher `Bash`.
   - Both hooks should parse `input.tool_input.command` and decide whether the Bash command is relevant before doing any work.

3. Define Codex-specific triggering heuristics.
   Because Codex only exposes Bash commands here, the hooks need explicit command detection rules. A first pass should target commands that are strong signals for JS/TS file modification or validation, such as:
   - editors or patch flows that include `.ts`, `.tsx`, `.js`, `.jsx`
   - shell commands invoking formatters, linters, or project scripts
   - command strings that reference files under the repo and match JS/TS extensions

4. Port the bypass-prevention behavior conservatively.
   The Claude version checks content diffs before write/edit operations. Codex does not expose that same structured edit payload, so parity will be partial unless the Bash command or resulting file content can be inspected safely.
   The implementation plan should therefore:
   - start with command-level screening for obviously dangerous bypass insertions
   - optionally inspect touched files after command generation if the command clearly names them
   - document any remaining parity gap versus Claude's `checkContentForPattern(...).isAddition` behavior

5. Port the validation hook with minimal semantic drift.
   The Codex `PostToolUse` version can retain most of the project-level TypeScript and ESLint validation logic, but it needs a different entry condition:
   - run only after relevant Bash commands
   - derive candidate changed files from the command string where possible
   - preserve the current package discovery and error formatting logic where still useful

6. Add Codex build output wiring.
   Introduce a new build script in `packages/typescript-hooks/package.json` that runs:

   ```bash
   npx -y @goodfoot/codex-hooks -i "src/codex/*.ts" -o "../../codex-plugins/typescript-hooks/hooks.json"
   ```

   This should coexist with the existing Claude build, not replace it.

7. Add or update package dependencies.
   `packages/typescript-hooks` will need `@goodfoot/codex-hooks` available as a dependency or workspace dependency alongside `@goodfoot/claude-code-hooks`.

8. Add tests for the Codex variants.
   New tests should cover:
   - command matching for relevant vs irrelevant Bash commands
   - deny behavior for bypass-like commands
   - allow behavior for unrelated commands
   - validation hook behavior when TypeScript or ESLint failures are detected
   - build generation of `codex-plugins/typescript-hooks/hooks.json`

9. Document the non-runtime status clearly.
   Update package and plugin docs to state:
   - the Codex hooks artifact is generated successfully
   - the artifact is intended for future Codex runtime/plugin support or manual use
   - the Codex plugin does not currently auto-activate hooks

## Proposed File Changes

- `packages/typescript-hooks/package.json`
  Add Codex build/test scripts and the `@goodfoot/codex-hooks` dependency.
- `packages/typescript-hooks/src/codex/eslint-typescript-bypass.ts`
  New Codex `PreToolUse` hook.
- `packages/typescript-hooks/src/codex/typescript-check.ts`
  New Codex `PostToolUse` hook.
- `packages/typescript-hooks/test/`
  Add Codex-focused test files or a `test/codex/` subdirectory.
- `packages/typescript-hooks/README.md`
  Explain the dual Claude/Codex build targets and the current Codex limitation.
- `codex-plugins/typescript-hooks/hooks.json`
  Generated build artifact.
- `codex-plugins/typescript-hooks/README.md` or plugin docs if present
  Clarify that hooks are emitted but not automatically consumed by Codex plugins today.

## Execution Sequence

1. Add a Codex section to `packages/typescript-hooks` without disturbing the current Claude hooks.
2. Implement the Codex `PreToolUse` hook around Bash command inspection.
3. Implement the Codex `PostToolUse` hook around Bash command inspection and existing validation helpers.
4. Add tests for Codex-specific behavior.
5. Add a dedicated Codex build script targeting `../../codex-plugins/typescript-hooks/hooks.json`.
6. Build the Codex hooks and verify the generated manifest and executables.
7. Update docs to state the generated artifact is not yet plugin-runtime-active.

## Validation Checklist

- `packages/typescript-hooks` still builds and tests for the existing Claude path.
- The new Codex build completes successfully.
- `codex-plugins/typescript-hooks/hooks.json` is generated with `PreToolUse` and `PostToolUse` entries.
- Generated commands point at the compiled `.mjs` files as expected.
- Documentation does not claim Codex plugin hook auto-execution.
- Any behavior that cannot fully match Claude's structured edit hooks is explicitly documented as a limitation.

## Risks

- The bypass-prevention hook may not achieve full parity because Codex currently exposes Bash command text rather than structured file edit payloads.
- False positives are possible if command-string heuristics are too broad.
- False negatives are possible when file changes happen through indirect shell commands that do not reveal target files cleanly.
- Future Codex runtime changes may require reshaping the output location or activation model.

## Recommendation

Proceed with a dual-track implementation: keep the existing Claude hooks as the production path, and add Codex hook equivalents as a separately built compatibility artifact. That gives the repository a concrete Codex migration path now without pretending current plugin support exists.
