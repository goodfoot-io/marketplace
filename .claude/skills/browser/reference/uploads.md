---
title: Uploads
summary: Uploading files during browser automation using JavaScript and the DataTransfer API.
---

# Uploads

`cdp("Input.setInputFiles", ...)` does not work through the `browser-use` helper (fails with a `sessionId` CDP protocol error). Use JS + the `DataTransfer` API instead:

```python
js("""
const input = document.getElementById('file-upload');   // or a more specific selector
const dt = new DataTransfer();
dt.items.add(new File(["file contents"], 'filename.txt', {type: 'text/plain'}));
input.files = dt.files;
""")
```

If the selector is a guess, confirm the element exists first (`js("!!document.getElementById('file-upload')")`) rather than iterating on `Cannot read properties of null` errors. Each `js()` call runs in its own scope, but if you re-paste the same snippet more than once in one call/session, rename `const`/`let` identifiers (or wrap the snippet in an IIFE) to avoid `SyntaxError: redeclaration`.

If the form doesn't auto-submit on file selection, submit it explicitly (target the submit control specifically — a bare `document.querySelector('button')` can grab the wrong button on pages with more than one):

```python
js("document.getElementById('file-submit').click()")
```
