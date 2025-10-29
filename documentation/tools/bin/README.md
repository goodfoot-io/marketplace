# Tools CLI Binaries

This directory contains executable CLI tools for the @tools monorepo. These scripts use `#!/usr/bin/env tsx` to execute TypeScript directly without a build step.

## Available Commands

### Print Tools (from @tools/print)

- **print-filesystem** - Print directory structure and file contents
- **print-dependencies** - Find all dependencies of specified files
- **print-inverse-dependencies** - Find all files that import specified targets

### Rules Tools (from @tools/rules)

- **rules-check** - Validate newsroom workspace organization against standards
- **rules-drift** - Check if rules are out of sync with protocol changes

## Usage

### From within the monorepo

```bash
# Direct execution from the path
print-filesystem "**/*.ts"
print-dependencies "src/index.ts"
print-inverse-dependencies "src/utils.ts"
rules-check
rules-drift
```

### Global Installation

```bash
# From the tools directory
npm install -g .

# Then use anywhere
print-filesystem "**/*.ts"
print-dependencies "src/index.ts"
print-inverse-dependencies "src/utils.ts"
rules-check
rules-drift
```

## Adding New CLI Tools

1. Create a new file in this directory (no .ts extension)
2. Add the shebang: `#!/usr/bin/env tsx`
3. Import necessary modules from packages
4. Make the file executable: `chmod +x bin/your-tool`
5. Add to package.json bin entries if needed

## Requirements

- `tsx` must be available in PATH
- Node.js >= 22.0.0