# Using @tools/print Binaries

## Direct Execution (without global install)

### From within the monorepo

```bash
# Use yarn scripts from the tools directory
cd /path/to/tools

# Print filesystem
yarn print "**/*.ts"

# Find dependencies
yarn dependencies "packages/rules/src/index.ts"

# Find inverse dependencies
yarn inverse-dependencies "packages/print/src/types.ts"
```

### Direct execution

Since the files use `#!/usr/bin/env tsx` shebang, you can execute them directly:

```bash
# From any directory
/path/to/tools/bin/print-filesystem "**/*.ts"
/path/to/tools/bin/print-dependencies "src/index.ts"
/path/to/tools/bin/print-inverse-dependencies "src/types.ts"
```

## Global Installation (npm)

If you want the commands available globally:

```bash
cd /path/to/tools/packages/print
yarn build
npm install -g .

# Now use from anywhere
print-filesystem "**/*.ts"
print-dependencies "src/index.ts"
print-inverse-dependencies "src/utils.ts"
```

## Integration in Other Projects

Add to your project's package.json:

```json
{
  "scripts": {
    "print": "print-filesystem \"src/**/*.ts\"",
    "deps": "print-dependencies \"src/index.ts\"",
    "who-imports": "print-inverse-dependencies"
  }
}
```
