import rule from '../../src/rules/LEGACY_AGENTS_DIRECTORY_FOUND.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createDirectory } from '../lib/test-workspace.js';
describe('LEGACY_AGENTS_DIRECTORY_FOUND Rule', () => {
  it('returns null when no legacy .agents directories exist', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects .agents directory in story root', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/.agents');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/test-story/.agents']);
    expect(violations![0].description).toContain(
      'Legacy hidden directory `.agents/` found in story `test-story`. Should be renamed to `agents/`'
    );
    await cleanupTestWorkspace(workspace);
  });
  it('detects multiple stories with legacy directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createDirectory(workspace, 'active/story-1/.agents');
    await createStory(workspace, 'active', 'story-2');
    await createDirectory(workspace, 'active/story-2/.agents');
    await createStory(workspace, 'published', 'story-3');
    await createDirectory(workspace, 'published/story-3/.agents');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createDirectory(workspace, 'active/story-1/.agents');
    await createStory(workspace, 'published', 'story-2');
    await createDirectory(workspace, 'published/story-2/.agents');
    await createStory(workspace, 'archive', 'story-3');
    await createDirectory(workspace, 'archive/story-3/.agents');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, [
      'active/story-1/.agents',
      'published/story-2/.agents',
      'archive/story-3/.agents'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/.agents');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'LEGACY_AGENTS_DIRECTORY_FOUND',
      title: 'Legacy Agents Directory Found',
      severity: 'error'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('ignores stories without .agents directory', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createDirectory(workspace, 'active/story-1/agents');
    await createStory(workspace, 'active', 'story-2');
    await createDirectory(workspace, 'active/story-2/sources');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles story directories with both .agents and agents', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/.agents');
    await createDirectory(workspace, 'active/test-story/agents');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/test-story/.agents']);
    await cleanupTestWorkspace(workspace);
  });
});
