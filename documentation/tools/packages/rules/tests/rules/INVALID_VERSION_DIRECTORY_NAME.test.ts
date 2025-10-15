import rule from '../../src/rules/INVALID_VERSION_DIRECTORY_NAME.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('INVALID_VERSION_DIRECTORY_NAME Rule', () => {
  it('returns null when all version directory names are valid', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/2501100945-initial-research/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501121430-tone-shift/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501151200-new-research/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/changelog.md', '');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects invalid timestamp format', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/version1-initial-draft/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/v1-20250110-initial-draft/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/250110-initial-draft/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('detects invalid timestamp length', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/25011009-initial-draft/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/250110094512-initial-draft/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2025-01-10-0945-initial-draft/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing reason descriptor', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/2501100945-/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    await cleanupTestWorkspace(workspace);
  });
  it('detects single-word reason descriptors', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/2501100945-fix/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501100950-revised/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2); // Both should now be violations
    await cleanupTestWorkspace(workspace);
  });
  it('detects uppercase in reason descriptor', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/2501100945-Initial-Draft/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501100945-REVISED-VERSION/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501100945-Fact-Check-Complete/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('detects avoided temporal terms', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/2501100945-final-version/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501101000-complete-rewrite/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501101015-last-revision/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501101030-finished-draft/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501101045-done-editing/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(5);
    violations!.forEach((v) => {
      expect(v.severity).toBe('warning');
    });
    await cleanupTestWorkspace(workspace);
  });
  it('detects avoided hyperbolic terms', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/2501100945-perfected-version/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501101000-ultimate-draft/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501101015-masterful-revision/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501101030-perfect-edit/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501101045-best-version/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(5);
    violations!.forEach((v) => {
      expect(v.severity).toBe('warning');
    });
    await cleanupTestWorkspace(workspace);
  });
  it('ignores changelog.md file', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/changelog.md', '');
    await createFile(workspace, 'active/test-story/essay/INVALID-VERSION/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toContain('INVALID-VERSION');
    await cleanupTestWorkspace(workspace);
  });
  it('ignores non-version directories and files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/some-other-dir/file.txt', '');
    await createFile(workspace, 'active/test-story/essay/notes.txt', '');
    await createFile(workspace, 'active/test-story/essay/.DS_Store', '');
    await createFile(workspace, 'active/test-story/essay/changelog.md', '');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    const dirs = ['active', 'published', 'archive'];
    for (const dir of dirs) {
      await createStory(workspace, dir, 'story');
      await createFile(workspace, `${dir}/story/essay/invalid-version-name/essay.md`, '');
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('allows valid reason descriptors', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const validReasons = [
      'initial-research',
      'audience-feedback',
      'fact-corrections',
      'major-restructure',
      'citations-added',
      'tone-edited',
      'peer-reviewed',
      'thoroughly-revised',
      'facts-corrected'
    ];
    for (let i = 0; i < validReasons.length; i++) {
      const timestamp = `250110${String(i).padStart(2, '0')}${String(i * 5).padStart(2, '0')}`;
      await createFile(workspace, `active/test-story/essay/${timestamp}-${validReasons[i]}/essay.md`, '');
    }
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles missing essay directory', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Essay directory doesn't exist - test graceful handling
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/bad-version-name/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'INVALID_VERSION_DIRECTORY_NAME',
      location: 'active/test-story/essay/bad-version-name'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('handles special characters in reason descriptor', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/2501100945-fact_check_complete/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501100945-fact.check.complete/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501100945-fact@check@complete/essay.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
});
