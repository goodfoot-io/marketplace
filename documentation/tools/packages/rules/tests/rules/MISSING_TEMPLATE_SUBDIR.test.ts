import rule from '../../src/rules/MISSING_TEMPLATE_SUBDIR.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createDirectory, createFile } from '../lib/test-workspace.js';
describe('MISSING_TEMPLATE_SUBDIR Rule', () => {
  it('returns null when all template subdirectories exist', async () => {
    const workspace = await createTestWorkspace();
    // Create _templates directory with all required subdirectories
    await createDirectory(workspace, '_templates');
    await createDirectory(workspace, '_templates/personas');
    await createDirectory(workspace, '_templates/rubrics');
    await createDirectory(workspace, '_templates/workflows');
    // Add some content to verify they're working
    await createFile(workspace, '_templates/personas/general-reader.md', '# General Reader Persona');
    await createFile(workspace, '_templates/rubrics/style-rubric.md', '# Style Rubric');
    await createFile(workspace, '_templates/workflows/standard.md', '# Standard Workflow');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing rubrics subdirectory', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, '_templates');
    await createDirectory(workspace, '_templates/personas');
    await createDirectory(workspace, '_templates/workflows');
    // Missing rubrics subdirectory
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0]).toMatchObject({
      code: 'MISSING_TEMPLATE_SUBDIR',
      location: '_templates/rubrics',
      severity: 'error'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing workflows subdirectory', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, '_templates');
    await createDirectory(workspace, '_templates/personas');
    await createDirectory(workspace, '_templates/rubrics');
    // Missing workflows
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['_templates/workflows']);
    await cleanupTestWorkspace(workspace);
  });
  it('detects all missing subdirectories when templates exists', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, '_templates');
    // All subdirectories missing
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, ['_templates/personas', '_templates/rubrics', '_templates/workflows']);
    await cleanupTestWorkspace(workspace);
  });
  it('returns null when _templates directory does not exist', async () => {
    const workspace = await createTestWorkspace();
    // No _templates directory at all
    const violations = await rule.check(workspace);
    // Should not report violations if parent directory doesn't exist
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles files instead of directories', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, '_templates');
    // Create files instead of directories
    await createFile(workspace, '_templates/rubrics', 'This should be a directory');
    await createDirectory(workspace, '_templates/personas');
    await createDirectory(workspace, '_templates/workflows');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expectViolationLocations(violations, ['_templates/rubrics']);
    await cleanupTestWorkspace(workspace);
  });
  it('provides helpful error descriptions', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, '_templates');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    violations!.forEach((v) => {
      expect(v.title).toBe('Missing Template Subdirectory');
      expect(v.description).toContain('subdirectory');
      expect(v.description).toContain('_templates');
    });
    await cleanupTestWorkspace(workspace);
  });
  it('validates subdirectory names exactly', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, '_templates');
    // Wrong names
    await createDirectory(workspace, '_templates/rubric'); // Should be 'rubrics'
    await createDirectory(workspace, '_templates/workflow'); // Should be 'workflows'
    await createDirectory(workspace, '_templates/persona'); // Should be 'personas'
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores other subdirectories', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, '_templates');
    await createDirectory(workspace, '_templates/personas');
    await createDirectory(workspace, '_templates/rubrics');
    await createDirectory(workspace, '_templates/workflows');
    // Additional subdirectories should be ignored
    await createDirectory(workspace, '_templates/custom');
    await createDirectory(workspace, '_templates/archive');
    await createFile(workspace, '_templates/README.md', '# Templates');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('maintains proper structure after fixes', async () => {
    const workspace = await createTestWorkspace();
    await createDirectory(workspace, '_templates');
    // Add some existing files
    await createFile(workspace, '_templates/README.md', '# Templates');
    await createFile(workspace, '_templates/.gitkeep', '');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    // Verify structure is complete and existing files preserved
    const fs = await import('fs/promises');
    const path = await import('path');
    const readmeExists = await fs
      .access(path.join(workspace, '_templates/README.md'))
      .then(() => true)
      .catch(() => false);
    const gitkeepExists = await fs
      .access(path.join(workspace, '_templates/.gitkeep'))
      .then(() => true)
      .catch(() => false);
    expect(readmeExists).toBe(true);
    expect(gitkeepExists).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
  it('handles nested template directories correctly', async () => {
    const workspace = await createTestWorkspace();
    // Create nested _templates (should not be checked)
    await createDirectory(workspace, 'active/story/_templates');
    await createDirectory(workspace, 'active/story/_templates/personas');
    const violations = await rule.check(workspace);
    // Only root _templates should be checked
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('checks only root _templates directory', async () => {
    const workspace = await createTestWorkspace();
    // Create incomplete root _templates
    await createDirectory(workspace, '_templates');
    await createDirectory(workspace, '_templates/personas');
    // Create complete nested _templates (should be ignored)
    await createDirectory(workspace, 'archive/old-story/_templates');
    await createDirectory(workspace, 'archive/old-story/_templates/personas');
    await createDirectory(workspace, 'archive/old-story/_templates/rubrics');
    await createDirectory(workspace, 'archive/old-story/_templates/workflows');
    // Should only report violations for root _templates, not nested ones
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2); // Missing rubrics, workflows from root
    violations!.forEach((v) => {
      expect(v.location).toMatch(/^_templates\//);
    });
    await cleanupTestWorkspace(workspace);
  });
});
