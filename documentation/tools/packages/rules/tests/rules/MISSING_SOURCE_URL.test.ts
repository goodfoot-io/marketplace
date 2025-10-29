import rule from '../../src/rules/MISSING_SOURCE_URL.js';
import { expectViolationLocations } from '../lib/test-helpers.js';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createStory,
  createFile,
  createDirectory
} from '../lib/test-workspace.js';
describe('MISSING_SOURCE_URL Rule', () => {
  it('returns null when all markdown files have proper source URLs in frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-article-analysis.md',
      `---
title: "Article Analysis"
source_url: "https://example.com/article"
publication_date: 2024-12-01
publication_type: "news-article"
credibility_tier: 2
author: "John Doe"
tags: [news, analysis]
---
# Article Analysis
This is the content of the article analysis.`
    );
    await createFile(
      workspace,
      'active/story-1/sources/interviews/20250111-expert-interview.md',
      `---
title: "Expert Interview"
source_url: "https://journal.com/paper"
publication_date: 2024-11-15
publication_type: "peer-reviewed"
credibility_tier: 1
author: "Dr. Jane Smith"
tags: [interview, research]
---
# Expert Interview
This is the transcript of the expert interview.`
    );
    await createFile(
      workspace,
      'active/story-1/sources/data/20250109-research-summary.md',
      `---
title: "Research Summary"
source_url: "https://research.org/study"
publication_date: 2024-10-20
publication_type: "academic-study"
credibility_tier: 1
author: "Research Team"
tags: [research, summary]
---
# Research Summary
This is a summary of the research findings.`
    );
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects markdown files without source URLs in frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // No frontmatter at all - this should be caught by MISSING_YAML_FRONTMATTER rule
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-analysis.md',
      `# Analysis Document
Date Accessed: 2025-01-10
Original Publication: Journal, 2024
Content without frontmatter.`
    );
    // Frontmatter without source_url field
    await createFile(
      workspace,
      'active/story-1/sources/data/20250111-summary.md',
      `---
title: "Summary Document"
publication_date: 2024-12-01
author: "Someone"
---
# Summary
Content with frontmatter but no source_url.`
    );
    // Empty source_url in frontmatter
    await createFile(
      workspace,
      'active/story-1/sources/interviews/20250109-notes.md',
      `---
title: "Interview Notes"
source_url: ""
author: "Interviewer"
---
# Interview Notes
This document has empty source_url.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    expectViolationLocations(violations, [
      'active/story-1/sources/data/20250110-analysis.md',
      'active/story-1/sources/data/20250111-summary.md',
      'active/story-1/sources/interviews/20250109-notes.md'
    ]);
    // The first file has no frontmatter, so it should be caught
    // The second file has frontmatter but no source_url
    // The third file has empty source_url
    // All should be violations
    expect(violations![0].location).toContain('20250110-analysis.md');
    expect(violations![1].location).toContain('20250111-summary.md');
    expect(violations![2].location).toContain('20250109-notes.md');
    await cleanupTestWorkspace(workspace);
  });
  it('detects invalid source_url values', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Invalid URL formats that should be rejected
    const invalidFiles = [
      {
        path: 'active/story-1/sources/data/20250110-study1.md',
        content: `---
title: "Study 1"
source_url: "Multiple academic studies"
author: "Various"
---
# Study 1
Content based on multiple sources.`
      },
      {
        path: 'active/story-1/sources/data/20250111-study2.md',
        content: `---
title: "Study 2"
source_url: "not-a-valid-url"
author: "Someone"
---
# Study 2
Research compilation.`
      },
      {
        path: 'active/story-1/sources/data/20250112-study3.md',
        content: `---
title: "Study 3"
source_url: 12345
author: "Internal"
---
# Study 3
Internal analysis with numeric source_url.`
      }
    ];
    for (const file of invalidFiles) {
      await createFile(workspace, file.path, file.content);
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    // All should have invalid format messages
    for (const violation of violations!) {
      expect(violation.description).toContain('invalid source_url format');
    }
    await cleanupTestWorkspace(workspace);
  });
  it('ignores non-markdown files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Non-markdown files should not be checked
    await createFile(workspace, 'active/story-1/sources/documents/20250110-report.pdf', 'binary content');
    await createFile(workspace, 'active/story-1/sources/data/20250111-data.csv', 'column1,column2\nvalue1,value2');
    await createFile(workspace, 'active/story-1/sources/data/20250112-config.json', '{"key": "value"}');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('accepts valid URL formats in frontmatter', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    const validUrls = [
      'https://example.com/article',
      'http://legacy-site.org/page',
      'https://www.journal.edu/paper?id=123',
      'https://doi.org/10.1000/182',
      'https://arxiv.org/abs/2023.12345',
      'https://pubmed.ncbi.nlm.nih.gov/12345678/'
    ];
    for (let i = 0; i < validUrls.length; i++) {
      await createFile(
        workspace,
        `active/story-1/sources/data/2025011${i}-source-${i}.md`,
        `---
title: "Source ${i}"
source_url: "${validUrls[i]}"
publication_date: 2024-12-01
author: "Author ${i}"
---
# Source ${i}
Content from source ${i}.`
      );
    }
    const violations = await rule.check(workspace);
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
        `${dir}/${dir}-story/sources/data/20250110-analysis.md`,
        `---
title: "Analysis"
author: "Someone"
---
# Analysis
Content without source_url.`
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('validates source_url field type', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // source_url as array (invalid)
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-array-url.md',
      `---
title: "Multiple Sources"
source_url: 
  - "https://example.com/source1"
  - "https://example.com/source2"
author: "Someone"
---
# Multiple Sources
Content with array source_url.`
    );
    // source_url as object (invalid)
    await createFile(
      workspace,
      'active/story-1/sources/data/20250111-object-url.md',
      `---
title: "Complex Source"
source_url:
  main: "https://example.com"
  backup: "https://archive.org/example"
author: "Someone"
---
# Complex Source
Content with object source_url.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    // Both should have invalid format messages
    for (const violation of violations!) {
      expect(violation.description).toContain('invalid source_url format');
    }
    await cleanupTestWorkspace(workspace);
  });
  it('provides helpful error messages', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // No frontmatter
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-no-frontmatter.md',
      `# Missing URL Document
This document lacks frontmatter.`
    );
    // Missing source_url field
    await createFile(
      workspace,
      'active/story-1/sources/data/20250111-missing-field.md',
      `---
title: "Document"
author: "Someone"
---
# Document
This has frontmatter but no source_url.`
    );
    // Invalid URL format
    await createFile(
      workspace,
      'active/story-1/sources/data/20250112-invalid-url.md',
      `---
title: "Invalid URL"
source_url: "not a url"
---
# Invalid URL
This has an invalid URL.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    // Check different error messages
    expect(violations![0].description).toContain('must have YAML frontmatter with source_url field');
    expect(violations![1].description).toContain('missing required source_url field in frontmatter');
    expect(violations![2].description).toContain('invalid source_url format');
    // All should have the same title
    for (const violation of violations!) {
      expect(violation.title).toBe('Missing Source URL');
    }
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden files and directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', '.hidden-story');
    await createFile(workspace, 'active/.hidden-story/sources/data/20250110-file.md', 'Content without source');
    await createStory(workspace, 'active', 'visible-story');
    await createFile(workspace, 'active/visible-story/sources/data/.hidden-file.md', 'Content without source');
    await createFile(workspace, 'active/visible-story/sources/data/20250110-visible.md', 'Content without source');
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toContain('visible.md');
    await cleanupTestWorkspace(workspace);
  });
  it('provides correct violation properties', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    await createFile(
      workspace,
      'active/test-story/sources/data/20250110-test.md',
      `# Test Document
Date Accessed: 2025-01-10
Content without source URL.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'MISSING_SOURCE_URL',
      location: 'active/test-story/sources/data/20250110-test.md',
      severity: 'error'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('validates frontmatter edge cases', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Valid: source_url is case-sensitive field name
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-valid-case.md',
      `---
title: "Valid Case"
source_url: "https://example.com"
---
# Valid Case
Content.`
    );
    // Invalid: Source_URL (wrong case)
    await createFile(
      workspace,
      'active/story-1/sources/data/20250111-wrong-case.md',
      `---
title: "Wrong Case"
Source_URL: "https://example.com"
---
# Wrong Case
Content.`
    );
    // Invalid: sourceUrl (camelCase)
    await createFile(
      workspace,
      'active/story-1/sources/data/20250112-camel-case.md',
      `---
title: "Camel Case"
sourceUrl: "https://example.com"
---
# Camel Case
Content.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2); // Only the wrong-case variants should fail
    expectViolationLocations(violations, [
      'active/story-1/sources/data/20250111-wrong-case.md',
      'active/story-1/sources/data/20250112-camel-case.md'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('exempts files in synthesis subdirectories from source URL requirement', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Create directory structure
    await createDirectory(workspace, 'active/test-story/sources/synthesis');
    // Create synthesis files without frontmatter or with incomplete frontmatter
    await createFile(
      workspace,
      'active/test-story/sources/synthesis/20250110-synthesis.md',
      '# Synthesis Document\n\nThis is a synthesis of multiple sources.'
    );
    await createFile(
      workspace,
      'active/test-story/sources/synthesis/20250111-analysis.md',
      `---
title: "Analysis"
tags: [synthesis, analysis]
---
# Analysis Document
No source_url required for synthesis files.`
    );
    // Create a regular source file that should be flagged
    await createFile(
      workspace,
      'active/test-story/sources/data/20250112-data.md',
      '# Data file\nThis should be flagged for missing frontmatter.'
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toBe('active/test-story/sources/data/20250112-data.md');
    await cleanupTestWorkspace(workspace);
  });
  it('validates archive files with original_url instead of source_url', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'test-story');
    // Archive file with correct original_url
    await createFile(
      workspace,
      'active/test-story/sources/archives/20250117-nytimes-climate.md',
      `---
original_url: "https://nytimes.com/article/climate-change"
archived_date: 2025-01-17
archived_by: fact-checker-specialist
archive_method: webfetch
title: "Climate Change Article"
---
# Archived Content: Climate Change Article
This is the archived content.`
    );
    // Archive file with source_url instead of original_url (wrong field)
    await createFile(
      workspace,
      'active/test-story/sources/archives/20250117-guardian-report.md',
      `---
source_url: "https://guardian.com/report"
archived_date: 2025-01-17
archived_by: researcher-specialist
archive_method: manual
title: "Guardian Report"
---
# Archived Content: Guardian Report
This is the archived content.`
    );
    // Archive file missing URL entirely
    await createFile(
      workspace,
      'active/test-story/sources/archives/20250117-missing-url.md',
      `---
archived_date: 2025-01-17
archived_by: researcher-specialist
archive_method: manual
title: "Missing URL Archive"
---
# Archived Content
No URL provided.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(2);
    // Check that the violations are for the files with wrong/missing URLs
    const violationFiles = violations!.map((v) => v.location);
    expect(violationFiles).toContain('active/test-story/sources/archives/20250117-guardian-report.md');
    expect(violationFiles).toContain('active/test-story/sources/archives/20250117-missing-url.md');
    // Check that error messages mention original_url
    const guardianViolation = violations!.find((v) => v.location.includes('guardian-report'));
    expect(guardianViolation?.description).toContain('original_url');
    await cleanupTestWorkspace(workspace);
  });
});
