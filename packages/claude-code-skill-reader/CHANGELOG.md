# @goodfoot/claude-code-skill-reader npm package changelog

## 0.2.0
- Improved code structure and maintainability through internal refactoring
- Improved error reporting for unhandled fatal errors

## 0.1.2
- Minor internal maintenance updates

## 0.1.1
- Initial release of `@goodfoot/claude-code-skill-reader`
- Added CLI for reading and processing Claude Code skills and commands (`npx @goodfoot/claude-code-skill-reader <name>`)
- Added discovery of skills from project-local, user-level, and installed plugin sources
- Added marketplace resolution for remote plugin skills (GitHub repos, git URLs, directories)
- Added full processing pipeline: YAML frontmatter parsing, `${CLAUDE_PLUGIN_ROOT}` substitution, and embedded bash execution
- Added `--no-bash` and `--raw` flags to control processing behavior
- Added programmatic API for use in other tools
