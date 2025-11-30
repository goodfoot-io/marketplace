# CDP Domains Reference

> **Official docs**: https://chromedevtools.github.io/devtools-protocol/

This document covers common Chrome DevTools Protocol domains for advanced browser automation.

## Setup

```typescript
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
const page = (await browser.pages())[0];
const client = await page.createCDPSession();
```

---

## Network Domain {#network}

Intercept and monitor network traffic.

### Enable Network Monitoring

```typescript
await client.send("Network.enable");
```

### Monitor Requests

```typescript
client.on("Network.requestWillBeSent", (event) => {
  console.log("Request:", event.request.method, event.request.url);
  console.log("Headers:", event.request.headers);
});

client.on("Network.responseReceived", (event) => {
  console.log("Response:", event.response.status, event.response.url);
  console.log("Content-Type:", event.response.headers["content-type"]);
});
```

### Block Requests

```typescript
await client.send("Network.setBlockedURLs", {
  urls: ["*.png", "*.jpg", "*analytics*", "*tracking*"]
});
```

### Intercept and Modify Requests

```typescript
await client.send("Fetch.enable", {
  patterns: [{ urlPattern: "*", requestStage: "Request" }]
});

client.on("Fetch.requestPaused", async (event) => {
  // Modify headers
  const headers = event.request.headers;
  headers["X-Custom-Header"] = "value";

  await client.send("Fetch.continueRequest", {
    requestId: event.requestId,
    headers: Object.entries(headers).map(([name, value]) => ({ name, value }))
  });
});
```

### Get Response Body

```typescript
client.on("Network.loadingFinished", async (event) => {
  const response = await client.send("Network.getResponseBody", {
    requestId: event.requestId
  });
  console.log("Body:", response.body);
});
```

---

## Emulation Domain {#emulation}

Override device characteristics.

### Mobile Emulation

```typescript
await client.send("Emulation.setDeviceMetricsOverride", {
  width: 375,
  height: 812,
  deviceScaleFactor: 3,
  mobile: true
});

await client.send("Emulation.setUserAgentOverride", {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15"
});
```

### Geolocation

```typescript
await client.send("Emulation.setGeolocationOverride", {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 100
});
```

### Timezone

```typescript
await client.send("Emulation.setTimezoneOverride", {
  timezoneId: "America/New_York"
});
```

### Touch Events

```typescript
await client.send("Emulation.setTouchEmulationEnabled", {
  enabled: true
});
```

### CPU Throttling

```typescript
await client.send("Emulation.setCPUThrottlingRate", {
  rate: 4  // 4x slowdown
});
```

---

## Runtime Domain {#runtime}

Execute JavaScript and access console.

### Evaluate Expression

```typescript
const result = await client.send("Runtime.evaluate", {
  expression: "document.title",
  returnByValue: true
});
console.log(result.result.value);
```

### Listen to Console

```typescript
await client.send("Runtime.enable");

client.on("Runtime.consoleAPICalled", (event) => {
  const args = event.args.map(a => a.value || a.description).join(" ");
  console.log(`[${event.type}]`, args);
});
```

### Handle Exceptions

```typescript
client.on("Runtime.exceptionThrown", (event) => {
  console.error("Exception:", event.exceptionDetails.text);
});
```

---

## Performance Domain {#performance}

Collect performance metrics.

### Get Metrics

```typescript
await client.send("Performance.enable");

const { metrics } = await client.send("Performance.getMetrics");
for (const metric of metrics) {
  console.log(`${metric.name}: ${metric.value}`);
}
```

### Common Metrics

| Metric | Description |
|--------|-------------|
| `Timestamp` | Current timestamp |
| `Documents` | Number of documents |
| `Frames` | Number of frames |
| `JSEventListeners` | Number of JS event listeners |
| `Nodes` | Number of DOM nodes |
| `LayoutCount` | Total layout operations |
| `JSHeapUsedSize` | Used JS heap in bytes |
| `JSHeapTotalSize` | Total JS heap in bytes |

---

## Page Domain {#page}

Page lifecycle and resources.

### Capture Screenshot (CDP way)

```typescript
const { data } = await client.send("Page.captureScreenshot", {
  format: "png",
  quality: 100,
  fromSurface: true
});

// data is base64 encoded
const buffer = Buffer.from(data, "base64");
```

### Print to PDF

```typescript
const { data } = await client.send("Page.printToPDF", {
  landscape: false,
  displayHeaderFooter: false,
  printBackground: true,
  scale: 1,
  paperWidth: 8.5,
  paperHeight: 11
});
```

### Navigate

```typescript
await client.send("Page.navigate", {
  url: "https://example.com"
});
```

### Get Frame Tree

```typescript
const { frameTree } = await client.send("Page.getFrameTree");
console.log("Main frame:", frameTree.frame.url);
for (const child of frameTree.childFrames || []) {
  console.log("Child frame:", child.frame.url);
}
```

---

## DOM Domain {#dom}

Query and manipulate DOM.

### Get Document

```typescript
const { root } = await client.send("DOM.getDocument");
console.log("Root node ID:", root.nodeId);
```

### Query Selector

```typescript
const { root } = await client.send("DOM.getDocument");
const { nodeId } = await client.send("DOM.querySelector", {
  nodeId: root.nodeId,
  selector: "h1"
});
```

### Get Outer HTML

```typescript
const { outerHTML } = await client.send("DOM.getOuterHTML", {
  nodeId: nodeId
});
console.log(outerHTML);
```

### Set Attribute

```typescript
await client.send("DOM.setAttributeValue", {
  nodeId: nodeId,
  name: "class",
  value: "highlighted"
});
```

---

## Storage Domain {#cookies}

Manage cookies and storage.

### Get Cookies

```typescript
const { cookies } = await client.send("Network.getCookies");
for (const cookie of cookies) {
  console.log(`${cookie.name}=${cookie.value}`);
}
```

### Set Cookie

```typescript
await client.send("Network.setCookie", {
  name: "session",
  value: "abc123",
  domain: "example.com",
  path: "/",
  httpOnly: true,
  secure: true
});
```

### Delete Cookies

```typescript
await client.send("Network.deleteCookies", {
  name: "session",
  domain: "example.com"
});
```

### Clear Browser Data

```typescript
await client.send("Storage.clearDataForOrigin", {
  origin: "https://example.com",
  storageTypes: "cookies,local_storage,session_storage"
});
```

---

## Input Domain {#input}

Synthesize input events.

### Mouse Click

```typescript
await client.send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: 100,
  y: 200,
  button: "left",
  clickCount: 1
});

await client.send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: 100,
  y: 200,
  button: "left",
  clickCount: 1
});
```

### Keyboard Input

```typescript
// Type a character
await client.send("Input.dispatchKeyEvent", {
  type: "keyDown",
  key: "a",
  text: "a"
});

await client.send("Input.dispatchKeyEvent", {
  type: "keyUp",
  key: "a"
});
```

### Insert Text

```typescript
await client.send("Input.insertText", {
  text: "Hello, World!"
});
```

---

## Tracing Domain {#tracing}

Performance tracing.

### Start Trace

```typescript
await client.send("Tracing.start", {
  categories: "devtools.timeline,v8.execute",
  transferMode: "ReturnAsStream"
});
```

### Stop and Get Data

```typescript
const traceComplete = new Promise(resolve => {
  client.on("Tracing.tracingComplete", resolve);
});

await client.send("Tracing.end");
await traceComplete;
```

---

## Security Domain {#security}

Handle security states and certificate errors.

### Ignore Certificate Errors

```typescript
await client.send("Security.setIgnoreCertificateErrors", {
  ignore: true
});
```

---

## Complete Example: Network Monitor

```typescript
import puppeteer from "puppeteer-core";

async function monitorNetwork(wsEndpoint: string, url: string) {
  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  const page = (await browser.pages())[0] || await browser.newPage();
  const client = await page.createCDPSession();

  await client.send("Network.enable");

  const requests: any[] = [];

  client.on("Network.requestWillBeSent", (event) => {
    requests.push({
      url: event.request.url,
      method: event.request.method,
      timestamp: event.timestamp
    });
  });

  client.on("Network.responseReceived", (event) => {
    const req = requests.find(r => r.url === event.response.url);
    if (req) {
      req.status = event.response.status;
      req.contentType = event.response.headers["content-type"];
    }
  });

  await page.goto(url, { waitUntil: "networkidle2" });

  console.log("\n=== Network Requests ===");
  for (const req of requests) {
    console.log(`${req.method} ${req.status || "?"} ${req.url}`);
  }

  await client.detach();
  await browser.disconnect();
}
```
