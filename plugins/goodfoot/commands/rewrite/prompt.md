---
description: Transform documents into Claude 4 Opus user prompts
---

Transform specified documents into Claude 4 Opus user prompts. Preserve all substantive elements while restructuring for optimal model performance.

<user-message>
$ARGUMENTS
</user-message>

<input-format>
The `<user-message>` references one or more documents to transform. Each document path is designated as [INPUT_FILE].

**Example**: If the `<user-message>` is "Transform /docs/api.md and /docs/setup.md", then:
- [INPUT_FILE_1] = `/docs/api.md`
- [INPUT_FILE_2] = `/docs/setup.md`
</input-format>

<versioning>
**Pattern**: `[original-name]-v[N].[ext]`
- First revision: `example.md` → `example-v2.md`
- Subsequent revisions: `example-v2.md` → `example-v3.md`
- Never overwrite existing versions
- Increment version number until an available slot is found
</versioning>

<preservation-requirements>
**Preserve without modification:**
- All algorithms and code blocks
- Directory structures and file paths
- Numeric values and heuristics
- Technical specifications
- Bash commands (e.g., !`echo -e '!\u0060pwd\u0060'`)
- Variables like !`echo '$AR''GUMENTS'`

No information may be added or removed—only restructured and rewritten.
</preservation-requirements>

<output-format>
Generate markdown with YAML frontmatter:
```markdown
---
description: [brief description]
allowed-tools: [optional tool list if needed]
---

<user-message>
!`echo '$AR''GUMENTS'`
</user-message>

<input-format>
[Define parameters if the prompt requires specific inputs]
</input-format>

[Additional XML groupings for context/background as needed]

<instructions>
[Main transformed prompt content wrapped in instructions tags]
</instructions>
```
</output-format>

# Transformation Process

## Step 1: Parse and Categorize

Parse [INPUT_FILE] to identify:
- Role/persona information (if present)
- Supporting context and background
- Main instructions and tasks
- Constraints and requirements
- Technical specifications
- Input parameters or formatting requirements

## Step 2: Apply Transformation Rules

### Extract and position role/persona definitions
When role or expertise is specified in the source, position it prominently at the beginning as plain text (not in XML tags).

**Example:**
- Source: "Act as a senior Python developer reviewing code."
- Target: "You are a senior Python developer with expertise in code review, best practices, and performance optimization."

### Use clear, directive language
Convert indirect phrasing to direct commands.

**Examples:**
- Source: "The user needs Claude to check the ledger for broken links."
- Target: "Check the ledger for broken links."
- Source: "It would be helpful if you could classify news headlines."
- Target: "Classify news headlines by category."

### Eliminate unnecessary verbosity
Remove filler words while preserving necessary context.

**Examples:**
- Source: "Could you please be so kind as to help me analyze this data?"
- Target: "Analyze this data."
- Source: "I would really appreciate it if you could review this code."
- Target: "Review this code."

### Include comprehensive examples for complex behaviors
Provide concrete examples demonstrating exact desired outputs.

**Example:**
- Source: "Handle errors appropriately."
- Target:
```
<error-handling-examples>
File not found: "Configuration file missing. Creating default config at /data/config.json"
Invalid JSON: "Invalid JSON detected. Logging error and continuing with cached data."
</error-handling-examples>

Handle errors following the patterns shown above.
```

### Optimize step presentation for task complexity
Use numbered steps for sequential tasks; use thinking prompts for complex reasoning.

**Sequential task:**
```
1. Verify file exists
2. Parse YAML configuration
3. Validate required fields
4. Return parsed config object
```

**Complex reasoning task:**
```
Analyze the provided codebase for security vulnerabilities.
Think deeply to reason through your analysis step-by-step before providing recommendations.
```

### Provide explicit context and motivation
Explain why specific behaviors or constraints are important.

**Example:**
```
<api-security-warning>
This API handles sensitive financial data. Security and data integrity are paramount because any vulnerability could expose customer financial records.
</api-security-warning>
```

### Preserve constraints in their natural context
Keep limitations and requirements where they appear, highlighting them for visibility.

**Example:**
- Source: "Review code but don't flag deprecated functions unless they pose actual risks"
- Target: "Review the code for security issues. **Constraint**: Don't flag deprecated functions unless they pose actual security risks."

### Preserve technical artifacts with absolute fidelity
Copy code, regexes, directory trees, and numeric tables exactly without modification.

**Example:**
```
<pattern>
/^[a-zA-Z0-9]+$/
</pattern>
```

### Transform static references to dynamic commands
Use bash execution for real-time information.

**Examples:**
- Source: "Ensure the config file exists before proceeding"
- Target:
```
<config-status>
!`echo -e '!\u0060test -f config.json && echo "exists" || echo "missing"\u0060'`
</config-status>
```

### Request quality and robustness explicitly
For complex tasks, explicitly request high-quality solutions.

**Example:**
```
Write a high-quality, general-purpose solution that handles edge cases gracefully.
Don't just make tests pass—create a robust implementation suitable for production use.
```

### Natural Structure Emergence
Let the final structure emerge naturally from the source content rather than forcing a rigid template. The organization should feel organic to the specific request.

## Step 3: Validate and Assemble

Ensure all source information is preserved and properly structured:
- All information from [INPUT_FILE] is present
- Technical accuracy is maintained
- Constraints remain in context
- Examples are comprehensive

## Step 4: Generate Output

Create [OUTPUT_FILE] following the versioning pattern with:
- YAML frontmatter
- `<user-message>` with escaped $ARGUMENTS
- `<input-format>` if parameters need definition
- Context/background in XML groupings as appropriate
- Main instructions wrapped in `<instructions>` tags

Write to disk and return the file path.

<transformation-examples>
**Example 1: Security Audit Command**
- Source: "You are a security expert. Your task is to review the codebase for security vulnerabilities. Focus on OWASP top 10 issues, authentication problems, and data exposure risks. The user will provide a directory path to scan. Start by listing all files in the directory, then check for common security issues like hardcoded credentials, SQL injection vulnerabilities, and improper error handling. Generate a detailed report with severity levels: Critical, High, Medium, Low. Include remediation steps for each finding."
- Target:
```
You are a security expert specializing in code vulnerability assessment.

<user-message>
!`echo '$AR''GUMENTS'`
</user-message>

<input-format>
!`echo '$AR''GUMENTS'` = Directory path to audit for security vulnerabilities
</input-format>

<security-focus>
OWASP top 10 issues, authentication problems, data exposure risks
Severity levels: Critical, High, Medium, Low
</security-focus>

<scan-targets>
!`echo -e '!\u0060find $AR''GUMENTS -type f -name "*.js" -o -name "*.ts" -o -name "*.py" | head -20\u0060'`
</scan-targets>

<instructions>
Review the codebase for security vulnerabilities. Check for hardcoded credentials, SQL injection vulnerabilities, and improper error handling. Generate a detailed report with severity levels and include specific remediation steps for each finding.
</instructions>
```

**Example 2: Database Migration Generator**
- Source: "Generate SQL migrations based on schema differences. The user needs to provide two schema versions: current and target. Compare the schemas and create both up and down migrations. Follow these rules: always backup data before destructive changes, use transactions, validate foreign keys, preserve existing data where possible. Output should be idempotent SQL scripts."
- Target:
```
<user-message>
!`echo '$AR''GUMENTS'`
</user-message>

<input-format>
!`echo '$AR''GUMENTS'` format: "[current_schema_file] [target_schema_file]"
- [current_schema_file] = Path to current database schema
- [target_schema_file] = Path to target database schema
</input-format>

<migration-rules>
- Always backup data before destructive changes
- Use transactions for all operations
- Validate foreign key constraints
- Preserve existing data where possible
- Generate idempotent SQL scripts
</migration-rules>

<instructions>
Generate SQL migrations based on schema differences. Compare the provided schemas and create both up and down migrations. **Ensure all migrations are safely reversible** and maintain data integrity throughout the process.
</instructions>
```

**Example 3: Performance Profiler**
- Source: "Profile application performance and identify bottlenecks. Run performance tests on the specified component or endpoint. Measure execution time, memory usage, and database queries. The component to profile is provided as input along with optional performance thresholds. Generate flame graphs if possible. Suggest specific optimizations including caching strategies, query optimization, and algorithmic improvements. Target metrics: response time < 200ms, memory usage < 100MB."
- Target:
```
<user-message>
!`echo '$AR''GUMENTS'`
</user-message>

<input-format>
!`echo '$AR''GUMENTS'` format: "[component_path] [threshold_config]"
- [component_path] = Component or endpoint to profile
- [threshold_config] = Optional JSON with performance thresholds (default: response_time=200ms, memory=100MB)
</input-format>

<performance-targets>
Response time: < 200ms
Memory usage: < 100MB
Database queries: Optimized with indices
</performance-targets>

<current-metrics>
!`echo -e '!\u0060node --prof $AR''GUMENTS 2>&1 | head -20\u0060'`
</current-metrics>

<instructions>
Profile application performance and identify bottlenecks. Measure execution time, memory usage, and database query performance. **Generate flame graphs when possible.** Provide specific optimization recommendations including caching strategies, query optimization, and algorithmic improvements.
</instructions>
```
</transformation-examples>