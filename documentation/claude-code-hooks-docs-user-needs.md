# Claude Code Hooks: User Needs (Web Survey)

This list consolidates common questions and pain points from public GitHub issues in `anthropics/claude-code` and community posts (brethorsting.com, claudelog.com, augmentedswe.com, and similar guides). It is ordered by how often the question appears and how much it blocks adoption.

1. **“Why aren’t my hooks running at all?”** Users report hooks not executing even when `settings.json` looks correct, or `/hooks` shows no configured hooks. This includes cases where PreToolUse never fires or configuration errors appear regardless of format. Importance: if hooks don’t run, nothing else matters.

2. **“Where does the hooks config live, and which file wins?”** Confusion about global vs project vs local settings and how Claude chooses between them is common. Developers ask where to place `settings.json` and how to verify which file is being used. Importance: misplacement silently disables hooks.

3. **“How do I match all file edits without missing some tools?”** People regularly ask how to catch every file modification and learn they need a composite matcher (for example, `Edit|MultiEdit|Write`). Importance: missing events leads to inconsistent enforcement of formatting or policy checks.

4. **“How do I scope hooks so they don’t run on every command?”** Developers struggle with hooks firing too broadly (especially `Bash` matchers), leading to slow or noisy workflows. The common request is for patterns that check command content before running expensive scripts. Importance: poor scoping makes hooks feel unusable.

5. **“How do I debug hook inputs and outputs?”** Many users want to see the JSON payload that hooks receive, or to understand why a hook decision didn’t take effect. They ask for ways to log or dump inputs and for reliable debug output. Importance: hooks are opaque without clear debugging paths.

6. **“What’s in the tool input and how do I parse it safely?”** Questions frequently focus on reading `CLAUDE_TOOL_INPUT`, extracting `command`, or using `jq` correctly. Errors here lead to broken conditionals or false positives. Importance: most hook logic depends on parsing tool inputs accurately.

7. **“How do I auto-approve or auto-deny permissions?”** The PermissionRequest hook raises questions about schema support, decision structure, and safe allow/deny patterns. Users are uncertain whether the settings schema supports it and how to return the proper response. Importance: permission automation is a primary driver for adopting hooks.

8. **“What happens when multiple hooks match the same tool?”** Reports show that later hooks can unintentionally override earlier ones (for example, `updatedInput` being cleared by a hook that returns nothing). Users ask about merge/precedence behavior. Importance: multi-hook setups are common and subtle ordering bugs are costly.

9. **“Why does my Stop hook see a stale transcript?”** Developers reading `transcript_path` in Stop hooks note that the latest message isn’t always available due to timing/race conditions. They ask how to reliably access the most recent content. Importance: Stop hooks are often used for final validation or summaries.

10. **“Why does Claude show an error label when my hook succeeds?”** Some users see hooks marked as errors even though the hook exits cleanly and returns valid JSON. This leads to confusion about exit codes and hook success semantics. Importance: perceived failure erodes trust in automation.

11. **“Why doesn’t /hooks show the event I selected?”** The `/hooks` UI is reported to redirect to the wrong event (e.g., always `PreToolUse`), which confuses new users trying to configure multiple events. Importance: the first setup experience often goes through `/hooks`.

12. **“How do I organize hook scripts so they’re maintainable?”** People ask how to avoid massive inline bash commands and instead keep scripts in a dedicated directory, while still referencing them reliably in settings. Importance: maintainability determines whether teams keep hooks long-term.

13. **“How do I make hooks less brittle across machines?”** Questions surface about absolute paths, symlinks, and portability when sharing configs or working across environments. Developers want to know best practices for pathing and script discovery. Importance: portability is required for teams and shared repos.

14. **“How do I validate hook execution without running full Claude sessions?”** Users look for a quick way to test hooks locally with sample JSON input to confirm logic and output formatting. Importance: fast local testing reduces iteration time and lowers the barrier to experimentation.
