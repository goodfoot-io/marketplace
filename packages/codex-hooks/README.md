# @goodfoot/codex-hooks

Build Codex hooks in TypeScript.

This package is intentionally narrower than `@goodfoot/claude-code-hooks`. It targets the actual Codex hook runtime behavior reflected in `/tmp/openai-codex` `rust-v0.118.0`: five events, synchronous `type: "command"` hooks only, and Bash-only `PreToolUse` / `PostToolUse` payloads.

## Quick Start

Install:

```bash
yarn add @goodfoot/codex-hooks
```

Write a hook:

```ts
import { preToolUseHook, preToolUseOutput } from "@goodfoot/codex-hooks";

export default preToolUseHook({ matcher: "Bash" }, (input) => {
  if (input.tool_input.command.includes("rm -rf")) {
    return preToolUseOutput({
      systemMessage: "Blocked destructive command.",
      permissionDecision: "deny",
      permissionDecisionReason: "Refusing destructive Bash command.",
    });
  }
});
```

Compile hooks and generate `hooks.json`:

```bash
codex-hooks -i "src/**/*.ts" -o ".codex/hooks.json"
```

If the output is under a repo-local `.codex/` directory, generated commands are rooted at `$(git rev-parse --show-toplevel)`. Otherwise the CLI emits absolute command paths.

## Supported Events

- `PreToolUse`
- `PostToolUse`
- `SessionStart`
- `UserPromptSubmit`
- `Stop`

## Current Codex Runtime Limits

| Limit | Current behavior |
| --- | --- |
| Event surface | Only 5 events |
| Handler type | `type: "command"` only |
| Async hooks | Ignored by Codex |
| Tool coverage | `PreToolUse` / `PostToolUse` are Bash-only today |
| Matcher support | Honored only for `SessionStart`, `PreToolUse`, `PostToolUse` |
| Unsupported output fields | Several parsed fields fail open or are ignored by Codex |
| Windows | Hooks are disabled |

## Runtime Semantics

- Structured hook output writes JSON to stdout and exits `0`.
- Throwing `BlockError` writes the reason to stderr and exits `2`.
- Unhandled exceptions write the stack trace to stderr and exit non-zero.
- Plain-text return values are only accepted for `SessionStart` and `UserPromptSubmit`, where they are normalized into `additionalContext`.

## Scaffolding

```bash
npx @goodfoot/codex-hooks --scaffold ./my-codex-hooks --hooks SessionStart,PreToolUse -o ./.codex/hooks.json
```

This creates a small starter project with `src/`, `test/`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `biome.json`, and `README.md`.
