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

Stdin is used when no path argument is given and stdin is not a TTY.

### Clear (bare invocation)

```xml
<invoke name="Bash">
<parameter name="command">voice html</parameter>
</invoke>
```

Running `voice html` with no argument and no piped input clears the stage and unmounts the iframe. The browser returns to an empty background.

**Path wins** when both a path argument and piped stdin are present.

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

## Trust model

The iframe is same-origin (served from the same host as the voice UI) and has no `sandbox` attribute — intentional. Scripts in the injected document can call any browser API, access `window.parent`, and interact with the page. Only inject HTML you control or trust.
