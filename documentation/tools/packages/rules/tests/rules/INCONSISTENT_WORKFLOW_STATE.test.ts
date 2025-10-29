import rule from '../../src/rules/INCONSISTENT_WORKFLOW_STATE.js';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createStory,
  createFile,
  createDirectory
} from '../lib/test-workspace.js';
describe('INCONSISTENT_WORKFLOW_STATE', () => {
  it('has correct metadata', () => {
    expect(rule.code).toBe('INCONSISTENT_WORKFLOW_STATE');
    expect(rule.title).toBe('Workflow state inconsistency detected');
  });
  it('detects essay.md without research-notes.md', async () => {
    const workspace = await createTestWorkspace();
    // Create minimal story structure without using createStory
    await createDirectory(workspace, 'active/test-story/agents');
    await createDirectory(workspace, 'active/test-story/sources');
    await createDirectory(workspace, 'active/test-story/essay');
    // Create version with essay but no research notes
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft');
    await createFile(workspace, 'active/test-story/essay/2501131445-initial-draft/essay.md', '# Essay');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('missing prerequisite file from Synthesis phase');
    await cleanupTestWorkspace(workspace);
  });
  it('allows essay.md with research-notes.md', async () => {
    const workspace = await createTestWorkspace();
    // Create minimal story structure
    await createDirectory(workspace, 'active/test-story/agents');
    await createDirectory(workspace, 'active/test-story/sources');
    await createDirectory(workspace, 'active/test-story/essay');
    // Create version with both essay and research notes
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft');
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/workspace');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/workspace/research-notes.md',
      '# Research'
    );
    await createFile(workspace, 'active/test-story/essay/2501131445-initial-draft/essay.md', '# Essay');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects reviews without essay.md', async () => {
    const workspace = await createTestWorkspace();
    // Create minimal story structure
    await createDirectory(workspace, 'active/test-story/agents');
    await createDirectory(workspace, 'active/test-story/sources');
    await createDirectory(workspace, 'active/test-story/essay');
    // Create version with reviews but no essay
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft');
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/reviews/editorial');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/reviews/editorial/2501131500.md',
      '# Review'
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('has reviews (editorial) but is missing essay.md');
    await cleanupTestWorkspace(workspace);
  });
  it('detects final review without required verification reviews', async () => {
    const workspace = await createTestWorkspace();
    // Create minimal story structure
    await createDirectory(workspace, 'active/test-story/agents');
    await createDirectory(workspace, 'active/test-story/sources');
    await createDirectory(workspace, 'active/test-story/essay');
    // Create version with essay and final review but missing verification reviews
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft');
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/workspace');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/workspace/research-notes.md',
      '# Research'
    );
    await createFile(workspace, 'active/test-story/essay/2501131445-initial-draft/essay.md', '# Essay');
    // Add final review
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/reviews/final');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/reviews/final/2501131600.md',
      '# Final Review'
    );
    // Add only fact-check, missing citation and quality
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/reviews/fact-check');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/reviews/fact-check/2501131500.md',
      '# Fact Check'
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('missing required verification reviews: citation, quality');
    await cleanupTestWorkspace(workspace);
  });
  it('allows final review with all required verification reviews', async () => {
    const workspace = await createTestWorkspace();
    // Create minimal story structure
    await createDirectory(workspace, 'active/test-story/agents');
    await createDirectory(workspace, 'active/test-story/sources');
    await createDirectory(workspace, 'active/test-story/essay');
    // Create version with essay and all required reviews
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft');
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/workspace');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/workspace/research-notes.md',
      '# Research'
    );
    await createFile(workspace, 'active/test-story/essay/2501131445-initial-draft/essay.md', '# Essay');
    // Add all required verification reviews
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/reviews/fact-check');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/reviews/fact-check/2501131500.md',
      '# Fact Check'
    );
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/reviews/citation');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/reviews/citation/2501131510.md',
      '# Citation'
    );
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/reviews/quality');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/reviews/quality/2501131520.md',
      '# Quality'
    );
    // Add final review
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/reviews/final');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/reviews/final/2501131600.md',
      '# Final Review'
    );
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects data-translation review without fact-check review', async () => {
    const workspace = await createTestWorkspace();
    // Create minimal story structure
    await createDirectory(workspace, 'active/test-story/agents');
    await createDirectory(workspace, 'active/test-story/sources');
    await createDirectory(workspace, 'active/test-story/essay');
    // Create version with essay and data-translation but no fact-check
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft');
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/workspace');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/workspace/research-notes.md',
      '# Research'
    );
    await createFile(workspace, 'active/test-story/essay/2501131445-initial-draft/essay.md', '# Essay');
    // Add data-translation review
    await createDirectory(workspace, 'active/test-story/essay/2501131445-initial-draft/reviews/data-translation');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-initial-draft/reviews/data-translation/2501131500.md',
      '# Data Translation'
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('has data-translation review but is missing fact-check review');
    await cleanupTestWorkspace(workspace);
  });
  it('ignores stories without version directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // No version directories created
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('checks only the latest version directory', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Create older version with invalid state
    await createDirectory(workspace, 'active/test-story/essay/2501131000-old-version');
    await createFile(workspace, 'active/test-story/essay/2501131000-old-version/essay.md', '# Old Essay');
    // Create newer version with valid state
    await createDirectory(workspace, 'active/test-story/essay/2501131445-new-version');
    await createDirectory(workspace, 'active/test-story/essay/2501131445-new-version/workspace');
    await createFile(
      workspace,
      'active/test-story/essay/2501131445-new-version/workspace/research-notes.md',
      '# Research'
    );
    await createFile(workspace, 'active/test-story/essay/2501131445-new-version/essay.md', '# New Essay');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull(); // Should only check the latest version
    await cleanupTestWorkspace(workspace);
  });
});
