import type { Rule } from '../../src/types.js';
import rule from '../../src/rules/INVALID_PERFORMANCE_REVIEW_FILENAME.js';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createStory,
  createFile,
  createDirectory
} from '../lib/test-workspace.js';
describe('INVALID_PERFORMANCE_REVIEW_FILENAME Rule', () => {
  let workspace: string;
  beforeEach(async () => {
    workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/performance-reviews');
  });
  afterEach(async () => {
    await cleanupTestWorkspace(workspace);
  });
  async function expectNoViolations(rule: Rule, workspace: string) {
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
  }
  it('returns null for valid performance review filenames', async () => {
    await createFile(workspace, 'active/test-story/agents/performance-reviews/240115-writer-specialist.yaml', '');
    await createFile(workspace, 'active/test-story/agents/performance-reviews/250220-editor-in-chief.yaml', '');
    await expectNoViolations(rule, workspace);
  });
  it('detects a violation for an incorrect file extension', async () => {
    await createFile(workspace, 'active/test-story/agents/performance-reviews/240115-writer-specialist.yml', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('Invalid performance review filename: `240115-writer-specialist.yml`');
  });
  it('detects a violation for an incorrect date format', async () => {
    await createFile(workspace, 'active/test-story/agents/performance-reviews/20240115-writer-specialist.yaml', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain(
      'Invalid performance review filename: `20240115-writer-specialist.yaml`'
    );
  });
  it('detects a violation for a missing specialist name', async () => {
    await createFile(workspace, 'active/test-story/agents/performance-reviews/240115.yaml', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('Invalid performance review filename: `240115.yaml`');
  });
  it('detects multiple violations in the same directory', async () => {
    await createFile(workspace, 'active/test-story/agents/performance-reviews/invalid-name.yaml', '');
    await createFile(workspace, 'active/test-story/agents/performance-reviews/240115-writer.txt', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
  });
  it('returns null if the performance-reviews directory does not exist', async () => {
    const newWorkspace = await createTestWorkspace();
    await createStory(newWorkspace, 'active', 'another-story');
    await expectNoViolations(rule, newWorkspace);
    await cleanupTestWorkspace(newWorkspace);
  });
});
