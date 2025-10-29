import rule from '../../src/rules/UNEXPECTED_DIRECTORY.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createStory,
  createDirectory,
  createFile
} from '../lib/test-workspace.js';
describe('UNEXPECTED_DIRECTORY Rule', () => {
  it('returns null when story has proper directory structure', async () => {
    const workspace = await createTestWorkspace();
    // Create proper story structure
    // createStory already creates all required directories
    await createStory(workspace, 'active', 'test-story');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects essay.md/ directory structure violation', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Create invalid essay.md/ directory
    await createDirectory(workspace, 'active/test-story/essay.md');
    await createDirectory(workspace, 'active/test-story/essay.md/reviews');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/test-story/essay.md/']);
    expect(violations![0].description).toContain('appears to be named like a file');
    await cleanupTestWorkspace(workspace);
  });
  it('detects version directories at story root level', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/v1-20250110-initial');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/test-story/v1-20250110-initial/']);
    expect(violations![0].description).toContain('Version directories should be in `essay/`');
    await cleanupTestWorkspace(workspace);
  });
  it('detects reviews directory at story root level', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/reviews');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/test-story/reviews/']);
    expect(violations![0].description).toContain('Reviews should be in `essay/working/reviews/`');
    await cleanupTestWorkspace(workspace);
  });
  it('detects unexpected custom directories at story root', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/custom-dir');
    await createDirectory(workspace, 'active/test-story/temp');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['active/test-story/custom-dir/', 'active/test-story/temp/']);
    await cleanupTestWorkspace(workspace);
  });
  it('detects unexpected directories in essay/', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/essay');
    await createDirectory(workspace, 'active/test-story/essay/backup');
    await createDirectory(workspace, 'active/test-story/essay/old-drafts');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['active/test-story/essay/backup/', 'active/test-story/essay/old-drafts/']);
    await cleanupTestWorkspace(workspace);
  });
  it('allows proper version directories in essay/', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // createStory already creates essay/2501130945-initial
    // Add more valid version directories
    await createDirectory(workspace, 'active/test-story/essay/2501131200-revised');
    await createDirectory(workspace, 'active/test-story/essay/2501131500-fact-checked');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects unexpected directories in sources/', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/sources');
    await createDirectory(workspace, 'active/test-story/sources/documents');
    await createDirectory(workspace, 'active/test-story/sources/backup');
    await createDirectory(workspace, 'active/test-story/sources/temp');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['active/test-story/sources/backup/', 'active/test-story/sources/temp/']);
    await cleanupTestWorkspace(workspace);
  });
  it('allows expected sources subdirectories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // createStory already creates sources subdirectories
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('allows the sources/synthesis directory', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/sources/synthesis');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects unexpected directories in version directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Add unexpected directories in version directory
    await createDirectory(workspace, 'active/test-story/essay/2501130945-initial/backup');
    await createDirectory(workspace, 'active/test-story/essay/2501130945-initial/temp');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, [
      'active/test-story/essay/2501130945-initial/backup/',
      'active/test-story/essay/2501130945-initial/temp/'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('detects unexpected files at story root level', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/draft.md', 'content');
    await createFile(workspace, 'active/test-story/notes.txt', 'content');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['active/test-story/draft.md', 'active/test-story/notes.txt']);
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/essay.md');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'UNEXPECTED_DIRECTORY',
      title: 'Unexpected Directory',
      severity: 'error'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('allows link-status-ledger.json and link-overrides.yaml at story root', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/link-status-ledger.json', '{"version": "1.0", "links": {}}');
    await createFile(workspace, 'active/test-story/link-overrides.yaml', 'overrides: []');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects specialist-feedback as unexpected in agents directory', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/specialist-feedback');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('active/test-story/agents/specialist-feedback/');
    expect(violations![0].description).toContain('Expected: messages/, performance-reviews/');
    await cleanupTestWorkspace(workspace);
  });
  it('allows synthesis-archive.md at the story root', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/synthesis-archive.md', '# Synthesis Archive');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects unexpected review types in review directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Create a version with an invalid review type
    await createDirectory(workspace, 'active/test-story/essay/2501130945-initial/reviews/my-custom-review');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('active/test-story/essay/2501130945-initial/reviews/my-custom-review/');
    expect(violations![0].description).toContain('unexpected review type `my-custom-review/`');
    expect(violations![0].description).toContain(
      'Allowed types: audience, citation, data-translation, editorial, fact-check, final, quality'
    );
    await cleanupTestWorkspace(workspace);
  });
  it('allows all valid review types', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Create all allowed review types
    const allowedTypes = ['audience', 'citation', 'data-translation', 'editorial', 'fact-check', 'final', 'quality'];
    for (const reviewType of allowedTypes) {
      await createDirectory(workspace, `active/test-story/essay/2501130945-initial/reviews/${reviewType}`);
    }
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects multiple unexpected review types', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Create multiple invalid review types
    await createDirectory(workspace, 'active/test-story/essay/2501130945-initial/reviews/custom-review');
    await createDirectory(workspace, 'active/test-story/essay/2501130945-initial/reviews/special-review');
    await createDirectory(workspace, 'active/test-story/essay/2501131200-revised/reviews/another-review');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, [
      'active/test-story/essay/2501130945-initial/reviews/custom-review/',
      'active/test-story/essay/2501130945-initial/reviews/special-review/',
      'active/test-story/essay/2501131200-revised/reviews/another-review/'
    ]);
    await cleanupTestWorkspace(workspace);
  });
});
