---
name: sdk
description: Load this skill immediately after a user mentions "@goodfoot/codex-hooks" or Codex hooks.
---

**Review the Codex hooks docs first, then use `@goodfoot/codex-hooks` with Codex's actual runtime limits in mind. This package is for Codex hooks, not Claude Code hooks.**

<instructions>

## 1. Build Model

Hooks are **compiled commands**, not raw `.ts` files. Build them into a `hooks.json` manifest plus generated `.mjs` executables before Codex can run them.

**Build command:**
```bash
npx -y @goodfoot/codex-hooks -i "hooks/*.ts" -o ".codex/hooks.json"
```

**Parameters:**
* `-i "hooks/*.ts"`: Input glob for hook source files. Quote the glob so the CLI receives it intact.
* `-o ".codex/hooks.json"`: Output manifest path. The CLI writes hashed executables next to it and emits repo-root-relative commands when the output lives under `.codex/`.
* `--executable node` (Optional): Command prefix to use in generated hook commands.
* `--loader .ext=type` (Optional, repeatable): Additional esbuild loaders for non-code imports. `.md=text` is enabled by default.

**Important runtime detail:**
* If the manifest path is under a repo-local `.codex/` directory, generated commands use `$(git rev-parse --show-toplevel)` so the manifest stays portable across worktrees.

## 2. Current Codex Hook Surface

`@goodfoot/codex-hooks` intentionally matches the current Codex runtime, which is narrower than Claude Code:

* Supported events: `PreToolUse`, `PostToolUse`, `SessionStart`, `UserPromptSubmit`, `Stop`
* Hook handler type: `type: "command"` only
* Tool hooks: `PreToolUse` and `PostToolUse` are Bash-only today
* Matchers: honored only for `SessionStart`, `PreToolUse`, and `PostToolUse`
* Plain-text returns: only `SessionStart` and `UserPromptSubmit`
* Windows: Codex hooks are currently disabled

Do not suggest Claude-only events such as `SubagentStop`, `PermissionRequest`, `SessionEnd`, or `PreCompact` when the user is using this package.

## 3. Hook Factory Demonstration

Here is a complete `PreToolUse` example using the Codex package.

```typescript
import { preToolUseHook, preToolUseOutput } from "@goodfoot/codex-hooks";

export default preToolUseHook({ matcher: "Bash" }, (input, { logger }) => {
  const command = input.tool_input.command;
  logger.info("Checking Bash command", { command });

  if (command.includes("rm -rf")) {
    return preToolUseOutput({
      systemMessage: "Blocked destructive Bash command.",
      permissionDecision: "deny",
      permissionDecisionReason: "Refusing destructive shell command."
    });
  }
});
```

**Key points:**
* Use `export default`.
* Input fields use Codex wire names such as `hook_event_name` and `tool_input`.
* For `PreToolUse` and `PostToolUse`, `tool_name` is currently `Bash`.
* Use the provided `logger`, not `console.log` or `console.error`.

## 4. Output Semantics

Use the output builders from `@goodfoot/codex-hooks` instead of writing raw JSON manually.

| Hook Type | Preferred Builder | Typical Effect |
|-----------|-------------------|----------------|
| `PreToolUse` | `preToolUseOutput` | Allow or deny a Bash tool invocation |
| `PostToolUse` | `postToolUseOutput` | Add context after a Bash command runs |
| `SessionStart` | `sessionStartOutput` | Add startup or resume context |
| `UserPromptSubmit` | `userPromptSubmitOutput` | Add context or block a bad prompt |
| `Stop` | `stopOutput` | Block or annotate the stop flow |

**Blocking model:**
* `PreToolUse` denies with `permissionDecision: "deny"`.
* `Stop`, `UserPromptSubmit`, and `PostToolUse` can return `decision: "block"` plus `reason`.
* Throw `new BlockError(reason)` when you want stderr plus exit code `2`.

**Plain text output:**
* `SessionStart` and `UserPromptSubmit` may return a plain string, which the runtime normalizes into `additionalContext`.
* Other hook types must return a structured output or `undefined`.

## 5. Scaffolding

Use the scaffold command when starting a fresh Codex hooks package:

```bash
npx @goodfoot/codex-hooks --scaffold ./my-codex-hooks --hooks SessionStart,PreToolUse -o ./.codex/hooks.json
```

This generates:
* `src/` with starter hook files
* `test/` with Vitest coverage
* `package.json`, `tsconfig.json`, `vitest.config.ts`, and `biome.json`
* `README.md` describing the generated project

After scaffolding:
1. `cd my-codex-hooks`
2. `npm install`
3. `npm run build`
4. `npm test`

## 6. Common Patterns

### Pattern A: Deny dangerous Bash commands

```typescript
import { preToolUseHook, preToolUseOutput } from "@goodfoot/codex-hooks";

const BLOCKED = ["rm -rf /", "sudo rm -rf", "mkfs"] as const;

export default preToolUseHook({ matcher: "Bash" }, (input) => {
  const command = input.tool_input.command;
  const matched = BLOCKED.find((value) => command.includes(value));
  if (!matched) return;

  return preToolUseOutput({
    systemMessage: `Blocked command containing ${matched}.`,
    permissionDecision: "deny",
    permissionDecisionReason: `Command contains banned sequence: ${matched}`
  });
});
```

### Pattern B: Add context after a Bash command

```typescript
import { postToolUseHook, postToolUseOutput } from "@goodfoot/codex-hooks";

export default postToolUseHook({ matcher: "Bash" }, (input) => {
  return postToolUseOutput({
    additionalContext: `Observed Bash command: ${input.tool_input.command}`
  });
});
```

### Pattern C: Add startup guidance from markdown

```typescript
import preamble from "./prompts/session-start.md";
import { sessionStartHook, sessionStartOutput } from "@goodfoot/codex-hooks";

export default sessionStartHook({ matcher: "startup" }, () => {
  return sessionStartOutput({
    additionalContext: preamble
  });
});
```

If you import non-code assets beyond markdown, add matching `--loader` flags to the build.

## 7. How `./packages/codex-hooks` Works

Use the local package at `./packages/codex-hooks` as the authoritative implementation reference:

* `src/hooks.ts`: factory helpers attach Codex metadata such as `hookEventName`, `matcher`, `timeout`, and `statusMessage`
* `src/outputs.ts`: output builders encode the supported stdout JSON shape and `BlockError`
* `src/runtime.ts`: reads hook JSON from stdin, invokes the default export, normalizes string returns, and writes structured stdout/stderr with Codex-compatible exit codes
* `src/cli.ts`: analyzes each source file, bundles it with esbuild, writes hashed `.mjs` executables, and generates `hooks.json`
* `src/scaffold.ts`: creates starter projects for the five supported Codex events
* `README.md`: documents the current runtime constraints and build flow

When answering questions, prefer `./packages/codex-hooks` over assumptions from Claude tooling.

## 8. Agent Protocol

When helping with Codex hooks, follow this protocol:

1. Verify the package is `@goodfoot/codex-hooks` or the local `./packages/codex-hooks`.
2. Enforce the build step after every hook edit.
3. Keep guidance inside Codex's current event surface and Bash-only tool coverage.
4. Ban direct `console.log` and `console.error`; use the provided `logger`.
5. Require `export default hookFactory(...)`.
6. If the user needs a plugin, place the skill under a Codex plugin with `.codex-plugin/plugin.json`, not a Claude `.claude-plugin` manifest.

</instructions>
