import rule from '../../src/rules/INVALID_MESSAGE_FILENAME.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createStory,
  createDirectory,
  createFile
} from '../lib/test-workspace.js';
describe('INVALID_MESSAGE_FILENAME Rule', () => {
  it('returns null when message files follow naming convention', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/messages');
    await createFile(workspace, 'active/test-story/agents/messages/2501121430-writer-editor.msg', 'content');
    await createFile(workspace, 'active/test-story/agents/messages/2501121445-researcher-all.msg', 'content');
    await createFile(workspace, 'active/test-story/agents/messages/2501121500-quality-newsroom-request.msg', 'content');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('returns null when no messages directory exists', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents');
    // No messages directory
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('returns null when messages directory is empty', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/messages');
    // No files
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects invalid message filenames', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/messages');
    await createFile(workspace, 'active/test-story/agents/messages/invalid-name.msg', 'content');
    await createFile(workspace, 'active/test-story/agents/messages/writer-message.msg', 'content');
    await createFile(workspace, 'active/test-story/agents/messages/20250112-badformat.msg', 'content');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, [
      'active/test-story/agents/messages/invalid-name.msg',
      'active/test-story/agents/messages/writer-message.msg',
      'active/test-story/agents/messages/20250112-badformat.msg'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('enforces YYMMDDHHMM timestamp format strictly', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/messages');
    // Valid
    await createFile(workspace, 'active/test-story/agents/messages/2501121430-writer-editor.msg', 'valid YYMMDDHHMM');
    // Invalid
    await createFile(workspace, 'active/test-story/agents/messages/20250112T143000-writer-editor.msg', 'ISO basic');
    await createFile(workspace, 'active/test-story/agents/messages/20250112-writer-editor.msg', 'date only');
    await createFile(workspace, 'active/test-story/agents/messages/170463540-writer-editor.msg', 'short timestamp');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('allows valid agent names and recipients', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/messages');
    await createFile(
      workspace,
      'active/test-story/agents/messages/2501121430-writer-specialist-editor-specialist.msg',
      'hyphenated names'
    );
    await createFile(
      workspace,
      'active/test-story/agents/messages/2501121430-researcher123-quality456.msg',
      'alphanumeric'
    );
    await createFile(workspace, 'active/test-story/agents/messages/2501121430-a-b.msg', 'single chars');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('rejects invalid agent names', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/messages');
    await createFile(workspace, 'active/test-story/agents/messages/2501121430-writer with spaces-editor.msg', 'spaces');
    await createFile(workspace, 'active/test-story/agents/messages/2501121430--editor.msg', 'empty from');
    await createFile(workspace, 'active/test-story/agents/messages/2501121430-writer-.msg', 'empty to');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores non-msg files in messages directory', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/messages');
    await createFile(workspace, 'active/test-story/agents/messages/2501121430-writer-editor.msg', 'valid msg');
    await createFile(workspace, 'active/test-story/agents/messages/invalid-name.txt', 'text file');
    await createFile(workspace, 'active/test-story/agents/messages/README.md', 'readme');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('validates special recipients correctly', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/messages');
    await createFile(workspace, 'active/test-story/agents/messages/2501121430-writer-all.msg', 'broadcast');
    await createFile(workspace, 'active/test-story/agents/messages/2501121430-writer-newsroom-request.msg', 'request');
    await createFile(workspace, 'active/test-story/agents/messages/2501121430-writer-invalid recipient.msg', 'invalid');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/test-story/agents/messages/2501121430-writer-invalid recipient.msg']);
    await cleanupTestWorkspace(workspace);
  });
  it('works across multiple stories', async () => {
    const workspace = await createTestWorkspace();
    // Story 1 - valid messages
    await createStory(workspace, 'active', 'story-one');
    await createDirectory(workspace, 'active/story-one/.agents/messages');
    await createFile(workspace, 'active/story-one/agents/messages/2501121430-writer-editor.msg', 'content');
    // Story 2 - invalid messages
    await createStory(workspace, 'active', 'story-two');
    await createDirectory(workspace, 'active/story-two/.agents/messages');
    await createFile(workspace, 'active/story-two/agents/messages/bad-name.msg', 'content');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['active/story-two/agents/messages/bad-name.msg']);
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/agents/messages');
    await createFile(workspace, 'active/test-story/agents/messages/invalid.msg', 'content');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'INVALID_MESSAGE_FILENAME',
      title: 'Invalid Message File Naming',
      severity: 'error'
    });
    expect(violation.description).toContain('[YYMMDDHHMM]-[specialist-name]-[topic].msg');
    await cleanupTestWorkspace(workspace);
  });
});
