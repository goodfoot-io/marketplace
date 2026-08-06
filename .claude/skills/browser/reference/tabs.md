---
title: Tabs
summary: Managing browser tabs during automation sessions.
---

# Tabs

```python
tabs = list_tabs()                    # includes chrome:// pages too
real_tabs = list_tabs(include_chrome=False)
tid = new_tab("https://example.com")  # create + attach
switch_tab(tid)                       # attach harness to tab
cdp("Target.activateTarget", targetId=tid)  # show it in Chrome
print(current_tab())
print(page_info())
```

What CDP is good at:
- attach to a tab
- open a tab
- activate a known target
- inspect URL/title/viewport
- capture the attached tab's screenshot even if another tab is visibly frontmost

What CDP is bad at:
- telling whether the attached target is an omnibox popup / internal page without URL filtering

## Rules that held up in practice

- `Target.activateTarget` is the CDP-side "show this tab" — use it, not just `switch_tab()`, when a tab must become the active one.
- `list_tabs()` includes `chrome://newtab/` by default; ask for `include_chrome=False` when you want only real pages.
- `chrome://omnibox-popup.top-chrome/` can appear as a fake page target; ignore it for user-facing tab lists.
- If a page has `w=0 h=0`, you may be attached to the wrong target or a non-window surface.
- For dynamic UIs, re-read element rects after opening dropdowns / modals before coordinate-clicking.
- `new_tab(url)` always creates and attaches to a fresh tab, even if you already have one open — it never navigates an existing tab. Navigating the tab you're already attached to is `goto_url(url)`. Calling `new_tab()` when you meant `goto_url()` silently leaves a stale tab attached/behind and `page_info()`/`goto_url()` calls will act on the wrong page until you notice and re-attach.
