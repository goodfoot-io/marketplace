# @tools/scrape

Web scraping and link checking utilities for the newsroom tools.

## Features

- Link status checking with redirect handling
- Web page scraping with HTML to Markdown conversion
- Browser automation using Playwright
- GitHub Flavored Markdown support

## Usage

```typescript
import { LinkScraper } from '@tools/scrape';

const scraper = new LinkScraper();
await scraper.initialize();

// Check link status
const status = await scraper.checkLinkStatus('https://example.com');
console.log(status); // { status: 200, finalUrl: 'https://example.com' }

// Scrape to markdown
const markdown = await scraper.scrapeToMarkdown('https://example.com');
console.log(markdown);

// Clean up
await scraper.shutdown();
```

## API

### LinkScraper

- `initialize()` - Start the browser instance
- `shutdown()` - Close the browser instance
- `checkLinkStatus(url)` - Check URL status and follow redirects
- `scrapeToMarkdown(url)` - Scrape page content and convert to Markdown

### LinkStatus

```typescript
interface LinkStatus {
  status: number;
  finalUrl: string;
}
```
