import rule from '../../src/rules/INVALID_LEDGER_STRUCTURE.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('INVALID_LEDGER_STRUCTURE Rule', () => {
  it('returns null when no ledger file exists', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('returns null for a valid ledger file', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const validLedger = {
      version: '1.0',
      links: {
        'https://example.com': {
          url: 'https://example.com',
          status: 'healthy',
          httpStatus: 200,
          finalUrl: 'https://example.com',
          lastChecked: new Date().toISOString(),
          retryCount: 0
        }
      }
    };
    await createFile(workspace, 'active/test-story/link-status-ledger.json', JSON.stringify(validLedger, null, 2));
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects when the ledger is not valid JSON', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(
      workspace,
      'active/test-story/link-status-ledger.json',
      '{"version": "1.0", "links": {}' // intentionally broken JSON
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/test-story/link-status-ledger.json']);
    expect(violations![0].description).toContain('is not valid JSON');
    await cleanupTestWorkspace(workspace);
  });
  it('detects an invalid version in the ledger', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidLedger = { version: '2.0', links: {} };
    await createFile(workspace, 'active/test-story/link-status-ledger.json', JSON.stringify(invalidLedger, null, 2));
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('version: Invalid literal value, expected "1.0"');
    await cleanupTestWorkspace(workspace);
  });
  it('detects a missing field in a link entry', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidLedger = {
      version: '1.0',
      links: {
        'https://example.com': {
          url: 'https://example.com',
          // status is missing
          httpStatus: 200,
          finalUrl: 'https://example.com',
          lastChecked: new Date().toISOString()
        }
      }
    };
    await createFile(workspace, 'active/test-story/link-status-ledger.json', JSON.stringify(invalidLedger, null, 2));
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('links.https://example.com.status: Required');
    await cleanupTestWorkspace(workspace);
  });
  it('detects an invalid data type for a field', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidLedger = {
      version: '1.0',
      links: {
        'https://example.com': {
          url: 'https://example.com',
          status: 'healthy',
          httpStatus: '200', // should be a number
          finalUrl: 'https://example.com',
          lastChecked: new Date().toISOString(),
          retryCount: 0
        }
      }
    };
    await createFile(workspace, 'active/test-story/link-status-ledger.json', JSON.stringify(invalidLedger, null, 2));
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain(
      'links.https://example.com.httpStatus: Expected number, received string'
    );
    await cleanupTestWorkspace(workspace);
  });
});
