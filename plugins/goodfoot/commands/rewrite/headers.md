---
description: Optimize document headers for clarity and consistency
---

Review and optimize headers in documents to improve structure, clarity, and consistency. Update numbering, semantics, and header levels. Preserve header text unless changes improve clarity or correct style mismatches.

<user-message>
$ARGUMENTS
</user-message>

<input-format>
The `<user-message>` references one or more documents to optimize headers for. Each document path is designated as [INPUT_FILE].

<example>
If the `<user-message>` is "Optimize headers in /docs/guide.md", then:
- [INPUT_FILE] = `/docs/guide.md`
</example>
</input-format>

<modification-note>
**Direct modification:** Files will be updated in place. No new versions are created.
All non-header content is preserved exactly. Header text is preserved unless:
- Converting between action-oriented and descriptive styles based on content type
- Fixing clear grammatical or clarity issues
- Improving consistency within the same hierarchical level
</modification-note>

<xml-block-boundaries>
**Important:** Treat each top-level XML block as a distinct, independent section. Never reorganize or merge content across XML block boundaries.

Examples of distinct sections:
- `<instructions>` ... `</instructions>`
- `<input-format>` ... `</input-format>`
- `<examples>` ... `</examples>`
- `<validation-rules>` ... `</validation-rules>`

Headers within each XML block should be optimized independently. Do not renumber or restructure headers in a way that spans across different XML blocks.
</xml-block-boundaries>

<instructions>
## Step 1: Analyze Current Structure

Read [INPUT_FILE] and identify:
- Overall document hierarchy
- Header levels and their relationships
- Naming patterns and inconsistencies
- Redundant or overlapping sections
- Missing logical groupings
- XML block boundaries (each top-level XML block is a separate section)

## Step 2: Apply Header Optimization Rules

### Distinguish steps from descriptions
Determine whether content represents sequential steps or descriptive information.

**Sequential Steps** (use action-oriented titles):
- Tasks that must be performed in order
- Procedures with dependencies
- Instructions that build on previous actions
- Commands to execute

<example>
Sequential steps:
```markdown
## Phase 1: Initialize System
### Step 1.1: Load Configuration
### Step 1.2: Connect to Database
### Step 1.3: Start Services
```
</example>

**Descriptive Content** (use noun-based titles):
- Role descriptions and responsibilities
- System characteristics or properties
- General information or context
- Options or alternatives (not in sequence)
- Requirements or constraints
- Architectural components

<example>
Descriptive content:
```markdown
## System Architecture
### Core Components
### Data Flow Patterns
### Security Boundaries

## Agent Capabilities
### Language Processing
### Tool Integration
### Error Recovery
```
</example>

### Use appropriate title styles

**Preserve existing header text** unless it needs style correction:

**For sequential steps:** Use action-oriented, imperative verbs
<example>
Keep: "Configure Settings" ✓ (already action-oriented)
Change: "Configuration Details" → "Configure Settings" (was descriptive, should be action)
</example>

**For descriptive content:** Use noun-based, descriptive titles
<example>
Keep: "System Architecture" ✓ (already descriptive)
Change: "Configure System" → "System Configuration" (was action, should be descriptive)
</example>

**Do NOT change headers that are already appropriate:**
<example>
"Load Data" remains "Load Data" (for a sequential step)
"Data Sources" remains "Data Sources" (for descriptive content)
"Run Tests" remains "Run Tests" (for a sequential step)
"Test Framework" remains "Test Framework" (for descriptive content)
</example>

### Maintain consistent naming patterns
Ensure headers at the same level follow similar grammatical structures. Only modify headers when inconsistency is clear.

<example>
Needs change (inconsistent styles):
"Setup", "Building the Project", "Tests"
→ "Set Up", "Build Project", "Run Tests"

Already consistent (preserve as-is):
"Initialize", "Process", "Finalize" ✓
"Data Input", "Data Processing", "Data Output" ✓
</example>

### Use appropriate header levels
- Level 1 (#): Document title only
- Level 2 (##): Major phases or sections
- Level 3 (###): Steps within phases
- Level 4 (####): Sub-steps or grouped items

### Number sequential content appropriately
Use "Phase N:" and "Step N.M:" only for sequential procedures. Descriptive sections should not be numbered as steps.

**Note:** Numbering restarts within each XML block. Each block has its own independent numbering scheme.

<example>
Sequential (numbered):
```markdown
## Phase 1: Initialize
### Step 1.1: Load Configuration
### Step 1.2: Validate Input
```

Descriptive (not numbered as steps):
```markdown
## System Requirements
### Hardware Specifications
### Software Dependencies

## Available Options
### Authentication Methods
### Output Formats
```
</example>

<example>
Mixed content:
```markdown
## Agent Behavior  // Descriptive section
### Core Responsibilities  // Descriptive
### Performance Constraints  // Descriptive

## Phase 1: Process Request  // Sequential section
### Step 1.1: Parse Input  // Sequential
### Step 1.2: Validate Format  // Sequential
```
</example>

### Group related content under clear subsections
When a step has multiple distinct parts, use level 4 headers to organize.

<example>
### Step 3.2: Execute and Monitor

#### Step 3.2.1: Launch Process
[content]

#### Step 3.2.2: Track Progress
[content]

#### Step 3.2.3: Handle Results
[content]
</example>

### Remove redundant headers
Eliminate headers that duplicate information or create unnecessary nesting.

<example>
Remove: "### Overview" immediately after "## Introduction"
</example>

<example>
Remove: "### Details" when it's the only subsection
</example>

### Convert example headers to tags
Remove headers that introduce examples and wrap the content in `<example>` tags instead.

<example>
Before:
```markdown
### Step 4.3: Review Examples
Here's how to handle user input:
[example content]
```

After:
```markdown
<example>
Here's how to handle user input:
[example content]
</example>
```
</example>

<example>
Before:
```markdown
#### Example Implementation
function validate() { ... }
```

After:
```markdown
<example>
function validate() { ... }
</example>
```
</example>

### Format lists properly
Use numbered lists for sequential steps and bullet points for non-sequential items.

**Sequential items** (use numbers):
- Actions that must happen in order
- Steps with dependencies
- Procedures to follow

**Non-sequential items** (use bullets):
- Characteristics or properties
- Options to choose from
- Requirements or constraints
- Parallel tasks

<example>
Before:
```markdown
### Step 2.1: Process Data
- Load the configuration file
- Parse input parameters
- Validate data format
- Transform the data
- Save results
```

After (sequential):
```markdown
### Step 2.1: Process Data

1. Load the configuration file
2. Parse input parameters
3. Validate data format
4. Transform the data
5. Save results
```
</example>

<example>
Before:
```markdown
### Available Tools
1. File reader
2. Code analyzer
3. Test runner
4. Documentation generator
```

After (non-sequential):
```markdown
### Available Tools
- File reader
- Code analyzer
- Test runner
- Documentation generator
```
</example>

<example>
Before:
```markdown
### Step 3.2: Analyze Results
Do the following:
- Check that outputs are valid
- Ensure no errors occurred
- Verify performance metrics
Remember to log everything.
```

After:
```markdown
### Step 3.2: Analyze Results

- Outputs must be validated
- No errors should have occurred
- Performance metrics should be tracked

1. Check that outputs are valid
2. Ensure no errors occurred
3. Verify performance metrics
4. Log all analysis results
```
</example>

### Use hierarchical numbering for substeps
When steps have substeps, use decimal notation (1.1, 1.2, etc.).

<example>
Before:
```markdown
## Phase 2: Execute
- First prepare the environment
- Then run the main process
  - Start the service
  - Monitor progress
- Finally cleanup
```

After:
```markdown
## Phase 2: Execute

2.1. Prepare the environment
2.2. Run the main process:
  - Service will be started
  - Progress will be monitored
2.3. Cleanup resources
```
</example>

### Make headers scannable
Readers should understand the document flow from headers alone.

<example>
Poor scannability:
## Setup
### Prerequisites
### Installation
## Usage
### Basic
### Advanced

Good scannability:
## Set Up Environment
### Check Prerequisites
### Install Dependencies
## Use the Tool
### Execute Basic Commands
### Apply Advanced Features
</example>

### Handle conditional sections appropriately
Use clear conditional language for alternative paths.

<example>
"If X Exists"
</example>

<example>
"When Y is Empty"
</example>

<example>
"For Z Configuration"
</example>

### Optimize step references
Internal references should use clear identifiers.

<example>
"Repeat from Step 1.2" (not "step A")
</example>

<example>
"Continue to Phase 3" (not "the next section")
</example>

<example>
"Return to Step 2.1" (for specific jumps)
</example>

## Step 3: Respect XML Block Boundaries

When optimizing headers:
- Never merge or reorganize content across XML block boundaries
- Each XML block maintains its own independent structure
- Phase/step numbering restarts in each block
- Internal references within a block stay within that block
- Cross-block references must explicitly mention the target block

<example>
Incorrect: "Continue to Step 3.1" (when referring to another XML block)
Correct: "Continue to Step 3.1 in the validation section"
</example>

## Step 4: Validate Consistency

Ensure optimization maintains:
- Logical flow within each XML block
- Consistent terminology throughout each block
- Appropriate header hierarchy within blocks
- No orphaned subsections
- Clear relationships between phases within the same block
- Preservation of XML block independence

## Step 5: Apply Changes

Modify [INPUT_FILE] directly with:
- All headers optimized according to rules
- All content between headers preserved exactly
- Proper header hierarchy maintained within each XML block
- XML block boundaries preserved
- Internal references updated if needed

Use the Edit or MultiEdit tool to update the file in place.

## Step 6: Update Internal References

After applying all header changes, perform a final check to ensure all internal references match the new header names:

### Identify all internal references
Search for patterns that indicate step or section references:
- "see Step X.Y"
- "refer to Phase N"
- "as described in [section name]"
- "continue to Step"
- "return to Step"
- "repeat from Step"
- Links to headers (e.g., `[link text](#header-name)`)

### Update references to match new headers
- Replace old step numbers with new numbering scheme
- Update section names to match optimized headers
- Ensure markdown links point to correct header anchors
- Verify cross-references maintain logical flow

### Validate reference accuracy
- Each reference must point to an existing header
- Step numbers must match the actual hierarchy
- Phase references must align with new phase numbers
- All markdown anchor links must resolve correctly

<example>
Before: "see step 3 for details"
After: "see Step 2.3 for details"
</example>

<example>
Before: "return to Prerequisites Check"
After: "return to Step 1.1: Check Prerequisites"
</example>

<example>
Before: `[configuration](#setup-and-configuration)`
After: `[configuration](#phase-1-configure-environment)`
</example>
</instructions>

<other-examples>
<example>
**Process Documentation**

Before:
```markdown
## Setup and Configuration
### Getting Started
### Prerequisites Check
### Installation Process

## Main Processing
### Data Input
### Processing Steps
#### Step One
#### Step Two
### Output Generation

## Finishing Up
### Cleanup
### Final Steps
```

After:
```markdown
## Phase 1: Configure Environment
### Step 1.1: Check Prerequisites
### Step 1.2: Install Components

## Phase 2: Process Data
### Step 2.1: Load Input
### Step 2.2: Execute Transformations
#### Step 2.2.1: Apply Initial Transform
#### Step 2.2.2: Apply Secondary Transform
### Step 2.3: Generate Output

## Phase 3: Complete Operation
### Step 3.1: Clean Resources
### Step 3.2: Finalize Results
```
</example>

<example>
**API Documentation**

Before:
```markdown
## API Information
### Authentication Details
### Request Formats
### Response Formats

## Endpoints
### User Endpoints
#### Getting Users
#### Creating Users
### Data Endpoints
```

After:
```markdown
## Configure Authentication
### Set Up Credentials
### Define Request Format
### Handle Response Format

## Use API Endpoints
### Manage Users
#### Retrieve User Data
#### Create New Users
### Access Data Resources
```
</example>
</other-examples>