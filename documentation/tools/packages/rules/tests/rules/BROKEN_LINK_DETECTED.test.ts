// Express typing for test server routes
import rule from '../../src/rules/BROKEN_LINK_DETECTED.js';
import { createTestServer, TestServer } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile, readFile } from '../lib/test-workspace.js';
const LATEST_ESSAY_PATH = 'essay/2501010100-test/essay.md';
interface LedgerLink {
  status: 'healthy' | 'broken' | 'redirect';
  httpStatus: number;
  lastChecked: string;
}
interface Ledger {
  links: Record<string, LedgerLink>;
}
describe('BROKEN_LINK_DETECTED Rule', () => {
  let testServer: TestServer;
  const setup = async () => {
    testServer = await createTestServer();
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(
      workspace,
      'active/test-story/agents/blackboard.yaml',
      `project_metadata:\n  latest_file: ${LATEST_ESSAY_PATH}`
    );
    return { workspace, serverUrl: testServer.url, app: testServer.app };
  };
  const teardown = async (workspace: string) => {
    await cleanupTestWorkspace(workspace);
    await testServer.close();
  };
  it('returns null when no links are present', async () => {
    const { workspace } = await setup();
    await createFile(workspace, `active/test-story/${LATEST_ESSAY_PATH}`, 'No links here.');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await teardown(workspace);
  });
  it('returns null for a healthy, new link', async () => {
    const { workspace, serverUrl } = await setup();
    await createFile(workspace, `active/test-story/${LATEST_ESSAY_PATH}`, `A [healthy link](${serverUrl}/ok).`);
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await teardown(workspace);
  });
  it('detects a broken link', async () => {
    const { workspace, serverUrl } = await setup();
    await createFile(workspace, `active/test-story/${LATEST_ESSAY_PATH}`, `A [broken link](${serverUrl}/not-found).`);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain(`Broken link detected: \`${serverUrl}/not-found\``);
    await teardown(workspace);
  });
  it('creates a ledger file after checking a link', async () => {
    const { workspace, serverUrl } = await setup();
    await createFile(workspace, `active/test-story/${LATEST_ESSAY_PATH}`, `[link](${serverUrl}/ok)`);
    await rule.check(workspace);
    const ledgerContent = await readFile(workspace, 'active/test-story/link-status-ledger.json');
    const ledger = JSON.parse(ledgerContent) as Ledger;
    expect(ledger.links[`${serverUrl}/ok`]).toBeDefined();
    expect(ledger.links[`${serverUrl}/ok`].status).toBe('healthy');
    await teardown(workspace);
  });
  describe('Bare URL extraction', () => {
    it('correctly extracts complete URLs with periods in bare format', async () => {
      const { workspace } = await setup();
      await createFile(
        workspace,
        `active/test-story/${LATEST_ESSAY_PATH}`,
        `Check out https://www.example.com for more info. Also see https://pmc.ncbi.nlm.nih.gov/articles/123`
      );
      await rule.check(workspace);
      // Read ledger to verify URLs were extracted correctly
      const ledgerContent = await readFile(workspace, 'active/test-story/link-status-ledger.json');
      const ledger = JSON.parse(ledgerContent) as Ledger;
      // These URLs should be extracted in full, not truncated at the first period
      expect(ledger.links['https://www.example.com']).toBeDefined();
      expect(ledger.links['https://pmc.ncbi.nlm.nih.gov/articles/123']).toBeDefined();
      // These incomplete URLs should NOT exist in the ledger
      expect(ledger.links['https://www']).toBeUndefined();
      expect(ledger.links['https://pmc']).toBeUndefined();
      await teardown(workspace);
    });
    it('handles URLs with multiple subdomains correctly', async () => {
      const { workspace } = await setup();
      await createFile(
        workspace,
        `active/test-story/${LATEST_ESSAY_PATH}`,
        `Visit https://en.wikipedia.org/wiki/Test and https://www.sciencedirect.com/science/article/123`
      );
      await rule.check(workspace);
      const ledgerContent = await readFile(workspace, 'active/test-story/link-status-ledger.json');
      const ledger = JSON.parse(ledgerContent) as Ledger;
      expect(ledger.links['https://en.wikipedia.org/wiki/Test']).toBeDefined();
      expect(ledger.links['https://www.sciencedirect.com/science/article/123']).toBeDefined();
      expect(ledger.links['https://en']).toBeUndefined();
      expect(ledger.links['https://www']).toBeUndefined();
      await teardown(workspace);
    });
    it('correctly stops URL extraction at appropriate boundaries', async () => {
      const { workspace } = await setup();
      await createFile(
        workspace,
        `active/test-story/${LATEST_ESSAY_PATH}`,
        `URLs in text: https://example.com, https://test.org; and (https://wrapped.com) or https://end.com.`
      );
      await rule.check(workspace);
      const ledgerContent = await readFile(workspace, 'active/test-story/link-status-ledger.json');
      const ledger = JSON.parse(ledgerContent) as Ledger;
      // URLs should be extracted without trailing punctuation
      expect(ledger.links['https://example.com']).toBeDefined();
      expect(ledger.links['https://test.org']).toBeDefined();
      expect(ledger.links['https://wrapped.com']).toBeDefined();
      expect(ledger.links['https://end.com']).toBeDefined();
      // URLs should not include trailing punctuation
      expect(ledger.links['https://example.com,']).toBeUndefined();
      expect(ledger.links['https://test.org;']).toBeUndefined();
      expect(ledger.links['https://end.com.']).toBeUndefined();
      await teardown(workspace);
    });
  });
  describe('State-Aware TTL Logic', () => {
    const fortyNineHoursAgo = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    it('re-checks a healthy link in "active" if older than 48 hours', async () => {
      const { workspace, serverUrl, app } = await setup();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      app.get('/changing-link', (req: any, res: any) => res.status(404).send('Not Found'));
      const initialLedger = {
        version: '1.0',
        links: {
          [`${serverUrl}/changing-link`]: {
            url: `${serverUrl}/changing-link`,
            status: 'healthy',
            httpStatus: 200,
            finalUrl: `${serverUrl}/changing-link`,
            lastChecked: fortyNineHoursAgo,
            retryCount: 0
          }
        }
      };
      await createFile(workspace, 'active/test-story/link-status-ledger.json', JSON.stringify(initialLedger));
      await createFile(workspace, `active/test-story/${LATEST_ESSAY_PATH}`, `[link](${serverUrl}/changing-link)`);
      const violations = await rule.check(workspace);
      expect(violations).not.toBeNull();
      expect(violations![0].description).toContain('Broken link detected');
      const updatedLedger = JSON.parse(
        await readFile(workspace, 'active/test-story/link-status-ledger.json')
      ) as Ledger;
      expect(updatedLedger.links[`${serverUrl}/changing-link`].status).toBe('broken');
      expect(updatedLedger.links[`${serverUrl}/changing-link`].httpStatus).toBe(404);
      await teardown(workspace);
    });
    it('does NOT check any links in "published" directory', async () => {
      const { workspace, serverUrl, app } = await setup();
      // This endpoint should not be called since published stories are skipped entirely
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      app.get('/stable-link', (req: any, res: any) => res.status(500).send('Should not be called'));
      // Create published story (no blackboard needed since directory is skipped)
      await createStory(workspace, 'published', 'test-story');
      await createFile(workspace, `published/test-story/${LATEST_ESSAY_PATH}`, `[link](${serverUrl}/stable-link)`);
      await createFile(
        workspace,
        'published/test-story/agents/blackboard.yaml',
        `project_metadata:\n  latest_file: ${LATEST_ESSAY_PATH}`
      );
      // Create ledger with old data (should remain untouched)
      const initialLedger = {
        version: '1.0',
        links: {
          [`${serverUrl}/stable-link`]: {
            url: `${serverUrl}/stable-link`,
            status: 'healthy',
            httpStatus: 200,
            finalUrl: `${serverUrl}/stable-link`,
            lastChecked: fortyNineHoursAgo,
            retryCount: 0
          }
        }
      };
      await createFile(workspace, 'published/test-story/link-status-ledger.json', JSON.stringify(initialLedger));
      const violations = await rule.check(workspace);
      expect(violations).toBeNull();
      // Ledger should be completely unchanged since published directory is skipped
      const ledger = JSON.parse(await readFile(workspace, 'published/test-story/link-status-ledger.json')) as Ledger;
      expect(ledger.links[`${serverUrl}/stable-link`].httpStatus).toBe(200); // Should be unchanged
      expect(ledger.links[`${serverUrl}/stable-link`].lastChecked).toBe(fortyNineHoursAgo); // Should be unchanged
      await teardown(workspace);
    });
    it('does NOT check any links in "archive" directory', async () => {
      const { workspace, serverUrl, app } = await setup();
      // This endpoint should not be called since archive stories are skipped entirely
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      app.get('/archived-link', (req: any, res: any) => res.status(500).send('Should not be called'));
      // Create archive story (no blackboard needed since directory is skipped)
      await createStory(workspace, 'archive', 'old-story');
      await createFile(workspace, `archive/old-story/${LATEST_ESSAY_PATH}`, `[link](${serverUrl}/archived-link)`);
      await createFile(
        workspace,
        'archive/old-story/agents/blackboard.yaml',
        `project_metadata:\n  latest_file: ${LATEST_ESSAY_PATH}`
      );
      // Create ledger with old data (should remain untouched)
      const initialLedger = {
        version: '1.0',
        links: {
          [`${serverUrl}/archived-link`]: {
            url: `${serverUrl}/archived-link`,
            status: 'broken',
            httpStatus: 404,
            finalUrl: `${serverUrl}/archived-link`,
            lastChecked: fortyNineHoursAgo,
            retryCount: 0
          }
        }
      };
      await createFile(workspace, 'archive/old-story/link-status-ledger.json', JSON.stringify(initialLedger));
      const violations = await rule.check(workspace);
      expect(violations).toBeNull();
      // Ledger should be completely unchanged since archive directory is skipped
      const ledger = JSON.parse(await readFile(workspace, 'archive/old-story/link-status-ledger.json')) as Ledger;
      expect(ledger.links[`${serverUrl}/archived-link`].status).toBe('broken'); // Should remain broken
      expect(ledger.links[`${serverUrl}/archived-link`].httpStatus).toBe(404); // Should be unchanged
      expect(ledger.links[`${serverUrl}/archived-link`].lastChecked).toBe(fortyNineHoursAgo); // Should be unchanged
      await teardown(workspace);
    });
    it('skips link checking for published stories with broken links', async () => {
      const { workspace, serverUrl } = await setup();
      // Create published story with a broken link
      await createStory(workspace, 'published', 'finished-story');
      await createFile(
        workspace,
        `published/finished-story/${LATEST_ESSAY_PATH}`,
        `This essay has a [broken link](${serverUrl}/broken-404) that should not be checked.`
      );
      await createFile(
        workspace,
        'published/finished-story/agents/blackboard.yaml',
        `project_metadata:\n  latest_file: ${LATEST_ESSAY_PATH}`
      );
      const violations = await rule.check(workspace);
      expect(violations).toBeNull();
      await teardown(workspace);
    });
    it('skips link checking for archive stories with broken links', async () => {
      const { workspace, serverUrl } = await setup();
      // Create archive story with a broken link
      await createStory(workspace, 'archive', 'ancient-story');
      await createFile(
        workspace,
        `archive/ancient-story/${LATEST_ESSAY_PATH}`,
        `This essay has a [broken link](${serverUrl}/broken-404) that should not be checked.`
      );
      await createFile(
        workspace,
        'archive/ancient-story/agents/blackboard.yaml',
        `project_metadata:\n  latest_file: ${LATEST_ESSAY_PATH}`
      );
      const violations = await rule.check(workspace);
      expect(violations).toBeNull();
      await teardown(workspace);
    });
    it('only checks links in active stories', async () => {
      const { workspace, serverUrl } = await setup();
      // Create active story with broken link (should be checked)
      await createFile(
        workspace,
        `active/test-story/${LATEST_ESSAY_PATH}`,
        `Active story with [broken link](${serverUrl}/broken-404).`
      );
      // Create published story with broken link (should NOT be checked)
      await createStory(workspace, 'published', 'pub-story');
      await createFile(
        workspace,
        `published/pub-story/${LATEST_ESSAY_PATH}`,
        `Published story with [broken link](${serverUrl}/broken-404).`
      );
      await createFile(
        workspace,
        'published/pub-story/agents/blackboard.yaml',
        `project_metadata:\n  latest_file: ${LATEST_ESSAY_PATH}`
      );
      // Create archive story with broken link (should NOT be checked)
      await createStory(workspace, 'archive', 'arch-story');
      await createFile(
        workspace,
        `archive/arch-story/${LATEST_ESSAY_PATH}`,
        `Archive story with [broken link](${serverUrl}/broken-404).`
      );
      await createFile(
        workspace,
        'archive/arch-story/agents/blackboard.yaml',
        `project_metadata:\n  latest_file: ${LATEST_ESSAY_PATH}`
      );
      const violations = await rule.check(workspace);
      // Should only detect the broken link in the active story
      expect(violations).not.toBeNull();
      expect(violations).toHaveLength(1);
      expect(violations![0].location).toContain('active/test-story');
      expect(violations![0].location).not.toContain('published');
      expect(violations![0].location).not.toContain('archive');
      await teardown(workspace);
    });
    it('respects 48-hour TTL for active stories only', async () => {
      const { workspace, serverUrl } = await setup();
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      // Create active story with recently checked healthy link
      const activeLedger = {
        version: '1.0',
        links: {
          [`${serverUrl}/ok`]: {
            url: `${serverUrl}/ok`,
            status: 'healthy',
            httpStatus: 200,
            finalUrl: `${serverUrl}/ok`,
            lastChecked: oneHourAgo,
            retryCount: 0
          }
        }
      };
      await createFile(workspace, 'active/test-story/link-status-ledger.json', JSON.stringify(activeLedger));
      await createFile(workspace, `active/test-story/${LATEST_ESSAY_PATH}`, `[link](${serverUrl}/ok)`);
      const violations = await rule.check(workspace);
      expect(violations).toBeNull();
      // Verify the link was NOT re-checked (should still have the old timestamp)
      const updatedLedger = JSON.parse(
        await readFile(workspace, 'active/test-story/link-status-ledger.json')
      ) as Ledger;
      expect(updatedLedger.links[`${serverUrl}/ok`].lastChecked).toBe(oneHourAgo);
      await teardown(workspace);
    });
  });
});
