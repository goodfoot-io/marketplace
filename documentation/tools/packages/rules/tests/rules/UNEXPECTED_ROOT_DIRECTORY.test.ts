import rule from '../../src/rules/UNEXPECTED_ROOT_DIRECTORY.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createDirectory } from '../lib/test-workspace.js';
describe('UNEXPECTED_ROOT_DIRECTORY Rule', () => {
  it('returns null when only allowed directories exist', async () => {
    const workspace = await createTestWorkspace();
    // Create allowed directories
    await createDirectory(workspace, 'active');
    await createDirectory(workspace, 'published');
    await createDirectory(workspace, 'archive');
    await createDirectory(workspace, '_templates');
    await createDirectory(workspace, 'protocols');
    await createDirectory(workspace, 'documentation');
    await createDirectory(workspace, 'analysis');
    await createDirectory(workspace, 'tools');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects unexpected directories at workspace root', async () => {
    const workspace = await createTestWorkspace();
    // Create some allowed directories
    await createDirectory(workspace, 'active');
    await createDirectory(workspace, 'published');
    // Create unexpected directories
    await createDirectory(workspace, 'review');
    await createDirectory(workspace, 'drafts');
    await createDirectory(workspace, 'temp');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, ['review', 'drafts', 'temp']);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden directories', async () => {
    const workspace = await createTestWorkspace();
    // Create allowed directories
    await createDirectory(workspace, 'active');
    // Create hidden directories (should be ignored)
    await createDirectory(workspace, '.git');
    await createDirectory(workspace, '.vscode');
    await createDirectory(workspace, '.claude');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects review directory as unexpected', async () => {
    const workspace = await createTestWorkspace();
    // Create the specific case we found
    await createDirectory(workspace, 'review');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('Unexpected directory `review/`');
    expect(violations![0].location).toBe('review');
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, 'unexpected-dir');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations![0]).toMatchObject({
      code: 'UNEXPECTED_ROOT_DIRECTORY',
      title: 'Unexpected Root Directory',
      severity: 'warning'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('lists all allowed directories in violation message', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, 'bad-directory');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    const message = violations![0].description;
    // Check that all allowed directories are mentioned
    expect(message).toContain('active');
    expect(message).toContain('published');
    expect(message).toContain('archive');
    expect(message).toContain('tools');
    expect(message).toContain('_templates');
    expect(message).toContain('protocols');
    expect(message).toContain('documentation');
    expect(message).toContain('analysis');
    await cleanupTestWorkspace(workspace);
  });
  it('handles mixed allowed and unexpected directories', async () => {
    const workspace = await createTestWorkspace();
    // Mix of allowed and unexpected
    await createDirectory(workspace, 'active');
    await createDirectory(workspace, 'review');
    await createDirectory(workspace, 'published');
    await createDirectory(workspace, 'drafts');
    await createDirectory(workspace, '_templates');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['review', 'drafts']);
    await cleanupTestWorkspace(workspace);
  });
  it('handles empty workspace', async () => {
    const workspace = await createTestWorkspace();
    // Don't create any directories
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects system directories used incorrectly', async () => {
    const workspace = await createTestWorkspace();
    // These are allowed, but let's test a typo
    await createDirectory(workspace, 'protocol'); // Should be 'protocols'
    await createDirectory(workspace, 'docs'); // Should be 'documentation'
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['protocol', 'docs']);
    await cleanupTestWorkspace(workspace);
  });
  it('is case sensitive for directory names', async () => {
    const workspace = await createTestWorkspace();
    // Wrong case
    await createDirectory(workspace, 'Active'); // Should be 'active'
    await createDirectory(workspace, 'PUBLISHED'); // Should be 'published'
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['Active', 'PUBLISHED']);
    await cleanupTestWorkspace(workspace);
  });
});
