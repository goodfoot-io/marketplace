---
description: Diagnose VSCode extension performance issues using CDP and code analysis
argument-hint: [symptom-description]
---

## Philosophy: The Cost of Blocking Operations

Performance issues in VSCode extensions compound silently. When code blocks the event loop or makes slow synchronous calls, users experience "laggy" UI without clear error messages. The extension appears functional but frustrating.

**The principle**: The event loop should remain responsive. Operations over 50ms should be async and non-blocking. If you find yourself using `execSync`, `spawnSync`, or tight loops, stop and ask: "What user interaction am I blocking, and for how long?"

---

## Load Prerequisites

Before diagnosing, load the extension-dev skill to get the current browser WebSocket endpoint:

```
/extension-dev
```

This provides `WS_ENDPOINT` and confirms VSCode is accessible via CDP.

---

## Diagnostic Approach

Investigate "$ARGUMENTS" using a combination of runtime diagnostics and static code analysis.

### Phase 1: Runtime Diagnostics via CDP

#### 1.1 Capture Console Errors and Performance Metrics

Run from `/workspace`:

```javascript
// /workspace/diagnose-perf.mjs
import puppeteer from "puppeteer-core";

const WS_ENDPOINT = "WS_ENDPOINT_FROM_SKILL";

const browser = await puppeteer.connect({
  browserWSEndpoint: WS_ENDPOINT,
  defaultViewport: null
});

const pages = await browser.pages();
// Find target page (EDH for extension code, workspace for UI)
let targetPage = pages.find(p => p.title().includes("[Extension Development Host]"))
  || pages.find(p => p.title().includes("(Workspace)"));

const client = await targetPage.createCDPSession();
await client.send("Runtime.enable");
await client.send("Performance.enable");

// Capture initial metrics
const { metrics: initial } = await client.send("Performance.getMetrics");

// Listen for errors
client.on("Runtime.consoleAPICalled", e => {
  if (e.type === "error" || e.type === "warning") {
    console.log(`[${e.type}]`, e.args.map(a => a.value ?? a.description).join(" "));
  }
});

client.on("Runtime.exceptionThrown", e => {
  console.log("[EXCEPTION]", e.exceptionDetails?.text);
});

// Wait and measure
await new Promise(r => setTimeout(r, 10000));

const { metrics: final } = await client.send("Performance.getMetrics");

// Report deltas
const interesting = ["TaskDuration", "ScriptDuration", "LayoutDuration", "JSHeapUsedSize"];
for (const name of interesting) {
  const i = initial.find(m => m.name === name)?.value ?? 0;
  const f = final.find(m => m.name === name)?.value ?? 0;
  console.log(`${name}: ${(f - i).toFixed(2)}`);
}

await client.detach();
await browser.disconnect();
```

**Key metrics to watch**:
- `TaskDuration` > 2s over 10s: Event loop is blocked
- `ScriptDuration` high: Heavy JavaScript execution
- `JSHeapUsedSize` growing: Memory leak potential

#### 1.2 Network Monitoring for Slow Requests

```javascript
await client.send("Network.enable");

client.on("Network.responseReceived", e => {
  // Flag requests over 500ms
  if (e.response.timing?.receiveHeadersEnd > 500) {
    console.log("SLOW:", e.response.url);
  }
});
```

#### 1.3 Trigger the Slow Interaction

While monitoring, reproduce the slow behavior:
- Click the button that feels slow
- Open the panel that takes time to load
- Trigger the command that hangs

---

### Phase 2: Static Code Analysis

Search the codebase for common performance anti-patterns:

#### 2.1 Synchronous Blocking Operations

```bash
# These block the event loop entirely
grep -rn "execSync\|spawnSync" packages/*/src/
grep -rn "fs\.readFileSync\|fs\.writeFileSync" packages/*/src/
```

**Why problematic**: Even 50ms of blocking makes UI feel unresponsive. Multiple sequential calls compound.

#### 2.2 Unbounded Loops and Iterations

```bash
grep -rn "while\s*(" packages/*/src/ | grep -v "test"
grep -rn "\.forEach\|\.map\|\.filter" packages/*/src/ | head -50
```

**Check for**: Loops over large datasets without chunking or yielding.

#### 2.3 Promise.all with Blocking Operations

```bash
grep -rn "Promise\.all" packages/*/src/
```

**Why problematic**: `Promise.all` with sync operations (like `execSync` wrapped in async) still blocks sequentially. The promises resolve in parallel but each sync operation blocks.

#### 2.4 Missing Debouncing/Throttling

```bash
grep -rn "onDidChange\|addEventListener\|\.on\(" packages/*/src/
```

**Check for**: Event handlers that trigger expensive operations without debouncing.

---

### Phase 3: Analysis Structure

For each potential issue found, document:

1. **What operation is slow?**
   - The specific function or code path
   - Estimated duration (measure if possible)

2. **Why is it slow?**
   - Sync I/O blocking event loop
   - Sequential operations that could parallelize
   - Unbounded iteration over large data
   - Missing caching for repeated operations

3. **What's the user impact?**
   - Which UI interactions feel slow?
   - Is the extension unresponsive during this operation?
   - Can users trigger this repeatedly (compounding slowness)?

4. **What's the call chain?**
   - Trace from user action to slow operation
   - Identify if this is on the critical path

---

## Resolution Patterns

### Pattern 1: Convert Sync to Async

```typescript
// BLOCKING
import { execSync } from 'node:child_process';
const result = execSync('git status');

// NON-BLOCKING
import { spawn } from 'node:child_process';
const result = await new Promise((resolve, reject) => {
  const proc = spawn('git', ['status']);
  let output = '';
  proc.stdout.on('data', d => output += d);
  proc.on('close', code => code === 0 ? resolve(output) : reject());
  proc.on('error', reject);
});
```

### Pattern 2: Batch and Chunk Large Operations

```typescript
// BLOCKING - processes all at once
const results = items.map(item => expensiveOperation(item));

// NON-BLOCKING - yields to event loop
async function processInChunks<T>(items: T[], fn: (item: T) => Promise<R>, chunkSize = 10) {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    results.push(...await Promise.all(chunk.map(fn)));
    await new Promise(r => setImmediate(r)); // Yield to event loop
  }
  return results;
}
```

### Pattern 3: Add Debouncing to Event Handlers

```typescript
// EXPENSIVE - fires on every keystroke
editor.onDidChangeContent(() => {
  heavyValidation();
});

// EFFICIENT - waits for typing pause
let timeout: NodeJS.Timeout;
editor.onDidChangeContent(() => {
  clearTimeout(timeout);
  timeout = setTimeout(() => heavyValidation(), 300);
});
```

### Pattern 4: Cache Expensive Computations

```typescript
// SLOW - recomputes every call
async function getCommitInfo(sha: string) {
  return await git.log({ commit: sha });
}

// FAST - caches results
const commitCache = new Map<string, CommitInfo>();
async function getCommitInfo(sha: string) {
  if (!commitCache.has(sha)) {
    commitCache.set(sha, await git.log({ commit: sha }));
  }
  return commitCache.get(sha)!;
}
```

---

## Adding Performance Logging

Use the existing `performanceLogger` infrastructure:

```typescript
import { performanceLogger } from './utils/logger.js';

async function potentiallySlowOperation() {
  const start = performance.now();
  try {
    // ... operation
  } finally {
    const duration = performance.now() - start;
    if (duration > 100) {
      performanceLogger.warn(`[PERF] slowOperation took ${duration.toFixed(0)}ms`);
    }
  }
}
```

For batch operations, log aggregate timing:

```typescript
performanceLogger.debug(`[PERF] Processing ${items.length} items`);
const start = performance.now();
// ... batch operation
performanceLogger.debug(`[PERF] Completed in ${(performance.now() - start).toFixed(0)}ms (${(duration/items.length).toFixed(1)}ms/item)`);
```

---

## Quick Diagnostic Checklist

- [ ] Took screenshot to confirm current UI state
- [ ] Captured console errors/warnings via CDP
- [ ] Measured performance metrics (TaskDuration, ScriptDuration)
- [ ] Monitored network for slow requests
- [ ] Searched for `execSync`/`spawnSync` usage
- [ ] Searched for `Promise.all` with potentially blocking operations
- [ ] Checked event handlers for missing debouncing
- [ ] Traced call chain from user action to slow code

---

## Summary

- **Default**: All I/O should be async
- **Exception**: Sync operations only at startup or in worker threads
- **Always**: Log operations over 100ms
- **Never**: `execSync` on user-triggered code paths
- **Never**: Unbounded loops without yielding
- **Measure**: Use CDP Performance metrics to validate fixes
