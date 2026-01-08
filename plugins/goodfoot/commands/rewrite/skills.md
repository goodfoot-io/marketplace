---
description: Rewrite skills for maximum coherence and efficacy
disable-model-invocation: true
---

Rewrite specified skills to maximize coherence, efficacy, and Claude's autonomous discovery. Preserve all substantive elements while restructuring for optimal model performance and progressive disclosure.

<input-format>
$ARGUMENTS references one or more skill paths to transform. Each path is designated as [INPUT_SKILL].

**Example**: If $ARGUMENTS is "plugins/project/skills/spike", then:
- [INPUT_SKILL_1] = `plugins/project/skills/spike`
- [INPUT_SKILL_1_DIR] = `plugins/project/skills/spike/` (the skill directory)
- [INPUT_SKILL_1_FILE] = `plugins/project/skills/spike/SKILL.md` (the main skill file)

For router-style skills with multiple files:
- [INPUT_SKILL_1] = `plugins/project/skills/standard-output-formats`
- [INPUT_SKILL_1_DIR] = `plugins/project/skills/standard-output-formats/`
- [INPUT_SKILL_1_FILE] = `plugins/project/skills/standard-output-formats/SKILL.md`
- [INPUT_SKILL_1_SUPPORTING] = `plugins/project/skills/standard-output-formats/formats/*.md` (or `instructions/*.md`, etc.)

Note: Router-style skills may organize supporting files in subdirectories like `formats/`, `instructions/`, `reference/`, or other semantic names.
</input-format>

<versioning>
**Pattern**: `[original-name]-v[N]/`

Skills are directories, not single files. Version the entire skill directory:
- First revision: `spike/` → `spike-v2/`
- Subsequent revisions: `spike-v2/` → `spike-v3/`
- Never overwrite existing versions
- Increment version number until an available slot is found

All files within the skill directory are copied to the new versioned directory.
</versioning>

<preservation-requirements>
**Preserve without modification:**
- All algorithms and code blocks
- Directory structures within skill folders
- File paths and script references
- Numeric values and heuristics
- Technical specifications
- Bash commands in embedded bash blocks
- Placeholder variables like `{baseDir}`, `[PLACEHOLDER]`
- Script files in subdirectories (e.g., `scripts/`, `formats/`)

**Preserve structural patterns:**
- Single-file skills: All content in SKILL.md
- Router-style skills: SKILL.md + supporting files in subdirectories
- Progressive disclosure architecture

No information may be added or removed—only restructured and rewritten for clarity and effectiveness.
</preservation-requirements>

<skill-fundamentals>
## What Are Skills?

Skills are **model-invoked capabilities** that Claude autonomously selects based on semantic matching. Unlike slash commands (user-invoked), skills activate when Claude determines they're relevant to the current task.

**Core Architecture:**
- **Progressive Disclosure**: Metadata loads at startup (~100 tokens), full SKILL.md loads when invoked (<5k tokens), supporting files load on-demand
- **Directory Structure**: Each skill is a directory containing SKILL.md (required) plus optional supporting files
- **Autonomous Activation**: Claude reads skill descriptions and decides when to use them based on natural language understanding

**Critical Success Factor:**
The `description` field in frontmatter determines discoverability. It must signal both **functionality** (what the skill does) AND **context** (when to use it).
</skill-fundamentals>

<skill-structure>
## SKILL.md File Structure

Every skill begins with YAML frontmatter followed by markdown instructions:

```yaml
---
name: skill-identifier
description: What the skill does AND when Claude should use it
allowed-tools: "Read,Grep,Bash(git:*)"  # Optional: Restrict tool access
model: sonnet                           # Optional: Override model
---
```

### Required Frontmatter Fields

**name**: Lowercase with hyphens, use gerund form (verb + "-ing")
- ✅ `processing-pdfs`, `analyzing-spreadsheets`, `extracting-code-references`
- ❌ `pdf-processor`, `spreadsheet-analysis`, `code-reference-extractor`

**description**: Explain what AND when (max 1024 characters)
- Must be specific with trigger keywords
- Include capabilities and usage context
- Use third person perspective
- Formula: `[Verb] [specific capabilities], [additional capabilities]. Use when [context/trigger keywords].`

**Examples of effective descriptions:**
- ✅ "Extract text and tables from PDFs, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs."
- ✅ "Conduct empirical technical investigations using isolated subagents to compare alternatives or validate assumptions through prototype testing."
- ❌ "Helps with documents" (too vague)
- ❌ "Tool for processing files" (no trigger context)

### Optional Frontmatter Fields

- `allowed-tools`: Restrict Claude's capabilities (enables read-only or sandboxed execution)
- `model`: Override model for skill execution
- `license`: Licensing information

### Body Organization (Progressive Disclosure)

**For Single-File Skills** (< 500 lines):
```markdown
# Skill Name

## Overview
Brief summary (2-3 sentences)

## Quick Start
Most common use case with simple example

## Detailed Instructions
Step-by-step workflows for major tasks

## Common Patterns
- Pattern 1: [description]
- Pattern 2: [description]

## Examples
Input/output pairs showing expected behavior

## Reference
Links to detailed documentation

## Troubleshooting
Common issues and solutions
```

**For Router-Style Skills** (main file + supporting files):
```markdown
# Skill Name

## Overview
Comprehensive summary of all capabilities

## Quick Navigation
- **Capability 1**: See file-1.md for [description]
- **Capability 2**: See file-2.md for [description]
- **Capability 3**: See file-3.md for [description]

## Supported Operations
Summary table or list of all operations

## Examples by Use Case
1. Use case 1: See file-1.md (Quick Start)
2. Use case 2: See file-2.md (Section Name)

## Scripts
- `{baseDir}/scripts/tool-1.py` - Description
- `{baseDir}/scripts/tool-2.sh` - Description
```

**File Organization Best Practices:**
```
skill-name/
├── SKILL.md              # Core instructions (< 500 lines)
├── reference.md          # Detailed specifications (optional)
├── examples.md           # Complex examples (optional)
└── scripts/              # Executable helpers (optional)
    ├── tool-1.py
    └── tool-2.sh
```

OR for router-style:

```
skill-name/
├── SKILL.md              # Router + overview
├── formats/              # Supporting files (or instructions/, reference/, etc.)
│   ├── capability-1.md
│   ├── capability-2.md
│   └── capability-3.md
└── scripts/              # Shared scripts (optional)
    └── helpers/
```

Common subdirectory names for router-style skills:
- `formats/` - For format-specific instructions (e.g., standard-output-formats)
- `instructions/` - For technique-specific guidance (e.g., explanation-techniques)
- `reference/` - For detailed API/specification documentation
- `examples/` - For comprehensive example collections
- `scripts/` - For executable helper scripts

**Keep reference depth to ONE level:**
- ✅ SKILL.md → reference.md (stops here)
- ❌ SKILL.md → guide.md → advanced.md → details.md (too deep)
</skill-structure>

# Transformation Process

## Step 1: Parse and Analyze

Read [INPUT_SKILL] to identify:
- Skill type: Single-file or router-style
- Frontmatter: name, description, optional fields
- Content organization: sections, workflows, examples
- Supporting files: scripts, references, subdirectories
- Technical specifications and code blocks
- Placeholder patterns and variables

**Assess current quality:**
- Is the description specific with trigger keywords?
- Is the name using gerund form?
- Is SKILL.md under 500 lines?
- Are file references one level deep?
- Is terminology consistent?
- Are instructions concise?
- Do examples show input/output patterns?

## Step 2: Apply Transformation Rules

### Improve Description for Discoverability

**Description formula:**
```
[Verb] [specific capabilities], [additional capabilities]. Use when [context/trigger keywords].
```

**Transformation examples:**

Before: `"Tool for processing documents"`
After: `"Process PDFs, Word documents, and spreadsheets. Extract text, create reports, merge files, analyze data. Use when working with document files or when the user mentions PDFs, spreadsheets, or Word documents."`

Before: `"Helps with code analysis"`
After: `"Analyze code for performance bottlenecks, security vulnerabilities, and design patterns. Use when the user requests code review, optimization, auditing, or refactoring suggestions."`

**Include specific trigger keywords:**
- Technology names: "PDFs", "React", "TypeScript", "Redis"
- Action verbs: "extract", "analyze", "merge", "create", "validate"
- User-facing terms: What users would naturally say when they need this skill
- Context phrases: "Use when working with...", "Use when the user mentions...", "Use for..."

### Fix Naming Convention

Use gerund form (verb + "-ing"):

| Current | Transformed |
|---------|-------------|
| `pdf-processor` | `processing-pdfs` |
| `spreadsheet-analyzer` | `analyzing-spreadsheets` |
| `dependency-manager` | `managing-dependencies` |
| `code-reference-extractor` | `extracting-code-references` |

### Use Clear, Directive Language

Convert indirect phrasing to direct instructions:

Before: `"The user might want Claude to check for errors."`
After: `"Check for errors in the specified files."`

Before: `"It would be helpful if you could analyze the data."`
After: `"Analyze data using the specified criteria."`

Before: `"You can extract text from PDFs if needed."`
After: `"Extract text from PDFs using the extraction script."`

### Eliminate Unnecessary Verbosity

Remove filler words while preserving necessary context:

Before: `"Please be so kind as to carefully review and thoroughly analyze this codebase."`
After: `"Review and analyze this codebase."`

Before: `"I would really appreciate it if you could help me understand how this works."`
After: `"Explain how this system works."`

### Optimize Step Presentation

**Use numbered steps for sequential workflows:**
```markdown
## Extracting Text from PDFs

1. Validate PDF file exists using `{baseDir}/scripts/validate.py`
2. Extract text using `{baseDir}/scripts/extract.py /path/to/file.pdf`
3. Save output to specified location
4. Verify extraction completed successfully
```

**Use thinking prompts for complex reasoning:**
```markdown
## Analyzing Security Vulnerabilities

Analyze the codebase for security vulnerabilities. Consider OWASP top 10 issues, authentication problems, and data exposure risks. Think through your analysis step-by-step before providing recommendations.
```

### Provide Explicit Context and Motivation

Explain why behaviors or constraints matter:

Before: `"Don't use deprecated functions."`
After: `"Avoid deprecated functions—they may be removed in future versions and lack security updates."`

Before: `"Validate input."`
After: `"Validate all input—this API handles financial data where invalid inputs could cause transaction errors or data corruption."`

### Include Comprehensive Examples

**Effective example pattern:**
```markdown
## Example: Merging PDF Documents

**Input:** Three PDF files at `/data/report-1.pdf`, `/data/report-2.pdf`, `/data/report-3.pdf`

**Process:**
1. Validate all files exist: `{baseDir}/scripts/validate.py /data/report-*.pdf`
2. Merge in order: `{baseDir}/scripts/merge.py /data/report-1.pdf /data/report-2.pdf /data/report-3.pdf /data/merged-report.pdf`
3. Verify page count: `{baseDir}/scripts/count-pages.py /data/merged-report.pdf`

**Output:**
```
✓ Validated 3 files
✓ Merged into /data/merged-report.pdf
✓ Total pages: 47
```
```

### Preserve Technical Artifacts with Fidelity

Copy code blocks, regexes, directory trees, file paths, and commands exactly:

```markdown
## Directory Structure
```
project/
├── SKILL.md
├── scripts/
│   ├── extract.py
│   └── merge.py
└── examples/
    └── sample.pdf
```
```

### Structure for Progressive Disclosure

**For overly long skills (>500 lines):**

Before:
```
skill-name/
└── SKILL.md (1200 lines of everything)
```

After:
```
skill-name/
├── SKILL.md (400 lines - overview + core workflows)
├── reference.md (detailed API specifications)
├── advanced-examples.md (complex usage patterns)
└── scripts/
    └── helpers/
```

**SKILL.md becomes router:**
```markdown
# Skill Name

## Overview
[Brief summary of all capabilities]

## Quick Start
[Most common use case]

## Detailed Instructions
[Core workflows with moderate detail]

## Advanced Usage
See reference.md for detailed API specifications and advanced-examples.md for complex patterns.

## Scripts
- `{baseDir}/scripts/extract.py` - Extract text from documents
- `{baseDir}/scripts/merge.py` - Merge multiple documents
```

### Maintain Consistent Terminology

Establish standard terms and use them consistently:

Before (inconsistent):
```markdown
Extract text... pull out data... grab information from PDFs...
```

After (consistent):
```markdown
Extract text from PDFs... Extract data tables... Extract metadata...
```

**Create a terminology table if needed:**
```markdown
## Terminology
- **Extract**: Pull text, tables, or metadata from existing documents
- **Merge**: Combine multiple documents into a single file
- **Split**: Divide a document into separate files
- **Validate**: Check file integrity and format compliance
```

### Match Specificity to Task Complexity

**High freedom** (general instructions):
```markdown
Analyze the code for potential improvements. Consider performance, readability, and maintainability.
```

**Medium freedom** (template-guided):
```markdown
Generate the report using this structure:
- Summary: Key findings in 2-3 sentences
- Details: Organized by category
- Recommendations: Actionable next steps
```

**Low freedom** (exact script execution):
```markdown
1. Run extraction: `{baseDir}/scripts/extract.py /path/to/file.pdf`
2. Validate output: `{baseDir}/scripts/validate.py /path/to/output.txt`
3. Report results: Display validation status and line count
```

### Use Semantic XML Tags for Content Organization

**Official Anthropic skills and high-quality workspace skills use semantic XML tags to organize content**, creating clear boundaries between examples, instructions, context, and other elements.

**Core semantic tag patterns:**

```markdown
<example>
[Example content showing the pattern]
</example>

<instructions>
[Guidance explaining how to apply the pattern]
</instructions>

<context>
[Background information or constraints]
</context>

<requirements>
[Mandatory criteria or specifications]
</requirements>

<workflow>
[Step-by-step process description]
</workflow>
```

**Real-world usage from official skills:**

**Pattern 1: Separating Examples from Instructions**
```markdown
## Creating Design Philosophy

<example>
**Concrete Poetry Philosophy**
Typography becomes sculpture. Letters transform into monumental geometric forms...
</example>

<instructions>
Write 4-6 paragraphs articulating your visual worldview. Focus on:
- How form communicates meaning
- Spatial relationships between elements
- Color as information architecture
- The balance between clarity and complexity
</instructions>
```

**Pattern 2: Providing Context Before Instructions**
```markdown
## Analysis Procedure

<context>
Spike investigations require complete isolation from the main codebase. All artifacts must live in scratchpad directories to prevent contamination of production code.
</context>

<instructions>
When you determine spike analysis is needed, invoke a general-purpose agent with these parameters:
1. Create isolated scratchpad directory
2. Prototype each approach independently
3. Compare results systematically
4. Document findings in structured format
</instructions>
```

**Pattern 3: Defining Requirements**
```markdown
## Validation Standards

<requirements>
**Mandatory Quality Criteria:**
- All type checks must pass with zero errors
- Test coverage must exceed 80% for new code
- No ESLint errors or warnings
- Documentation updated for public APIs
</requirements>

<instructions>
Run validation commands in sequence:
1. Type check: `yarn typecheck`
2. Unit tests: `yarn test --coverage`
3. Linting: `yarn lint`
4. Generate coverage report and verify thresholds
</instructions>
```

**Pattern 4: Multi-Section Organization**
```markdown
## Technical Spike Investigation

<spike-purpose>
Notification system requires real-time delivery with horizontal scaling. Multiple approaches exist but no clear winner without empirical testing.
</spike-purpose>

<approaches-to-test>
1. Socket.io v4.6.1 (WebSocket) - bidirectional, requires Redis adapter
2. Native EventSource (SSE) - server→client only, simpler protocol
3. Long-polling - fallback approach, works everywhere
</approaches-to-test>

<comparison-criteria>
- Developer experience: setup complexity, debugging, ecosystem support
- Bidirectional communication: can clients send data without separate endpoint?
- Horizontal scaling: can scale across multiple server instances?
</comparison-criteria>

<instructions>
Create working prototypes of each approach in the scratchpad directory. Test each against the comparison criteria. Document findings in structured format with concrete evidence from prototypes.
</instructions>
```

**Benefits of semantic XML tags:**

1. **Progressive disclosure**: Claude can scan tag names before reading content
2. **Clear boundaries**: No ambiguity about where examples end and instructions begin
3. **Structured navigation**: Claude can jump to specific sections by tag name
4. **Context separation**: Examples, instructions, requirements, and context stay distinct
5. **Professional appearance**: Matches official Anthropic skill quality standards

**Common semantic tags by purpose:**

| Purpose | Tag Name | Usage |
|---------|----------|-------|
| Show example | `<example>` | Demonstrate the pattern with concrete instance |
| Provide instructions | `<instructions>` | Explain how to apply the approach |
| Add context | `<context>`, `<background>` | Provide situational information |
| Define requirements | `<requirements>`, `<constraints>` | Specify mandatory criteria |
| Describe workflow | `<workflow>`, `<process>` | Document step-by-step procedures |
| List options | `<options>`, `<alternatives>` | Present multiple valid choices |
| Highlight warnings | `<warning>`, `<critical>` | Emphasize important constraints |
| Provide rationale | `<rationale>`, `<motivation>` | Explain why decisions were made |

**Transformation guidance:**

When rewriting skills, wrap distinct content types in semantic XML tags:

Before (undifferentiated content):
```markdown
## Creating Reports

Generate reports with the following structure:
- Summary: 2-3 sentences
- Details: Organized by category
- Recommendations: Actionable steps

Here's an example report:
# Analysis Report
Summary: Found 3 critical issues...
Details: Issue 1: Authentication bypass...
```

After (semantically organized):
```markdown
## Creating Reports

<example>
# Analysis Report

**Summary:** Found 3 critical issues affecting authentication and data validation.

**Details:**
- Issue 1: Authentication bypass in /api/login endpoint
- Issue 2: Missing input validation on user preferences
- Issue 3: SQL injection vulnerability in search function

**Recommendations:**
1. Implement JWT token validation middleware
2. Add Zod schemas for all user inputs
3. Use parameterized queries for database operations
</example>

<instructions>
Generate reports using this structure:
- **Summary**: 2-3 sentences highlighting key findings
- **Details**: Organize issues by severity or category
- **Recommendations**: Provide actionable steps with specific file references
</instructions>
```

### Language Style and Voice (Official Anthropic Pattern)

**Official Anthropic skills use a distinctive voice that balances precision with personality:**

**Core language characteristics:**

1. **Imperative, direct voice** (not descriptive third-person in body):
   - ✅ "Create the design philosophy first. Articulate your visual worldview."
   - ❌ "The skill creates design philosophies. It articulates visual worldviews."

2. **Emphasis through repetition**: Key principles appear multiple times
   - "Meticulously crafted" appears 3+ times in canvas-design skill
   - "Master-level execution" and "top of their field" emphasize quality standards

3. **Philosophical framing for creative tasks**:
   - ✅ "The beauty lives in the process, not the final frame"
   - ✅ "If the goal is organic emergence, consider elements that accumulate or grow"
   - ❌ "Use particle systems for animation"

4. **Uncompromising quality language**:
   - "Museum-quality work"
   - "Sophistication remains non-negotiable"
   - "Work appearing as though someone at the absolute top of their field labored over every detail"

5. **Architectural terminology for structure**:
   - "Establish", "articulate", "embed", "translate" (high-level concepts)
   - "Implement", "validate", "execute" (concrete actions)

6. **Specific, measurable guidance**:
   - ✅ "90% design and 10% essential text"
   - ✅ "Process 100+ notifications/second"
   - ❌ "Mostly design with some text"
   - ❌ "Handle many notifications"

**Voice spectrum by context:**

| Context | Voice Style | Example |
|---------|-------------|---------|
| Technical instructions | Direct, precise, imperative | "Validate all inputs using Zod schemas. Run type checking before committing." |
| Creative guidance | Philosophical, exploratory | "Consider how color can function as information architecture, not decoration." |
| Quality standards | Aspirational, uncompromising | "Ensure every detail reflects master-level craftsmanship." |
| Process descriptions | Clear, sequential | "First establish the philosophy. Then translate concepts into code." |

**Frontmatter vs. Body voice:**

| Section | Voice | Example |
|---------|-------|---------|
| Frontmatter description | Third-person, descriptive | "Extracts text from PDFs, fills forms, merges documents. Use when..." |
| Skill body | Imperative, direct | "Extract text from PDFs using the provided script. Fill forms by..." |

**Common patterns from official skills:**

```markdown
# Pattern 1: Repetition for emphasis
CRITICAL: Avoid redundancy across design aspects.
CRITICAL: Leave creative interpretive space.
CRITICAL: Minimize text; integrate it as visual element.

# Pattern 2: Philosophical framing
"The philosophy should be 4-6 paragraphs articulating how ideas communicate
spatially rather than textually."

# Pattern 3: Quality emphasis
"Meticulously crafted algorithm"
"Master-level implementation"
"Museum-quality visual work"

# Pattern 4: Conditional guidance (not prescriptive)
"If the philosophy is about organic emergence, consider using elements
that accumulate or grow over time."

# Pattern 5: Process-focused language
"The beauty lives in the process, not the final frame."
"Each seed produces identical output, transforming the algorithm itself
into an instrument for exploration."
```

## Step 3: Validate and Assemble

**Quality checklist:**

**Frontmatter:**
- ✓ Name uses gerund form, lowercase with hyphens
- ✓ Description is specific (what + when), under 1024 characters
- ✓ Description includes trigger keywords users would naturally mention
- ✓ `allowed-tools` restricts to only needed tools (if present)

**Structure:**
- ✓ SKILL.md is under 500 lines
- ✓ File references are one level deep (not nested chains)
- ✓ All paths use forward slashes (Unix-style)
- ✓ Progressive disclosure: overview → details → supporting files
- ✓ Clear navigation for router-style skills

**Content:**
- ✓ Consistent terminology throughout
- ✓ Clear, short sentences (avoid complexity)
- ✓ Concise explanations (remove redundancy)
- ✓ Examples show input/output pairs
- ✓ Context explains why (not just what)
- ✓ Imperative voice in body ("Extract text from PDFs" not "The skill extracts text")
- ✓ Third-person only in frontmatter description
- ✓ Semantic XML tags organize content (`<example>`, `<instructions>`, `<context>`, etc.)

**Technical Preservation:**
- ✓ All code blocks preserved exactly
- ✓ All file paths preserved exactly
- ✓ All script references preserved exactly
- ✓ All placeholders preserved exactly (e.g., `{baseDir}`, `[PLACEHOLDER]`)
- ✓ All embedded bash blocks preserved exactly

## Step 4: Generate Output

Create [OUTPUT_SKILL_DIR] following the versioning pattern:

1. **Determine version number:**
   - If original is `plugins/project/skills/spike/`, create `plugins/project/skills/spike-v2/`
   - If `spike-v2/` exists, try `spike-v3/`, etc.

2. **Copy entire skill directory:**
   - Copy all files from original to new versioned directory
   - Preserve subdirectory structure (`scripts/`, `formats/`, etc.)

3. **Rewrite files in new directory:**
   - Update SKILL.md with improved frontmatter and content
   - Update supporting files if needed (maintain consistency)
   - Preserve all script files without modification
   - Update internal references if skill name changed

4. **Verify structure:**
   - Check that all original files are present
   - Confirm subdirectories are intact
   - Validate that SKILL.md follows quality checklist

5. **Report results:**
   - List the new skill path
   - Summarize key improvements made
   - Note any issues that require manual attention

<transformation-examples>
## Example 1: Single-File Skill with Vague Description

**Input:** `plugins/project/skills/data-processor/SKILL.md`

```yaml
---
name: data-processor
description: Helps with data processing tasks
disable-model-invocation: true
---

Process data files. Read files and extract information. Can handle various formats.

Use scripts in scripts/ directory.
```

**Transformed:** `plugins/project/skills/data-processor-v2/SKILL.md`

```yaml
---
name: processing-data-files
description: Process CSV, JSON, and XML data files. Extract, transform, validate, and aggregate data. Use when working with data files or when the user needs data analysis, format conversion, or validation.
allowed-tools: "Read,Write,Bash(python {baseDir}/scripts/*:*)"
disable-model-invocation: true
---

# Processing Data Files

## Overview
Process structured data files in CSV, JSON, and XML formats. Extract specific fields, transform data structures, validate against schemas, and aggregate results.

## Quick Start
Extract data from a CSV file:
1. Validate file format: `{baseDir}/scripts/validate.py /path/to/file.csv`
2. Extract columns: `{baseDir}/scripts/extract.py /path/to/file.csv --columns name,email,age`
3. Review output in stdout

## Supported Formats
- CSV: Extract columns, filter rows, aggregate values
- JSON: Parse nested structures, extract fields, validate schemas
- XML: Parse elements, extract attributes, transform to other formats

## Common Workflows

### Extract and Transform
1. Validate input file format
2. Extract specified fields using extraction script
3. Transform to target format using conversion script
4. Validate output against schema

### Aggregate Data
1. Load multiple data files
2. Apply aggregation functions (sum, average, count)
3. Group by specified dimensions
4. Export aggregated results

## Scripts
- `{baseDir}/scripts/validate.py` - Validate file format and structure
- `{baseDir}/scripts/extract.py` - Extract specific fields from data files
- `{baseDir}/scripts/convert.py` - Convert between CSV, JSON, and XML
- `{baseDir}/scripts/aggregate.py` - Aggregate data with grouping and functions
```

**Key Improvements:**
- Name changed from `data-processor` to `processing-data-files` (gerund form)
- Description now specific: lists formats, operations, and trigger context
- Added `allowed-tools` to restrict to needed capabilities
- Structured content with clear sections
- Added concrete examples with script usage
- Specified supported formats and workflows
- Maintained all script references from original

disable-model-invocation: true
---

## Example 2: Router-Style Skill with Poor Navigation

**Input:** `plugins/project/skills/document-tools/SKILL.md`

```yaml
---
name: document-tools
description: Document processing
disable-model-invocation: true
---

This skill handles documents. See other files for details.

Files:
- pdf.md
- word.md
- excel.md
```

**Input:** Supporting files exist at:
- `plugins/project/skills/document-tools/operations/pdf.md`
- `plugins/project/skills/document-tools/operations/word.md`
- `plugins/project/skills/document-tools/operations/excel.md`
- `plugins/project/skills/document-tools/scripts/pdf-extract.py`
- `plugins/project/skills/document-tools/scripts/docx-edit.py`

Note: This skill uses `operations/` subdirectory for supporting files (other skills might use `formats/`, `instructions/`, etc.)

**Transformed:** `plugins/project/skills/document-tools-v2/SKILL.md`

```yaml
---
name: processing-documents
description: Process PDFs, Word documents, and Excel spreadsheets. Extract text, edit content, create reports, merge files, analyze data. Use when working with document files or when the user mentions PDFs, Word, Excel, or spreadsheets.
allowed-tools: "Read,Write,Bash(python {baseDir}/scripts/*:*)"
disable-model-invocation: true
---

# Processing Documents

## Overview
Comprehensive document processing for PDFs (extract, merge, split), Word documents (edit, format, track changes), and Excel spreadsheets (analyze, create charts, apply formulas).

## Quick Navigation
- **PDF Operations**: See operations/pdf.md for text extraction, merging, splitting, and form filling
- **Word Documents**: See operations/word.md for content editing, formatting, and tracked changes
- **Excel Spreadsheets**: See operations/excel.md for data analysis, chart creation, and formula application

## Supported Formats and Operations

| Format | Operations | Reference |
|--------|-----------|-----------|
| PDF (.pdf) | Extract text/tables, merge, split, fill forms | operations/pdf.md |
| Word (.docx) | Edit content, apply formatting, track changes | operations/word.md |
| Excel (.xlsx, .csv) | Analyze data, create charts, apply formulas | operations/excel.md |

## Examples by Use Case
1. **Extract text from PDF**: See operations/pdf.md → "Text Extraction" section
2. **Edit Word document**: See operations/word.md → "Content Editing" section
3. **Create Excel chart**: See operations/excel.md → "Visualization" section
4. **Merge multiple PDFs**: See operations/pdf.md → "Merging Documents" section

## Scripts
- `{baseDir}/scripts/pdf-extract.py` - Extract text and tables from PDFs
- `{baseDir}/scripts/pdf-merge.py` - Merge multiple PDF files
- `{baseDir}/scripts/docx-edit.py` - Edit Word document content
- `{baseDir}/scripts/xlsx-analyze.py` - Analyze spreadsheet data

## Getting Started

**First time using this skill?**
1. Identify your document type (PDF, Word, or Excel)
2. Read the corresponding reference file for detailed operations
3. Review examples in the reference file
4. Execute operations using the provided scripts

**Need help choosing?**
- Text extraction or report generation → PDF operations (operations/pdf.md)
- Document editing with formatting → Word operations (operations/word.md)
- Data analysis or visualization → Excel operations (operations/excel.md)
```

**Key Improvements:**
- Name changed from `document-tools` to `processing-documents` (gerund form)
- Description now comprehensive: lists all formats, operations, and trigger keywords
- Supporting files organized into `operations/` subdirectory for clarity
- Added clear navigation table showing format → operations → reference file
- Created "Examples by Use Case" with specific pointers to sections
- Listed all scripts with descriptions
- Added "Getting Started" guide for new users
- Maintained all original supporting files (operations/pdf.md, operations/word.md, operations/excel.md, scripts/)
- Progressive disclosure: overview in SKILL.md, details in supporting files

**Note on subdirectory naming**: This example uses `operations/` as the subdirectory name. Other common patterns include `formats/` (for format-specific content), `instructions/` (for technique-specific guidance), `reference/` (for detailed specifications), or any other semantic name that fits the skill's organization.

disable-model-invocation: true
---

## Example 3: Overly Verbose Single-File Skill

**Input:** `plugins/project/skills/api-validator/SKILL.md` (800 lines)

```yaml
---
name: api-validator
description: Validates APIs
disable-model-invocation: true
---

# API Validation Tool

This tool is designed to help you validate your APIs. It can check various things...

[600 lines of detailed API specifications, examples, edge cases]

[200 lines of troubleshooting and FAQ]
```

**Transformed:** Creates multiple files:

`plugins/project/skills/api-validator-v2/SKILL.md` (350 lines):
```yaml
---
name: validating-apis
description: Validate REST APIs, GraphQL endpoints, and WebSocket connections. Check response codes, schema compliance, authentication, rate limits, and error handling. Use when the user needs API testing, contract validation, or integration verification.
allowed-tools: "Read,Bash(curl:*),Bash(python {baseDir}/scripts/*:*)"
disable-model-invocation: true
---

# Validating APIs

## Overview
Validate API endpoints against specifications. Check HTTP response codes, JSON/XML schema compliance, authentication mechanisms, rate limiting, and error handling patterns.

## Quick Start
Validate a REST endpoint:
```bash
{baseDir}/scripts/validate-endpoint.py https://api.example.com/users --spec {baseDir}/specs/users-api.json
```

## Supported API Types
- REST APIs: Validate endpoints, methods, status codes, response schemas
- GraphQL: Validate queries, mutations, schema compliance
- WebSocket: Validate connection, message format, event handling

## Core Workflows

### REST API Validation
1. Load OpenAPI specification: `{baseDir}/scripts/load-spec.py /path/to/openapi.yaml`
2. Test each endpoint: `{baseDir}/scripts/validate-endpoint.py [url] --spec [spec-file]`
3. Verify response schemas match specification
4. Check authentication and authorization rules
5. Generate validation report

### GraphQL Validation
1. Load GraphQL schema: `{baseDir}/scripts/load-graphql-schema.py /path/to/schema.graphql`
2. Test queries and mutations: `{baseDir}/scripts/validate-graphql.py [endpoint] --schema [schema-file]`
3. Verify type compliance and error handling
4. Generate validation report

## Examples
See examples.md for comprehensive validation scenarios including:
- Multi-endpoint REST validation
- GraphQL schema compliance testing
- WebSocket connection validation
- Rate limiting verification
- Authentication flow testing

## Reference
See reference.md for:
- Detailed API specification formats (OpenAPI, GraphQL Schema)
- Response code interpretations
- Schema validation rules
- Authentication patterns

## Troubleshooting
See troubleshooting.md for common issues and solutions.

## Scripts
- `{baseDir}/scripts/validate-endpoint.py` - Validate single REST endpoint
- `{baseDir}/scripts/validate-graphql.py` - Validate GraphQL queries
- `{baseDir}/scripts/load-spec.py` - Load and parse API specifications
```

`plugins/project/skills/api-validator-v2/reference.md`:
```markdown
# API Validation Reference

[Detailed API specifications, schema formats, validation rules - 300 lines]
```

`plugins/project/skills/api-validator-v2/examples.md`:
```markdown
# API Validation Examples

[Comprehensive examples with input/output for various scenarios - 200 lines]
```

`plugins/project/skills/api-validator-v2/troubleshooting.md`:
```markdown
# Troubleshooting API Validation

[Common issues, error messages, solutions - 150 lines]
```

**Key Improvements:**
- Name changed from `api-validator` to `validating-apis` (gerund form)
- Description comprehensive with specific capabilities and trigger keywords
- Reduced SKILL.md from 800 to 350 lines by extracting content
- Created supporting files for detailed content (reference, examples, troubleshooting)
- Maintained progressive disclosure: core workflows in SKILL.md, details in supporting files
- Clear navigation showing what's in each supporting file
- All original content preserved, just reorganized
</transformation-examples>

<anti-patterns>
## Patterns to Avoid

### Structural Anti-Patterns

**❌ Vague description without trigger keywords:**
```yaml
description: Helps with files
```
**✅ Specific description with triggers:**
```yaml
description: Process CSV, JSON, and XML data files. Extract, transform, validate, and aggregate data. Use when working with data files or when the user needs data analysis, format conversion, or validation.
```

**❌ Generic naming (not gerund form):**
```yaml
name: pdf-tool
```
**✅ Gerund form:**
```yaml
name: processing-pdfs
```

**❌ Deeply nested file references:**
```
SKILL.md → "See advanced.md"
advanced.md → "See patterns.md"
patterns.md → "See edge-cases.md"
```
**✅ One level deep:**
```
SKILL.md → "See reference.md for detailed specifications"
reference.md → (contains all details, no further references)
```

**❌ Overly long single file:**
```
skill-name/
└── SKILL.md (1500 lines)
```
**✅ Properly split:**
```
skill-name/
├── SKILL.md (400 lines - overview + core workflows)
├── reference.md (detailed specifications)
└── examples.md (comprehensive examples)
```

### Content Anti-Patterns

**❌ Inconsistent terminology:**
```markdown
Extract text... pull out data... grab information... retrieve content...
```
**✅ Consistent terminology:**
```markdown
Extract text... Extract data... Extract information... Extract content...
```

**❌ Unexplained magic numbers:**
```python
max_retries = 5
timeout = 30
```
**✅ Justified configuration:**
```python
max_retries = 5  # Allow retries for transient network errors
timeout = 30     # API typically responds within 10s, 30s provides buffer
```

**❌ Unclear navigation in router skills:**
```markdown
See these files: pdf.md, word.md, excel.md
```
**✅ Clear navigation with purpose:**
```markdown
## Quick Navigation
- **PDF Operations**: See pdf.md for text extraction, merging, and form filling
- **Word Documents**: See word.md for content editing and formatting
- **Excel Spreadsheets**: See excel.md for data analysis and chart creation
```

**❌ Examples without context:**
```markdown
Run: `script.py file.csv`
```
**✅ Examples with full context:**
```markdown
## Example: Extract Email Addresses

**Input:** CSV file at `/data/contacts.csv` with columns: name, email, phone

**Process:**
```bash
{baseDir}/scripts/extract.py /data/contacts.csv --column email --output /data/emails.txt
```

**Output:** Text file at `/data/emails.txt` with one email per line:
```
john@example.com
jane@example.com
...
```
```

**❌ Indirect, passive phrasing:**
```markdown
The user might want you to check for errors if they seem to exist.
```
**✅ Direct, active instructions:**
```markdown
Check for errors in the specified files.
```

**❌ Missing why/motivation:**
```markdown
Validate all inputs.
```
**✅ Explained motivation:**
```markdown
Validate all inputs—this API handles financial transactions where invalid data could cause monetary errors or compliance violations.
```
</anti-patterns>

<quality-checklist>
## Pre-Output Validation

Before generating the transformed skill, verify:

**Frontmatter:**
- [ ] `name` uses gerund form (verb + "-ing")
- [ ] `name` is lowercase with hyphens only
- [ ] `description` explains both what and when
- [ ] `description` includes specific trigger keywords
- [ ] `description` is under 1024 characters
- [ ] `allowed-tools` restricts to only needed tools (if present)

**Structure:**
- [ ] SKILL.md is under 500 lines
- [ ] File references are maximum one level deep
- [ ] All paths use forward slashes (Unix-style)
- [ ] Supporting files are properly organized (reference.md, examples.md, scripts/)
- [ ] Router-style skills have clear navigation

**Content Quality:**
- [ ] Terminology is consistent throughout
- [ ] Sentences are clear and concise
- [ ] Body uses imperative voice ("Extract text" not "The skill extracts")
- [ ] Frontmatter description uses third-person descriptive voice
- [ ] Examples include input/output context
- [ ] Configuration values are justified
- [ ] Context explains why (not just what)
- [ ] Semantic XML tags organize content (`<example>`, `<instructions>`, `<context>`, etc.)
- [ ] Language style matches official Anthropic skill quality (direct, precise, occasionally philosophical)

**Technical Preservation:**
- [ ] All code blocks preserved exactly
- [ ] All file paths preserved exactly
- [ ] All script references preserved exactly
- [ ] All placeholders preserved exactly (e.g., `{baseDir}`, `[PLACEHOLDER]`)
- [ ] All subdirectory structures preserved
- [ ] All original files copied to new versioned directory

**Progressive Disclosure:**
- [ ] Metadata loads first (frontmatter)
- [ ] Core instructions in SKILL.md
- [ ] Detailed content in supporting files
- [ ] Clear pointers from SKILL.md to supporting files
</quality-checklist>

<execution-workflow>
## Step-by-Step Execution

1. **Read original skill:**
   - Use Read tool on [INPUT_SKILL_FILE]
   - If router-style, identify subdirectory structure (formats/, instructions/, operations/, reference/, etc.)
   - Read supporting files in subdirectories
   - Catalog all files and subdirectories to preserve structure

2. **Analyze quality:**
   - Check description specificity and trigger keywords
   - Verify name follows gerund form
   - Assess SKILL.md length (should be < 500 lines)
   - Review file reference depth
   - Check terminology consistency

3. **Plan transformations:**
   - List specific improvements needed:
     - Frontmatter changes (name, description)
     - Content restructuring (split files if > 500 lines)
     - Language improvements (passive → active voice)
     - Navigation enhancements (for router-style)
     - Example additions or improvements

4. **Determine version:**
   - Check if versioned directory exists
   - Increment version until finding available slot
   - Example: `spike/` → check `spike-v2/` → if exists, try `spike-v3/`

5. **Create new skill directory:**
   - Use Bash tool to create versioned directory
   - Copy all original files to new directory
   - Preserve subdirectory structure

6. **Transform files:**
   - Rewrite SKILL.md with improvements
   - Update supporting files if needed (maintain consistency)
   - Preserve scripts without modification
   - Update internal references if name changed

7. **Validate quality:**
   - Run through quality checklist
   - Verify all original content preserved
   - Check that transformations applied correctly

8. **Report results:**
   - State new skill path
   - Summarize key improvements:
     - Frontmatter changes
     - Structural reorganization
     - Language improvements
     - Navigation enhancements
   - Note any manual actions required
</execution-workflow>

<important-reminders>
## Critical Guidelines

1. **No information loss**: All content from original skill must be preserved—only restructured and rewritten for clarity

2. **Preserve code exactly**: Code blocks, scripts, file paths, placeholders must remain identical

3. **Version entire directory**: Skills are directories, not files—copy entire directory structure

4. **One level deep**: File references should not create deep chains (SKILL.md → reference.md, stop)

5. **Progressive disclosure**: Metadata → core instructions → detailed content → supporting files

6. **Gerund naming**: Use verb + "-ing" form for skill names (processing, analyzing, extracting)

7. **Specific descriptions**: Include capabilities AND trigger context with specific keywords

8. **Imperative voice in body**: "Extract text from PDFs" not "The skill extracts text" (body uses commands, not descriptions)

9. **Third-person only in frontmatter**: Description field uses third-person ("Extracts..."), body uses imperative ("Extract...")

10. **Directive language**: "Validate input" not "The user might want validation"

11. **Semantic XML tags**: Organize content with `<example>`, `<instructions>`, `<context>`, `<requirements>`, etc.

12. **Context matters**: Explain why, not just what—motivation clarifies intent

13. **Official Anthropic style**: Balance precision with personality; use quality-emphasizing language when appropriate ("meticulously crafted", "master-level")
</important-reminders>
