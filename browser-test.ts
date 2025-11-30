import puppeteer from "puppeteer-core";
import { execSync } from "child_process";

(async () => {
  // Auto-detect Docker environment
  let browserIP = "127.0.0.1";
  try {
    browserIP = execSync("getent hosts host.docker.internal", { encoding: "utf8" }).split(/\s+/)[0];
    console.log("Docker detected, using host IP:", browserIP);
  } catch {}

  const browserURL = "http://" + browserIP + ":9222";
  console.log("Connecting to:", browserURL);

  const browser = await puppeteer.connect({ browserURL });
  const page = (await browser.pages())[0] || await browser.newPage();

  // Use CDP to set device metrics override (works with connected browsers)
  const client = await page.createCDPSession();
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });
  console.log("Set device metrics: 1920x1080");

  await page.goto("https://goodfoot.io", { waitUntil: "networkidle2", timeout: 30000 });
  console.log("Navigated to:", page.url());
  console.log("Title:", await page.title());

  await page.screenshot({ path: "/workspace/screenshot.png", fullPage: false });
  console.log("Screenshot saved: /workspace/screenshot.png");

  console.log("WS_ENDPOINT=" + browser.wsEndpoint());
  await browser.disconnect();
})();
