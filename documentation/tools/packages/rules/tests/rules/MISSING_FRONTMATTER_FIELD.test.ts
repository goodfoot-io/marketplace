import rule from '../../src/rules/MISSING_FRONTMATTER_FIELD.js';
import { expectViolationLocations, createIncompleteFrontmatter } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('MISSING_FRONTMATTER_FIELD Rule', () => {
  it('returns null when all frontmatter fields are present', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Valid essay file
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/essay.md',
      createIncompleteFrontmatter({
        title: 'Test Essay',
        status: 'draft',
        contributors: ['writer-specialist', 'researcher-specialist'],
        target_audience: 'general-educated'
      })
    );
    // Valid review file
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/feedback.md',
      createIncompleteFrontmatter({
        overall_effectiveness: 'good',
        key_issues: ['clarity', 'structure'],
        recommended_changes: 3,
        priority: 'high'
      })
    );
    // Valid source file
    await createFile(
      workspace,
      'active/story-1/sources/documents/20250113-research.md',
      createIncompleteFrontmatter({
        source_url: 'https://example.com/article'
      })
    );
    // Valid workspace file
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/workspace/research-notes.md',
      createIncompleteFrontmatter({
        phase: 'initial-discovery',
        sources_reviewed: 15,
        key_gaps: ['youth-perspectives', 'regional-data'],
        next_priorities: ['policy-analysis', 'economic-impact']
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects missing fields in review files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Reviews should be in version-specific directories
    // Missing recommended_changes field
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/feedback.md',
      createIncompleteFrontmatter({
        overall_effectiveness: 'good',
        key_issues: ['clarity', 'structure'],
        priority: 'high'
      })
    );
    // Missing priority field
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/quality/feedback.md',
      createIncompleteFrontmatter({
        overall_effectiveness: 'excellent',
        key_issues: ['structure'],
        recommended_changes: 2
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, [
      'active/story-1/essay/2501130945-initial/reviews/editorial/feedback.md',
      'active/story-1/essay/2501130945-initial/reviews/quality/feedback.md'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('provides specific field names in error messages', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Missing multiple fields in review file
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/feedback.md',
      createIncompleteFrontmatter({
        overall_effectiveness: 'good'
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation.description).toContain('key_issues');
    expect(violation.description).toContain('recommended_changes');
    expect(violation.description).toContain('priority');
    await cleanupTestWorkspace(workspace);
  });
  it('handles files without frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/feedback.md',
      '# Review Feedback\n\nNo frontmatter here.'
    );
    const violations = await rule.check(workspace);
    // Should be handled by MISSING_YAML_FRONTMATTER rule, not this one
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    const dirs = ['active', 'published', 'archive'];
    for (const dir of dirs) {
      await createStory(workspace, dir, `${dir}-story`);
      await createFile(
        workspace,
        `${dir}/${dir}-story/essay/2501130945-initial/reviews/editorial/feedback.md`,
        createIncompleteFrontmatter({
          overall_effectiveness: 'good'
          // Missing other required fields
        })
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores optional fields', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Has all required fields but missing optional ones
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/feedback.md',
      createIncompleteFrontmatter({
        overall_effectiveness: 'good',
        key_issues: ['clarity', 'structure'],
        recommended_changes: 3,
        priority: 'high'
        // No optional fields like notes, etc.
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles empty frontmatter values', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/feedback.md',
      createIncompleteFrontmatter({
        overall_effectiveness: '',
        key_issues: [],
        recommended_changes: 0,
        priority: ''
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('overall_effectiveness');
    expect(violations![0].description).toContain('priority');
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', '.hidden-story');
    await createFile(
      workspace,
      'active/.hidden-story/essay/2501130945-initial/reviews/editorial/feedback.md',
      createIncompleteFrontmatter({ overall_effectiveness: 'good' })
    );
    await createStory(workspace, 'active', 'visible-story');
    await createFile(
      workspace,
      'active/visible-story/essay/2501130945-initial/reviews/editorial/feedback.md',
      createIncompleteFrontmatter({ overall_effectiveness: 'good' })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toContain('visible-story');
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(
      workspace,
      'active/test-story/essay/2501130945-initial/reviews/editorial/feedback.md',
      createIncompleteFrontmatter({
        overall_effectiveness: 'good',
        key_issues: ['clarity']
        // Missing recommended_changes and priority
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'MISSING_FRONTMATTER_FIELD',
      location: 'active/test-story/essay/2501130945-initial/reviews/editorial/feedback.md',
      severity: 'error'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('validates all review type files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    const reviewTypes = ['editorial', 'quality', 'fact-check', 'audience', 'final'];
    for (const reviewType of reviewTypes) {
      await createFile(
        workspace,
        `active/story-1/essay/2501130945-initial/reviews/${reviewType}/feedback.md`,
        createIncompleteFrontmatter({
          overall_effectiveness: 'good'
          // Missing key_issues, recommended_changes, priority
        })
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(reviewTypes.length);
    await cleanupTestWorkspace(workspace);
  });
  it('checks nested review directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Various review directory patterns in new structure
    const reviewPaths = [
      'essay/2501130945-initial/reviews/editorial/feedback.md',
      'essay/2501131200-revised/reviews/quality/feedback.md',
      'essay/2501131500-final/reviews/fact-check/feedback.md',
      'essay/2501131800-published/reviews/audience/feedback.md'
    ];
    for (const path of reviewPaths) {
      await createFile(
        workspace,
        `active/story-1/${path}`,
        createIncompleteFrontmatter({
          overall_effectiveness: 'good'
          // Missing other required fields
        })
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(reviewPaths.length);
    await cleanupTestWorkspace(workspace);
  });
  it('validates archive files with specific required fields', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Archive file with all required fields
    await createFile(
      workspace,
      'active/test-story/sources/archives/20250117-nytimes-climate.md',
      createIncompleteFrontmatter({
        original_url: 'https://nytimes.com/article/climate-change',
        archived_date: '2025-01-17',
        archived_by: 'fact-checker-specialist',
        archive_method: 'webfetch',
        title: 'Climate Change Article'
      })
    );
    // Archive file missing required fields
    await createFile(
      workspace,
      'active/test-story/sources/archives/20250117-guardian-report.md',
      createIncompleteFrontmatter({
        original_url: 'https://guardian.com/report',
        title: 'Guardian Report'
        // Missing archived_date, archived_by, archive_method
      })
    );
    // Archive file with source_url instead of original_url (wrong field)
    await createFile(
      workspace,
      'active/test-story/sources/archives/20250117-science-journal.md',
      createIncompleteFrontmatter({
        source_url: 'https://science.org/journal/article',
        archived_date: '2025-01-17',
        archived_by: 'researcher-specialist',
        archive_method: 'manual',
        title: 'Science Journal Article'
        // Has source_url instead of original_url
      })
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    // Check violations are for the files with missing fields
    const violationFiles = violations!.map((v) => v.location);
    expect(violationFiles).toContain('active/test-story/sources/archives/20250117-guardian-report.md');
    expect(violationFiles).toContain('active/test-story/sources/archives/20250117-science-journal.md');
    // Check specific missing fields are mentioned
    const guardianViolation = violations!.find((v) => v.location.includes('guardian-report'));
    expect(guardianViolation?.description).toContain('archived_date');
    expect(guardianViolation?.description).toContain('archived_by');
    expect(guardianViolation?.description).toContain('archive_method');
    const scienceViolation = violations!.find((v) => v.location.includes('science-journal'));
    expect(scienceViolation?.description).toContain('original_url');
    await cleanupTestWorkspace(workspace);
  });
});
