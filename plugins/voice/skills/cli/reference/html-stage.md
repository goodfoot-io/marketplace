Use when rendering an HTML document full-viewport behind the voice UI.

## Overview

`voice html` paints an HTML document behind the voice overlays (floating tab, transcript, instructions). The overlays remain above the stage and stay interactive. The stage is an unsandboxed, same-origin iframe — full DOM and script access apply.

**Important:** only absolute URLs or CDN URLs work inside the iframe. The daemon serves no asset server, so relative-path `<script>`/`<link>`/`<img>` references will 404. Use inline styles or CDN-hosted libraries.

## Modes

### File mode (live reload)

```xml
<invoke name="Bash">
<parameter name="command">voice html /absolute/path/to/page.html</parameter>
</invoke>
```

The daemon watches the file and live-reloads every time it is saved — including editor atomic-replace saves. Path is resolved against the CLI's working directory, not the daemon's. An absolute path is safest.

### Stdin mode (piped HTML)

```xml
<invoke name="Bash">
<parameter name="command">cat page.html | voice html</parameter>
</invoke>
```

Or inline:

```xml
<invoke name="Bash">
<parameter name="command">voice html &lt;&lt;'EOF'
&lt;!doctype html&gt;...
EOF</parameter>
</invoke>
```

Stdin is read to EOF when no path argument is given. If the content is non-empty, the stage is set to that document (verbatim). If the content is empty or whitespace-only, the stage is cleared. This works from agents and scripts where stdin is not a TTY.

### Clear (bare invocation)

```xml
<invoke name="Bash">
<parameter name="command">voice html</parameter>
</invoke>
```

Running `voice html` with no argument clears the stage and unmounts the iframe. The browser returns to an empty background.

- **Interactive terminal**: clears immediately — no stdin read, no Ctrl-D required.
- **Non-TTY caller** (agent, script, closed or `/dev/null` stdin): reads stdin to EOF; empty/whitespace clears the stage.

**Path wins** when both a path argument and piped stdin are present.

## When to clear

The stage is a transient aid that tracks the conversation, not a poster that stays up until manually removed. Clear it the moment the visual it carries stops matching what is being discussed. Concretely, issue a bare `voice html` when:

- The conversation moves to a subject the current stage no longer illustrates.
- The user signals they are done with the visual ("you can take that down", or simply moving on).
- The conversation is reset or ended (see §RESET/§END in ./conversation-lifecycle.md).
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
- **Replace, don't stack.** Re-render the stage for the next idea instead of appending to the current one; clear it (bare `voice html`) when the visual is no longer relevant. This pairs with [conversation-lifecycle.md](./conversation-lifecycle.md) and the clearing behaviour above — the stage tracks the conversation, it does not accumulate.
- **Full-bleed, centered.** The body fills the viewport (`min-h-screen`) and the focal content is centered both axes. No top-left document flow, no page margins.
- **Glance-readable type.** Size for reading during speech: headline `text-6xl`–`text-8xl`, body/bullets `text-3xl`–`text-4xl`. A restrained scale — one headline size, one body size — reads as deliberate; many sizes read as a web page.
- **Restraint.** One accent color, generous whitespace, short lines. Words on a slide are a cue for what you are saying, not a transcript of it.

All templates below build only on the [recommended CDN stack](#recommended-cdn-stack) (Tailwind v4 + DaisyUI v5) — no new dependencies, no relative assets. Copy one, fill the marked content, render.

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

## Trust model

The iframe is same-origin (served from the same host as the voice UI) and has no `sandbox` attribute — intentional. Scripts in the injected document can call any browser API, access `window.parent`, and interact with the page. Only inject HTML you control or trust.
