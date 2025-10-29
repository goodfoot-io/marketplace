import rule from '../../src/rules/UNEXPECTED_FILE.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('UNEXPECTED_FILE Rule', () => {
  it('returns null when file structure is compliant with the current protocol', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Root
    await createFile(workspace, 'active/test-story/agents/blackboard.yaml', '');
    await createFile(workspace, 'active/test-story/essay/changelog.md', '');
    // Version
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/essay.md', '');
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/rubric.md', '');
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/user-feedback.md', '');
    // Workspace
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/workspace/research-notes.md', '');
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/workspace/outline.md', '');
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/workspace/research-synthesis.md', '');
    // Reviews
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/reviews/editorial/1672531200.md', '');
    // Performance Reviews
    await createFile(workspace, 'active/test-story/agents/performance-reviews/250113-writer.yaml', '');
    // Sources
    await createFile(workspace, 'active/test-story/sources/documents/20250110-report.pdf', '');
    // Link management files (allowed at story root)
    await createFile(workspace, 'active/test-story/link-status-ledger.json', '{}');
    await createFile(workspace, 'active/test-story/link-overrides.yaml', 'overrides: []');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('allows partial-work.md in workspace directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Test that partial-work.md is allowed in workspace directories
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/workspace/partial-work.md', '');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects unexpected files at the story root', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/README.md', '');
    await createFile(workspace, 'active/test-story/notes.txt', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['README.md', 'notes.txt']);
  });
  it('detects legacy .status file as a violation', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/.status', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('.status');
    expect(violations![0].description).toContain('Legacy file `.status` is not allowed');
  });
  it('detects files directly in `essay` directory (except changelog.md)', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/notes.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('essay/notes.md');
  });
  it('detects files directly in version directory (except standard files)', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/extra.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('essay/2501130945-initial/extra.md');
  });
  it('detects invalid filenames in performance-reviews', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Invalid pattern (should be YYMMDD-specialist.yaml)
    await createFile(workspace, 'active/test-story/agents/performance-reviews/writer-review.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('agents/performance-reviews/writer-review.md');
  });
  it('detects invalid filenames in review subdirectories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Invalid pattern (should be timestamp.md)
    await createFile(workspace, 'active/test-story/essay/2501130945-initial/reviews/editorial/feedback.txt', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('essay/2501130945-initial/reviews/editorial/feedback.txt');
  });
  it('detects files directly in sources directory', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/sources/document.pdf', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('sources/document.pdf');
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
  it('enforces date prefix for source subdirectories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Files without date prefix - should be flagged
    await createFile(workspace, 'active/test-story/sources/documents/report.pdf', '');
    await createFile(workspace, 'active/test-story/sources/interviews/transcript.md', '');
    await createFile(workspace, 'active/test-story/sources/data/analysis.csv', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, [
      'sources/documents/report.pdf',
      'sources/interviews/transcript.md',
      'sources/data/analysis.csv'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('accepts properly dated files in source subdirectories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Files with proper date prefix - should be accepted
    await createFile(workspace, 'active/test-story/sources/documents/20250101-report.pdf', '');
    await createFile(workspace, 'active/test-story/sources/interviews/20250102-transcript.md', '');
    await createFile(workspace, 'active/test-story/sources/data/20250103-analysis.csv', '');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('allows any filename in sources/synthesis directory', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Any filename should be allowed in synthesis
    await createFile(workspace, 'active/test-story/sources/synthesis/synthesis-notes.txt', '');
    await createFile(workspace, 'active/test-story/sources/synthesis/combined-research.md', '');
    await createFile(workspace, 'active/test-story/sources/synthesis/20250101-synthesis.md', ''); // With date
    await createFile(workspace, 'active/test-story/sources/synthesis/pattern-analysis.pdf', ''); // Without date
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects unexpected file types in agents/messages', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/agents/messages/notes.txt', 'this should not be here');
    await createFile(workspace, 'active/test-story/agents/messages/20250101T000000-test-test.msg', 'this is fine');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('agents/messages/notes.txt');
    await cleanupTestWorkspace(workspace);
  });
  it('enforces date prefix for archive files in sources/archives', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Files without date prefix - should be flagged
    await createFile(workspace, 'active/test-story/sources/archives/article.md', '');
    await createFile(workspace, 'active/test-story/sources/archives/webpage-archive.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, ['sources/archives/article.md', 'sources/archives/webpage-archive.md']);
    await cleanupTestWorkspace(workspace);
  });
  it('accepts properly dated files in sources/archives', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Files with proper date prefix - should be accepted
    await createFile(workspace, 'active/test-story/sources/archives/20250117-nytimes-article.md', '');
    await createFile(workspace, 'active/test-story/sources/archives/20250117-nature-study-12345.md', '');
    await createFile(workspace, 'active/test-story/sources/archives/20250117-gov-data.md', '');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
});
