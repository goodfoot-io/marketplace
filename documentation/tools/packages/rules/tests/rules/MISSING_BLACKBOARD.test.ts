import rule from '../../src/rules/MISSING_BLACKBOARD.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createStory,
  createFile,
  deleteFile
} from '../lib/test-workspace.js';
describe('MISSING_BLACKBOARD Rule', () => {
  it('returns null when all stories have blackboard files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createStory(workspace, 'active', 'story-2');
    await createStory(workspace, 'review', 'story-3');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing blackboard files', async () => {
    const workspace = await createTestWorkspace();
    // Create stories with blackboard files present
    await createStory(workspace, 'active', 'story-1');
    // Create stories without blackboard files
    await createStory(workspace, 'active', 'story-2');
    await deleteFile(workspace, 'active/story-2/agents/blackboard.yaml');
    await createStory(workspace, 'archive', 'story-3');
    await deleteFile(workspace, 'archive/story-3/agents/blackboard.yaml');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, [
      'active/story-2/agents/blackboard.yaml',
      'archive/story-3/agents/blackboard.yaml'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    // Create stories in different directories
    const dirs = ['active', 'published', 'archive'];
    for (const dir of dirs) {
      await createStory(workspace, dir, `${dir}-story`);
      // Remove blackboard
      await deleteFile(workspace, `${dir}/${dir}-story/agents/blackboard.yaml`);
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', '.hidden-story');
    await deleteFile(workspace, 'active/.hidden-story/agents/blackboard.yaml');
    await createStory(workspace, 'active', 'visible-story');
    await deleteFile(workspace, 'active/visible-story/agents/blackboard.yaml');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('active/visible-story/agents/blackboard.yaml');
    await cleanupTestWorkspace(workspace);
  });
  it('handles empty workspace', async () => {
    const workspace = await createTestWorkspace();
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles stories without .status files', async () => {
    const workspace = await createTestWorkspace();
    // Create story directory structure without .status file
    await createFile(workspace, 'active/orphan-story/workspace/current-draft.md', 'content');
    const violations = await rule.check(workspace);
    // Should detect as a story and flag missing blackboard
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('active/orphan-story/agents/blackboard.yaml');
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await deleteFile(workspace, 'active/test-story/agents/blackboard.yaml');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'MISSING_BLACKBOARD',
      location: 'active/test-story/agents/blackboard.yaml'
    });
    await cleanupTestWorkspace(workspace);
  });
});
