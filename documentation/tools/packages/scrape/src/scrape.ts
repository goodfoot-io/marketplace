import { gfm } from '@joplin/turndown-plugin-gfm';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import TurndownService from 'turndown';

export interface LinkStatus {
  status: number;
  finalUrl: string;
}

export class LinkScraper {
  private browser: Browser | null = null;

  private turndown: TurndownService;

  constructor() {
    // Configure Turndown with GFM support

    this.turndown = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*'
    });

    // Add GitHub Flavored Markdown support
    this.turndown.use(gfm);
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
      });
    }
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async checkLinkStatus(url: string): Promise<LinkStatus> {
    if (!this.browser) {
      throw new Error('LinkScraper not initialized. Call initialize() first.');
    }

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // Create a new browser context for isolation
      context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (compatible; Newsroom-LinkChecker/1.0)'
      });

      page = await context.newPage();

      // Navigate to the URL with timeout
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      if (!response) {
        // No response object (rare edge case)
        return {
          status: 503,
          finalUrl: url
        };
      }

      // Get the final URL after any redirects
      const finalUrl = page.url();
      const status = response.status();

      return {
        status,
        finalUrl
      };
    } catch (error) {
      // Handle network errors gracefully
      console.error(`Error checking ${url}:`, error);
      return {
        status: 503, // Service Unavailable for network errors
        finalUrl: url
      };
    } finally {
      // Clean up resources
      if (page) {
        await page.close();
      }
      if (context) {
        await context.close();
      }
    }
  }

  async scrapeToMarkdown(url: string): Promise<string> {
    if (!this.browser) {
      throw new Error('LinkScraper not initialized. Call initialize() first.');
    }

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (compatible; Newsroom-LinkChecker/1.0)'
      });

      page = await context.newPage();

      // Navigate and wait for content
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Extract main content, removing scripts, styles, and ads
      const html = await page.evaluate(() => {
        // Remove unwanted elements
        const selectorsToRemove = [
          'script',
          'style',
          '.ad',
          '.advertisement',
          '[class*="ad-"]',
          '[id*="ad-"]',
          'iframe[src*="doubleclick"]',
          'iframe[src*="googlesyndication"]'
        ];

        selectorsToRemove.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => el.remove());
        });

        // Try to find main content areas
        const contentSelectors = [
          'main',
          'article',
          '[role="main"]',
          '.main-content',
          '#main-content',
          '.post-content',
          '.entry-content'
        ];

        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element.innerHTML;
          }
        }

        // Fallback to body if no main content found
        return document.body.innerHTML;
      });

      // Convert to markdown
      return this.turndown.turndown(html);
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
      if (context) {
        await context.close();
      }
    }
  }
}
