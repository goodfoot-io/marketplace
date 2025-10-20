---
name: browser
description: Automate browser tasks including navigation, web scraping, element interaction, screenshots, and page analysis
---

# Browser Automation Tool

This skill provides browser automation capabilities through the `mcp__browser__prompt` tool. Use this tool to interact with web pages, extract information, capture screenshots, test web applications, and automate browser-based workflows.

## When to Use This Tool

Use the browser automation tool when you need to:

1. **Navigate and interact with web pages**
   - Visit URLs and navigate through multi-page flows
   - Click buttons, fill forms, and interact with page elements
   - Handle authentication and login flows

2. **Extract information from web pages**
   - Scrape content from websites (respecting robots.txt and terms of service)
   - Extract structured data from tables, lists, or other elements
   - Monitor changes on web pages

3. **Test web applications**
   - Verify user interface behavior
   - Test interactive features and workflows
   - Validate form submissions and error handling

4. **Capture visual information**
   - Take screenshots of pages or specific elements
   - Debug visual rendering issues
   - Document web application states

5. **Analyze web performance**
   - Monitor page load times
   - Debug console errors
   - Analyze network requests

## When NOT to Use This Tool

**Do not** use the browser automation tool when:

- **Simple HTTP requests suffice**: Use `WebFetch` instead for fetching static page content
- **API endpoints are available**: Prefer direct API calls over browser automation
- **File operations are needed**: Use `Read`, `Write`, `Edit` for file system operations
- **The task requires malicious activity**: Respect website terms of service and legal boundaries

## Tool Usage

The browser automation tool is invoked using the `mcp__browser__prompt` tool with these parameters:

- `prompt` (required): Natural language instructions describing the browser task
- `sessionId` (optional): Session ID for maintaining conversation continuity across multiple interactions

## Examples

### Example 1: Navigate to a website and take a screenshot

```
Task: Visit example.com and take a screenshot of the page

Tool call:
mcp__browser__prompt({
  prompt: "Navigate to https://example.com and take a screenshot of the entire page"
})
```

### Example 2: Extract specific information from a page

```
Task: Get the latest article titles from a news website

Tool call:
mcp__browser__prompt({
  prompt: "Go to https://news.example.com and extract all article titles from the homepage"
})
```

### Example 3: Fill out a form and submit

```
Task: Test a contact form submission

Tool call:
mcp__browser__prompt({
  prompt: "Navigate to https://example.com/contact, fill in the name field with 'Test User', email with 'test@example.com', message with 'This is a test message', and click the submit button. Capture a screenshot of the confirmation page."
})
```

### Example 4: Search and extract results

```
Task: Search for a product and get pricing information

Tool call:
mcp__browser__prompt({
  prompt: "Go to https://shop.example.com, search for 'laptop', wait for results to load, and extract the names and prices of the first 5 products"
})
```

### Example 5: Debug a web page

```
Task: Investigate console errors on a page

Tool call:
mcp__browser__prompt({
  prompt: "Navigate to https://app.example.com/dashboard, open the browser console, and report any JavaScript errors or warnings that appear"
})
```

### Example 6: Multi-step workflow with session continuity

```
Task: Login and navigate to user profile

First interaction:
mcp__browser__prompt({
  prompt: "Go to https://app.example.com/login and fill in username 'testuser' and password from environment. Click login.",
  sessionId: "user-profile-task"
})

Second interaction (continuing same session):
mcp__browser__prompt({
  prompt: "Now navigate to the user profile page and extract the account information displayed",
  sessionId: "user-profile-task"
})
```

### Example 7: Wait for dynamic content

```
Task: Extract data from a page that loads asynchronously

Tool call:
mcp__browser__prompt({
  prompt: "Navigate to https://example.com/data, wait for the loading spinner to disappear and the data table to appear, then extract all rows from the table"
})
```

### Example 8: Interact with modals and popups

```
Task: Handle a cookie consent dialog

Tool call:
mcp__browser__prompt({
  prompt: "Go to https://example.com, wait for the cookie consent popup to appear, click the 'Accept All' button, then take a screenshot of the main page content"
})
```

## Best Practices

1. **Be specific in your prompts**: Clearly describe the elements to interact with, using CSS selectors, text content, or visual descriptions
2. **Handle dynamic content**: Explicitly mention waiting for elements to load or animations to complete
3. **Use sessions for multi-step tasks**: Maintain `sessionId` across related browser interactions
4. **Capture evidence**: Take screenshots to verify successful completion of tasks
5. **Respect rate limits**: Avoid overwhelming websites with rapid requests
6. **Follow ethical guidelines**: Only automate interactions with websites where you have permission

## Troubleshooting

- **Element not found**: Be more specific in describing the element, or wait for page to fully load
- **Timeout errors**: Increase wait time or verify the page loads correctly manually
- **Authentication issues**: Ensure credentials are correct and the login flow is accurately described
- **Dynamic content**: Explicitly instruct the tool to wait for specific elements or events

## Related Tools

- `WebFetch`: For simple HTTP requests to fetch page content without browser rendering
- `WebSearch`: For searching the web and retrieving results
- `Read`: For reading local HTML files
- `Bash`: For running browser automation scripts with tools like Playwright or Puppeteer
