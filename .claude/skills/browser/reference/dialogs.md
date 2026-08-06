---
title: Dialogs
summary: Handling browser dialogs (alert, confirm, prompt, beforeunload) during browser automation.
---

# Dialogs

Browser dialogs (`alert`, `confirm`, `prompt`, `beforeunload`) freeze the JS thread. Two approaches depending on timing.

## Detection

`page_info()` auto-surfaces any open dialog: if one is pending it returns `{"dialog": {"type", "message", ...}}` instead of the usual viewport dict (because the page's JS is frozen anyway). So if you call `page_info()` after an action and see a `dialog` key, handle it before doing anything else.

## Proactive: stub via JS (preferred — do this before the triggering click)

Prevents dialogs from ever appearing, so nothing blocks waiting for them. Run this before whatever click/submit would trigger the dialog:

```python
js("""
window.__dialogs__=[];
window.alert=m=>window.__dialogs__.push(String(m));
window.confirm=m=>{window.__dialogs__.push(String(m));return true;};
window.prompt=(m,d)=>{window.__dialogs__.push(String(m));return d||'';};
""")
# ... do actions that trigger dialogs ...
msgs = js("window.__dialogs__||[]")
```

`window.__dialogs__` only proves the stub *ran*, not that the page's own handler saw the result — the stub was installed via a separate `js()` call from the click, so a page that re-evaluates its confirm-handling logic before your stub attaches (or clears it on an intermediate navigation) can leave `__dialogs__` empty even though the click landed. Verify the actual outcome by reading the page's own result element/text after the click, not just `__dialogs__`.

Tradeoffs:
- Stubs are lost on page navigation -- must re-run the snippet
- `confirm()` always returns `true` (auto-approves)
- Detectable by antibot (`window.alert.toString()` reveals non-native code)
- Does NOT handle `beforeunload`

## Reactive: dismiss via CDP

Works even when JS is frozen, and handles `beforeunload` (the proactive stub can't). In practice, calling another helper (e.g. `click_at_xy()`) *while* a dialog is already open and blocking the JS thread can time out — call `cdp("Page.handleJavaScriptDialog", ...)` itself right after the triggering action instead of any helper that touches the page.

```python
# Dismiss and read the message
cdp("Page.handleJavaScriptDialog", accept=True)   # accept / click OK
cdp("Page.handleJavaScriptDialog", accept=False)  # cancel / click Cancel

# Read what the dialog said (from buffered CDP events)
events = drain_events()
for e in events:
    if e["method"] == "Page.javascriptDialogOpening":
        print(e["params"]["type"])     # "alert", "confirm", "prompt", "beforeunload"
        print(e["params"]["message"])  # the dialog text
```

Undetectable by antibot — no JS injected into the page.

## beforeunload specifically

Fires when navigating away from a page with unsaved changes (forms, editors, upload pages). The page freezes until the user clicks Leave/Stay.

```python
# Option A: dismiss after navigating (CDP-level, safe)
goto_url("https://new-url.com")
try:
    cdp("Page.handleJavaScriptDialog", accept=True)  # click "Leave"
except:
    pass  # no dialog — normal

# Option B: prevent before navigating (JS injection, detectable)
js("window.onbeforeunload=null")
goto_url("https://new-url.com")
```
