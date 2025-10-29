---
description: Resolve negative complexity drivers in documents
---

Perform a negative complexity driver analysis then create a new version of the document(s) to address the identified issues.

<user-message>
$ARGUMENTS
</user-message>

<versioning>
## File Versioning Standard

**Pattern**: `[original-name]-v[N].[ext]`
- First rewrite: `example.md` → `example-v2.md`
- Subsequent: `example-v2.md` → `example-v3.md`
- Never overwrite existing versions
- If version exists, increment until available number found
</versioning>

<content-preservation-guidelines>
## Content Preservation Guidelines

Do not modify:
- Filenames or file paths
- External references
- YAML frontmatter
- Embedded bash commands (e.g., !`echo -e '!\u0060pwd\u0060'` or !`echo -e '!\u0060echo "Bar"\u0060'`) unless necessary to modify the command's stdout
- Variables like !`echo '$AR''GUMENTS'`
- Acronyms (API, SDK, REST, etc.) and jargon when meaning is clear in context

Maintain all code, patterns, and specifications.
</content-preservation-guidelines>

For each file specified by the user:

1. **Analyze for negative complexity drivers** by invoking multiple agents simultaneously:
   ```
   Task(description="Identify negative complexity drivers in [filename]", 
       subagent_type="general-purpose",
       prompt=`Follow the instructions in \@.claude/commands/review/complexity.md      replacing !`echo '$AR''GUMENTS'` with: "@[full-path-to-file]"`)
   Task(description="Identify negative complexity drivers in [filename]", 
       subagent_type="general-purpose",
       prompt=`Follow the instructions in \@.claude/commands/review/complexity.md      replacing !`echo '$AR''GUMENTS'` with: "@[full-path-to-file]"`)
   Task(description="Identify negative complexity drivers in [filename]", 
       subagent_type="general-purpose",
       prompt=`Follow the instructions in \@.claude/commands/review/complexity.md      replacing !`echo '$AR''GUMENTS'` with: "@[full-path-to-file]"`)
   ```

2. **Examine analyses** from all three subagents and identify drivers that appear in every report.

3. **Create a new version** of the document that resolves these drivers:
   - Apply the versioning pattern to generate the new filename
   - Follow all content preservation guidelines when transforming the document
   - Address each resolvable complexity driver while maintaining document integrity

4. **Output**:
   - The new document filename
   - List of negative complexity drivers successfully addressed (with explanations)
   - List of negative complexity drivers that could not be resolved (with explanations)


