import rule from '../../src/rules/MISSING_REQUIRED_DIRECTORY.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createDirectory } from '../lib/test-workspace.js';
describe('MISSING_REQUIRED_DIRECTORY Rule', () => {
  it('returns null when all required directories exist', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createStory(workspace, 'active', 'story-2');
    await createStory(workspace, 'review', 'story-3');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing agent directories', async () => {
    const workspace = await createTestWorkspace();
    // Create partial story structure
    await createDirectory(workspace, 'active/story-1/sources');
    await createDirectory(workspace, 'active/story-1/essay');
    // Missing agents and subdirectories
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    const agentViolations = violations!.filter((v) => v.location.includes('agents'));
    expect(agentViolations).toHaveLength(3); // agents, agents/messages, agents/performance-reviews
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing source subdirectories', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, 'active/story-1/agents');
    await createDirectory(workspace, 'active/story-1/agents/messages');
    await createDirectory(workspace, 'active/story-1/agents/performance-reviews');
    await createDirectory(workspace, 'active/story-1/sources'); // But no subdirectories
    await createDirectory(workspace, 'active/story-1/essay');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    const sourceViolations = violations!.filter((v) => v.location.includes('sources/'));
    expect(sourceViolations).toHaveLength(5); // documents, interviews, data, synthesis, archives
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing sources/synthesis directory specifically', async () => {
    const workspace = await createTestWorkspace();
    // Create all directories except sources/synthesis
    await createDirectory(workspace, 'active/story-1/agents');
    await createDirectory(workspace, 'active/story-1/agents/messages');
    await createDirectory(workspace, 'active/story-1/agents/performance-reviews');
    await createDirectory(workspace, 'active/story-1/sources');
    await createDirectory(workspace, 'active/story-1/sources/documents');
    await createDirectory(workspace, 'active/story-1/sources/interviews');
    await createDirectory(workspace, 'active/story-1/sources/data');
    await createDirectory(workspace, 'active/story-1/sources/archives');
    await createDirectory(workspace, 'active/story-1/essay');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('active/story-1/sources/synthesis');
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing essay structure', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, 'active/story-1/agents');
    await createDirectory(workspace, 'active/story-1/agents/messages');
    await createDirectory(workspace, 'active/story-1/agents/performance-reviews');
    await createDirectory(workspace, 'active/story-1/sources');
    await createDirectory(workspace, 'active/story-1/sources/documents');
    await createDirectory(workspace, 'active/story-1/sources/interviews');
    await createDirectory(workspace, 'active/story-1/sources/data');
    // Missing essay directory
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    const essayViolations = violations!.filter((v) => v.location.includes('essay'));
    expect(essayViolations).toHaveLength(1); // essay
    await cleanupTestWorkspace(workspace);
  });
  it('detects all missing directories for incomplete story', async () => {
    const workspace = await createTestWorkspace();
    // Create directory to make it a story but no subdirectories
    await createDirectory(workspace, 'active/bare-story');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(10); // All required directories
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    const dirs = ['active', 'published', 'archive'];
    for (const dir of dirs) {
      await createDirectory(workspace, `${dir}/story`);
      // No other directories
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(30); // 10 directories × 3 stories
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden directories', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, 'active/.hidden-story');
    await createDirectory(workspace, 'active/visible-story');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    const visibleViolations = violations!.filter((v) => v.location.includes('visible-story'));
    expect(visibleViolations).toHaveLength(10);
    const hiddenViolations = violations!.filter((v) => v.location.includes('.hidden-story'));
    expect(hiddenViolations).toHaveLength(0);
    await cleanupTestWorkspace(workspace);
  });
  it('handles empty workspace', async () => {
    const workspace = await createTestWorkspace();
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, 'active/test-story');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    const agentViolation = violations!.find((v) => v.location === 'active/test-story/agents');
    expect(agentViolation).toMatchObject({
      code: 'MISSING_REQUIRED_DIRECTORY',
      location: 'active/test-story/agents'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('verifies all required directories in correct order', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, 'active/test-story');
    const violations = await rule.check(workspace);
    const expectedDirs = [
      'agents',
      'agents/messages',
      'agents/performance-reviews',
      'sources',
      'sources/documents',
      'sources/interviews',
      'sources/data',
      'sources/synthesis',
      'sources/archives',
      'essay'
    ];
    const actualDirs = violations!.map((v) => v.location.replace('active/test-story/', ''));
    expect(actualDirs).toEqual(expectedDirs);
    await cleanupTestWorkspace(workspace);
  });
});
