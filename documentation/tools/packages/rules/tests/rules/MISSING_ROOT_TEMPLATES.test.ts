import rule from '../../src/rules/MISSING_ROOT_TEMPLATES.js';
import { createTestWorkspace, cleanupTestWorkspace, createDirectory } from '../lib/test-workspace.js';
describe('MISSING_ROOT_TEMPLATES Rule', () => {
  it('returns null when _templates directory exists', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, '_templates');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing _templates directory', async () => {
    const workspace = await createTestWorkspace();
    // Don't create _templates directory
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0]).toMatchObject({
      code: 'MISSING_ROOT_TEMPLATES',
      location: '_templates'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing even with other directories present', async () => {
    const workspace = await createTestWorkspace();
    // Create other directories but not _templates
    await createDirectory(workspace, 'active');
    await createDirectory(workspace, 'archive');
    await createDirectory(workspace, 'protocols');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    await cleanupTestWorkspace(workspace);
  });
  it('provides consistent violation structure', async () => {
    const workspace = await createTestWorkspace();
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toHaveProperty('code');
    expect(violation).toHaveProperty('title');
    expect(violation).toHaveProperty('description');
    expect(violation).toHaveProperty('location');
    await cleanupTestWorkspace(workspace);
  });
});
