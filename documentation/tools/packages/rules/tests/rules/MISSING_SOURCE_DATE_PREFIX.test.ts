import rule from '../../src/rules/MISSING_SOURCE_DATE_PREFIX.js';
import { expectViolationLocations, createSourceFileContent } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('MISSING_SOURCE_DATE_PREFIX Rule', () => {
  it('returns null when all source files have date prefixes', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Valid date prefixes
    await createFile(workspace, 'active/story-1/sources/documents/20250110-climate-report.pdf', 'binary content');
    await createFile(
      workspace,
      'active/story-1/sources/interviews/20250109-smith-interview.md',
      createSourceFileContent()
    );
    await createFile(workspace, 'active/story-1/sources/data/20250111-statistics.csv', 'data,value\n1,2');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects source files without date prefixes', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // No date prefix
    await createFile(workspace, 'active/story-1/sources/documents/climate-report.pdf', 'binary content');
    await createFile(workspace, 'active/story-1/sources/interviews/smith-interview.md', createSourceFileContent());
    await createFile(workspace, 'active/story-1/sources/data/statistics.csv', 'data');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, [
      'active/story-1/sources/documents/climate-report.pdf',
      'active/story-1/sources/interviews/smith-interview.md',
      'active/story-1/sources/data/statistics.csv'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('detects invalid date formats in prefixes', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Invalid date formats
    await createFile(workspace, 'active/story-1/sources/documents/2025-01-10-report.pdf', 'content');
    await createFile(workspace, 'active/story-1/sources/documents/01-10-2025-report.pdf', 'content');
    await createFile(workspace, 'active/story-1/sources/documents/Jan10-report.pdf', 'content');
    await createFile(workspace, 'active/story-1/sources/documents/2025110-report.pdf', 'content');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(4);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Create subdirectories without date prefixes
    await createFile(workspace, 'active/story-1/sources/documents/reports/file.txt', 'content');
    const violations = await rule.check(workspace);
    // Should only check files directly in source directories
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    const dirs = ['active', 'published', 'archive'];
    for (const dir of dirs) {
      await createStory(workspace, dir, `${dir}-story`);
      await createFile(workspace, `${dir}/${dir}-story/sources/documents/report.pdf`, 'content');
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('validates date prefix is at the start', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Date not at start
    await createFile(workspace, 'active/story-1/sources/documents/report-20250110.pdf', 'content');
    await createFile(workspace, 'active/story-1/sources/documents/draft_20250110_report.pdf', 'content');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    await cleanupTestWorkspace(workspace);
  });
  it('handles mixed valid and invalid files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Valid
    await createFile(workspace, 'active/story-1/sources/documents/20250110-report-1.pdf', 'content');
    await createFile(workspace, 'active/story-1/sources/data/20250111-data.csv', 'data');
    // Invalid
    await createFile(workspace, 'active/story-1/sources/documents/report-2.pdf', 'content');
    await createFile(workspace, 'active/story-1/sources/interviews/interview.md', 'content');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, [
      'active/story-1/sources/documents/report-2.pdf',
      'active/story-1/sources/interviews/interview.md'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(workspace, 'active/story-1/sources/documents/.hidden-file', 'content');
    await createFile(workspace, 'active/story-1/sources/documents/visible-file.pdf', 'content');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toContain('visible-file.pdf');
    await cleanupTestWorkspace(workspace);
  });
  it('provides helpful error messages', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(workspace, 'active/story-1/sources/documents/important-report.pdf', 'content');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation.description).toContain('YYYYMMDD');
    expect(violation.description).toContain('20250110');
    expect(violation.description).toContain('important-report.pdf');
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(workspace, 'active/test-story/sources/data/statistics.xlsx', 'data');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'MISSING_SOURCE_DATE_PREFIX',
      location: 'active/test-story/sources/data/statistics.xlsx',
      severity: 'warning'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('handles empty source directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Empty source directories should not cause violations
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('validates all source subdirectories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Create files in each source subdirectory
    await createFile(workspace, 'active/story-1/sources/documents/doc.pdf', 'content');
    await createFile(workspace, 'active/story-1/sources/interviews/interview.txt', 'content');
    await createFile(workspace, 'active/story-1/sources/data/data.json', '{}');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    // All should be from different subdirectories
    const locations = violations!.map((v) => v.location);
    expect(locations.some((l) => l.includes('/documents/'))).toBe(true);
    expect(locations.some((l) => l.includes('/interviews/'))).toBe(true);
    expect(locations.some((l) => l.includes('/data/'))).toBe(true);
    await cleanupTestWorkspace(workspace);
  });
});
