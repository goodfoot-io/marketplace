# Codex Hooks Library Plan

## Summary

Build a new `./packages/codex-hooks` package that is analogous to `./packages/claude-code-hooks`, but intentionally narrower and Codex-specific.

The package should be:

- A TypeScript authoring library for Codex hook handlers
- A small build system that compiles hook files and generates `hooks.json`
- A runtime wrapper that handles Codex stdin/stdout/stderr/exit-code semantics safely
- A scaffold/test/documentation tool for starting new Codex hook projects quickly

The first version should target the actual Codex runtime behavior in `rust-v0.118.0`, not the broader shape implied by Claude Code.

## What I reviewed

- Claude Code hooks docs: https://code.claude.com/docs/en/hooks
- Codex hooks docs: https://developers.openai.com/codex/hooks
- Codex source at `/tmp/openai-codex`, tag `rust-v0.118.0`
- Existing package at `/workspace/packages/claude-code-hooks`

## Key findings that should shape the design

### Codex is much narrower than Claude Code

Claude Code currently documents a large event surface. Codex currently supports only:

- `PreToolUse`
- `PostToolUse`
- `SessionStart`
- `UserPromptSubmit`
- `Stop`

This is confirmed both by the public Codex docs and by the Rust config/parser code in:

- `/tmp/openai-codex/codex-rs/hooks/src/engine/config.rs`
- `/tmp/openai-codex/codex-rs/hooks/src/engine/discovery.rs`

### Only command hooks are actually supported

Codex parses `type: "prompt"` and `type: "agent"` in config, but explicitly skips them today. It also skips `async: true` command hooks.

This means `codex-hooks` should support only synchronous `type: "command"` handlers in v1.

### Current tool coverage is effectively Bash-only

In the current runtime:

- `PreToolUse` matcher input is only `Bash`
- `PostToolUse` matcher input is only `Bash`
- the input payload schema for both only models `tool_input.command`

This is confirmed in:

- `/tmp/openai-codex/codex-rs/core/src/hook_runtime.rs`
- `/tmp/openai-codex/codex-rs/hooks/schema/generated/pre-tool-use.command.input.schema.json`
- `/tmp/openai-codex/codex-rs/hooks/schema/generated/post-tool-use.command.input.schema.json`

So the TypeScript types should narrow these events to `tool_name: "Bash"` and `{ tool_input: { command: string } }` instead of pretending Codex already has Claude-level tool coverage.

### Matchers are event-dependent

Codex currently honors `matcher` only for:

- `SessionStart`
- `PreToolUse`
- `PostToolUse`

Codex currently ignores `matcher` for:

- `UserPromptSubmit`
- `Stop`

This behavior is explicit in the docs and in `/tmp/openai-codex/codex-rs/hooks/src/events/common.rs`.

### Some documented/parsed fields are intentionally unsupported

This is the biggest design constraint.

The current runtime parses several output fields but rejects or ignores them:

- `PreToolUse`
  - unsupported: `continue: false`
  - unsupported: `stopReason`
  - unsupported: `suppressOutput`
  - unsupported: `hookSpecificOutput.updatedInput`
  - unsupported: `hookSpecificOutput.additionalContext`
  - unsupported: `permissionDecision: "allow"`
  - unsupported: `permissionDecision: "ask"`
  - unsupported: legacy `decision: "approve"`
- `PostToolUse`
  - unsupported: `suppressOutput`
  - unsupported: `hookSpecificOutput.updatedMCPToolOutput`

This is explicit in `/tmp/openai-codex/codex-rs/hooks/src/engine/output_parser.rs`.

The library should not normalize these into first-class supported APIs in v1.

### Config generation needs Codex-specific path handling

`claude-code-hooks` relies on Claude plugin/project environment conventions. Codex does not.

Codex docs recommend repo-local commands resolve from the git root because Codex may start from a subdirectory. That means `codex-hooks` should generate commands differently:

- repo-local output: prefer `$(git rev-parse --show-toplevel)` based command paths
- user/global output: fall back to absolute paths

This is a meaningful difference from the Claude package and should be built into the CLI.

## Product goal

Create the easiest safe path for authoring Codex hooks in TypeScript without promising runtime capabilities Codex does not currently have.

## Non-goals for v1

- Supporting Claude Code and Codex from the same package
- Supporting all Claude Code hook events
- Exposing unsupported Codex output fields as normal builder options
- Supporting `type: "prompt"` or `type: "agent"`
- Supporting `async: true` handlers
- Inventing a fake generalized tool model for Codex beyond current Bash coverage

## Proposed package shape

Create `./packages/codex-hooks` with a structure parallel to the Claude package:

```text
packages/codex-hooks/
├── package.json
├── README.md
├── tsconfig.json
├── tsconfig.build.json
├── biome.json
├── vitest.config.ts
├── vitest.e2e.config.ts
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── hooks.ts
│   ├── outputs.ts
│   ├── runtime.ts
│   ├── cli.ts
│   ├── constants.ts
│   ├── logger.ts
│   ├── scaffold.ts
│   └── schema/
│       └── generated/
├── scripts/
│   └── snapshot-codex-schemas.ts
├── tests/
└── e2e/
```

## Proposed public API

Keep the same mental model as `claude-code-hooks`:

- hook factory functions
- typed input types
- output builders
- runtime `execute(...)`
- CLI to compile hooks and generate `hooks.json`

But only expose Codex-supported events:

```ts
preToolUseHook(...)
postToolUseHook(...)
sessionStartHook(...)
userPromptSubmitHook(...)
stopHook(...)
```

And matching output builders:

```ts
preToolUseOutput(...)
postToolUseOutput(...)
sessionStartOutput(...)
userPromptSubmitOutput(...)
stopOutput(...)
```

### Input types

`types.ts` should define exact current wire-shape types, not aspirational ones.

Recommended event inputs:

- `BaseHookInput`
- `SessionStartInput`
- `PreToolUseInput`
- `PostToolUseInput`
- `UserPromptSubmitInput`
- `StopInput`
- `HookInput`
- `PermissionMode`
- `SessionStartSource`

Important modeling choices:

- use Codex wire format keys directly: `session_id`, `hook_event_name`, `tool_use_id`
- represent current `permission_mode` literals from the schema
- model `transcript_path` and `last_assistant_message` as nullable where the schema does
- narrow `tool_name` to `"Bash"` for pre/post tool hooks

### Hook factories

`hooks.ts` should provide:

- strongly typed handler inputs per event
- event-aware `matcher` typing
- event-aware timeout typing
- injected logger/context object

Recommended config types:

- `MatcherHookConfig` for `SessionStart`, `PreToolUse`, `PostToolUse`
- `NoMatcherHookConfig` for `UserPromptSubmit`, `Stop`

This avoids silently accepting `matcher` on events where Codex ignores it.

### Output builders

The output builders should be intentionally conservative.

Recommended supported builder surface:

- `sessionStartOutput`
  - `continue`
  - `stopReason`
  - `systemMessage`
  - `additionalContext`
- `userPromptSubmitOutput`
  - `continue`
  - `stopReason`
  - `systemMessage`
  - `additionalContext`
  - `decision: "block"`
  - `reason`
- `stopOutput`
  - `continue`
  - `stopReason`
  - `systemMessage`
  - `decision: "block"`
  - `reason`
- `preToolUseOutput`
  - `systemMessage`
  - `permissionDecision: "deny"`
  - `permissionDecisionReason`
  - optionally legacy `decision: "block"` + `reason` through a separate explicit helper for compatibility
- `postToolUseOutput`
  - `continue`
  - `stopReason`
  - `systemMessage`
  - `additionalContext`
  - `decision: "block"`
  - `reason`

Do not expose these as normal options in v1:

- `suppressOutput`
- `updatedInput`
- `updatedMCPToolOutput`
- `permissionDecision: "allow"`
- `permissionDecision: "ask"`
- `PreToolUse.additionalContext`

If needed, expose one escape hatch like `rawOutput(...)`, but keep it clearly unsafe and undocumented for normal users.

## Runtime design

Implement `runtime.ts` as the Codex equivalent of the Claude package runtime:

- read a single JSON object from `stdin`
- parse into typed input
- call the exported default hook handler
- write only valid Codex output to `stdout`
- write blocking reason/errors to `stderr` when appropriate
- exit with the correct code

### Exit-code policy

The runtime should normalize the common hook authoring cases:

- success: exit `0`
- explicit block via structured output: exit `0` and emit the expected JSON
- explicit block via thrown `BlockError`: exit `2` and write reason to `stderr`
- unhandled exception: exit non-zero and surface stack trace to `stderr`

Use Codex semantics, not Claude-specific assumptions, when deciding what gets serialized versus sent to `stderr`.

### Plain-text stdout support

Codex allows plain text stdout for some events, but not all.

Recommendation:

- keep the default runtime JSON-first
- optionally support returning plain text only for:
  - `SessionStart`
  - `UserPromptSubmit`
- explicitly reject plain text returns for:
  - `Stop`
  - `PreToolUse`
  - `PostToolUse`

That gives useful convenience without creating ambiguous behavior.

## CLI and build plan

The CLI should remain a core part of the package, not an afterthought.

Recommended command:

```bash
codex-hooks -i "src/**/*.ts" -o ".codex/hooks.json"
```

### Responsibilities

- scan source files for `export default <eventFactory>(...)`
- compile hook files with esbuild
- emit bundled `.mjs` files
- generate `hooks.json`
- optionally scaffold a starter project

### Manifest generation rules

`hooks.json` generation should reflect Codex behavior exactly:

- only emit supported event names
- only emit `type: "command"`
- convert builder timeout milliseconds into Codex config seconds if keeping parity with the Claude package API, or standardize on seconds for Codex-native clarity
- emit `statusMessage` when configured
- omit `matcher` for `UserPromptSubmit` and `Stop`
- group handlers by event and matcher

### Path strategy

This needs special care.

Recommended behavior:

- if output path is under a repo `.codex/` directory, generate command paths rooted at `$(git rev-parse --show-toplevel)`
- otherwise emit absolute command paths

That matches Codex guidance better than relative paths and avoids the Claude-specific plugin-root strategy.

### Loader support

Keep the useful parts of the Claude package:

- default `.md=text`
- optional `--loader .txt=text`
- general esbuild loader passthrough

This makes prompt/context asset imports work without custom setup.

## Scaffolding plan

Add `--scaffold` with a smaller event list than the Claude package.

Example:

```bash
npx @goodfoot/codex-hooks --scaffold ./my-codex-hooks --hooks SessionStart,PreToolUse -o ./.codex/hooks.json
```

Scaffold should generate:

- `src/*.ts` hook examples
- `test/*.test.ts`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `biome.json`
- `README.md`

The examples should demonstrate current Codex-safe behavior, especially:

- Bash command denial in `PreToolUse`
- Bash output review in `PostToolUse`
- context injection in `SessionStart`
- prompt validation in `UserPromptSubmit`
- continuation control in `Stop`

## Type/source-of-truth strategy

Unlike the Claude package, there is no obvious published TypeScript SDK surface here to re-export directly.

The safest plan is:

1. Vendor the generated Codex hook schemas into the package.
2. Add a script that refreshes them from a checked-out Codex source tree.
3. Hand-maintain TypeScript types and output builders against those schemas.
4. Add snapshot tests so schema drift is visible during upgrades.

This keeps the package stable for consumers while preserving a clear sync path to Codex versions.

Recommended sync script input for now:

- source repo: `/tmp/openai-codex`
- source tag basis: `rust-v0.118.0`

Longer-term, the script should support a configurable local checkout path.

## Testing plan

The library needs both unit tests and protocol-level e2e tests.

### Unit tests

- input type guards and parsing
- output builder JSON shape
- config metadata extraction from source files
- matcher handling rules
- timeout/statusMessage serialization
- path generation rules

### E2E tests

Compile fixture hooks and assert:

- generated `hooks.json` matches expected structure
- spawned compiled hooks produce the expected stdout/stderr/exit code
- `PreToolUse` deny path matches Codex expectations
- `PostToolUse` block/context path matches Codex expectations
- `SessionStart` additional context path works
- `UserPromptSubmit` block path works
- `Stop` continuation path works

### Compatibility tests against vendored schema

Validate produced JSON against the vendored Codex schemas for:

- each event input fixture
- each event output builder

This is the most important guard against the package drifting into Claude-like assumptions.

## Documentation plan

The README should lead with Codex-specific constraints, not generic hook marketing.

Recommended sections:

- what Codex supports today
- quick start
- supported events
- current runtime limitations
- config path strategy
- blocking vs context injection
- build command examples
- migration notes for users familiar with `claude-code-hooks`

Also add one explicit table named something like `Current Codex Runtime Limits` covering:

- only 5 events
- only command hooks
- no async hooks
- pre/post tool hooks are Bash-only today
- `matcher` ignored for `UserPromptSubmit` and `Stop`
- some parsed fields fail open
- hooks disabled on Windows

## Implementation phases

### Phase 1: Core library

- create package skeleton
- add exact current wire-format types
- add five hook factories
- add conservative output builders
- add runtime executor
- add logger

### Phase 2: CLI/build system

- implement source discovery and metadata extraction
- compile with esbuild
- generate Codex-correct `hooks.json`
- implement repo-root path strategy

### Phase 3: Scaffold and docs

- add `--scaffold`
- generate starter hooks/tests
- write README

### Phase 4: Verification hardening

- vendor schemas
- add schema snapshot/update script
- add protocol conformance tests
- add upgrade notes for future Codex releases

## Design decisions to make up front

These should be settled before implementation starts:

1. Whether hook config `timeout` should be expressed in milliseconds for parity with `claude-code-hooks`, or in seconds to match Codex config directly.
2. Whether to support a limited plain-text return mode for context-injecting events, or require JSON builders everywhere.
3. Whether to expose a low-level `rawOutput(...)` escape hatch in v1.
4. Whether the package name should be `@goodfoot/codex-hooks` for symmetry with `@goodfoot/claude-code-hooks`.

My recommendation:

- keep `timeout` in milliseconds in the TypeScript API, convert to seconds in manifest generation
- support plain text only for `SessionStart` and `UserPromptSubmit`
- include `rawOutput(...)` only if clearly marked unsafe/internal
- use `@goodfoot/codex-hooks`

## Expected outcome

At the end of this work, the repo should have a `./packages/codex-hooks` package that feels familiar to users of `claude-code-hooks`, but is honest about current Codex behavior and tested against the real Codex hook schemas and runtime semantics from `rust-v0.118.0`.
