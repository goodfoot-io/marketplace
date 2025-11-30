# Puppeteer Plugin

Browser automation using [Puppeteer](https://pptr.dev/) and Chrome DevTools Protocol (CDP).

## Overview

This plugin provides a skill for controlling browsers programmatically, enabling:

- Navigation and page interaction like a human user
- Screenshots and PDF generation
- Form filling and button clicking
- Network monitoring via CDP
- Session persistence across multiple script executions

## Installation

The plugin requires `puppeteer-core` (connects to existing browser, doesn't bundle Chrome):

```bash
npm install puppeteer-core
```

## Prerequisites

A browser must be running with remote debugging enabled. The skill assumes the browser is already running and will attempt to connect on the default port (9222) or use a user-provided endpoint.

## Skill Structure

```
skills/puppeteer/
├── SKILL.md                    # Main reference (~500 lines)
├── advanced/
│   ├── cdp-domains.md          # CDP protocol domains
│   ├── selectors.md            # Advanced selector patterns
│   └── debugging.md            # Troubleshooting guide
└── tests/
    └── verify-sdk-behavior.ts  # SDK verification script
```

## Usage

### Basic Workflow

1. **First call**: Connect to browser, store `wsEndpoint`
2. **Subsequent calls**: Reconnect using `wsEndpoint`, perform actions
3. **Final call**: Close browser when done

### Example Script

```typescript
import puppeteer from "puppeteer-core";

const BROWSER_URL = process.env.BROWSER_URL || "http://127.0.0.1:9222";
const WS_ENDPOINT = process.env.WS_ENDPOINT;

async function run() {
  // Connect via wsEndpoint if available, otherwise browserURL
  const browser = WS_ENDPOINT
    ? await puppeteer.connect({ browserWSEndpoint: WS_ENDPOINT })
    : await puppeteer.connect({ browserURL: BROWSER_URL });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  await page.goto("https://example.com");
  await page.screenshot({ path: "screenshot.png" });

  // Output wsEndpoint for subsequent calls
  console.log("WS_ENDPOINT=" + browser.wsEndpoint());

  // Disconnect but keep browser running
  await browser.disconnect();
}

run().catch(console.error);
```

### Running Scripts

```bash
# First connection (uses default port 9222)
dotenv -- tsx script.ts

# Subsequent connections (uses stored wsEndpoint)
WS_ENDPOINT=ws://127.0.0.1:9222/devtools/browser/abc123 dotenv -- tsx script.ts

# Custom port
BROWSER_URL=http://127.0.0.1:9333 dotenv -- tsx script.ts
```

## Skill Reference

The main `SKILL.md` covers:

- Connection patterns (default port, custom port, wsEndpoint)
- Session lifecycle (establish, reconnect, close)
- Navigation and waiting
- Element interaction (click, type, selectors)
- Screenshots and PDFs
- CDP sessions for advanced automation
- Error handling

### Advanced Topics

| Document | Content |
|----------|---------|
| `advanced/cdp-domains.md` | Network, Emulation, Runtime, Performance, DOM, Input domains |
| `advanced/selectors.md` | CSS, XPath, text, ARIA, shadow DOM, iframes |
| `advanced/debugging.md` | Connection issues, timeouts, protocol logging |

## Verification

Run the verification script to test SDK behavior:

```bash
BROWSER_URL=http://127.0.0.1:9222 tsx plugins/puppeteer/skills/puppeteer/tests/verify-sdk-behavior.ts
```

## Key Behaviors

| Behavior | Description |
|----------|-------------|
| `browser.disconnect()` | Keeps browser running, can reconnect |
| `browser.close()` | Terminates browser process |
| `wsEndpoint` | Valid while browser is running |
| Pages | Persist across disconnect/reconnect |
| CDP sessions | One per page, detach when done |

## Official Documentation

- [Puppeteer](https://pptr.dev/)
- [Puppeteer API](https://pptr.dev/api)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
