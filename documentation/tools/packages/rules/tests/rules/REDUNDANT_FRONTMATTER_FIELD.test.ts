import rule from '../../src/rules/REDUNDANT_FRONTMATTER_FIELD.js';
import { createIncompleteFrontmatter } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('REDUNDANT_FRONTMATTER_FIELD Rule', () => {
  it('returns null when no redundant fields are present', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Valid essay file without redundant fields
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/essay.md',
      createIncompleteFrontmatter({
        title: 'Test Essay',
        status: 'draft',
        contributors: ['writer-specialist'],
        target_audience: 'general-educated'
      })
    );
    // Valid review file without redundant fields
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/review-metadata.md',
      createIncompleteFrontmatter({
        overall_effectiveness: 'good',
        key_issues: ['clarity', 'structure'],
        recommended_changes: 3,
        priority: 'high'
      })
    );
    // Valid source file without redundant fields
    await createFile(
      workspace,
      'active/story-1/sources/data/20250113-research-data.md',
      createIncompleteFrontmatter({
        source_url: 'https://example.com/research',
        publication_type: 'peer-reviewed',
        credibility_tier: 1,
        author: 'Dr. Smith',
        tags: ['research', 'data']
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects forbidden fields: version, story_slug, timestamp, created, last_updated, specialist', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // File with forbidden fields
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/essay.md',
      createIncompleteFrontmatter({
        title: 'Test Essay',
        version: '2501130945-initial', // Forbidden - derived from directory
        story_slug: 'story-1', // Forbidden - derived from path
        timestamp: '2025-01-13T09:45:00Z', // Forbidden - use filesystem
        created: '2025-01-13', // Forbidden - use filesystem
        last_updated: '2025-01-13', // Forbidden - use filesystem
        specialist: 'writer-specialist' // Forbidden - derived from context
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(6);
    // Check that all forbidden fields are detected
    const descriptions = violations!.map((v) => v.description);
    expect(descriptions.some((d) => d.includes('"version"'))).toBeTruthy();
    expect(descriptions.some((d) => d.includes('"story_slug"'))).toBeTruthy();
    expect(descriptions.some((d) => d.includes('"timestamp"'))).toBeTruthy();
    expect(descriptions.some((d) => d.includes('"created"'))).toBeTruthy();
    expect(descriptions.some((d) => d.includes('"last_updated"'))).toBeTruthy();
    expect(descriptions.some((d) => d.includes('"specialist"'))).toBeTruthy();
    await cleanupTestWorkspace(workspace);
  });
  it('detects date-related redundant fields: date_accessed, date_created, date_modified', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/sources/documents/research-paper.md',
      createIncompleteFrontmatter({
        title: 'Research Paper',
        source_url: 'https://example.com',
        date_accessed: '2025-01-13', // Forbidden - use filesystem
        date_created: '2025-01-10', // Forbidden - use filesystem
        date_modified: '2025-01-12' // Forbidden - use filesystem
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    const descriptions = violations!.map((v) => v.description);
    expect(descriptions.some((d) => d.includes('"date_accessed"'))).toBeTruthy();
    expect(descriptions.some((d) => d.includes('"date_created"'))).toBeTruthy();
    expect(descriptions.some((d) => d.includes('"date_modified"'))).toBeTruthy();
    await cleanupTestWorkspace(workspace);
  });
  it('detects path-related redundant fields: path, filename, directory', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/workspace/research-notes.md',
      createIncompleteFrontmatter({
        phase: 'initial-discovery',
        path: 'active/story-1/essay/2501130945-initial/workspace/research-notes.md', // Forbidden
        filename: 'research-notes.md', // Forbidden
        directory: 'workspace' // Forbidden
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    const descriptions = violations!.map((v) => v.description);
    expect(descriptions.some((d) => d.includes('"path"'))).toBeTruthy();
    expect(descriptions.some((d) => d.includes('"filename"'))).toBeTruthy();
    expect(descriptions.some((d) => d.includes('"directory"'))).toBeTruthy();
    await cleanupTestWorkspace(workspace);
  });
  it('detects context-specific fields in essay files (version_number, version_name)', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/essay.md',
      createIncompleteFrontmatter({
        title: 'Test Essay',
        version_number: 'v1', // Forbidden in essay files
        version_name: 'initial-draft' // Forbidden in essay files
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('version information');
    await cleanupTestWorkspace(workspace);
  });
  it('detects context-specific fields in review files (reviewer, reviewed_by)', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/review-metadata.md',
      createIncompleteFrontmatter({
        overall_effectiveness: 'good',
        reviewer: 'editor-specialist', // Forbidden in review files
        reviewed_by: 'Jane Doe' // Forbidden in review files
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('reviewer identity');
    await cleanupTestWorkspace(workspace);
  });
  it('detects context-specific fields in source files (file_type, source_type)', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/sources/documents/research.md',
      createIncompleteFrontmatter({
        title: 'Research Document',
        source_url: 'https://example.com',
        file_type: 'pdf', // Forbidden in source files
        source_type: 'document' // Forbidden in source files
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('file/source type');
    await cleanupTestWorkspace(workspace);
  });
  it('ignores files without frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/essay.md',
      '# Essay Title\n\nNo frontmatter here, just content.'
    );
    await createFile(workspace, 'active/story-1/sources/data/notes.md', 'Just some notes without frontmatter.');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles invalid YAML gracefully', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/essay.md',
      '---\ntitle: "Test Essay\nversion: invalid yaml\n---\n\nContent here.'
    );
    const violations = await rule.check(workspace);
    // Should not crash, invalid YAML is handled by other rules
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/essay.md',
      createIncompleteFrontmatter({
        title: 'Test Essay',
        version: 'v1',
        story_slug: 'story-1'
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    violations!.forEach((violation) => {
      expect(violation).toMatchObject({
        code: 'REDUNDANT_FRONTMATTER_FIELD',
        severity: 'error',
        location: 'active/story-1/essay/2501130945-initial/essay.md'
      });
    });
    await cleanupTestWorkspace(workspace);
  });
  it('checks all directories including published and archive', async () => {
    const workspace = await createTestWorkspace();
    const dirs = ['active', 'published', 'archive'];
    for (const dir of dirs) {
      await createStory(workspace, dir, `${dir}-story`);
      await createFile(
        workspace,
        `${dir}/${dir}-story/essay/2501130945-initial/essay.md`,
        createIncompleteFrontmatter({
          title: `Essay in ${dir}`,
          version: 'should-be-derived',
          created: 'should-be-derived'
        })
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(6); // 2 violations per file * 3 directories
    await cleanupTestWorkspace(workspace);
  });
  it('recursively checks all subdirectories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Create files in various nested locations
    const testFiles = [
      'essay/2501130945-initial/essay.md',
      'essay/2501130945-initial/workspace/outline.md',
      'essay/2501130945-initial/reviews/editorial/review-metadata.md',
      'sources/documents/research.md',
      'sources/interviews/transcript.md',
      'sources/data/analysis.md'
    ];
    for (const file of testFiles) {
      await createFile(
        workspace,
        `active/story-1/${file}`,
        createIncompleteFrontmatter({
          title: 'Test Document',
          timestamp: '2025-01-13T10:00:00Z' // Forbidden field
        })
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(testFiles.length);
    await cleanupTestWorkspace(workspace);
  });
  it('handles multiple redundant fields in a single file', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/essay.md',
      createIncompleteFrontmatter({
        title: 'Test Essay',
        version: 'v1',
        story_slug: 'story-1',
        timestamp: '2025-01-13T10:00:00Z',
        created: '2025-01-13',
        last_updated: '2025-01-13',
        specialist: 'writer',
        path: '/full/path/to/file',
        filename: 'essay.md',
        directory: 'essay',
        version_number: 'v1',
        version_name: 'initial'
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    // Should have violations for all forbidden fields plus context-specific violations
    expect(violations!.length).toBeGreaterThanOrEqual(10);
    await cleanupTestWorkspace(workspace);
  });
  it('detects redundant fields in workspace files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/workspace/research-notes.md',
      createIncompleteFrontmatter({
        phase: 'initial-discovery',
        sources_reviewed: 15,
        created: '2025-01-13', // Forbidden
        last_updated: '2025-01-13', // Forbidden
        story_slug: 'story-1' // Forbidden
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
});
