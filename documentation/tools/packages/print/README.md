# @tools/print

A set of command-line tools for printing filesystem structures and analyzing dependencies in JavaScript/TypeScript projects.

## Features

- **File Printing**: Display directory trees and file contents with syntax highlighting
- **Gitignore Support**: Respects .gitignore patterns for clean output (including parent directories)
- **Dependency Analysis**: Find all dependencies of specified files
- **Inverse Dependencies**: Find all files that import/depend on specified targets
- **Monorepo Aware**: Works seamlessly in monorepo environments
- **Binary Exports**: Available as global command-line tools

## Installation

The CLI tools for this package are available in the monorepo's `tools/bin` directory.

### Global Installation

To install the tools globally and make them available from anywhere on your system:

```bash
# From the tools directory (not the print package)
cd /path/to/tools
npm install -g .

# After installation, these commands will be available globally:
# - print-filesystem
# - print-dependencies
# - print-inverse-dependencies
```

Note: The binaries use `tsx` via shebang, so `tsx` must be available in your PATH.

### Local Development (within monorepo)

```bash
# From the tools directory
yarn print "**/*.ts"
yarn dependencies "src/index.ts"
yarn inverse-dependencies "src/utils.ts"

# Or execute directly
./bin/print-filesystem "**/*.ts"
./bin/print-dependencies "src/index.ts"
./bin/print-inverse-dependencies "src/utils.ts"
```

## Available Commands

### print-filesystem

Print the directory structure and file contents for specified patterns.

```bash
# Print all files in current directory
print-filesystem

# Print all TypeScript files
print-filesystem "**/*.ts"

# Print with exclusions
print-filesystem "**/*.ts" --exclude "node_modules/**" --exclude "*.test.ts"

# Short form for exclude
print-filesystem "**/*.ts" -e "node_modules/**"
```

### print-dependencies

Find all dependencies of specified files.

```bash
# Find dependencies of a single file
print-dependencies "src/index.ts"

# Find dependencies using glob patterns
print-dependencies "src/**/*.ts"

# Multiple patterns
print-dependencies "src/**/*.ts" "lib/**/*.ts"
```

### print-inverse-dependencies

Find all files that import/depend on the specified files.

```bash
# Find what imports a specific file
print-inverse-dependencies "src/utils/logger.ts"

# Find importers using glob patterns
print-inverse-dependencies "src/utils/**/*.ts"

# Specify TypeScript config
print-inverse-dependencies "src/utils/*.ts" --project "./tsconfig.json"
```

## Development

```bash
# Run tests
yarn test

# Lint code
yarn lint

# Type check
yarn typecheck
```

## How it Works

The binary scripts use `tsx` to execute TypeScript files directly without a build step. When installed globally, the wrapper scripts in the `bin/` directory handle:

- Resolving the tsx executable
- Locating the TypeScript source files
- Forwarding all command-line arguments
- Preserving the original working directory

The tools are written in TypeScript and use the following key dependencies:

- `glob` and `glob-gitignore` for file matching
- `dependency-tree` for analyzing dependencies
- `typescript` compiler API for inverse dependency analysis
- `istextorbinary` for filtering binary files
