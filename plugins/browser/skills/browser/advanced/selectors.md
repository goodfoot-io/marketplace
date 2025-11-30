# Advanced Selectors Reference

> **Official docs**: https://pptr.dev/guides/query-selectors

This document covers advanced selector patterns for complex DOM structures.

## Selector Types

| Prefix | Type | Example |
|--------|------|---------|
| (none) | CSS | `"button.submit"` |
| `xpath/` | XPath | `"xpath//div[@id='main']"` |
| `::-p-text()` | Text content | `"::-p-text(Sign In)"` |
| `::-p-aria()` | ARIA label/role | `"::-p-aria(Submit button)"` |
| `pierce/` | Shadow DOM piercing | `"pierce/.inner-element"` |

---

## CSS Selectors

### Basic Patterns

```typescript
// By ID
await page.$("#login-form");

// By class
await page.$(".submit-button");

// By attribute
await page.$("[data-testid='submit']");
await page.$("input[type='email']");
await page.$("a[href*='login']");  // Contains "login"

// By tag
await page.$("button");

// Combinations
await page.$("form#login button.primary");
await page.$("div.container > p:first-child");
```

### Attribute Selectors

| Selector | Meaning |
|----------|---------|
| `[attr]` | Has attribute |
| `[attr=value]` | Exact match |
| `[attr^=value]` | Starts with |
| `[attr$=value]` | Ends with |
| `[attr*=value]` | Contains |
| `[attr~=value]` | Word in space-separated list |

```typescript
// Starts with
await page.$("a[href^='https://']");

// Ends with
await page.$("a[href$='.pdf']");

// Contains
await page.$("input[placeholder*='email']");
```

### Pseudo-selectors

```typescript
// Position
await page.$("li:first-child");
await page.$("li:last-child");
await page.$("li:nth-child(3)");
await page.$("li:nth-child(odd)");

// State (limited in Puppeteer)
await page.$("input:disabled");
await page.$("input:checked");

// Negation
await page.$("button:not(.disabled)");
```

---

## XPath Selectors

Use for complex traversal that CSS can't express.

### Basic XPath

```typescript
// By text content
await page.$("xpath//button[text()='Submit']");

// Contains text
await page.$("xpath//button[contains(text(), 'Sign')]");

// By attribute
await page.$("xpath//input[@type='password']");

// By class (contains)
await page.$("xpath//div[contains(@class, 'error')]");
```

### Axes

```typescript
// Parent
await page.$("xpath//span[@class='error']/parent::div");

// Following sibling
await page.$("xpath//label[text()='Email']/following-sibling::input");

// Preceding sibling
await page.$("xpath//button/preceding-sibling::input");

// Ancestor
await page.$("xpath//span[@class='icon']/ancestor::button");

// Descendant
await page.$("xpath//form//input[@type='submit']");
```

### Conditions

```typescript
// Multiple conditions (AND)
await page.$("xpath//input[@type='text' and @name='email']");

// OR conditions
await page.$("xpath//button[@class='primary' or @class='secondary']");

// Position
await page.$("xpath//ul/li[1]");  // First li
await page.$("xpath//ul/li[last()]");  // Last li
await page.$("xpath//ul/li[position() > 2]");  // 3rd and beyond
```

---

## Text Selectors

Match elements by visible text content.

```typescript
// Exact match
await page.locator("::-p-text(Sign In)").click();

// Case-sensitive by default
await page.locator("::-p-text(SUBMIT)").click();

// Works with buttons, links, spans, etc.
await page.locator("::-p-text(Learn more)").click();
```

### Finding by Partial Text

```typescript
// Use XPath for partial text matching
await page.$("xpath//button[contains(text(), 'Sign')]");

// Or find all and filter
const buttons = await page.$$("button");
for (const btn of buttons) {
  const text = await btn.evaluate(el => el.textContent);
  if (text?.includes("Sign")) {
    await btn.click();
    break;
  }
}
```

---

## ARIA Selectors

Match by accessible name or role.

```typescript
// By accessible name
await page.locator("::-p-aria(Submit)").click();
await page.locator("::-p-aria(Close dialog)").click();

// Buttons with aria-label
// <button aria-label="Close">X</button>
await page.locator("::-p-aria(Close)").click();

// Input with associated label
// <label for="email">Email address</label>
// <input id="email">
await page.locator("::-p-aria(Email address)").fill("test@example.com");
```

---

## Shadow DOM

### Pierce Selector

Crosses shadow boundaries.

```typescript
// Element inside shadow DOM
await page.$("pierce/.shadow-inner-class");

// Multiple levels
await page.$("pierce/div.container pierce/span.text");
```

### Manual Shadow DOM Access

```typescript
// Get shadow host
const host = await page.$("custom-element");

// Get shadow root
const shadowRoot = await host.evaluateHandle(el => el.shadowRoot);

// Query inside shadow
const inner = await shadowRoot.$(".inner-element");
```

### Evaluate Inside Shadow DOM

```typescript
const text = await page.evaluate(() => {
  const host = document.querySelector("custom-element");
  const shadow = host?.shadowRoot;
  return shadow?.querySelector(".inner")?.textContent;
});
```

---

## Iframes

### Switch to Iframe

```typescript
// Get iframe element
const frameHandle = await page.$("iframe#content");

// Get frame object
const frame = await frameHandle?.contentFrame();

// Interact within frame
await frame?.click("button.submit");
await frame?.type("#email", "test@example.com");
```

### By Frame Name/URL

```typescript
// By name attribute
const frame = page.frames().find(f => f.name() === "content-frame");

// By URL
const frame = page.frames().find(f => f.url().includes("embed"));
```

### Nested Iframes

```typescript
const outerFrame = await (await page.$("iframe#outer"))?.contentFrame();
const innerFrame = await (await outerFrame?.$("iframe#inner"))?.contentFrame();
await innerFrame?.click("button");
```

---

## Waiting for Selectors

### Wait Options

```typescript
// Basic wait
await page.waitForSelector(".results");

// With timeout
await page.waitForSelector(".results", { timeout: 10000 });

// Wait for visible
await page.waitForSelector(".modal", { visible: true });

// Wait for hidden/removed
await page.waitForSelector(".loading", { hidden: true });
```

### Wait for Multiple Conditions

```typescript
// Wait for any of multiple selectors
const element = await Promise.race([
  page.waitForSelector(".success"),
  page.waitForSelector(".error")
]);

// Wait for all
await Promise.all([
  page.waitForSelector(".header"),
  page.waitForSelector(".content"),
  page.waitForSelector(".footer")
]);
```

---

## Multiple Elements

### Query All

```typescript
// Get all matching elements
const items = await page.$$(".list-item");

// Iterate
for (const item of items) {
  const text = await item.evaluate(el => el.textContent);
  console.log(text);
}

// Get count
console.log("Found:", items.length, "items");
```

### Extract Data from Multiple Elements

```typescript
// Get all link data
const links = await page.$$eval("a", elements =>
  elements.map(el => ({
    text: el.textContent?.trim(),
    href: el.href
  }))
);

// Filter in page context
const externalLinks = await page.$$eval("a", elements =>
  elements
    .filter(el => el.href.startsWith("https://") && !el.href.includes(location.host))
    .map(el => el.href)
);
```

---

## Locators (Recommended)

Modern API with auto-waiting and retries.

### Basic Usage

```typescript
// Click with auto-wait
await page.locator("button.submit").click();

// Fill input
await page.locator("#email").fill("test@example.com");

// Get element handle
const handle = await page.locator(".result").waitHandle();
```

### Locator Options

```typescript
// With timeout
await page.locator(".slow-element").setTimeout(30000).click();

// Visible only
await page.locator(".modal").setVisibility("visible").click();

// Wait for enabled
await page.locator("button").setEnabled(true).click();
```

### Chaining Locators

```typescript
// Find within container
await page
  .locator(".form-container")
  .locator("button[type='submit']")
  .click();
```

---

## Debugging Selectors

### Check if Selector Matches

```typescript
const element = await page.$(selector);
if (element) {
  console.log("Found element");
  const box = await element.boundingBox();
  console.log("Position:", box);
} else {
  console.log("Element not found");
}
```

### List All Matching Elements

```typescript
const count = await page.$$eval(selector, els => els.length);
console.log(`Selector "${selector}" matches ${count} elements`);
```

### Get Element Details

```typescript
const details = await page.$eval(selector, el => ({
  tag: el.tagName,
  id: el.id,
  classes: el.className,
  text: el.textContent?.slice(0, 100),
  visible: el.offsetParent !== null
}));
console.log(details);
```

### Screenshot Element

```typescript
const element = await page.$(selector);
if (element) {
  await element.screenshot({ path: "element-debug.png" });
}
```

---

## Common Patterns

### Form with Labels

```typescript
// Find input by its label text
async function findInputByLabel(page: any, labelText: string) {
  // Try aria first
  try {
    return await page.locator(`::-p-aria(${labelText})`).waitHandle();
  } catch {
    // Fall back to label/for relationship
    const labelId = await page.$eval(
      `xpath//label[contains(text(), '${labelText}')]`,
      (el: HTMLLabelElement) => el.htmlFor
    );
    return await page.$(`#${labelId}`);
  }
}
```

### Table Cell by Row/Column

```typescript
// Get cell at row 2, column 3
const cell = await page.$("table tr:nth-child(2) td:nth-child(3)");

// Get cell by header name
async function getCellByHeader(page: any, row: number, headerText: string) {
  const colIndex = await page.$eval(
    `xpath//th[contains(text(), '${headerText}')]`,
    (el: Element) => Array.from(el.parentElement!.children).indexOf(el) + 1
  );
  return await page.$(`table tr:nth-child(${row}) td:nth-child(${colIndex})`);
}
```

### Dropdown Selection

```typescript
// Native select
await page.select("select#country", "US");

// Custom dropdown
await page.click(".dropdown-trigger");
await page.locator(`::-p-text(United States)`).click();
```
