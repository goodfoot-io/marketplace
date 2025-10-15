import type { Rule } from '../../src/types.js';
import rule from '../../src/rules/INVALID_USER_FEEDBACK_STRUCTURE.js';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createStory,
  createFile,
  createDirectory
} from '../lib/test-workspace.js';
const validSingleEntry = `
## Request
Initial user request.
## Intent Analysis
- Analysis of intent.
## Implementation
- Implementation details.
`;
const validMultipleEntries = `
## Request
Request 1.
## Intent Analysis
- Analysis 1.
## Implementation
- Implementation 1.
---
## Request
Request 2.
## Intent Analysis
- Analysis 2.
## Implementation
- Implementation 2.
`;
const missingImplementation = `
## Request
A request.
## Intent Analysis
- Some analysis.
`;
const missingRequestAndIntent = `
## Implementation
- Just implementation.
`;
const mixedEntries = `
## Request
Request 1.
## Intent Analysis
- Analysis 1.
## Implementation
- Implementation 1.
---
## Request
Request 2.
## Intent Analysis
- Analysis 2.
`;
const noSeparator = `
## Request
Request without separator.
## Implementation
- No separator.
`;
describe('INVALID_USER_FEEDBACK_STRUCTURE Rule', () => {
  let workspace: string;
  beforeEach(async () => {
    workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createDirectory(workspace, 'active/test-story/essay/2501010000-initial');
  });
  afterEach(async () => {
    await cleanupTestWorkspace(workspace);
  });
  async function expectNoViolations(rule: Rule, workspace: string) {
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
  }
  it('returns null for a valid file with a single entry', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/user-feedback.md', validSingleEntry);
    await expectNoViolations(rule, workspace);
  });
  it('returns null for a valid file with multiple entries', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/user-feedback.md', validMultipleEntries);
    await expectNoViolations(rule, workspace);
  });
  it('detects a violation for a missing section in a single entry', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/user-feedback.md', missingImplementation);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('missing required sections: ## Implementation');
  });
  it('detects a violation for multiple missing sections', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/user-feedback.md', missingRequestAndIntent);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('missing required sections: ## Request, ## Intent Analysis');
  });
  it('detects a violation in the second entry of a multi-entry file', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/user-feedback.md', mixedEntries);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain(
      'Entry 2 in `user-feedback.md` for version `2501010000-initial` of story `test-story` is missing required sections: ## Implementation.'
    );
  });
  it('detects a violation for a file with content but no separator and missing sections', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/user-feedback.md', noSeparator);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('missing required sections: ## Intent Analysis');
  });
  it('returns null for an empty file', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/user-feedback.md', '');
    await expectNoViolations(rule, workspace);
  });
  it('returns null for a file with just a separator', async () => {
    await createFile(workspace, 'active/test-story/essay/2501010000-initial/user-feedback.md', '---');
    await expectNoViolations(rule, workspace);
  });
  it('should not check non-story directories', async () => {
    await createDirectory(workspace, 'not-a-story');
    await createFile(workspace, 'not-a-story/user-feedback.md', missingImplementation);
    await expectNoViolations(rule, workspace);
  });
});
