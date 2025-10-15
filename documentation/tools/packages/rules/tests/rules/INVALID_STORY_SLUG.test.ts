import rule from '../../src/rules/INVALID_STORY_SLUG.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory } from '../lib/test-workspace.js';
describe('INVALID_STORY_SLUG Rule', () => {
  it('returns null when all story slugs are valid', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'valid-story');
    await createStory(workspace, 'active', 'another-valid-story');
    await createStory(workspace, 'active', 'three-word-story');
    await createStory(workspace, 'published', 'this-has-many-words-but-is-still-valid');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects uppercase letters in story slugs', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'Valid-Story');
    await createStory(workspace, 'active', 'UPPERCASE-STORY');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['active/Valid-Story', 'active/UPPERCASE-STORY']);
    await cleanupTestWorkspace(workspace);
  });
  it('detects underscores in story slugs', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story_with_underscores');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/story_with_underscores']);
    await cleanupTestWorkspace(workspace);
  });
  it('detects special characters in story slugs', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story@with#special');
    await createStory(workspace, 'active', 'story.with.dots');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    await cleanupTestWorkspace(workspace);
  });
  it('detects slugs starting or ending with hyphens', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', '-starts-with-hyphen');
    await createStory(workspace, 'active', 'ends-with-hyphen-');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    await cleanupTestWorkspace(workspace);
  });
  it('detects consecutive hyphens', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story--with--double');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'BAD-SLUG');
    await createStory(workspace, 'published', 'Bad-Slug');
    await createStory(workspace, 'archive', 'bad--slug');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', '.hidden-BAD-story');
    await createStory(workspace, 'active', 'visible-BAD-story');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('active/visible-BAD-story');
    await cleanupTestWorkspace(workspace);
  });
  it('handles empty workspace', async () => {
    const workspace = await createTestWorkspace();
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles missing content directories', async () => {
    const workspace = await createTestWorkspace();
    // Only create active directory
    await createStory(workspace, 'active', 'INVALID');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'INVALID-SLUG');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'INVALID_STORY_SLUG',
      location: 'active/INVALID-SLUG',
      severity: 'warning'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('allows single word slugs', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'simple');
    await createStory(workspace, 'active', 'story');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('allows numbers in slugs', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-2024');
    await createStory(workspace, 'active', 'test-123-example');
    await createStory(workspace, 'active', '2024-yearly-report');
    const violations = await rule.check(workspace);
    // Numbers are now allowed in story slugs
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
});
