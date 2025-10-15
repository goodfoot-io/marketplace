import rule from '../../src/rules/DUPLICATE_TEMPLATES_DIR.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createDirectory, createStory } from '../lib/test-workspace.js';
describe('DUPLICATE_TEMPLATES_DIR Rule', () => {
  it('returns null when no duplicate _templates directories exist', async () => {
    const workspace = await createTestWorkspace();
    // Create root _templates directory (allowed)
    await createDirectory(workspace, '_templates');
    await createDirectory(workspace, '_templates/personas');
    await createDirectory(workspace, '_templates/rubrics');
    await createDirectory(workspace, '_templates/workflows');
    // Create some stories without _templates
    await createStory(workspace, 'active', 'test-story-1');
    await createStory(workspace, 'active', 'test-story-2');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects duplicate _templates at content directory level', async () => {
    const workspace = await createTestWorkspace();
    // Create duplicate _templates in content directories
    await createDirectory(workspace, 'active/_templates');
    await createDirectory(workspace, 'review/_templates');
    await createDirectory(workspace, 'published/_templates');
    await createDirectory(workspace, 'archive/_templates');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(4);
    expectViolationLocations(violations, [
      'active/_templates',
      'review/_templates',
      'published/_templates',
      'archive/_templates'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('detects duplicate _templates inside story directories', async () => {
    const workspace = await createTestWorkspace();
    // Create stories with duplicate _templates
    await createStory(workspace, 'active', 'story-1');
    await createDirectory(workspace, 'active/story-1/_templates');
    await createStory(workspace, 'review', 'story-2');
    await createDirectory(workspace, 'review/story-2/_templates');
    await createStory(workspace, 'published', 'story-3');
    await createDirectory(workspace, 'published/story-3/_templates');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, [
      'active/story-1/_templates',
      'review/story-2/_templates',
      'published/story-3/_templates'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('detects both content-level and story-level duplicate _templates', async () => {
    const workspace = await createTestWorkspace();
    // Mix of both types
    await createDirectory(workspace, 'active/_templates');
    await createStory(workspace, 'active', 'story-1');
    await createDirectory(workspace, 'active/story-1/_templates');
    await createDirectory(workspace, 'review/_templates');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, ['active/_templates', 'active/story-1/_templates', 'review/_templates']);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden directories when searching for stories', async () => {
    const workspace = await createTestWorkspace();
    // Create hidden directory that should be ignored
    await createDirectory(workspace, 'active/.hidden-story');
    await createDirectory(workspace, 'active/.hidden-story/_templates');
    // Create normal story with duplicate
    await createStory(workspace, 'active', 'visible-story');
    await createDirectory(workspace, 'active/visible-story/_templates');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('active/visible-story/_templates');
    await cleanupTestWorkspace(workspace);
  });
  it('handles missing content directories gracefully', async () => {
    const workspace = await createTestWorkspace();
    // Only create some content directories
    await createDirectory(workspace, 'active');
    await createDirectory(workspace, 'active/_templates');
    // review, published, archive don't exist
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('active/_templates');
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, 'active/_templates');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'DUPLICATE_TEMPLATES_DIR',
      location: 'active/_templates',
      severity: 'error'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('handles empty workspace', async () => {
    const workspace = await createTestWorkspace();
    // No directories at all
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('correctly identifies all content directories', async () => {
    const workspace = await createTestWorkspace();
    // Create all content directories with duplicates
    const contentDirs = ['active', 'review', 'published', 'archive'];
    for (const dir of contentDirs) {
      await createDirectory(workspace, dir);
      await createDirectory(workspace, `${dir}/_templates`);
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(4);
    const locations = violations!.map((v) => v.location).sort();
    expect(locations).toEqual(['active/_templates', 'archive/_templates', 'published/_templates', 'review/_templates']);
    await cleanupTestWorkspace(workspace);
  });
  it('handles deeply nested story structures', async () => {
    const workspace = await createTestWorkspace();
    // Create nested stories (though not typical, should still be handled)
    await createStory(workspace, 'active', 'parent-story');
    await createDirectory(workspace, 'active/parent-story/nested');
    await createDirectory(workspace, 'active/parent-story/nested/_templates');
    const violations = await rule.check(workspace);
    // Should not detect nested/_templates as it's not a direct story subdirectory
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
});
