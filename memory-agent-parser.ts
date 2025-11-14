/**
 * Memory Agent Markdown Parser
 *
 * This module provides TypeScript regex patterns and utilities for parsing
 * markdown output from memory agents. It handles:
 * - Release items (with itemUid, reason, and token counts)
 * - Adoption items (with itemUid, reason, and optional releaseToMakeRoom)
 * - Agent identifiers and descriptions
 * - "None" cases for empty releases/adoptions
 */

/**
 * Pattern Definitions
 */

// Release item pattern: matches "- itemUid: ..., reason: ..., X tokens"
// Captures: itemUid, reason, tokens
// Example: "- itemUid: conversation-11.md, reason: Quality below threshold (0.45 < 0.50), 35 tokens"
const RELEASE_ITEM_PATTERN = /^-\s+itemUid:\s*([^\s,]+),\s*reason:\s*(.+?),\s*(\d+)\s+tokens$/gm;

// Adoption item pattern: matches "- itemUid: ..., reason: ...[, releaseToMakeRoom: ...]"
// Captures: itemUid, reason, optional releaseToMakeRoom
// Example: "- itemUid: conversation-30.md, reason: Direct alignment with accessibility specialization"
// Example: "- itemUid: conversation-25.md, reason: Highly relevant, releaseToMakeRoom: conversation-7.md"
const ADOPTION_ITEM_PATTERN = /^-\s+itemUid:\s*([^\s,]+),\s*reason:\s*(.+?)(?:,\s*releaseToMakeRoom:\s*([^\s,]+))?$/gm;

// Empty section pattern: matches "None" as the only content in releases/adoptions section
// Captures: presence of "None"
// Example: "# Releases\nNone"
const EMPTY_SECTION_PATTERN = /^None$/m;

// Agent identifier pattern: matches "# Identifier\n<agent-name>"
// Captures: agent name/id
// Example: "# Identifier\nreact-performance-optimization-agent"
const AGENT_IDENTIFIER_PATTERN = /^#\s+Identifier\s*\n\s*(.+?)$/m;

// Agent description pattern: matches "# Agent Description\n<description>"
// Captures: full description text (may span multiple lines)
// Example: "# Agent Description\nThis agent specializes in React performance optimization..."
const AGENT_DESCRIPTION_PATTERN = /^#\s+Agent\s+Description\s*\n\s*(.+?)(?=\n#|$)/ms;

// Section pattern: matches section headers like "# Releases", "# Adoptions", "# Reasoning"
// Captures: section name
const SECTION_PATTERN = /^#\s+([A-Za-z\s]+?)$/m;

/**
 * Interface definitions for parsed data
 */

interface ReleaseItem {
  itemUid: string;
  reason: string;
  tokens: number;
}

interface AdoptionItem {
  itemUid: string;
  reason: string;
  releaseToMakeRoom?: string;
}

interface AgentInfo {
  identifier: string;
  description: string;
}

interface ParsedReleases {
  isEmpty: boolean;
  items: ReleaseItem[];
}

interface ParsedAdoptions {
  isEmpty: boolean;
  items: AdoptionItem[];
}

/**
 * Utility function to extract section content
 *
 * @param markdown - The markdown text to parse
 * @param sectionName - The section name to extract (e.g., "Releases", "Adoptions")
 * @returns The content of the section as a string
 */
function extractSection(markdown: string, sectionName: string): string {
  // Match section header and capture everything until the next section or end
  const sectionRegex = new RegExp(
    `^#\\s+${sectionName}\\s*$\\n([\\s\\S]*?)(?=^#\\s|$)`,
    'm'
  );
  const match = markdown.match(sectionRegex);
  return match ? match[1].trim() : '';
}

/**
 * Parses release items from markdown output
 *
 * Handles two cases:
 * 1. Release items with format: "- itemUid: X, reason: Y, N tokens"
 * 2. Empty releases indicated by "None"
 *
 * @param markdown - The markdown text to parse
 * @returns ParsedReleases object with isEmpty flag and items array
 * @throws Error if parsing fails on non-"None" content
 */
function parseReleases(markdown: string): ParsedReleases {
  const releasesSection = extractSection(markdown, 'Releases');

  if (!releasesSection) {
    return { isEmpty: true, items: [] };
  }

  // Check for "None" case
  if (EMPTY_SECTION_PATTERN.test(releasesSection)) {
    return { isEmpty: true, items: [] };
  }

  const items: ReleaseItem[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex for global flag
  RELEASE_ITEM_PATTERN.lastIndex = 0;

  while ((match = RELEASE_ITEM_PATTERN.exec(releasesSection)) !== null) {
    items.push({
      itemUid: match[1],
      reason: match[2].trim(),
      tokens: parseInt(match[3], 10),
    });
  }

  if (items.length === 0 && releasesSection.length > 0) {
    throw new Error(
      `Failed to parse release items. Section content: "${releasesSection}"`
    );
  }

  return { isEmpty: false, items };
}

/**
 * Parses adoption items from markdown output
 *
 * Handles two cases:
 * 1. Adoption items with optional releaseToMakeRoom field
 * 2. Empty adoptions indicated by "None"
 *
 * @param markdown - The markdown text to parse
 * @returns ParsedAdoptions object with isEmpty flag and items array
 * @throws Error if parsing fails on non-"None" content
 */
function parseAdoptions(markdown: string): ParsedAdoptions {
  const adoptionsSection = extractSection(markdown, 'Adoptions');

  if (!adoptionsSection) {
    return { isEmpty: true, items: [] };
  }

  // Check for "None" case
  if (EMPTY_SECTION_PATTERN.test(adoptionsSection)) {
    return { isEmpty: true, items: [] };
  }

  const items: AdoptionItem[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex for global flag
  ADOPTION_ITEM_PATTERN.lastIndex = 0;

  while ((match = ADOPTION_ITEM_PATTERN.exec(adoptionsSection)) !== null) {
    const item: AdoptionItem = {
      itemUid: match[1],
      reason: match[2].trim(),
    };

    // Only add releaseToMakeRoom if it was captured
    if (match[3]) {
      item.releaseToMakeRoom = match[3];
    }

    items.push(item);
  }

  if (items.length === 0 && adoptionsSection.length > 0) {
    throw new Error(
      `Failed to parse adoption items. Section content: "${adoptionsSection}"`
    );
  }

  return { isEmpty: true, items };
}

/**
 * Parses agent identifier from markdown output
 *
 * Expected format:
 * # Identifier
 * react-performance-optimization-agent
 *
 * @param markdown - The markdown text to parse
 * @returns The agent identifier string
 * @throws Error if identifier is not found
 */
function parseAgentIdentifier(markdown: string): string {
  const match = markdown.match(AGENT_IDENTIFIER_PATTERN);

  if (!match) {
    throw new Error('Agent identifier not found in markdown');
  }

  return match[1].trim();
}

/**
 * Parses agent description from markdown output
 *
 * Expected format:
 * # Agent Description
 * This agent specializes in React performance optimization...
 *
 * Note: Description can span multiple lines until the next section
 *
 * @param markdown - The markdown text to parse
 * @returns The agent description string
 * @throws Error if description is not found
 */
function parseAgentDescription(markdown: string): string {
  const match = markdown.match(AGENT_DESCRIPTION_PATTERN);

  if (!match) {
    throw new Error('Agent description not found in markdown');
  }

  return match[1].trim();
}

/**
 * Complete parser that extracts all available information from agent markdown
 *
 * @param markdown - The markdown text to parse
 * @returns Object containing parsed releases, adoptions, and agent info
 */
function parseAgentMarkdown(markdown: string) {
  return {
    releases: parseReleases(markdown),
    adoptions: parseAdoptions(markdown),
    agentIdentifier: parseAgentIdentifier(markdown),
    agentDescription: parseAgentDescription(markdown),
  };
}

/**
 * TEST CASES
 *
 * Run with: npx ts-node memory-agent-parser.ts
 */

// Test 1: Release Output Example
const releaseOutputExample = `# Releases
- itemUid: conversation-11.md, reason: Quality below threshold (0.45 < 0.50), 35 tokens
- itemUid: conversation-31.md, reason: Quality below threshold (0.40 < 0.50), 25 tokens

# Reasoning
Under severe capacity pressure...
`;

// Test 2: Empty Release Example
const emptyReleaseExample = `# Releases
None

# Reasoning
All documents align with specialization...
`;

// Test 3: Adoption Output Example
const adoptionOutputExample = `# Adoptions
- itemUid: conversation-30.md, reason: Direct alignment with accessibility specialization
- itemUid: conversation-25.md, reason: Highly relevant, releaseToMakeRoom: conversation-7.md

# Reasoning
Prioritizing items that...
`;

// Test 4: Agent Creation Example
const agentCreationExample = `# Identifier
react-performance-optimization-agent

# Agent Description
This agent specializes in React performance optimization and component rendering efficiency.
`;

// Test 5: Complex example with all sections
const complexExample = `# Releases
- itemUid: conversation-11.md, reason: Quality below threshold (0.45 < 0.50), 35 tokens
- itemUid: conversation-31.md, reason: Quality below threshold (0.40 < 0.50), 25 tokens

# Adoptions
- itemUid: conversation-30.md, reason: Direct alignment with accessibility specialization
- itemUid: conversation-25.md, reason: Highly relevant, releaseToMakeRoom: conversation-7.md

# Identifier
react-performance-optimization-agent

# Agent Description
This agent specializes in React performance optimization and component rendering efficiency.

# Reasoning
Under severe capacity pressure, we're prioritizing high-impact items.
`;

/**
 * Run all tests
 */
function runTests() {
  console.log('='.repeat(80));
  console.log('MEMORY AGENT MARKDOWN PARSER - TEST SUITE');
  console.log('='.repeat(80));

  // Test 1: Release Output
  console.log('\nTest 1: Release Output with Multiple Items');
  console.log('-'.repeat(80));
  try {
    const result = parseReleases(releaseOutputExample);
    console.log('SUCCESS');
    console.log('Result:', JSON.stringify(result, null, 2));
    if (result.items.length === 2) {
      console.log('✓ Correctly parsed 2 release items');
      console.log('✓ Item 1:', result.items[0]);
      console.log('✓ Item 2:', result.items[1]);
    } else {
      console.log('✗ FAILED: Expected 2 items, got', result.items.length);
    }
  } catch (error) {
    console.log('ERROR:', error instanceof Error ? error.message : error);
  }

  // Test 2: Empty Release
  console.log('\nTest 2: Empty Release Section');
  console.log('-'.repeat(80));
  try {
    const result = parseReleases(emptyReleaseExample);
    console.log('SUCCESS');
    console.log('Result:', JSON.stringify(result, null, 2));
    if (result.isEmpty && result.items.length === 0) {
      console.log('✓ Correctly identified empty release section');
    } else {
      console.log('✗ FAILED: Expected isEmpty=true and empty items');
    }
  } catch (error) {
    console.log('ERROR:', error instanceof Error ? error.message : error);
  }

  // Test 3: Adoption Output
  console.log('\nTest 3: Adoption Output with Mixed Items');
  console.log('-'.repeat(80));
  try {
    const result = parseAdoptions(adoptionOutputExample);
    console.log('SUCCESS');
    console.log('Result:', JSON.stringify(result, null, 2));
    if (result.items.length === 2) {
      console.log('✓ Correctly parsed 2 adoption items');
      console.log('✓ Item 1:', result.items[0]);
      console.log('✓ Item 2:', result.items[1]);
      if (result.items[1].releaseToMakeRoom === 'conversation-7.md') {
        console.log('✓ Correctly extracted optional releaseToMakeRoom field');
      }
    } else {
      console.log('✗ FAILED: Expected 2 items, got', result.items.length);
    }
  } catch (error) {
    console.log('ERROR:', error instanceof Error ? error.message : error);
  }

  // Test 4: Agent Info
  console.log('\nTest 4: Agent Identifier and Description');
  console.log('-'.repeat(80));
  try {
    const identifier = parseAgentIdentifier(agentCreationExample);
    const description = parseAgentDescription(agentCreationExample);
    console.log('SUCCESS');
    console.log('Identifier:', identifier);
    console.log('Description:', description);
    if (
      identifier === 'react-performance-optimization-agent' &&
      description.includes('React performance optimization')
    ) {
      console.log('✓ Correctly parsed agent identifier and description');
    } else {
      console.log('✗ FAILED: Parsing mismatch');
    }
  } catch (error) {
    console.log('ERROR:', error instanceof Error ? error.message : error);
  }

  // Test 5: Complex Example
  console.log('\nTest 5: Complex Example with All Sections');
  console.log('-'.repeat(80));
  try {
    const result = parseAgentMarkdown(complexExample);
    console.log('SUCCESS');
    console.log('Parsed Results:', JSON.stringify(result, null, 2));
    if (
      result.releases.items.length === 2 &&
      result.adoptions.items.length === 2 &&
      result.agentIdentifier === 'react-performance-optimization-agent'
    ) {
      console.log('✓ All sections parsed correctly');
    } else {
      console.log('✗ FAILED: Some sections not parsed correctly');
    }
  } catch (error) {
    console.log('ERROR:', error instanceof Error ? error.message : error);
  }

  // Test 6: Edge Cases
  console.log('\nTest 6: Edge Cases');
  console.log('-'.repeat(80));

  // Test 6a: Release with special characters in reason
  const edgeCase1 = `# Releases
- itemUid: doc-with-special-chars.md, reason: Contains <tags>, [brackets], and (parentheses), 42 tokens
`;
  try {
    const result = parseReleases(edgeCase1);
    console.log('Edge Case 6a - Special characters in reason: SUCCESS');
    console.log('✓ Item:', result.items[0]);
  } catch (error) {
    console.log('Edge Case 6a - FAILED:', error instanceof Error ? error.message : error);
  }

  // Test 6b: Adoption without releaseToMakeRoom
  const edgeCase2 = `# Adoptions
- itemUid: conversation-100.md, reason: Simple adoption without roomRelease
`;
  try {
    const result = parseAdoptions(edgeCase2);
    console.log('\nEdge Case 6b - Adoption without releaseToMakeRoom: SUCCESS');
    console.log('✓ Item:', result.items[0]);
    if (!result.items[0].releaseToMakeRoom) {
      console.log('✓ releaseToMakeRoom correctly absent');
    }
  } catch (error) {
    console.log('Edge Case 6b - FAILED:', error instanceof Error ? error.message : error);
  }

  // Test 6c: Agent description spanning multiple lines
  const edgeCase3 = `# Identifier
multiline-agent

# Agent Description
This is a multi-line description.
It spans multiple lines.
And has multiple sentences.
`;
  try {
    const identifier = parseAgentIdentifier(edgeCase3);
    const description = parseAgentDescription(edgeCase3);
    console.log('\nEdge Case 6c - Multi-line description: SUCCESS');
    console.log('✓ Identifier:', identifier);
    console.log('✓ Description (first 60 chars):', description.substring(0, 60) + '...');
  } catch (error) {
    console.log('Edge Case 6c - FAILED:', error instanceof Error ? error.message : error);
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST SUITE COMPLETED');
  console.log('='.repeat(80));
}

// Execute tests when run directly
if (require.main === module) {
  runTests();
}

// Export for use as module
export {
  RELEASE_ITEM_PATTERN,
  ADOPTION_ITEM_PATTERN,
  EMPTY_SECTION_PATTERN,
  AGENT_IDENTIFIER_PATTERN,
  AGENT_DESCRIPTION_PATTERN,
  SECTION_PATTERN,
  ReleaseItem,
  AdoptionItem,
  AgentInfo,
  ParsedReleases,
  ParsedAdoptions,
  parseReleases,
  parseAdoptions,
  parseAgentIdentifier,
  parseAgentDescription,
  parseAgentMarkdown,
  extractSection,
};
