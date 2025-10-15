import rule from '../../src/rules/INVALID_LINK_OVERRIDES_STRUCTURE.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('INVALID_LINK_OVERRIDES_STRUCTURE Rule', () => {
  it('returns null when no link-overrides.yaml files exist', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('returns null when link-overrides.yaml has valid structure', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const validOverrides = `overrides:
  - url: "https://example.com/broken-link"
    reason: "Website temporarily down for maintenance"
    authorized_by: "reviewer-specialist"
    timestamp: "2025-01-16T14:30:00Z"`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', validOverrides);
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing overrides array', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidOverrides = `invalid: structure`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', invalidOverrides);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('missing required "overrides" array');
    await cleanupTestWorkspace(workspace);
  });
  it('detects when overrides is not an array', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidOverrides = `overrides: "not an array"`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', invalidOverrides);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('must be an array');
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing required fields in override entries', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidOverrides = `overrides:
  - url: "https://example.com/broken-link"
    reason: "Website down"
  - reason: "Another reason"
    authorized_by: "reviewer-specialist"
    timestamp: "2025-01-16T14:30:00Z"`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', invalidOverrides);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expect(violations![0].description).toContain('missing required fields: authorized_by, timestamp');
    expect(violations![1].description).toContain('missing required fields: url');
    await cleanupTestWorkspace(workspace);
  });
  it('detects invalid ISO 8601 timestamp format', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidOverrides = `overrides:
  - url: "https://example.com/broken-link"
    reason: "Website down"
    authorized_by: "reviewer-specialist"
    timestamp: "2025-01-16 14:30:00"
  - url: "https://example.com/another-link"
    reason: "Another reason"
    authorized_by: "reviewer-specialist"
    timestamp: "January 16, 2025"`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', invalidOverrides);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expect(violations![0].description).toContain('timestamp must be in ISO 8601 format');
    expect(violations![1].description).toContain('timestamp must be in ISO 8601 format');
    await cleanupTestWorkspace(workspace);
  });
  it('warns when authorized_by does not end with -specialist', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const overridesWithWarning = `overrides:
  - url: "https://example.com/broken-link"
    reason: "Website down"
    authorized_by: "john-smith"
    timestamp: "2025-01-16T14:30:00Z"`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', overridesWithWarning);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('should be a specialist identifier');
    expect(violations![0].severity).toBe('warning');
    await cleanupTestWorkspace(workspace);
  });
  it('handles invalid YAML gracefully', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidYaml = `overrides:
  - url: "https://example.com
    reason: unclosed quote`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', invalidYaml);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('invalid YAML');
    await cleanupTestWorkspace(workspace);
  });
  it('detects non-object entries in overrides array', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidOverrides = `overrides:
  - "not an object"
  - 123
  - null`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', invalidOverrides);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    violations!.forEach((violation, index) => {
      expect(violation.description).toContain(`Override entry [${index}] must be an object`);
    });
    await cleanupTestWorkspace(workspace);
  });
  it('accepts valid ISO 8601 timestamp variations', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const validOverrides = `overrides:
  - url: "https://example.com/link1"
    reason: "Reason 1"
    authorized_by: "reviewer-specialist"
    timestamp: "2025-01-16T14:30:00Z"
  - url: "https://example.com/link2"
    reason: "Reason 2"
    authorized_by: "reviewer-specialist"
    timestamp: "2025-01-16T14:30:00.123Z"
  - url: "https://example.com/link3"
    reason: "Reason 3"
    authorized_by: "reviewer-specialist"
    timestamp: "2025-01-16T14:30:00+05:00"
  - url: "https://example.com/link4"
    reason: "Reason 4"
    authorized_by: "reviewer-specialist"
    timestamp: "2025-01-16T14:30:00-08:00"`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', validOverrides);
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story1');
    await createStory(workspace, 'published', 'story2');
    await createStory(workspace, 'archive', 'story3');
    const invalidOverrides = `overrides:
  - missing: fields`;
    await createFile(workspace, 'active/story1/link-overrides.yaml', invalidOverrides);
    await createFile(workspace, 'published/story2/link-overrides.yaml', invalidOverrides);
    await createFile(workspace, 'archive/story3/link-overrides.yaml', invalidOverrides);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expect(violations!.map((v) => v.location)).toEqual([
      'active/story1/link-overrides.yaml',
      'published/story2/link-overrides.yaml',
      'archive/story3/link-overrides.yaml'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    const invalidOverrides = `invalid: yaml`;
    await createFile(workspace, 'active/test-story/link-overrides.yaml', invalidOverrides);
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations!.length).toBeGreaterThanOrEqual(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'INVALID_LINK_OVERRIDES_STRUCTURE',
      location: 'active/test-story/link-overrides.yaml'
    });
    await cleanupTestWorkspace(workspace);
  });
});
