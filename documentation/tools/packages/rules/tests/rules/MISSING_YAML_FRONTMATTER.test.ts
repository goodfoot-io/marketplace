import rule from '../../src/rules/MISSING_YAML_FRONTMATTER.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('MISSING_YAML_FRONTMATTER Rule', () => {
  it('returns null when all source files have YAML frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Valid source files with frontmatter
    await createFile(
      workspace,
      'active/story-1/sources/documents/20250110-report.md',
      `---
title: "Climate Report"
source_url: "https://example.com/report"
publication_date: 2025-01-10
author: "Research Institute"
---
# Climate Report
Content goes here.`
    );
    await createFile(
      workspace,
      'active/story-1/sources/interviews/20250111-expert.md',
      `---
title: "Expert Interview"
source_url: "https://example.com/interview"
publication_date: 2025-01-11
author: "Dr. Expert"
---
# Interview Transcript
Q&A content here.`
    );
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('ignores review files without frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Review files without frontmatter should not trigger violations
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/feedback.md',
      `# Editorial Review
## What Went Well
- Good narrative structure
- Clear writing style
## Areas for Improvement
- Could use more examples`
    );
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/quality/feedback.md',
      `---
overall_effectiveness: good
key_issues: [clarity]
# Quality Review
Content without closing frontmatter.`
    );
    const violations = await rule.check(workspace);
    // Should be null because review files don't require frontmatter
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('ignores workspace files without frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Workspace files without frontmatter should not trigger violations
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/workspace/research-notes.md',
      `# Research Notes
## Key Findings
- Important discovery 1
- Important discovery 2
## Next Steps
- Investigate further sources`
    );
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/workspace/outline.md',
      `--
phase: initial-discovery
sources_reviewed: 15
--
# Story Outline
Content with malformed frontmatter.`
    );
    const violations = await rule.check(workspace);
    // Should be null because workspace files don't require frontmatter
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects source files missing YAML frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Source files without frontmatter - these should be flagged
    await createFile(
      workspace,
      'active/story-1/sources/documents/20250110-report.md',
      `# Report Title
This source file has no frontmatter.`
    );
    await createFile(
      workspace,
      'active/story-1/sources/interviews/20250111-interview.md',
      `# Interview Transcript
Q: What do you think?
A: This file is missing frontmatter.`
    );
    await createFile(
      workspace,
      'active/story-1/sources/data/20250112-analysis.md',
      `# Data Analysis
Important findings without frontmatter.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, [
      'active/story-1/sources/documents/20250110-report.md',
      'active/story-1/sources/interviews/20250111-interview.md',
      'active/story-1/sources/data/20250112-analysis.md'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('validates proper YAML frontmatter format for source files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Valid source file frontmatter
    await createFile(
      workspace,
      'active/story-1/sources/documents/20250110-report.md',
      `---
title: "Test Report"
source_url: "https://example.com/report"
---
# Report Title
This has valid frontmatter.`
    );
    // Invalid - no opening ---
    await createFile(
      workspace,
      'active/story-1/sources/documents/20250111-invalid1.md',
      `source_url: "https://example.com"
---
# Source Document
Missing opening dashes.`
    );
    // Invalid - extra content before frontmatter
    await createFile(
      workspace,
      'active/story-1/sources/documents/20250112-invalid2.md',
      `# Some content first
---
source_url: "https://example.com"
---
# Source Document
Content before frontmatter.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, [
      'active/story-1/sources/documents/20250111-invalid1.md',
      'active/story-1/sources/documents/20250112-invalid2.md'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('checks all content directories', async () => {
    const workspace = await createTestWorkspace();
    const dirs = ['active', 'published', 'archive'];
    for (const dir of dirs) {
      await createStory(workspace, dir, `${dir}-story`);
      // Review files don't need frontmatter anymore
      await createFile(
        workspace,
        `${dir}/${dir}-story/essay/2501130945-initial/reviews/editorial/feedback.md`,
        '# Review without frontmatter'
      );
      // Only source files need frontmatter
      await createFile(
        workspace,
        `${dir}/${dir}-story/sources/data/20250110-analysis.md`,
        '# Source file without frontmatter'
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3); // 1 source file per directory × 3 directories
    await cleanupTestWorkspace(workspace);
  });
  it('ignores files that are not markdown files requiring frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // These files don't need frontmatter
    await createFile(workspace, 'active/story-1/essay/2501130945-initial/notes.txt', 'Random notes in text file');
    await createFile(workspace, 'active/story-1/sources/documents/report.pdf', 'Binary PDF content');
    await createFile(workspace, 'active/story-1/agents/blackboard.yaml', 'project_metadata:\n  primary_topic: test');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles empty frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/essay/2501130945-initial/reviews/editorial/feedback.md',
      `---
---
# Editorial Review
Empty frontmatter section.`
    );
    const violations = await rule.check(workspace);
    // Empty frontmatter is still valid frontmatter
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('validates all source files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    const sourceFiles = [
      { path: 'sources/data/20250110-analysis.md', hasFrontmatter: true },
      { path: 'sources/data/20250111-research.md', hasFrontmatter: false },
      { path: 'sources/interviews/20250112-expert.md', hasFrontmatter: true },
      { path: 'sources/interviews/20250113-interview.md', hasFrontmatter: false },
      { path: 'sources/documents/20250114-report.md', hasFrontmatter: true },
      { path: 'sources/documents/20250115-summary.md', hasFrontmatter: false }
    ];
    // Create files with or without frontmatter
    for (const { path, hasFrontmatter } of sourceFiles) {
      if (hasFrontmatter) {
        await createFile(
          workspace,
          `active/story-1/${path}`,
          `---\nsource_url: "https://example.com/source"\nauthor: "Test Author"\n---\n\n# Source Document\n\nContent with frontmatter.`
        );
      } else {
        await createFile(workspace, `active/story-1/${path}`, `# Source Document\n\nContent without frontmatter.`);
      }
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3); // 3 files without frontmatter
    await cleanupTestWorkspace(workspace);
  });
  it('ignores nested review directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Review files don't require frontmatter
    const reviewPaths = [
      'essay/2501130945-initial/reviews/editorial/feedback.md',
      'essay/2501131200-revised/reviews/quality/feedback.md',
      'essay/2501131500-final/reviews/fact-check/feedback.md',
      'essay/2501131800-published/reviews/audience/feedback.md'
    ];
    for (const path of reviewPaths) {
      await createFile(workspace, `active/story-1/${path}`, '# Review\n\nNo frontmatter required.');
    }
    const violations = await rule.check(workspace);
    // Should be null because review files don't require frontmatter
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden files and directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', '.hidden-story');
    await createFile(
      workspace,
      'active/.hidden-story/sources/data/20250110-analysis.md',
      '# Analysis without frontmatter'
    );
    await createStory(workspace, 'active', 'visible-story');
    await createFile(
      workspace,
      'active/visible-story/sources/data/.hidden-source.md',
      '# Hidden source without frontmatter'
    );
    await createFile(
      workspace,
      'active/visible-story/sources/data/20250110-visible.md',
      '# Visible source without frontmatter'
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toContain('20250110-visible.md');
    await cleanupTestWorkspace(workspace);
  });
  it('provides helpful error messages', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-analysis.md',
      '# Source Analysis\n\nContent without frontmatter.'
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation.title).toContain('Missing YAML Frontmatter');
    expect(violation.description).toContain('---');
    expect(violation.description).toContain('frontmatter');
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(
      workspace,
      'active/test-story/sources/data/20250110-analysis.md',
      '# Feedback without frontmatter'
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'MISSING_YAML_FRONTMATTER',
      location: 'active/test-story/sources/data/20250110-analysis.md',
      severity: 'error'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('handles frontmatter with invalid YAML', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-analysis.md',
      `---
source_url: "https://example.com"
invalid: yaml: content: here
author: "Test Author"
---
# Source Analysis
Has frontmatter but invalid YAML.`
    );
    const violations = await rule.check(workspace);
    // This rule only checks for presence of frontmatter, not validity
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles whitespace variations in frontmatter delimiters', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Valid with extra whitespace
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-valid.md',
      `---   
source_url: "https://example.com"
author: "Test Author"
---  
# Source Document
Valid with whitespace.`
    );
    // Invalid with different characters
    await createFile(
      workspace,
      'active/story-1/sources/data/20250111-invalid.md',
      `===
source_url: "https://example.com"
author: "Test Author"
===
# Source Document
Wrong delimiter characters.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toContain('20250111-invalid.md');
    await cleanupTestWorkspace(workspace);
  });
  it('handles file system errors gracefully', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Create a source file
    await createFile(
      workspace,
      'active/test-story/sources/data/20250110-analysis.md',
      `---
specialist: writer-specialist
story_slug: test-story
---
# Feedback content`
    );
    // The rule should work normally and not throw errors for missing directories
    const violations = await rule.check(workspace);
    // Should not find violations for the valid file
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles non-existent directories gracefully', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Don't create any feedback files or review directories
    // This should not throw errors even though directories don't exist
    const violations = await rule.check(workspace);
    // Should return null since no valid files were found to check
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('exempts files in synthesis subdirectories from frontmatter requirement', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Create synthesis files without frontmatter - should be exempt
    await createFile(
      workspace,
      'active/test-story/sources/synthesis/20250110-synthesis.md',
      '# Synthesis Document\n\nThis combines insights from multiple sources.'
    );
    // Create regular source files without frontmatter - should be flagged
    await createFile(
      workspace,
      'active/test-story/sources/data/20250112-data.md',
      '# Data Analysis\n\nThis needs frontmatter.'
    );
    await createFile(
      workspace,
      'active/test-story/sources/interviews/20250113-interview.md',
      '# Interview Transcript\n\nThis also needs frontmatter.'
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    expectViolationLocations(violations, [
      'active/test-story/sources/data/20250112-data.md',
      'active/test-story/sources/interviews/20250113-interview.md'
    ]);
    await cleanupTestWorkspace(workspace);
  });
});
