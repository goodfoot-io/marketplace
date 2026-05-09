---
name: puppeteer
description: Use puppeteer to browse websites
---

## Connection

```bash
curl -s --connect-timeout 2 http://127.0.0.1:9222/json/version | head -c 200
```

Empty / `FAILED` output means Chrome was not launched with `--remote-debugging-port=9222` — stop and ask the user.

### Resolve the WS endpoint (do not hardcode the UUID)

The browser UUID changes every launch. Always discover it:

```bash
WS=$(curl -s http://127.0.0.1:9222/json/version | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).webSocketDebuggerUrl))")
echo "$WS"
```

### Connect and navigate

Run from `/workspace` so `puppeteer-core` resolves from the workspace `node_modules`. The heredoc form below uses `tsx` for top-level await; `node --input-type=module` works equivalently.

```bash
WS_ENDPOINT="$WS" tsx << 'EOF'
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserWSEndpoint: process.env.WS_ENDPOINT,
  defaultViewport: null,
});
const page = (await browser.pages())[0] || await browser.newPage();
await page.goto("http://example.com:8080/", { waitUntil: "networkidle2", timeout: 20000 });
console.log(await page.title()); 
await browser.disconnect();        // never close() — keeps Chrome alive for next call
EOF
```
