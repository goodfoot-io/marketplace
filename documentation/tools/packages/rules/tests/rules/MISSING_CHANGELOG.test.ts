import rule from '../../src/rules/MISSING_CHANGELOG.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createStory,
  createDirectory,
  createFile
} from '../lib/test-workspace.js';
describe('MISSING_CHANGELOG Rule', () => {
  it('returns null when stories have changelog.md files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/essay');
    await createFile(workspace, 'active/test-story/essay/changelog.md', '# Version History');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('returns null for stories without essay directories', async () => {
    const workspace = await createTestWorkspace();
    // Create story manually without essay directory
    await createDirectory(workspace, 'active');
    await createDirectory(workspace, 'active/test-story');
    await createFile(workspace, 'active/test-story/.status', 'state: assigned\ncreated: 2025-01-10T10:00:00Z');
    await createDirectory(workspace, 'active/test-story/workspace');
    await createDirectory(workspace, 'active/test-story/sources');
    // Deliberately no essay directory
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing changelog.md in stories with essay directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/essay');
    await createDirectory(workspace, 'active/test-story/essay/working');
    // No changelog.md
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/test-story/essay/changelog.md']);
    expect(violations![0].description).toContain('missing required `essay/changelog.md`');
    await cleanupTestWorkspace(workspace);
  });
  it('detects multiple missing changelogs across stories', async () => {
    const workspace = await createTestWorkspace();
    // Story 1 - missing changelog
    await createStory(workspace, 'active', 'story-one');
    await createDirectory(workspace, 'active/story-one/essay');
    // Story 2 - has changelog
    await createStory(workspace, 'active', 'story-two');
    await createDirectory(workspace, 'active/story-two/essay');
    await createFile(workspace, 'active/story-two/essay/changelog.md', '# History');
    // Story 3 - missing changelog
    await createStory(workspace, 'active', 'story-three');
    await createDirectory(workspace, 'active/story-three/essay');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, [
      'active/story-one/essay/changelog.md',
      'active/story-three/essay/changelog.md'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('works across different story directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'published', 'published-story');
    await createDirectory(workspace, 'published/published-story/essay');
    // No changelog
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['published/published-story/essay/changelog.md']);
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/essay');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'MISSING_CHANGELOG',
      title: 'Missing Version History File',
      severity: 'error'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('handles edge case with complex story structure', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'complex-story');
    await createDirectory(workspace, 'active/complex-story/essay');
    await createDirectory(workspace, 'active/complex-story/essay/working');
    await createDirectory(workspace, 'active/complex-story/essay/v1-20250110-initial');
    await createFile(workspace, 'active/complex-story/essay/v1-20250110-initial/essay.md', 'content');
    // Still missing changelog.md
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/complex-story/essay/changelog.md']);
    await cleanupTestWorkspace(workspace);
  });
});
