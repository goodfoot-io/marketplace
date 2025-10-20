---
description: Resolve language issues in documents
---

Perform a language analysis, then create a new version of the document(s) to address the identified issues.

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

1. **Analyze for language issues** by using the Task tool to invoke a `general-purpose` agent:
   <tool-use-template>
   Task(description="Identify language issues in [FILES]",
         subagent_type="general-purpose",
         prompt=`Follow the instructions in \@.claude/commands/review/language.md replacing !`echo '$AR''GUMENTS'` with: "Identify language issues in [FILES]"`)
   </tool-use-template>

   **You must use this exact prompt when using the Task tool. Replace [FILES] with the files specified by the user.**

2. **Create a new version** of the document that resolves these issues:
   - Apply the versioning pattern to generate the new filename
   - Follow all content preservation guidelines when transforming the document
   - Address each resolvable issue while maintaining document integrity

3. **Output**:
   - The new document filename
   - List of issues successfully addressed (with explanations)
   - List of issues that could not be resolved (with explanations)

