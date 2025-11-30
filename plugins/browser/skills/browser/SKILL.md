---
name: browser
description: Browser automation using the puppeteer NPM package. Use when
  performing tasks on websites as a user would, taking screenshots, filling
  forms, or navigating web applications.
---

# Puppeteer Reference (SDK)

```!
# === Browser Skill Environment Check ===
BLOCKED=""

# Detect package manager
if [ -f "yarn.lock" ]; then
  PKG_MGR="yarn" PKG_ADD="yarn add" PKG_GLOBAL="yarn global add"
elif [ -f "pnpm-lock.yaml" ]; then
  PKG_MGR="pnpm" PKG_ADD="pnpm add" PKG_GLOBAL="pnpm add -g"
else
  PKG_MGR="npm" PKG_ADD="npm install" PKG_GLOBAL="npm install -g"
fi

# 1. Container detection
CONTAINER_TYPE="" BROWSER_HOST="127.0.0.1"
if [ -f /.dockerenv ] || grep -sq "docker\|containerd" /proc/1/cgroup 2>/dev/null; then
  HOST_IP=$(getent hosts host.docker.internal 2>/dev/null | awk '{print $1}')
  [ -n "$HOST_IP" ] && CONTAINER_TYPE="Docker" && BROWSER_HOST="$HOST_IP"
elif [ -f /run/.containerenv ]; then
  HOST_IP=$(getent hosts host.containers.internal 2>/dev/null | awk '{print $1}')
  [ -n "$HOST_IP" ] && CONTAINER_TYPE="Podman" && BROWSER_HOST="$HOST_IP"
elif grep -sq "microsoft\|WSL" /proc/version 2>/dev/null; then
  HOST_IP=$(ip route show default 2>/dev/null | awk '{print $3}')
  [ -n "$HOST_IP" ] && CONTAINER_TYPE="WSL" && BROWSER_HOST="$HOST_IP"
fi
[ -n "$CONTAINER_TYPE" ] && echo "📦 $CONTAINER_TYPE detected - Host: $BROWSER_HOST"

# 2. Scan common CDP ports
FOUND_PORT=""
for PORT in 9222 9223 9224 9229; do
  CDP_URL="http://${BROWSER_HOST}:${PORT}"
  if CDP_RESPONSE=$(curl -s --connect-timeout 1 "$CDP_URL/json/version" 2>/dev/null) && [ -n "$CDP_RESPONSE" ]; then
    FOUND_PORT=$PORT
    break
  fi
done

if [ -n "$FOUND_PORT" ]; then
  VER=$(echo "$CDP_RESPONSE" | grep -o '"Browser"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"//' | tr -d '"')
  WS=$(echo "$CDP_RESPONSE" | grep -o '"webSocketDebuggerUrl"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"//' | tr -d '"')
  PAGES=$(curl -s "$CDP_URL/json/list" 2>/dev/null | grep -c '"id"' || true)
  [ "$FOUND_PORT" != "9222" ] && echo "ℹ️ Browser on non-standard port $FOUND_PORT"
  echo "✓ Browser ready: $VER ($PAGES page(s))"
  echo "  WS_ENDPOINT=$WS"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: No browser with remote debugging found"
  echo ""
  echo "STOP. Do not attempt browser operations."
  echo "Ask user one of:"
  echo "  1. \"Is Chrome running with remote debugging? If not: chrome --remote-debugging-port=9222\""
  echo "  2. \"If it's on a different port, which port?\" (then retry with that port)"
  echo ""
  echo "Checked ports 9222-9224, 9229 on $BROWSER_HOST"
fi

# 3. Runtime check
if command -v tsx >/dev/null 2>&1; then
  echo "✓ tsx $(tsx --version 2>&1 | head -1)"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: tsx not installed"
  echo "   Cannot execute scripts. Install with: $PKG_GLOBAL tsx"
fi

# 4. Package check
if [ -d "node_modules/puppeteer-core" ]; then
  VER=$(node -p "require('puppeteer-core/package.json').version" 2>/dev/null || echo "?")
  echo "✓ puppeteer-core@$VER"
elif command -v $PKG_MGR >/dev/null 2>&1 && $PKG_MGR list puppeteer-core 2>/dev/null | grep -q puppeteer-core; then
  echo "✓ puppeteer-core ($PKG_MGR)"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: puppeteer-core not installed"
  echo "   Cannot execute scripts. Install with: $PKG_ADD puppeteer-core"
fi

# Final status (must exit 0 to not fail skill load)
if [ -z "$BLOCKED" ]; then
  echo ""
  echo "Ready to execute browser operations."
fi
```

Uses `puppeteer-core` with `tsx`. Run inline scripts using heredocs for top-level await support:

```bash
WS_ENDPOINT="..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({ browserWSEndpoint: process.env.WS_ENDPOINT });
// your code with top-level await
await browser.disconnect();
EOF
```

## Agent Workflow

This skill enables you to control a browser like a human user would. The browser
runs persistently and you reconnect between script executions.

**IMPORTANT**: Use `tsx << 'EOF' ... EOF` heredoc syntax for inline execution with top-level await. The `tsx -e` flag does NOT support top-level await.

### Connection Priority

1. **Use WS_ENDPOINT from environment check above** (if browser detected)
2. **User-provided endpoint** → Use if specified
3. **Ask user** → If connection fails, ask for correct port or wsEndpoint

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ FIRST CALL: Establish session                               │
│   1. Try connecting to browser (user-specified or port 9222)│
│   2. If fails, ask user for correct port/endpoint           │
│   3. Store wsEndpoint for subsequent calls                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ SUBSEQUENT CALLS: Reconnect and continue                    │
│   1. Connect using stored wsEndpoint                        │
│   2. Get existing page or create new                        │
│   3. Perform actions, take screenshots                      │
│   4. Disconnect (keep browser running)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FINAL CALL: Clean up (when task complete)                   │
│   1. Connect using wsEndpoint                               │
│   2. browser.close() to terminate                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Gotchas

| Issue | Reality | Fix |
|-------|---------|-----|
| `disconnect()` vs `close()` | `close()` kills browser, `disconnect()` keeps it | Use `disconnect()` between calls |
| wsEndpoint validity | Valid while browser runs | Store and reuse across calls |
| Page persistence | Pages survive reconnection | Reuse existing pages via `browser.pages()` |
| Port already in use | Another process on 9222 | Ask user for correct port/endpoint |

---

## Connection Patterns

### Connect with Known Endpoint

```bash
# When wsEndpoint is already known (from previous call or user)
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
console.log("Connected to", (await browser.pages())[0]?.url());
await browser.disconnect();
EOF
```

### Pattern 3: Connect with Custom Port/IP

```bash
# When user specifies a different port or IP
BROWSER_IP=192.168.65.254 BROWSER_PORT=9222 tsx << 'EOF'
import puppeteer from "puppeteer-core";
const { BROWSER_IP = "127.0.0.1", BROWSER_PORT = "9222" } = process.env;
const browser = await puppeteer.connect({
  browserURL: `http://${BROWSER_IP}:${BROWSER_PORT}`,
  defaultViewport: null
});
console.log("Connected! WS_ENDPOINT=" + browser.wsEndpoint());
await browser.disconnect();
EOF
```

---

## First Call: Establish Session

Use the `WS_ENDPOINT` from the environment check above, or connect via browserURL:

```bash
# Connect using WS_ENDPOINT from environment check
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = await browser.newPage();

console.log("SESSION_ESTABLISHED");
console.log("WS_ENDPOINT=" + browser.wsEndpoint());
await browser.disconnect();
EOF
```

---

## Subsequent Calls: Reconnect and Act

### Navigate to URL

```bash
# Navigate to a URL and take screenshot
WS_ENDPOINT="ws://..." URL="https://example.com" tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0] || await browser.newPage();

await page.goto(process.env.URL, { waitUntil: "networkidle2", timeout: 30000 });
console.log("Navigated to:", page.url());
console.log("Title:", await page.title());

await page.screenshot({ path: "screenshot.png", captureBeyondViewport: false });
console.log("Screenshot saved: screenshot.png");
await browser.disconnect();
EOF
```

### Take Screenshot of Current Page

```bash
# Screenshot current page state
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];
if (!page) { console.error("No page open"); process.exit(1); }

await page.screenshot({ path: "screenshot.png", captureBeyondViewport: false });
console.log("Current URL:", page.url());
console.log("Screenshot saved: screenshot.png");
await browser.disconnect();
EOF
```

### Click Element

```bash
# Click an element by selector or text
WS_ENDPOINT="ws://..." SELECTOR="button.submit" tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];
const selector = process.env.SELECTOR;

try {
  const element = await page.$(selector);
  if (element) {
    await element.click();
  } else {
    await page.locator(`::-p-text(${selector})`).click();
  }
  console.log("Clicked:", selector);
} catch (e: any) {
  console.error("Could not click:", selector, e.message);
}
await browser.disconnect();
EOF
```

### Type Text

```bash
# Type text into an element
WS_ENDPOINT="ws://..." SELECTOR="input[name=email]" TEXT="user@example.com" tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];

await page.locator(process.env.SELECTOR).fill(process.env.TEXT);
console.log("Typed into", process.env.SELECTOR);
await browser.disconnect();
EOF
```

### Get Page Content

```bash
# Extract text content from page
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];

const content = await page.evaluate(() => ({
  url: window.location.href,
  title: document.title,
  text: document.body.innerText.slice(0, 5000)
}));
console.log(JSON.stringify(content, null, 2));
await browser.disconnect();
EOF
```

---

## Final Call: Close Browser

```bash
# Close the browser session
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({ browserWSEndpoint: process.env.WS_ENDPOINT });
await browser.close();
console.log("Browser closed");
EOF
```

---

## All-in-One Script Template

```bash
# General browser automation - use WS_ENDPOINT from environment check
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});

const page = (await browser.pages())[0] || await browser.newPage();

// ========== YOUR ACTIONS HERE ==========
await page.goto("https://example.com");
await page.screenshot({ path: "result.png", captureBeyondViewport: false });
// ========================================

console.log("WS_ENDPOINT=" + browser.wsEndpoint());
await browser.disconnect();
EOF
```

---

## Selector Reference

| Selector | Example | Use When |
|----------|---------|----------|
| CSS | `"button.submit"` | Element has class/id |
| Text | `"::-p-text(Sign In)"` | Match visible text |
| Aria | `"::-p-aria(Submit)"` | Match accessible name |
| XPath | `"xpath//button[@type='submit']"` | Complex DOM traversal |

### Finding the Right Selector

```bash
# List all interactive elements on the page
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];

const buttons = await page.$$eval("button", els =>
  els.map(el => ({ text: el.textContent?.trim(), classes: el.className }))
);
const links = await page.$$eval("a", els =>
  els.map(el => ({ text: el.textContent?.trim(), href: el.href }))
);
const inputs = await page.$$eval("input", els =>
  els.map(el => ({ name: el.name, id: el.id, type: el.type }))
);

console.log("Buttons:", JSON.stringify(buttons, null, 2));
console.log("Links:", JSON.stringify(links, null, 2));
console.log("Inputs:", JSON.stringify(inputs, null, 2));
await browser.disconnect();
EOF
```

---

## Wait Patterns

```bash
# Wait pattern examples
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];

// Wait for navigation after click
await Promise.all([
  page.waitForNavigation(),
  page.click("a.next-page")
]);

// Wait for element to appear
await page.waitForSelector(".results", { timeout: 10000 });

// Wait for network to settle
await page.goto("https://example.com", { waitUntil: "networkidle2" });

// Wait for custom condition
await page.waitForFunction(() => document.querySelectorAll(".item").length > 10);

await browser.disconnect();
EOF
```

---

## Screenshots & PDFs

### Screenshot Options

```bash
# Various screenshot options
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];

// Viewport only (default)
await page.screenshot({ path: "viewport.png", captureBeyondViewport: false });

// Full page (scrolls entire document)
await page.screenshot({ path: "page.png", fullPage: true });

// As buffer (no file)
const buffer = await page.screenshot();
console.log("Buffer size:", buffer.length);

// Specific element
const element = await page.$(".hero-section");
if (element) await element.screenshot({ path: "element.png" });

// Quality for JPEG/WebP
await page.screenshot({ path: "page.jpg", type: "jpeg", quality: 80 });

await browser.disconnect();
EOF
```

### PDF Generation

```bash
# Generate PDF (requires headless mode)
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];

await page.pdf({
  path: "page.pdf",
  format: "A4",
  printBackground: true,
  margin: { top: "1in", bottom: "1in" }
});
console.log("PDF saved: page.pdf");
await browser.disconnect();
EOF
```

---

## Analyzing Screenshots

When you need to understand what's in a screenshot, use the `browser:screenshot-description` agent first. Only view the image directly with the Read tool if the agent's answer is unclear or insufficient.

### Workflow

1. **First**: Ask the screenshot-description agent
2. **If unclear**: View the image directly with Read tool
3. **Then**: Delete the screenshot file

### Example: Ask Agent First

```xml
<invoke name="Task">
<parameter name="subagent_type">browser:screenshot-description</parameter>
<parameter name="model">haiku</parameter>
<parameter name="prompt">Path: /workspace/screenshot.png
Question: What error message is displayed on the page?</parameter>
</invoke>
```

### Example: Fallback to Direct Viewing

If the agent's response is unclear or you need more detail:

```xml
<invoke name="Read">
<parameter name="file_path">/workspace/screenshot.png</parameter>
</invoke>
```

### Resizing Large Screenshots

Before viewing a screenshot directly, check its dimensions and resize if needed:

1. Run `identify -format "%wx%h" screenshot.png` to get dimensions (e.g., `2400x1800`)
2. If either dimension exceeds 2000px, resize with:
   ```bash
   npx sharp-cli -i screenshot.png -o screenshot.png resize 2000 2000 --fit inside --withoutEnlargement
   ```

Then clean up:

```bash
rm -f /workspace/screenshot.png
```


---

## Evaluate in Page Context

```bash
# Evaluate JavaScript in page context
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];

// Get data from page
const title = await page.evaluate(() => document.title);
console.log("Title:", title);

// With arguments
const text = await page.evaluate(
  (selector) => document.querySelector(selector)?.textContent,
  ".headline"
);
console.log("Headline:", text);

// Complex extraction
const data = await page.evaluate(() => ({
  url: window.location.href,
  links: Array.from(document.querySelectorAll("a"))
    .map(a => ({ href: a.href, text: a.textContent }))
}));
console.log("Data:", JSON.stringify(data, null, 2));

await browser.disconnect();
EOF
```

---

## CDP Sessions

Access raw Chrome DevTools Protocol for advanced automation.

### Create Session and Send Commands

```bash
# CDP session example
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];

const client = await page.createCDPSession();

// Enable a domain
await client.send("Network.enable");

// Command with parameters - emulate mobile device
await client.send("Emulation.setDeviceMetricsOverride", {
  width: 375,
  height: 812,
  deviceScaleFactor: 3,
  mobile: true
});

console.log("Mobile emulation enabled");
await client.detach();
await browser.disconnect();
EOF
```

### Listen for Events

```bash
# Monitor network requests via CDP
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null
});
const page = (await browser.pages())[0];

const client = await page.createCDPSession();
await client.send("Network.enable");

client.on("Network.requestWillBeSent", (event) => {
  console.log("Request:", event.request.url);
});

client.on("Network.responseReceived", (event) => {
  console.log("Response:", event.response.status, event.response.url);
});

// Navigate to trigger events
await page.goto("https://example.com");

await client.detach();
await browser.disconnect();
EOF
```

See **advanced/cdp-domains.md** for full CDP domain reference.

---

## Error Handling

```bash
# Error handling patterns - use WS_ENDPOINT from environment check
WS_ENDPOINT="ws://..." tsx << 'EOF'
import puppeteer from "puppeteer-core";

try {
  const browser = await puppeteer.connect({
    browserWSEndpoint: process.env.WS_ENDPOINT,
    defaultViewport: null
  });
  const page = (await browser.pages())[0];

  // Navigation timeout handling
  try {
    await page.goto("https://slow-site.example.com", { timeout: 30000 });
  } catch (error: any) {
    if (error.name === "TimeoutError") {
      console.error("Page took too long to load");
    }
  }

  // Element not found handling
  const element = await page.$(".might-not-exist");
  if (!element) {
    console.log("Element not found - try different selector");
  }

  await browser.disconnect();
} catch (error: any) {
  if (error.message.includes("ECONNREFUSED") || error.message.includes("WebSocket")) {
    console.error("Could not connect. Check WS_ENDPOINT is valid.");
  } else {
    console.error("Connection error:", error.message);
  }
}
EOF
```

---

## When to Ask the User

| Situation | Question |
|-----------|----------|
| Environment check shows "No browser found" | "Please start Chrome with `--remote-debugging-port=9222`. If using a different port, let me know." |
| Browser on unlisted port | "What port is the browser's remote debugging running on?" |
| WS_ENDPOINT invalid or expired | "Please provide the WebSocket endpoint (starts with `ws://`)" |
| Element not found | "Could not find element. Can you describe what to click?" |

---

## Advanced Topics

| Topic | When to Use | Reference |
|-------|-------------|-----------|
| CDP protocol commands | Network interception, performance | advanced/cdp-domains.md |
| Complex selectors | Shadow DOM, iframes | advanced/selectors.md |
| Debugging | Connection issues, timeouts | advanced/debugging.md |

---

## Official Documentation

- **Puppeteer**: https://pptr.dev/
- **API Reference**: https://pptr.dev/api
- **CDP Protocol**: https://chromedevtools.github.io/devtools-protocol/
