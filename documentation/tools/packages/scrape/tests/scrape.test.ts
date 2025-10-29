import { createTestServer, TestServer } from './lib/test-helpers.js';
import { LinkScraper } from '../src/scrape.js';

describe('LinkScraper', () => {
  describe('checkLinkStatus', () => {
    it('should return status 200 for a healthy link', async () => {
      let testServer: TestServer | null = null;
      let scraper: LinkScraper | null = null;
      try {
        testServer = await createTestServer();
        scraper = new LinkScraper();
        await scraper.initialize();

        const result = await scraper.checkLinkStatus(`${testServer.url}/ok`);

        expect(result.status).toBe(200);
        expect(result.finalUrl).toBe(`${testServer.url}/ok`);
      } finally {
        await testServer?.close();
        await scraper?.shutdown();
      }
    });

    it('should handle redirects and return the final status and URL', async () => {
      let testServer: TestServer | null = null;
      let scraper: LinkScraper | null = null;
      try {
        testServer = await createTestServer();
        scraper = new LinkScraper();
        await scraper.initialize();

        const result = await scraper.checkLinkStatus(`${testServer.url}/redirect`);

        expect(result.status).toBe(200);
        expect(result.finalUrl).toBe(`${testServer.url}/ok`);
      } finally {
        await testServer?.close();
        await scraper?.shutdown();
      }
    });

    it('should return status 404 for a not-found link', async () => {
      let testServer: TestServer | null = null;
      let scraper: LinkScraper | null = null;
      try {
        testServer = await createTestServer();
        scraper = new LinkScraper();
        await scraper.initialize();

        const result = await scraper.checkLinkStatus(`${testServer.url}/not-found`);

        expect(result.status).toBe(404);
        expect(result.finalUrl).toBe(`${testServer.url}/not-found`);
      } finally {
        await testServer?.close();
        await scraper?.shutdown();
      }
    });

    it('should return status 503 for a server error', async () => {
      let testServer: TestServer | null = null;
      let scraper: LinkScraper | null = null;
      try {
        testServer = await createTestServer();
        scraper = new LinkScraper();
        await scraper.initialize();

        const result = await scraper.checkLinkStatus(`${testServer.url}/server-error`);

        expect(result.status).toBe(503);
        expect(result.finalUrl).toBe(`${testServer.url}/server-error`);
      } finally {
        await testServer?.close();
        await scraper?.shutdown();
      }
    });

    it('should return status 503 for a network error (e.g., invalid domain)', async () => {
      let scraper: LinkScraper | null = null;
      try {
        scraper = new LinkScraper();
        await scraper.initialize();

        const result = await scraper.checkLinkStatus('http://localhost:9999/invalid');

        expect(result.status).toBe(503);
        expect(result.finalUrl).toBe('http://localhost:9999/invalid');
      } finally {
        await scraper?.shutdown();
      }
    });
  });

  describe('scrapeToMarkdown', () => {
    it('should convert simple HTML to markdown', async () => {
      let testServer: TestServer | null = null;
      let scraper: LinkScraper | null = null;
      try {
        testServer = await createTestServer();
        scraper = new LinkScraper();
        await scraper.initialize();

        testServer.app.get('/simple', (req, res) => {
          res.send('<html><body><h1>Title</h1><p>Hello, world!</p></body></html>');
        });

        const markdown = await scraper.scrapeToMarkdown(`${testServer.url}/simple`);

        expect(markdown.trim()).toBe('# Title\n\nHello, world!');
      } finally {
        await testServer?.close();
        await scraper?.shutdown();
      }
    });

    it('should extract main content and convert to markdown', async () => {
      let testServer: TestServer | null = null;
      let scraper: LinkScraper | null = null;
      try {
        testServer = await createTestServer();
        scraper = new LinkScraper();
        await scraper.initialize();

        testServer.app.get('/article', (req, res) => {
          res.send(`
            <html>
              <head><title>Test Article</title></head>
              <body>
                <header>Site Header</header>
                <nav>Navigation</nav>
                <main>
                  <h1>Article Title</h1>
                  <p>This is the main content.</p>
                  <script>console.log("script")</script>
                </main>
                <footer>Site Footer</footer>
              </body>
            </html>
          `);
        });

        const markdown = await scraper.scrapeToMarkdown(`${testServer.url}/article`);

        expect(markdown.trim()).toBe('# Article Title\n\nThis is the main content.');
      } finally {
        await testServer?.close();
        await scraper?.shutdown();
      }
    });
  });
});
