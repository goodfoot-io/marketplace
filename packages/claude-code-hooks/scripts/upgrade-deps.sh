#!/bin/bash
#
# Upgrade biome and claude-agent-sdk to latest versions, then validate.
#
# Usage:
#   ./scripts/upgrade-deps.sh           # Check and upgrade
#   ./scripts/upgrade-deps.sh --dry-run # Show what would change without modifying
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse args
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE ==="
  echo ""
fi

cd "$PACKAGE_DIR"

echo "=== Fetching latest versions ==="

# Get latest versions from npm registry
LATEST_BIOME=$(npm view @biomejs/biome version 2>/dev/null)
LATEST_SDK=$(npm view @anthropic-ai/claude-agent-sdk version 2>/dev/null)

if [[ -z "$LATEST_BIOME" ]]; then
  echo "Error: Could not fetch @biomejs/biome version from npm"
  exit 1
fi

if [[ -z "$LATEST_SDK" ]]; then
  echo "Error: Could not fetch @anthropic-ai/claude-agent-sdk version from npm"
  exit 1
fi

echo "Latest @biomejs/biome: $LATEST_BIOME"
echo "Latest @anthropic-ai/claude-agent-sdk: $LATEST_SDK"
echo ""

# Get current versions from package.json
CURRENT_BIOME=$(node -e "console.log(require('./package.json').devDependencies['@biomejs/biome'])")
CURRENT_SDK=$(node -e "console.log(require('./package.json').devDependencies['@anthropic-ai/claude-agent-sdk'])")

echo "Current @biomejs/biome: $CURRENT_BIOME"
echo "Current @anthropic-ai/claude-agent-sdk: $CURRENT_SDK"
echo ""

# Normalize version strings for comparison (strip ^ or ~)
CURRENT_BIOME_CLEAN="${CURRENT_BIOME#^}"
CURRENT_BIOME_CLEAN="${CURRENT_BIOME_CLEAN#~}"
CURRENT_SDK_CLEAN="${CURRENT_SDK#^}"
CURRENT_SDK_CLEAN="${CURRENT_SDK_CLEAN#~}"

BIOME_CHANGED=false
SDK_CHANGED=false

if [[ "$CURRENT_BIOME_CLEAN" != "$LATEST_BIOME" ]]; then
  BIOME_CHANGED=true
  echo "Biome will be upgraded: $CURRENT_BIOME_CLEAN -> $LATEST_BIOME"
else
  echo "Biome is already at latest version"
fi

if [[ "$CURRENT_SDK_CLEAN" != "$LATEST_SDK" ]]; then
  SDK_CHANGED=true
  echo "claude-agent-sdk will be upgraded: $CURRENT_SDK_CLEAN -> $LATEST_SDK"
else
  echo "claude-agent-sdk is already at latest version"
fi

echo ""

if [[ "$BIOME_CHANGED" == "false" && "$SDK_CHANGED" == "false" ]]; then
  echo "All dependencies are already at latest versions. Running validation anyway..."
  echo ""
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "=== Changes that would be made ==="

  if [[ "$BIOME_CHANGED" == "true" ]]; then
    echo ""
    echo "package.json: @biomejs/biome $CURRENT_BIOME -> $LATEST_BIOME"
    echo "src/scaffold.ts: biome version $CURRENT_BIOME_CLEAN -> $LATEST_BIOME (in generatePackageJson)"
    echo "src/scaffold.ts: biome schema URL version $CURRENT_BIOME_CLEAN -> $LATEST_BIOME (in generateBiomeConfig)"
    echo "biome.json: schema URL version $CURRENT_BIOME_CLEAN -> $LATEST_BIOME"
  fi

  if [[ "$SDK_CHANGED" == "true" ]]; then
    echo ""
    echo "package.json: @anthropic-ai/claude-agent-sdk $CURRENT_SDK -> ^$LATEST_SDK"
  fi

  echo ""
  echo "=== Validation steps that would run ==="
  echo "1. yarn install"
  echo "2. yarn lint"
  echo "3. yarn typecheck"
  echo "4. yarn test"
  echo "5. yarn snapshot:sdk-types"
  exit 0
fi

echo "=== Updating package.json ==="

if [[ "$BIOME_CHANGED" == "true" ]]; then
  # Update biome version in package.json (keep exact version, no ^)
  node -e "
    const fs = require('fs');
    const pkg = require('./package.json');
    pkg.devDependencies['@biomejs/biome'] = '$LATEST_BIOME';
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "Updated @biomejs/biome to $LATEST_BIOME in package.json"
fi

if [[ "$SDK_CHANGED" == "true" ]]; then
  # Update SDK version in package.json (keep ^ prefix)
  node -e "
    const fs = require('fs');
    const pkg = require('./package.json');
    pkg.devDependencies['@anthropic-ai/claude-agent-sdk'] = '^$LATEST_SDK';
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "Updated @anthropic-ai/claude-agent-sdk to ^$LATEST_SDK in package.json"
fi

if [[ "$BIOME_CHANGED" == "true" ]]; then
  echo ""
  echo "=== Updating scaffold.ts ==="

  # Update biome version in generatePackageJson function
  # Pattern: "@biomejs/biome": "X.Y.Z"
  sed -i "s|\"@biomejs/biome\": \"[0-9]*\.[0-9]*\.[0-9]*\"|\"@biomejs/biome\": \"$LATEST_BIOME\"|g" src/scaffold.ts
  echo "Updated @biomejs/biome version in generatePackageJson()"

  # Update biome schema URL in generateBiomeConfig function
  # Pattern: https://biomejs.dev/schemas/X.Y.Z/schema.json
  sed -i "s|biomejs.dev/schemas/[0-9]*\.[0-9]*\.[0-9]*/schema.json|biomejs.dev/schemas/$LATEST_BIOME/schema.json|g" src/scaffold.ts
  echo "Updated biome schema URL in generateBiomeConfig()"

  echo ""
  echo "=== Updating biome.json ==="
  # Update biome schema URL in biome.json
  sed -i "s|biomejs.dev/schemas/[0-9]*\.[0-9]*\.[0-9]*/schema.json|biomejs.dev/schemas/$LATEST_BIOME/schema.json|g" biome.json
  echo "Updated biome schema URL in biome.json"
fi

echo ""
echo "=== Running yarn install ==="
cd "$PACKAGE_DIR/../.."
yarn install

echo ""
echo "=== Running linting ==="
cd "$PACKAGE_DIR"
yarn lint
echo "✓ Linting passed"

echo ""
echo "=== Running type checking ==="
yarn typecheck
echo "✓ Type checking passed"

echo ""
echo "=== Running tests ==="
yarn test
echo "✓ Tests passed"

echo ""
echo "=== Running SDK type snapshot ==="
yarn snapshot:sdk-types
SNAPSHOT_EXIT=$?

echo ""
if [[ $SNAPSHOT_EXIT -eq 0 ]]; then
  echo "✓ SDK types unchanged or baseline updated successfully"
else
  echo ""
  echo "=== SDK Type Changes Detected ==="
  echo "The snapshot script detected type changes in the SDK."
  echo "Review the changes above and if they are expected, run:"
  echo "  yarn snapshot:sdk-types --update"
  echo ""
  echo "Then update the package types to match the new SDK types."
fi

echo ""
echo "=== Upgrade Complete ==="
if [[ "$BIOME_CHANGED" == "true" || "$SDK_CHANGED" == "true" ]]; then
  echo "Updated packages:"
  [[ "$BIOME_CHANGED" == "true" ]] && echo "  - @biomejs/biome: $CURRENT_BIOME_CLEAN -> $LATEST_BIOME"
  [[ "$SDK_CHANGED" == "true" ]] && echo "  - @anthropic-ai/claude-agent-sdk: $CURRENT_SDK_CLEAN -> $LATEST_SDK"
else
  echo "All packages were already at latest versions."
fi

# If SDK was upgraded, invoke Claude to detect and implement new functionality
if [[ "$SDK_CHANGED" == "true" ]]; then
  echo ""
  echo "=== Analyzing SDK Changes with Claude ==="
  echo "Invoking Claude to detect new hooks, tool types, or functionality..."
  echo ""

  WORKSPACE_ROOT="$(cd "$PACKAGE_DIR/../.." && pwd)"
  cd "$WORKSPACE_ROOT"

  CLAUDE_PROMPT="The @anthropic-ai/claude-agent-sdk package has been upgraded from version $CURRENT_SDK_CLEAN to $LATEST_SDK in the @goodfoot/claude-code-hooks package.

**Your Task:** Analyze the SDK changes and update the claude-code-hooks package to support any new functionality.

**SDK Type Definitions Location:**
- node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts

**Package Source Files:**
- packages/claude-code-hooks/src/types.ts - Type definitions (hook inputs, tool types)
- packages/claude-code-hooks/src/hooks.ts - Hook factory functions
- packages/claude-code-hooks/src/outputs.ts - Output builder functions
- packages/claude-code-hooks/src/constants.ts - Hook name mappings
- packages/claude-code-hooks/src/scaffold.ts - Project scaffolding
- packages/claude-code-hooks/src/index.ts - Public exports

**Instructions:**
1. Read the SDK type definitions to identify:
   - New hook event types (e.g., new *HookInput types)
   - New tool input types (e.g., new *Input types for tools)
   - Changed or renamed types
   - New fields on existing types

2. Compare with the current package types in src/types.ts to find gaps

3. For any new hook types found:
   - Add the input type to src/types.ts
   - Add the output type and builder to src/outputs.ts
   - Add the hook factory to src/hooks.ts
   - Add the mapping to src/constants.ts
   - Update src/scaffold.ts if needed
   - Export from src/index.ts

4. For any new tool types found:
   - Add imports and re-exports in src/types.ts
   - Add type guards if appropriate

5. Update tests if you add new functionality:
   - tests/types/inputs.test.ts
   - tests/hooks.test.ts

6. Run validation after changes:
   - yarn typecheck
   - yarn test

If no new functionality needs to be added, explain what you found and confirm the package is up to date.

Start by reading the SDK type definitions."

  claude -p "$CLAUDE_PROMPT"

  echo ""
  echo "=== Claude Analysis Complete ==="
  echo "Review any changes made and run validation:"
  echo "  cd packages/claude-code-hooks"
  echo "  yarn typecheck && yarn test"
fi
