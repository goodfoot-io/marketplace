import type { Rule } from '../../src/types.js';
import rule from '../../src/rules/INVALID_REVIEW_FILENAME.js';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createStory,
  createFile,
  createDirectory
} from '../lib/test-workspace.js';
describe('INVALID_REVIEW_FILENAME Rule', () => {
  let workspace: string;
  beforeEach(async () => {
    workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial');
  });
  afterEach(async () => {
    await cleanupTestWorkspace(workspace);
  });
  async function expectNoViolations(rule: Rule, workspace: string) {
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
  }
  it('returns null for valid review filenames', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial/2501131445.md', '');
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial/2501140930.md', '');
    await expectNoViolations(rule, workspace);
  });
  it('detects a violation for a non-numeric filename', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial/feedback.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain(
      "review file `feedback.md` that doesn't follow the naming convention `[YYMMDDHHMM].md`"
    );
  });
  it('does not detect a violation for an incorrect file extension because it only checks .md files', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial/1234567890.txt', '');
    await expectNoViolations(rule, workspace);
  });
  it('detects multiple violations in the same directory', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial/invalid-name.md', '');
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial/another-bad-one.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
  });
  it('returns null if the reviews directory does not exist', async () => {
    const newWorkspace = await createTestWorkspace();
    await createStory(newWorkspace, 'active', 'another-story');
    await createDirectory(newWorkspace, 'active/another-story/essay/2501010000-initial');
    await expectNoViolations(rule, newWorkspace);
    await cleanupTestWorkspace(newWorkspace);
  });
  it('detects unix timestamps as invalid', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial/1234567890.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('YYMMDDHHMM');
  });
  it('detects timestamps with wrong number of digits', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial/123.md', '');
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/reviews/editorial/12345678901.md', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
  });
});
