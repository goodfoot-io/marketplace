---
description: Analyze producer and consumer components for integration incompatibilities
---

Analyze producer and consumer components to identify genuine integration incompatibilities that would prevent successful consumption or processing, while recognizing Claude Code design patterns. Ultrathink.

<user-message>
$ARGUMENTS
</user-message>

Verify these are NOT incompatibilities:

**Standard Claude Code Patterns** (DO NOT report as issues):
- **Task() Integration**: Calls like `Task(description="...", subagent_type="general-purpose", prompt=...)` - Standard Claude processing
- **@ File References**: Syntax like `@file/path` or `@.claude/commands/file.md` - Intentional context management  
- **Agent Autonomy**: Format/technique selection flexibility - Designed adaptive behavior
- **Response-Based Outputs**: Agents outputting results in response format - Standard communication pattern
- **Bash Utility Integration**: Scripts transforming data between components - May resolve apparent format mismatches
- **Format Flexibility**: Multiple output formats or adaptive formatting - Intentional design feature
- **Terminology Differences**: Different terms serving distinct functional purposes - May be intentional

**Evidence Requirements**: For any reported incompatibility, provide:
- Concrete failure scenario with specific error conditions
- Verification that no utility scripts resolve the mismatch  
- Proof of actual processing failure (not theoretical format differences)
- Consumer parsing/validation code that would break

**Multi-Format Verification**: Check if producer supports multiple output formats and verify if ANY format aligns with consumer expectations.

First, thoroughly examine:
1. The producer component - what it generates or creates
2. Any consumer components - what they process, verify, or expect
3. Any authoritative references or standards mentioned by either component
4. Examples within each file that demonstrate expected formats

Look for these critical mismatch patterns:
- Conflicting instructions within the same file
- Differences between stated rules and provided examples
- Format specifications that contradict between files
- Required elements in one file that are optional or missing in another
- Terminology and naming conventions that don't align
- Structural organization and section ordering differences

<analysis>
1. Extract the complete output format from the producer - look for templates, examples, or generation code
2. Extract what the consumer expects - find all checks, error messages, and requirements
3. If referenced, find any authoritative standard or reference that defines the expected format
4. Perform these specific compatibility checks:
   
   **Header/Title Formatting Patterns**:
   - Analyze formatting rules for primary identifiers or headers
   - Look for variations in punctuation, spacing, and capitalization conventions
   - Compare emphatic instructions (IMPORTANT, MUST, etc.) with actual examples
   - Check for processing errors that contradict producer guidance
   - Identify ambiguity where multiple valid interpretations exist
   - Note if different sources show conflicting format patterns
   
   **Required vs Optional Elements**:
   - Map which structural elements appear in producer's template
   - Map which structural elements the consumer expects or requires
   - Identify elements that consumer requires but producer omits
   - Identify elements that producer includes but consumer doesn't process
   
   **Structural Component Inventory**:
   - List all major components in producer's output format
   - List all components required by consumer's processing rules
   - Compare presence/absence of each component type
   - Note which components are mandatory vs optional in each context
   
   **Terminology and Naming Alignment**:
   - Identify sections or components using different terms for same concept
   - Check if canonical terminology is defined and consistently applied
   - Look for terminology variations that would cause recognition failures
   
   **Standardized Output Formats**:
   - Analyze required format for generated outputs (test results, findings)
   - Compare documented format specifications with actual examples
   - Look for mandatory fields and their expected structure
   - Check if outputs follow defined templates consistently
   - Identify missing required documentation elements
   - Note if format flexibility contradicts stated requirements
   
   **Relationship/Connection Mapping**:
   - Compare how relationships between components are organized
   - Check categorization patterns (quantitative vs qualitative grouping)
   - Analyze if grouping criteria differ (threshold-based vs concept-based)
   - Look for required organizational structures and their naming
   - Check if metrics or measurements are presented differently
   - Identify structural organization mismatches between producer and consumer
   
   **Procedural Content Organization**:
   - Check if step-by-step content appears as separate or embedded sections
   - Compare whether procedural elements are integrated or standalone
   - Analyze enumeration and formatting of sequential items
   - Look for differences in how procedures reference external elements
   
   **Section Structure and Ordering**:
   - Extract the canonical section order if defined
   - Compare actual section sequence against documented requirements
   - Check if missing or reordered sections would cause recognition failures

5. For each mismatch found:
   - Quote the specific conflicting text from both files
   - Show exact line numbers
   - Explain the impact on integration or consumption
</analysis>

## Classification and Reporting

Before reporting, classify each potential issue:

**Classification Standards**:
- **Critical**: Prevents successful integration with concrete evidence of failure
- **Major**: Requires manual intervention with processing impact and supporting evidence  
- **Minor**: Cosmetic differences with no functional impact
- **Design Feature**: Intentional Claude Code pattern that enables flexibility (EXCLUDE from report)
- **Insufficient Evidence**: Cannot demonstrate actual integration failure (EXCLUDE from report)

**ONLY REPORT** issues classified as Critical, Major, or Minor with proper evidence.

## Verified Integration Issues

Report ONLY verified incompatibilities using this format:

For each verified mismatch:
### [Number]. [Issue Name] [Classification: Critical/Major/Minor]

**Issue**: [Brief description]

**Evidence**:
- **Failure Scenario**: [Specific scenario where integration would fail]
- **Error Conditions**: [Exact error messages or processing failures that would occur]

**Details**:
- **Producer** ([filename]:[line]): [Quote exact text/instruction]
- **Consumer/Reference** ([filename]:[line]): [Quote expected format]
- **Impact**: [How this prevents successful integration]
- **Verification**: [Proof this is not resolved by utilities or alternative formats]

Focus especially on:
- Conflicting instructions within the same file
- Differences between examples and stated requirements
- Missing required elements
- Naming or terminology mismatches
- Format details that would cause processing errors

Refer to components by their file paths as provided in the user message.