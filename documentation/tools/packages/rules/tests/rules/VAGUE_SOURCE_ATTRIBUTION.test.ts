import rule from '../../src/rules/VAGUE_SOURCE_ATTRIBUTION.js';
import { expectViolationLocations, createSourceFileContent } from '../lib/test-helpers.js';
import { createTestWorkspace, cleanupTestWorkspace, createStory, createFile } from '../lib/test-workspace.js';
describe('VAGUE_SOURCE_ATTRIBUTION Rule', () => {
  it('returns null when all sources have specific attributions', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Specific, acceptable sources
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-climate-study.md',
      createSourceFileContent('https://nature.com/articles/climate2024', true)
    );
    await createFile(
      workspace,
      'active/story-1/sources/data/20250111-health-research.md',
      `# Health Research Analysis
Source: https://pubmed.ncbi.nlm.nih.gov/12345678/
Date Accessed: 2025-01-11
Original Publication: New England Journal of Medicine, 2024
Specific research findings.`
    );
    await createFile(
      workspace,
      'active/story-1/sources/data/20250112-economic-data.md',
      `# Economic Data
Source: https://bls.gov/data/employment-2024
Date Accessed: 2025-01-12
Original Publication: Bureau of Labor Statistics, 2024
Employment statistics.`
    );
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('detects vague source attributions', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Various vague attributions
    const vagueFiles = [
      {
        path: 'active/story-1/sources/data/20250110-vague1.md',
        content: `# Vague Source 1
Source: Multiple academic studies
Date Accessed: 2025-01-10
Content based on multiple sources.`
      },
      {
        path: 'active/story-1/sources/data/20250111-vague2.md',
        content: `# Vague Source 2
Source: Various research papers
Date Accessed: 2025-01-11
Research compilation.`
      },
      {
        path: 'active/story-1/sources/data/20250112-vague3.md',
        content: `# Vague Source 3
Source: Several studies
Date Accessed: 2025-01-12
Multiple study analysis.`
      },
      {
        path: 'active/story-1/sources/data/20250113-vague4.md',
        content: `# Vague Source 4
Source: Internal documents
Date Accessed: 2025-01-13
Internal analysis.`
      }
    ];
    for (const file of vagueFiles) {
      await createFile(workspace, file.path, file.content);
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(4);
    expectViolationLocations(violations, [
      'active/story-1/sources/data/20250110-vague1.md',
      'active/story-1/sources/data/20250111-vague2.md',
      'active/story-1/sources/data/20250112-vague3.md',
      'active/story-1/sources/data/20250113-vague4.md'
    ]);
    await cleanupTestWorkspace(workspace);
  });
  it('detects case-insensitive vague patterns', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Different cases of vague attributions
    const vagueCases = [
      'Multiple Academic Studies',
      'VARIOUS RESEARCH PAPERS',
      'Several Studies',
      'multiple sources',
      'Various Documents',
      'INTERNAL DOCUMENTS'
    ];
    for (let i = 0; i < vagueCases.length; i++) {
      await createFile(
        workspace,
        `active/story-1/sources/data/2025011${i}-case-${i}.md`,
        `# Case ${i}
Source: ${vagueCases[i]}
Date Accessed: 2025-01-1${i}
Content with vague attribution.`
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(vagueCases.length);
    await cleanupTestWorkspace(workspace);
  });
  it('detects additional vague patterns', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    const additionalVague = [
      'Industry reports',
      'Expert interviews',
      'Government data',
      'Company filings',
      'News articles',
      'Public records',
      'Survey data',
      'Market research'
    ];
    for (let i = 0; i < additionalVague.length; i++) {
      await createFile(
        workspace,
        `active/story-1/sources/data/2025011${i}-additional-${i}.md`,
        `# Additional ${i}
Source: ${additionalVague[i]}
Date Accessed: 2025-01-1${i}
Content with additional vague pattern.`
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(additionalVague.length);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores specific sources that contain vague keywords', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // These should NOT be flagged as they're specific despite containing keywords
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-specific1.md',
      `# Specific Source 1
Source: https://journal-of-multiple-studies.com/article/2024
Date Accessed: 2025-01-10
This is a specific journal despite having 'multiple' in the name.`
    );
    await createFile(
      workspace,
      'active/story-1/sources/data/20250111-specific2.md',
      `# Specific Source 2
Source: https://various-research-institute.edu/paper/123
Date Accessed: 2025-01-11
This is a specific institute despite having 'various' in the name.`
    );
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
        `${dir}/${dir}-story/sources/data/20250110-vague.md`,
        `# Vague Source
Source: Multiple studies
Date Accessed: 2025-01-10
Vague attribution.`
      );
    }
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(3);
    await cleanupTestWorkspace(workspace);
  });
  it('ignores non-markdown files', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Non-markdown files should not be checked
    await createFile(workspace, 'active/story-1/sources/documents/20250110-report.pdf', 'binary content');
    await createFile(workspace, 'active/story-1/sources/data/20250111-data.csv', 'source,value\nMultiple studies,123');
    const violations = await rule.check(workspace);
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('handles files without source lines', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-no-source.md',
      `# Document Without Source
Date Accessed: 2025-01-10
This document has no source line at all.`
    );
    const violations = await rule.check(workspace);
    // Should not be flagged by this rule (handled by MISSING_SOURCE_URL)
    expect(violations).toBeNull();
    await cleanupTestWorkspace(workspace);
  });
  it('provides helpful error messages', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-vague.md',
      `# Vague Source
Source: Multiple academic studies
Date Accessed: 2025-01-10
Content with vague attribution.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation.title).toContain('Vague Source Attribution');
    expect(violation.description).toContain('Multiple academic studies');
    expect(violation.description).toContain('exact source URLs');
    expect(violation.description).toContain('specific');
    await cleanupTestWorkspace(workspace);
  });
  it('ignores hidden files and directories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', '.hidden-story');
    await createFile(workspace, 'active/.hidden-story/sources/data/20250110-vague.md', `Source: Multiple studies`);
    await createStory(workspace, 'active', 'visible-story');
    await createFile(workspace, 'active/visible-story/sources/data/.hidden-file.md', `Source: Multiple studies`);
    await createFile(
      workspace,
      'active/visible-story/sources/data/20250110-visible.md',
      `# Visible File
Source: Multiple studies
Date Accessed: 2025-01-10`
    );
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
Source: Various research papers
Date Accessed: 2025-01-10
Test content.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    const violation = violations![0];
    expect(violation).toMatchObject({
      code: 'VAGUE_SOURCE_ATTRIBUTION',
      location: 'active/test-story/sources/data/20250110-test.md',
      severity: 'error'
    });
    await cleanupTestWorkspace(workspace);
  });
  it('handles multi-source files correctly', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // File with mixed specific and vague sources
    await createFile(
      workspace,
      'active/story-1/sources/data/20250110-mixed.md',
      `# Mixed Sources
## Source 1
Source: https://specific-journal.com/article
Date Accessed: 2025-01-10
Content from specific source.
## Source 2
Source: Multiple academic studies
Date Accessed: 2025-01-10
Content from vague sources.
## Source 3
Source: https://another-specific.edu/paper
Date Accessed: 2025-01-10
More specific content.`
    );
    const violations = await rule.check(workspace);
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].description).toContain('Multiple academic studies');
    await cleanupTestWorkspace(workspace);
  });
  it('validates all source subdirectories', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Create vague sources in each subdirectory
    await createFile(workspace, 'active/story-1/sources/documents/20250110-doc.md', `Source: Various documents`);
    await createFile(
      workspace,
      'active/story-1/sources/interviews/20250111-interview.md',
      `Source: Multiple interviews`
    );
    await createFile(workspace, 'active/story-1/sources/data/20250112-data.md', `Source: Several studies`);
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
  it('exempts synthesis directory from URL requirements', async () => {
    const workspace = await createTestWorkspace();
    await createStory(workspace, 'active', 'story-1');
    // Create synthesis files with vague attributions - these should NOT be flagged
    await createFile(
      workspace,
      'active/story-1/sources/synthesis/20250110-synthesis.md',
      `# Research Synthesis
This document synthesizes insights from multiple sources including:
- Various academic studies
- Multiple research papers
- Several expert interviews
- Internal analysis documents
The patterns identified across these sources suggest...`
    );
    await createFile(
      workspace,
      'active/story-1/sources/synthesis/20250111-pattern-analysis.md',
      `# Pattern Analysis
Source: Synthesis of multiple research findings
Date: 2025-01-11
This analysis combines insights from various documents.`
    );
    // Also create a non-synthesis file with vague attribution for comparison
    await createFile(workspace, 'active/story-1/sources/data/20250110-vague.md', `Source: Multiple studies`);
    const violations = await rule.check(workspace);
    // Should only flag the non-synthesis file
    expect(violations).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations![0].location).toContain('sources/data/20250110-vague.md');
    expect(violations![0].location).not.toContain('synthesis');
    await cleanupTestWorkspace(workspace);
  });
});
