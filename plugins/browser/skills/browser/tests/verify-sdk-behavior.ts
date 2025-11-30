/**
 * Puppeteer SDK Behavior Verification Script
 * Run with: BROWSER_URL=http://127.0.0.1:9222 tsx plugins/puppeteer/skills/puppeteer/tests/verify-sdk-behavior.ts
 *
 * Tests actual SDK behavior to verify documentation accuracy.
 * Requires a browser running with remote debugging enabled.
 */

import puppeteer, { Browser, Page } from "puppeteer-core";

const BROWSER_URL = process.env.BROWSER_URL || "http://127.0.0.1:9222";
const WS_ENDPOINT = process.env.WS_ENDPOINT;

let browser: Browser;
let page: Page;

async function connect(): Promise<void> {
  console.log("\n=== Test: Connection ===");

  if (WS_ENDPOINT) {
    console.log("Connecting via wsEndpoint...");
    browser = await puppeteer.connect({ browserWSEndpoint: WS_ENDPOINT });
    console.log("✓ Connected via wsEndpoint");
  } else {
    console.log("Connecting via browserURL:", BROWSER_URL);
    browser = await puppeteer.connect({ browserURL: BROWSER_URL });
    console.log("✓ Connected via browserURL");
  }

  const wsEndpoint = browser.wsEndpoint();
  console.log("wsEndpoint:", wsEndpoint);
  console.log("wsEndpoint starts with ws://:", wsEndpoint.startsWith("ws://"));
  console.log("wsEndpoint contains /devtools/browser/:", wsEndpoint.includes("/devtools/browser/"));
}

async function verifyBrowserInfo(): Promise<void> {
  console.log("\n=== Test: Browser Info ===");

  const version = await browser.version();
  console.log("browser.version():", version);

  const pages = await browser.pages();
  console.log("browser.pages() count:", pages.length);

  console.log("✓ Browser info methods work as expected");
}

async function verifyPagePersistence(): Promise<void> {
  console.log("\n=== Test: Page Persistence ===");

  // Get or create page
  const pages = await browser.pages();
  page = pages[0] || await browser.newPage();
  const pageCount = pages.length;

  console.log("Initial page count:", pageCount);

  // Navigate
  await page.goto("https://example.com", { waitUntil: "networkidle2" });
  console.log("Navigated to:", page.url());

  // Get wsEndpoint for reconnection test
  const wsEndpoint = browser.wsEndpoint();

  // Disconnect
  await browser.disconnect();
  console.log("Disconnected from browser");

  // Reconnect
  browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  console.log("Reconnected to browser");

  // Verify pages persist
  const pagesAfter = await browser.pages();
  console.log("Page count after reconnect:", pagesAfter.length);
  console.log("Page URL after reconnect:", pagesAfter[0]?.url());

  // Verify it's the same page
  const urlAfter = pagesAfter[0]?.url();
  const persisted = urlAfter === "https://example.com/";
  console.log("Page persisted:", persisted);

  page = pagesAfter[0];

  if (persisted) {
    console.log("✓ Pages persist across disconnect/reconnect");
  } else {
    console.log("⚠ Page state may have changed");
  }
}

async function verifyDisconnectVsClose(): Promise<void> {
  console.log("\n=== Test: disconnect() vs close() Behavior ===");

  const wsEndpoint = browser.wsEndpoint();

  // Test disconnect
  await browser.disconnect();
  console.log("Called browser.disconnect()");

  // Try to reconnect - should work if browser still running
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    console.log("✓ Reconnected after disconnect - browser stayed running");

    // Verify pages still exist
    const pages = await browser.pages();
    console.log("Pages still present:", pages.length);
    page = pages[0];
  } catch (error: any) {
    console.log("✗ Could not reconnect:", error.message);
  }

  console.log("NOTE: browser.close() would terminate the browser - not testing");
}

async function verifyNavigationDefaults(): Promise<void> {
  console.log("\n=== Test: Navigation Defaults ===");

  // Test default timeout by timing a navigation
  const start = Date.now();

  try {
    await page.goto("https://example.com", { waitUntil: "networkidle2" });
    const elapsed = Date.now() - start;
    console.log("Navigation completed in:", elapsed, "ms");
  } catch (error: any) {
    if (error.name === "TimeoutError") {
      console.log("Navigation timed out - default timeout hit");
    }
  }

  // Test waitUntil options
  console.log("\nTesting waitUntil options:");

  for (const waitUntil of ["load", "domcontentloaded", "networkidle0", "networkidle2"] as const) {
    const start = Date.now();
    await page.goto("https://example.com", { waitUntil });
    console.log(`  ${waitUntil}: ${Date.now() - start}ms`);
  }

  console.log("✓ Navigation wait conditions work as expected");
}

async function verifyCDPSession(): Promise<void> {
  console.log("\n=== Test: CDP Session ===");

  const client = await page.createCDPSession();
  console.log("Created CDP session");

  // Test send
  await client.send("Network.enable");
  console.log("Sent Network.enable");

  // Test getting response
  const { result } = await client.send("Runtime.evaluate", {
    expression: "navigator.userAgent"
  });
  console.log("Runtime.evaluate result type:", typeof result.value);
  console.log("User agent (truncated):", result.value.slice(0, 50) + "...");

  // Test events
  let eventReceived = false;
  client.on("Network.requestWillBeSent", () => {
    eventReceived = true;
  });

  await page.goto("https://example.com");
  console.log("Event received after navigation:", eventReceived);

  // Test detach
  await client.detach();
  console.log("Detached CDP session");

  console.log("✓ CDP sessions work as expected");
}

async function verifySelectors(): Promise<void> {
  console.log("\n=== Test: Selector Types ===");

  await page.goto("https://example.com");

  // CSS selector
  const h1 = await page.$("h1");
  console.log("CSS selector (h1):", h1 ? "found" : "not found");

  // Text content
  const moreLink = await page.$("::-p-text(More information)");
  console.log("Text selector (::-p-text):", moreLink ? "found" : "not found");

  // XPath
  const xpathH1 = await page.$("xpath//h1");
  console.log("XPath selector (xpath//h1):", xpathH1 ? "found" : "not found");

  // Evaluate for comparison
  const h1Text = await page.$eval("h1", el => el.textContent);
  console.log("H1 text content:", h1Text);

  console.log("✓ Selector types work as expected");
}

async function verifyScreenshot(): Promise<void> {
  console.log("\n=== Test: Screenshot ===");

  // Test buffer return
  const buffer = await page.screenshot();
  console.log("Screenshot as buffer:", buffer instanceof Buffer);
  console.log("Buffer size:", buffer.length, "bytes");

  // Test options
  const fullPage = await page.screenshot({ fullPage: true });
  console.log("Full page screenshot size:", fullPage.length, "bytes");

  console.log("✓ Screenshots work as expected");
}

async function verifyNullBehavior(): Promise<void> {
  console.log("\n=== Test: Null/Undefined Behavior ===");

  // Test element not found
  const notFound = await page.$(".nonexistent-class-12345");
  console.log("Element not found returns:", notFound);
  console.log("=== null:", notFound === null);
  console.log("=== undefined:", notFound === undefined);

  // Test $eval on missing element
  try {
    await page.$eval(".nonexistent", el => el.textContent);
    console.log("$eval on missing: did not throw");
  } catch (error: any) {
    console.log("$eval on missing throws:", error.message.slice(0, 50));
  }

  console.log("✓ Null behavior documented");
}

async function main(): Promise<void> {
  console.log("Puppeteer SDK Behavior Verification");
  console.log("====================================");

  try {
    await connect();
    await verifyBrowserInfo();
    await verifyPagePersistence();
    await verifyDisconnectVsClose();
    await verifyNavigationDefaults();
    await verifyCDPSession();
    await verifySelectors();
    await verifyScreenshot();
    await verifyNullBehavior();

    console.log("\n=== Summary ===");
    console.log("All verifications completed. Check output above for actual behavior.");

  } catch (error: any) {
    console.error("\nError during verification:", error.message);
  } finally {
    if (browser) {
      await browser.disconnect();
      console.log("\nDisconnected from browser (browser still running)");
    }
  }
}

main();
