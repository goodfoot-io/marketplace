---
name: browser
title: Browser
summary: Fast browser automation via the agent-browser CLI (Chrome/Chromium over CDP, accessibility-tree snapshots with @eN refs).
description: Browser automation (navigation, forms, clicks, screenshots, data extraction, testing) using the agent-browser CLI against a Chromium binary set up by this skill's bin/ scripts. Snapshot-and-ref workflow, not raw CDP scripting.
---

<instructions>

## The core loop

Always pass `--session <name>` — every command in this container shares one default browser without it, and another task's navigation can silently overwrite your page mid-task with no error (wrong content, blank screenshot, `eval` returning null, a just-seen element gone missing). Pick any short unique slug for `<name>`.

```bash
export AGENT_BROWSER_SESSION=<task-slug>   # once per task; every command below inherits it
agent-browser open <url>        # 1. Open a page
agent-browser snapshot -i       # 2. See what's on it (interactive elements only)
agent-browser click @e3         # 3. Act on refs from the snapshot
agent-browser snapshot -i       # 4. Re-snapshot after any page change
agent-browser close             # 5. Close when the task is done
```

If a shell can't retain `export` across calls, pass `--session <task-slug>` on every single `agent-browser` invocation instead.

The browser stays running across commands (its own daemon manages the Chrome process — no manual start/stop step, unlike CDP-scripting tools). It auto-shuts down after an hour of idleness and restarts on the next command. Still run `agent-browser close` when finished.

Refs (`@e1`, `@e2`, ...) are assigned fresh on every `snapshot` and go stale the moment the page changes — navigation, form submit, re-render, dialog. Always re-snapshot before the next ref interaction. If a ref goes stale with no action of yours that would explain it, that's the signature of a missing `--session` — see above.

## Reading and interacting

Default to `read` for anything that's just extraction — it skips launching Chrome entirely, so it's both faster and cheaper. Reach for `open` + `snapshot` only when you need to click, fill, or otherwise interact.

`read <url>` always fetches fresh from the server — it does not reflect an already-open session's live state (post-click, post-fill). For the current state of a page you're mid-interaction with, use `get text @eN`, `snapshot`, or `screenshot` instead.

```bash
agent-browser read <url>                  # default for extraction: no Chrome, prefers markdown
agent-browser snapshot -i --json          # machine-readable snapshot of an already-open page
agent-browser get text @e1
agent-browser fill @e2 "hello"            # clear then type
agent-browser click @e1
agent-browser select @e4 "option-value"
agent-browser screenshot page.png
agent-browser screenshot --annotate map.png   # numbered labels keyed to snapshot refs
```

When refs aren't available or convenient, use semantic locators before falling back to raw CSS:

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
```

## Waiting (agents fail more from bad waits than bad selectors)

After any page-changing action, pick one:

```bash
agent-browser wait @e1                     # until an element appears
agent-browser wait --text "Success"
agent-browser wait --url "**/dashboard"
agent-browser wait --load networkidle      # catch-all for SPA navigation
```

`networkidle` only catches network activity — a client-side delay with no request (a JS `setTimeout`, a CSS transition) can resolve before the content actually appears. Prefer `wait @eN` / `wait --text` for those.

Avoid bare `agent-browser wait 2000` except when debugging — it makes scripts slow and flaky.

## Sharp gotchas

- **Ref not found**: page changed since the last snapshot — re-run `agent-browser snapshot -i`.
- **Click does nothing / `covered by <...>`**: a modal or cookie banner is intercepting it. Try `agent-browser find text "Close" click` (or whatever the dismiss control's text is) rather than a ref click — the overlay's ref is often the thing covering itself. Then re-snapshot and retry the original action.
- **Native `<select>` dropdowns**: never `click` an option ref — it fails with a box-model error. Use `agent-browser select @eN "option text or value"` directly on the `<select>` element.
- **Fill/type silently no-ops** on custom input components: `agent-browser focus @e1` then `agent-browser keyboard inserttext "text"` (bypasses key events) or `agent-browser keyboard type "text"`.
- **JS with quotes/backticks**: use `eval --stdin` with a heredoc, not inline `agent-browser eval "..."`.
- **Dialogs**: `alert`/`beforeunload` auto-accept. For `confirm`/`prompt`: `agent-browser dialog status`, `dialog accept`, `dialog dismiss`.
- **Login walls**: stop and ask. Exception: already-authenticated SSO can proceed automatically; still stop for passwords, MFA, consent, or ambiguous account choice. Never put credentials in a shell command — use `agent-browser auth save`/`auth login` (see `agent-browser skills get core --full` for the auth vault workflow).
- **Screenshots**: headless screenshots hide native scrollbars by design; that's expected, not a bug.
- **Something's broken** (`Unknown command`, `Failed to connect`, missing Chrome, stale daemon): run `agent-browser doctor` first — `agent-browser doctor --fix` for destructive repairs (reinstall Chrome, purge stale state).

## Loading deeper docs on demand

For anything not covered above (auth vault, network mocking, video recording, Electron/Slack automation, ...), run `agent-browser skills get core --full` or `agent-browser skills list` — served live from the installed CLI, so it's always version-accurate.

Upstream source: https://github.com/vercel-labs/agent-browser

## Appendix: install

`agent-browser` and its Chromium binary are expected to already be installed. If a command fails with "command not found" or a missing-browser error, run:

```bash
bash bin/install-agent-browser.sh   # relative to this skill's base directory
```

Idempotent — safe to re-run.

</instructions>
