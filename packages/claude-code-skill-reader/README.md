# @goodfoot/claude-code-skill-reader

**Read and process Claude Code skills and commands with full fidelity.**

This package resolves skill and command files from the Claude Code ecosystem — project-local, user-level, installed plugins, and remote marketplaces — then processes them exactly as Claude Code does: parsing YAML frontmatter, executing embedded bash, and substituting `${CLAUDE_PLUGIN_ROOT}`.

## Quick Start

### Read a local skill or command

```bash
# Reads from .claude/skills/trace/SKILL.md or .claude/commands/trace.md
npx @goodfoot/claude-code-skill-reader trace
```

### Read a plugin skill or command

```bash
# Reads from installed plugin-dev plugin
npx @goodfoot/claude-code-skill-reader plugin-dev:command-development
```

### Skip bash execution

```bash
npx @goodfoot/claude-code-skill-reader --no-bash plugin-dev:hook-development
```

### Output raw body (no processing)

```bash
npx @goodfoot/claude-code-skill-reader --raw trace
```

---

## Install

```bash
yarn add @goodfoot/claude-code-skill-reader
# or npm install, pnpm, etc.
```

Or run without installing:

```bash
npx @goodfoot/claude-code-skill-reader <skill-name>
```

---

## CLI Reference

```
Usage: claude-code-skill-reader [options] <skill-name> [skill-name...]

Options:
  -h, --help                   Show help text
  -v, --version                Show version number
  --no-bash                    Skip bash execution
  --raw                        Output unprocessed body
  --marketplace <json-string>  Resolve skills from a marketplace source

Skill Names:
  Plain name:     my-skill        (searches .claude/skills/ and .claude/commands/)
  Plugin name:    plugin:skill    (searches installed plugin skills and commands)
```

### Multiple skills

Pass multiple names to read them in sequence:

```bash
npx @goodfoot/claude-code-skill-reader trace evaluate-routing update-skills
```

### Marketplace resolution

For plugin skills not installed locally, provide a marketplace source:

```bash
npx @goodfoot/claude-code-skill-reader \
  --marketplace '{"source":"github","repo":"anthropics/claude-plugins-official"}' \
  plugin-dev:create-plugin
```

Supported marketplace sources:

| Source      | JSON                                              |
| ----------- | ------------------------------------------------- |
| GitHub repo | `{"source":"github","repo":"owner/repo"}`         |
| Git URL     | `{"source":"git","url":"https://..."}`             |
| URL         | `{"source":"url","url":"https://.../manifest.json"}` |
| Directory   | `{"source":"directory","path":"/local/path"}`     |
| File        | `{"source":"file","path":"/path/to/manifest.json"}` |

---

## Resolution Order

### Plain names (e.g., `trace`)

The CLI searches these paths in order and returns the first match:

1. `{cwd}/.claude/skills/{name}/SKILL.md`
2. `{cwd}/.claude/commands/{name}.md`
3. `~/.claude/skills/{name}/SKILL.md`
4. `~/.claude/commands/{name}.md`

Project-level files always take priority over user-level files. Skills take priority over commands at each level.

### Plugin names (e.g., `plugin-dev:hook-development`)

1. Reads `~/.claude/plugins/installed_plugins.json`
2. Finds matching plugin entries by prefix
3. For each install path, checks:
   - `{installPath}/skills/{name}/SKILL.md`
   - `{installPath}/commands/{name}.md`

### Marketplace fallback

If a plugin skill is not found locally and `--marketplace` is provided, the CLI clones or reads the marketplace source and searches the same skill/command paths within the resolved plugin directory.

---

## Processing Pipeline

Each resolved file goes through this pipeline:

1. **Frontmatter parsing** — YAML frontmatter between `---` delimiters is extracted and stripped from the body.
2. **`${CLAUDE_PLUGIN_ROOT}` replacement** — All occurrences are replaced with the plugin's install path (or empty string for non-plugin skills).
3. **Bash execution** — Embedded bash commands are executed and replaced with their stdout:
   - Block bash: `` ```! ... ``` ``
   - Inline bash: `` !`command` ``

Use `--no-bash` to skip step 3, or `--raw` to skip steps 2 and 3.

---

## Programmatic API

The package exports all building blocks for use in other tools:

```typescript
import {
  // Discovery
  discoverSkill,
  discoverPluginSkill,
  splitSkillName,

  // Marketplace
  findSkillInMarketplace,
  resolveMarketplace,
  withTempDir,

  // Processing
  parseFrontmatter,
  processContent,

  // Errors
  SkillReaderError,
} from '@goodfoot/claude-code-skill-reader';
```

### Example: resolve and process a skill

```typescript
import {
  discoverSkill,
  parseFrontmatter,
  processContent,
} from '@goodfoot/claude-code-skill-reader';
import { readFileSync } from 'node:fs';

const location = discoverSkill('trace', process.cwd());
if (!location) throw new Error('Skill not found');

const content = readFileSync(location.path, 'utf-8');
const { frontmatter, body } = parseFrontmatter(content);

const processed = processContent(body, {
  pluginRoot: location.pluginRoot,
  executeBash: true,
});

console.log(processed);
```

---

## Error Handling

All errors are instances of `SkillReaderError` with a `code` property:

| Code                       | Meaning                                        |
| -------------------------- | ---------------------------------------------- |
| `SKILL_NOT_FOUND`          | No matching skill or command file found         |
| `INVALID_ARGS`             | Bad CLI arguments or skill name                 |
| `INVALID_MARKETPLACE`      | Missing or malformed marketplace manifest       |
| `MARKETPLACE_FETCH_FAILED` | Failed to clone or download marketplace source  |
| `BASH_EXECUTION_FAILED`    | Embedded bash command failed or timed out       |
| `INTERNAL_ERROR`           | Unexpected error                                |

The CLI writes errors to stderr as JSON:

```json
{"error":{"code":"SKILL_NOT_FOUND","message":"Skill not found: nonexistent"}}
```

---

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| 0    | Success |
| 1    | Error   |
