---
name: browser
title: Browser
summary: Direct browser control via CDP for web interaction using a local headless Chromium managed by this skill.
description: Direct browser control via CDP for web interaction (automation, scraping, testing, screenshots) using the browser-use CLI against a local headless Chromium started by this skill's bin/ scripts.
---

<instructions>

## 1. Ensure Chrome is running

```bash
bash /workspace/.claude/skills/browser/bin/start-chrome.sh
```

Idempotent — no-ops if Chrome is already up. Run it at the start of every session. If it fails because Chromium isn't installed, run:

```bash
bash /workspace/.claude/skills/browser/bin/install-chromium.sh
```

then retry `start-chrome.sh`.

## 2. Drive it

```bash
browser-use <<'PY'
new_tab("https://example.com")
ensure_real_tab()   # attach to the real tab, not an invisible omnibox popup
wait_for_load()
print(page_info())
PY
```

- First navigation on a tab is `new_tab(url)`, not `goto_url(url)`. `new_tab()` always opens a **new** tab and attaches to it — calling it again does not navigate your current tab, it leaves the old tab open and attaches you to a different one. For every navigation after the first on a given tab, use `goto_url(url)`.
- Call `ensure_real_tab()` right after `new_tab()` — a fresh session's only CDP target can be an invisible `chrome://omnibox-popup` page, which silently swallows navigation/clicks meant for the real page.
- Helpers (`new_tab`, `page_info`, `capture_screenshot`, `click_at_xy`, `js`, `cdp`, etc.) are pre-imported — no imports needed in the heredoc.

## 3. Stop it (optional)

Local process, not a billed service — fine to leave running between tasks, which also keeps the persistent profile warm. Ask the user before stopping if a task clearly isn't finished.

```bash
bash /workspace/.claude/skills/browser/bin/stop-chrome.sh
```

## Page workflow

- Screenshots first: `capture_screenshot()` returns a file path (e.g. `/home/node/.config/browser-harness/tmp/shot.png`) — `print()` it, then `Read` the path to view the image.
- Clicking: screenshot -> read pixel coords -> `click_at_xy(x, y)` -> screenshot again to confirm.
- After navigation, call `wait_for_load()`.
- If the current tab is stale, internal, or navigation/clicks seem to land on the wrong page, call `ensure_real_tab()`.
- Native `<select>` dropdowns: don't coordinate-click the opened option — it doesn't reliably update the element's value. Set it directly: `js("document.querySelector('select#id').value='opt'; document.querySelector('select#id').dispatchEvent(new Event('change'))")`.
- Use `js(...)` for DOM inspection/extraction when coordinates are the wrong tool. Target elements with a specific selector (`#id`, `[name=...]`, `button[type=submit]`) — a bare tag selector like `document.querySelector('button')` can silently grab the wrong element on pages with more than one match.
- Login walls: stop and ask. Exception: available SSO can be used automatically if already signed in; still stop for passwords, MFA, consent, or ambiguous account choice.
- Raw CDP is available via `cdp("Domain.method", ...)` — except file inputs, see `reference/uploads.md`.

## Interaction skills — load only when needed

| File | Load when... |
|---|---|
| `reference/connection.md` | A tab seems attached but invisible/wrong, or `new_tab`/`goto_url` act on the wrong target |
| `reference/dialogs.md` | `page_info()` returns a `dialog` key, or a flow triggers `alert`/`confirm`/`prompt`/`beforeunload` |
| `reference/uploads.md` | Task needs a file upload (`cdp("Input.setInputFiles", ...)` does not work) |
| `reference/profile-sync.md` | The task needs a logged-in session (reuse the persistent local Chrome profile), or you need to reset it |
| `reference/screenshots.md` | Screenshots come back oversized, or click coordinates from a screenshot land in the wrong place |
| `reference/tabs.md` | Managing more than one tab in a session |

Upstream source (for updates, or to check for newly-filled-in topics not yet mirrored here): https://github.com/browser-use/browser-harness/tree/main/interaction-skills

## Design constraints

- Coordinate clicks are the default — CDP mouse events pass through iframes/shadow DOM/cross-origin content at the compositor level.
- Connection model: `browser-use` always connects via `BU_CDP_URL` to the local Chrome managed by `bin/start-chrome.sh` — no cloud fallback.

## Gotchas

- Omnibox popups are not real work tabs.
- All sessions in this container share the one local Chrome instance and its tabs/state — if concurrent work needs isolation, deliberately use separate tabs/contexts rather than assuming separate browsers.

</instructions>
