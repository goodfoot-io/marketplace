# Debugging Guide

Troubleshooting common issues with Puppeteer and CDP connections.

## Connection Issues

### ECONNREFUSED

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:9222`

**Causes**:
1. Browser not running with remote debugging
2. Wrong port number
3. Browser crashed

**Solutions**:
```typescript
// Ask user for correct port
console.error("Could not connect. Please confirm the remote debugging port.");

// Try alternative ports
const ports = [9222, 9223, 9224, 9515];
for (const port of ports) {
  try {
    const browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${port}`
    });
    console.log("Connected on port", port);
    return browser;
  } catch {
    continue;
  }
}
```

### Invalid WebSocket Endpoint

**Symptom**: `WebSocket is not open` or invalid wsEndpoint errors

**Causes**:
1. Browser was closed/crashed
2. wsEndpoint expired
3. Malformed wsEndpoint URL

**Solutions**:
```typescript
// Validate wsEndpoint format
function isValidWsEndpoint(url: string): boolean {
  return url.startsWith("ws://") && url.includes("/devtools/browser/");
}

// Re-establish connection
async function reconnect(browserURL: string) {
  const browser = await puppeteer.connect({ browserURL });
  const newEndpoint = browser.wsEndpoint();
  console.log("New WS_ENDPOINT=" + newEndpoint);
  return browser;
}
```

---

## Navigation Issues

### Timeout Errors

**Symptom**: `TimeoutError: Navigation timeout of 30000 ms exceeded`

**Causes**:
1. Slow network/server
2. Page never finishes loading (infinite spinners)
3. Wrong waitUntil condition

**Solutions**:
```typescript
// Increase timeout
await page.goto(url, { timeout: 60000 });

// Use different wait condition
await page.goto(url, { waitUntil: "domcontentloaded" });  // Faster
await page.goto(url, { waitUntil: "networkidle0" });     // Wait for all network

// Handle timeout gracefully
try {
  await page.goto(url, { timeout: 30000 });
} catch (error: any) {
  if (error.name === "TimeoutError") {
    console.log("Page load timed out, continuing anyway...");
    // Page might still be usable
  } else {
    throw error;
  }
}
```

### Navigation Interrupted

**Symptom**: `Navigation failed because page crashed` or navigation interrupted

**Causes**:
1. Page redirected during navigation
2. JavaScript error crashed the page
3. Out of memory

**Solutions**:
```typescript
// Handle redirects
await page.goto(url, { waitUntil: "networkidle2" });
console.log("Final URL:", page.url());  // May differ from original

// Listen for crashes
page.on("error", (err) => {
  console.error("Page crashed:", err);
});
```

---

## Element Issues

### Element Not Found

**Symptom**: `null` returned or timeout waiting for selector

**Causes**:
1. Element doesn't exist
2. Element not yet rendered
3. Element is in iframe
4. Element is in shadow DOM

**Debug Steps**:
```typescript
// 1. Check if page loaded
console.log("Current URL:", page.url());
console.log("Title:", await page.title());

// 2. Search for similar elements
const allButtons = await page.$$eval("button", els =>
  els.map(el => ({
    text: el.textContent?.trim(),
    classes: el.className,
    id: el.id
  }))
);
console.log("All buttons:", allButtons);

// 3. Check for iframes
const frames = page.frames();
console.log("Frames:", frames.map(f => f.url()));

// 4. Take screenshot to see current state
await page.screenshot({ path: "debug.png", fullPage: true });
```

### Element Not Clickable

**Symptom**: Click seems to do nothing or clicks wrong element

**Causes**:
1. Element covered by overlay
2. Element not in viewport
3. Element disabled
4. Another element receiving click

**Solutions**:
```typescript
// Scroll element into view
await page.$eval(selector, el => el.scrollIntoView({ block: "center" }));

// Wait for element to be clickable
await page.waitForSelector(selector, { visible: true });

// Check if element is covered
const isClickable = await page.$eval(selector, el => {
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const topElement = document.elementFromPoint(centerX, centerY);
  return el.contains(topElement) || el === topElement;
});

// Force click via JavaScript
await page.$eval(selector, (el: HTMLElement) => el.click());
```

---

## Protocol Debugging

### Enable CDP Logging

Set environment variable before running:

```bash
DEBUG=puppeteer:* tsx script.ts
```

Or more specifically:
```bash
DEBUG=puppeteer:protocol:SEND tsx script.ts  # Outgoing
DEBUG=puppeteer:protocol:RECV tsx script.ts  # Incoming
DEBUG=puppeteer:protocol:* tsx script.ts     # Both
```

### Log All CDP Messages

```typescript
const client = await page.createCDPSession();

// Monkey-patch send to log
const originalSend = client.send.bind(client);
client.send = async (method: string, params?: any) => {
  console.log("CDP SEND:", method, params);
  const result = await originalSend(method, params);
  console.log("CDP RECV:", method, result);
  return result;
};
```

### Monitor All Events

```typescript
// Log all CDP events (verbose!)
const client = await page.createCDPSession();

// Enable domains you're interested in
await client.send("Network.enable");
await client.send("Page.enable");
await client.send("Runtime.enable");

// Catch-all listener (internal API, may break)
(client as any)._connection.on("message", (msg: string) => {
  const parsed = JSON.parse(msg);
  if (parsed.method) {  // It's an event
    console.log("EVENT:", parsed.method);
  }
});
```

---

## Performance Issues

### Slow Script Execution

**Causes**:
1. Too many screenshots
2. Waiting too long between actions
3. Large page with heavy JavaScript

**Solutions**:
```typescript
// Disable images for faster loading
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (["image", "font", "stylesheet"].includes(req.resourceType())) {
    req.abort();
  } else {
    req.continue();
  }
});

// Or via CDP
const client = await page.createCDPSession();
await client.send("Network.setBlockedURLs", {
  urls: ["*.png", "*.jpg", "*.gif", "*.css", "*.woff*"]
});
```

### Memory Issues

```typescript
// Close pages you're done with
const pages = await browser.pages();
for (const p of pages.slice(1)) {  // Keep first page
  await p.close();
}

// Force garbage collection (if Node started with --expose-gc)
if (global.gc) {
  global.gc();
}
```

---

## Common Error Messages

### "Execution context was destroyed"

**Cause**: Page navigated while script was running

**Solution**:
```typescript
// Wait for navigation to complete before interacting
await page.waitForNavigation();

// Or handle the error
try {
  await page.evaluate(() => /* something */);
} catch (error: any) {
  if (error.message.includes("context was destroyed")) {
    // Page navigated, re-query elements
  }
}
```

### "Protocol error: Target closed"

**Cause**: Page or browser closed unexpectedly

**Solution**:
```typescript
// Check if browser is connected
if (!browser.isConnected()) {
  // Reconnect
  browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
}

// Check if page is closed
const pages = await browser.pages();
if (!pages.includes(page)) {
  // Page was closed, create new or get existing
  page = pages[0] || await browser.newPage();
}
```

### "Node is detached from document"

**Cause**: Element was removed from DOM after you found it

**Solution**:
```typescript
// Re-query the element
const element = await page.$(selector);
if (!element) {
  console.log("Element no longer exists");
  return;
}

// Or use locators (auto-retry)
await page.locator(selector).click();
```

---

## Diagnostic Script

Run this to diagnose connection and page state:

```typescript
import puppeteer from "puppeteer-core";

async function diagnose(wsEndpoint?: string, browserURL?: string) {
  console.log("=== Puppeteer Diagnostics ===\n");

  // Connection test
  console.log("1. Testing connection...");
  let browser;
  try {
    if (wsEndpoint) {
      browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
      console.log("   Connected via wsEndpoint");
    } else {
      const url = browserURL || "http://127.0.0.1:9222";
      browser = await puppeteer.connect({ browserURL: url });
      console.log("   Connected via browserURL:", url);
    }
  } catch (error: any) {
    console.error("   Connection FAILED:", error.message);
    return;
  }

  // Browser info
  console.log("\n2. Browser info:");
  console.log("   Version:", await browser.version());
  console.log("   wsEndpoint:", browser.wsEndpoint());

  // Pages
  const pages = await browser.pages();
  console.log("\n3. Open pages:", pages.length);
  for (const [i, p] of pages.entries()) {
    console.log(`   [${i}] ${p.url()}`);
  }

  // Test page
  if (pages.length > 0) {
    const page = pages[0];
    console.log("\n4. Current page diagnostics:");
    console.log("   URL:", page.url());
    console.log("   Title:", await page.title());

    // Viewport
    const viewport = page.viewport();
    console.log("   Viewport:", viewport?.width, "x", viewport?.height);

    // Try screenshot
    try {
      await page.screenshot({ path: "diagnostic.png" });
      console.log("   Screenshot: saved to diagnostic.png");
    } catch (error: any) {
      console.log("   Screenshot: FAILED -", error.message);
    }
  }

  console.log("\n=== Diagnostics complete ===");
  await browser.disconnect();
}

// Run with: WS_ENDPOINT=ws://... tsx diagnose.ts
// Or: BROWSER_URL=http://... tsx diagnose.ts
diagnose(process.env.WS_ENDPOINT, process.env.BROWSER_URL);
```

---

## Useful Environment Variables

| Variable | Purpose |
|----------|---------|
| `DEBUG=puppeteer:*` | Enable all Puppeteer debug output |
| `DEBUG=puppeteer:protocol:*` | Log CDP messages |
| `PUPPETEER_EXECUTABLE_PATH` | Override Chrome path |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | Don't download Chrome |

---

## Getting Help

1. **Check page state**: Take screenshot, log URL and title
2. **Check console**: Listen for `console` and `pageerror` events
3. **Check network**: Enable Network domain, look for failed requests
4. **Simplify**: Test with minimal script on simple page first
5. **Official docs**: https://pptr.dev/troubleshooting
