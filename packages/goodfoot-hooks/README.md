# goodfoot-hooks

This project contains [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) built with the `@goodfoot/claude-code-hooks` library. Hooks let you extend Claude Code's behavior by running custom code at specific points during a session—before or after tool execution, when Claude starts or stops, and more. This project includes hooks for: `PostToolUse`, `SessionStart`, `SessionEnd`.

To get started, run `npm install` to install dependencies, then `npm run build` to compile your hooks into `hooks.json`. Copy the generated `hooks.json` to your Claude Code settings directory (or reference it in your `.claude/settings.json`), and your hooks will run automatically. Edit the files in `src/` to customize behavior, and use `npm test` to verify your changes work correctly.
