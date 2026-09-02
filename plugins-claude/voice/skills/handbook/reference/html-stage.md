Use when rendering an HTML document full-viewport behind the voice UI.

## Overview

`html(...)` paints an HTML document behind the voice overlays (floating tab, transcript, instructions). The overlays remain above the stage and stay interactive. The stage is an unsandboxed, same-origin iframe — full DOM and script access apply.

**Important:** only absolute URLs or CDN URLs work inside the iframe. The server hosts no asset server, so relative-path `<script>`/`<link>`/`<img>` references will 404. Use inline styles or CDN-hosted libraries.

## The model can't see the stage — say what you show

`html(...)` is a *visually-only* primitive. The voice model has zero awareness of the stage: the runtime sends only the session `instructions` to the realtime model, and the stage broadcast to the browser carries only a version number — the HTML body never reaches the model. A user looking at a staged slide who asks "what does this show?" gets an answer untethered from what they see unless you told the model, in words, what is on screen.

So staging a visual is only half the move. Treat it as one habit — **stage and say**: every time you render HTML, in the same step describe what is now on screen with `set({ context })` (the displayed facts/content), and, when the visual should steer the conversation, add `set({ topics })`. See [SKILL.md §CONTEXT / §TOPICS](../SKILL.md#steering-referenced-by-the-guides).

```
html({ path: "/tmp/stage.html" })
set({ context: 'The stage shows a slide titled "Q3 revenue": one figure, $4.2M, up 18% year over year, with the prior-year $3.6M beneath it.' })
```

Keep the spoken description on the **same latest-wins cadence** the stage itself follows (see [When to clear](#when-to-clear)): when you replace the stage, re-describe it; when you clear it, say the visual is gone so the model stops referring to it. A stale description is as incoherent as a stale slide.

## Modes

### File mode (live reload)

The stage is **path-based only** — write the document to a file, then point the stage at it:

```
html({ path: "/absolute/path/to/page.html" })
```

The server watches the file and live-reloads every time it is saved — including editor atomic-replace saves, so you can iterate by rewriting the file. The path is resolved by the server process, so an **absolute path is required** in practice.

### Clear

```
html({})
```

Calling `html` with no `path` clears the stage and unmounts the iframe. The browser returns to an empty background.

## When to clear

The stage is a transient aid that tracks the conversation, not a poster that stays up until manually removed. Clear it the moment the visual it carries stops matching what is being discussed. Concretely, `html({})` when:

- The conversation moves to a subject the current stage no longer illustrates.
- The user signals they are done with the visual ("you can take that down", or simply moving on).
- The conversation is reset or ended (see §RESET / §END in [conversation-lifecycle.md](conversation-lifecycle.md)).
- A new visual is needed — render the replacement directly (latest-wins); do not stack stale stages.

Heuristic: if you can't say why the stage is still up, take it down.

## Recommended CDN stack

Tailwind v4 + DaisyUI v5 loads from CDN with no build step:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body>
  <!-- your content -->
</body>
</html>
```

## Slide-style stages

The stage is read from across a room while you are speaking, not scrolled like a document. Default to a **presentation slide**, not a web page.

**Principles**

- **One idea per stage.** A slide carries a single focal point — one statement, one list, one number, one image. If you have two ideas, render two stages in sequence.
- **Replace, don't stack.** Re-render the stage for the next idea instead of appending; clear it (`html({})`) when the visual is no longer relevant. The stage tracks the conversation, it does not accumulate.
- **Full-bleed, centered.** The body fills the viewport (`min-h-screen`) and the focal content is centered on both axes. No top-left document flow, no page margins.
- **Glance-readable type.** Size for reading during speech: headline `text-6xl`–`text-8xl`, body/bullets `text-3xl`–`text-4xl`. One headline size and one body size reads as deliberate; many sizes read as a web page.
- **Restraint.** One accent color, generous whitespace, short lines. Words on a slide are a cue for what you are saying, not a transcript of it.

All templates below build only on the [recommended CDN stack](#recommended-cdn-stack) — no new dependencies, no relative assets. Copy one, fill the marked content, render.

### Title slide

```html
<!doctype html>
<html data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-16">
  <h1 class="text-8xl font-bold tracking-tight">Main title</h1>
  <p class="text-3xl text-base-content/60">Supporting subtitle or context</p>
</body>
</html>
```

### Key points (bulleted)

```html
<!doctype html>
<html data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="min-h-screen flex flex-col items-center justify-center px-24">
  <div class="max-w-5xl">
    <h2 class="text-6xl font-bold mb-12">Section heading</h2>
    <ul class="space-y-6 text-4xl list-disc list-inside text-base-content/90">
      <li>First key point, kept to one line</li>
      <li>Second key point</li>
      <li>Third key point</li>
    </ul>
  </div>
</body>
</html>
```

### Single big number / stat

```html
<!doctype html>
<html data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="min-h-screen flex flex-col items-center justify-center gap-4 text-center">
  <div class="text-[12rem] leading-none font-bold text-primary">42%</div>
  <p class="text-4xl text-base-content/70">What the number means</p>
</body>
</html>
```

### Image / diagram with caption

Use an absolute or CDN image URL — relative `<img>` paths 404 (see the no-asset-server constraint above).

```html
<!doctype html>
<html data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="min-h-screen flex flex-col items-center justify-center gap-8 px-16">
  <img src="https://example.com/diagram.png" alt="Diagram"
       class="max-h-[70vh] max-w-[80vw] object-contain rounded-lg" />
  <p class="text-3xl text-base-content/70 text-center">Caption describing the image</p>
</body>
</html>
```

## Interactivity (`postMessageToHtml` / `html.message`)

The stage is a two-way channel, not just a poster. You push arbitrary JSON in with `postMessageToHtml({ payload })` — the browser delivers it to the document's `window` `message` event — and the document pushes back out with `window.parent.postMessage(payload, location.origin)`, which arrives to you as an `html.message` channel event (default-watched). Payloads are passed verbatim; you define the contract.

```html
<script>
  // Receive from the colleague:
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin) return;
    render(e.data); // e.g. { highlight: "node-3" }
  });
  // Send back to the colleague (arrives as html.message):
  document.querySelector("#buy").addEventListener("click", () => {
    parent.postMessage({ action: "buy", id: 42 }, location.origin);
  });
</script>
```

`html.click` (element path + position of any click) arrives automatically; `html.message` is for the document's own structured signals. `postMessageToHtml` is a no-op when no HTML is mounted.

## Trust model

The iframe is same-origin (served from the same host as the voice UI) and has no `sandbox` attribute — intentional. Scripts in the injected document can call any browser API, access `window.parent`, and interact with the page. Only inject HTML you control or trust. The inbound `html.message` path accepts only same-origin messages whose source is the live stage window.
