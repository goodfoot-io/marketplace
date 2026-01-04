# Claude Code Hooks Package: Docs Topics

This list focuses on package-level issues that users commonly struggle with when using `@goodfoot/claude-code-hooks`. It avoids rehashing the general hook mechanics covered in the official Claude Code hooks documentation.

1. **Hook factory + default export detection.** The CLI extracts metadata (event, matcher, timeout) by parsing hook factory calls, and it only recognizes `export default` hook exports. If the default export is missing or the factory call is absent, the file is skipped. Why it matters: skipped files never make it into the compiled hooks or `hooks.json`.

2. **CLI build outputs and absolute paths.** The CLI compiles hook files into hashed `.mjs` files and emits a `hooks.json` that contains absolute command paths to those files. This is different from hand-written `hooks.json` that might reference relative paths. Why it matters: you need to know where the compiled artifacts live and how to run them.

3. **Rebuilds after moving a repo.** Because `hooks.json` contains absolute paths, moving a repo or switching machines makes those paths stale. The fix is to re-run the CLI build step so paths are regenerated. Why it matters: stale paths silently prevent hooks from running.

4. **Plugin portability with `${CLAUDE_PLUGIN_ROOT}`.** When distributing hooks as a plugin, command paths should be rewritten to `${CLAUDE_PLUGIN_ROOT}/hooks/build/<file>.mjs` so they work on any machine. The E2E setup shows how to post-process `hooks.json` for this. Why it matters: absolute paths break once the plugin is installed elsewhere.

5. **Logging is silent by default.** The logger emits nothing unless you configure `CLAUDE_CODE_HOOKS_LOG_FILE` or use the CLI `--log` option, and the runtime guards against conflicting log settings. Why it matters: no configuration means no log output, which can look like “logging doesn’t work.”

6. **Avoid stdout/stderr in hooks.** Hook output must be valid JSON on stdout, so `console.log` or writing to stderr can corrupt the protocol. Use the package logger instead. Why it matters: corrupted output causes hooks to fail in hard-to-debug ways.

7. **JSONL logs and external sinks.** Log files are JSON Lines, which makes it easy to filter with `jq` or pipe into external loggers using `logger.on(...)`. Why it matters: structured logs are the fastest path to actionable debugging.

8. **Handler error propagation (exit 2 + stack trace).** Unhandled exceptions are now treated as blocking errors and propagate with exit code 2 plus a stack trace. Catch exceptions if you need to degrade gracefully or return a specific hook output. Why it matters: unexpected exceptions can now block sessions instead of failing quietly.

9. **Local testing of compiled hooks.** You can run the compiled `.mjs` directly with `node` and pipe in a mock JSON payload to validate behavior before enabling hooks in Claude Code. Why it matters: fast iteration beats debugging in a live Claude session.

10. **Timeout units are milliseconds.** The hook factory `timeout` option is in milliseconds and is passed through to `hooks.json` unchanged. Accidentally supplying seconds can make hooks appear to hang or time out too fast. Why it matters: timeout unit confusion is a common source of “my hook was killed” reports.

11. **`toolInput` is untyped at runtime.** `toolInput` and other nested fields are `unknown`, so you should use type guards and defaults when reading fields like `command` or `file_path`. Why it matters: careless casts are a frequent source of runtime errors.

12. **CLI skip rules for non-hook files.** The CLI skips files that don’t match the factory + default export pattern, so it’s best to keep hooks in a dedicated directory with a consistent naming scheme. Why it matters: a single misplaced export can silently remove a hook from the build.

13. **SessionStart-only environment persistence.** `persistEnvVar` and `persistEnvVars` only work in SessionStart hooks because they depend on `CLAUDE_ENV_FILE`. Guard against use in other hooks. Why it matters: calling these in other hook types throws at runtime.

14. **ESM output and execution model.** Compiled hooks are ESM `.mjs` files with a Node shebang, so they should be executed with `node` (not `ts-node`, not CJS `require`). Why it matters: mismatched module systems are a common cause of “hook runs but does nothing.”

15. **Loading the plugin + skill for guidance.** The `claude-code-hooks` plugin provides a dedicated skill that activates when you ask about hook creation, porting, output builders, or logging; you can also name it directly to force activation. Why it matters: it puts all the package-specific guidance inside Claude Code when you need it.
