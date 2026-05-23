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
LINT_FAILED=false
LINT_OUTPUT="$(yarn lint 2>&1)" || LINT_FAILED=true
echo "$LINT_OUTPUT"
if [[ "$LINT_FAILED" == "true" ]]; then
  echo ""
  echo "⚠️  Linting is failing — continuing with upgrade process anyway."
  echo "   The errors above will be passed to Claude for analysis."
else
  echo "✓ Linting passed"
fi

echo ""
echo "=== Running type checking ==="
TYPECHECK_FAILED=false
TYPECHECK_OUTPUT="$(yarn typecheck 2>&1)" || TYPECHECK_FAILED=true
echo "$TYPECHECK_OUTPUT"
if [[ "$TYPECHECK_FAILED" == "true" ]]; then
  echo ""
  echo "⚠️  Type checking is failing — continuing with upgrade process anyway."
  echo "   The errors above will be passed to Claude for analysis."
else
  echo "✓ Type checking passed"
fi

echo ""
echo "=== Running tests ==="
TEST_FAILED=false
yarn test || TEST_FAILED=true
if [[ "$TEST_FAILED" == "true" ]]; then
  echo ""
  echo "⚠️  Tests are failing — continuing with upgrade process anyway."
  echo "   Review test failures above and fix them after the upgrade completes."
else
  echo "✓ Tests passed"
fi

echo ""
echo "=== Running SDK type snapshot ==="
yarn snapshot:sdk-types || SNAPSHOT_EXIT=$?
SNAPSHOT_EXIT=${SNAPSHOT_EXIT:-0}

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

# Invoke Claude if the SDK was upgraded, or if any validation step failed.
if [[ "$SDK_CHANGED" == "true" || "$LINT_FAILED" == "true" || "$TYPECHECK_FAILED" == "true" || "$TEST_FAILED" == "true" ]]; then
  echo ""
  echo "=== Analyzing Changes with Claude ==="
  if [[ "$SDK_CHANGED" == "true" ]]; then
    echo "Invoking Claude to detect new hooks, tool types, or functionality..."
  fi
  [[ "$LINT_FAILED" == "true" ]] && echo "⚠️  Note: Linting was failing before Claude analysis — Claude will need to fix it."
  [[ "$TYPECHECK_FAILED" == "true" ]] && echo "⚠️  Note: Type checking was failing before Claude analysis — Claude will need to fix it."
  [[ "$TEST_FAILED" == "true" ]] && echo "⚠️  Note: Tests were failing before Claude analysis — Claude will need to fix them."
  echo ""

  WORKSPACE_ROOT="$(cd "$PACKAGE_DIR/../.." && pwd)"
  cd "$WORKSPACE_ROOT"

  LINT_FAILURE_NOTE=""
  if [[ "$LINT_FAILED" == "true" ]]; then
    LINT_FAILURE_NOTE="

**⚠️ Linting was failing after the upgrade.** You must identify and fix the lint errors. The 'yarn lint' output was:

\`\`\`
$LINT_OUTPUT
\`\`\`"
  fi

  TYPECHECK_FAILURE_NOTE=""
  if [[ "$TYPECHECK_FAILED" == "true" ]]; then
    TYPECHECK_FAILURE_NOTE="

**⚠️ Type checking was failing after the upgrade.** You must identify and fix the type errors. The 'yarn typecheck' output was:

\`\`\`
$TYPECHECK_OUTPUT
\`\`\`"
  fi

  TEST_FAILURE_NOTE=""
  if [[ "$TEST_FAILED" == "true" ]]; then
    TEST_FAILURE_NOTE="

**⚠️ Note: Tests were already failing before this analysis.** As part of your work, you must also identify and fix the failing tests. Run 'yarn test' in packages/claude-code-hooks to see the current failures."
  fi

  SDK_UPGRADE_NOTE="The @anthropic-ai/claude-agent-sdk package has been upgraded from version $CURRENT_SDK_CLEAN to $LATEST_SDK in the @goodfoot/claude-code-hooks package."
  if [[ "$SDK_CHANGED" != "true" ]]; then
    SDK_UPGRADE_NOTE="Dependencies in the @goodfoot/claude-code-hooks package were upgraded (the claude-agent-sdk version was unchanged)."
  fi

  # SDK-analysis instructions are only relevant when the SDK version changed.
  SDK_INSTRUCTIONS=""
  if [[ "$SDK_CHANGED" == "true" ]]; then
    SDK_INSTRUCTIONS="

**Your Task:** Analyze the SDK changes and update the claude-code-hooks package to support any new functionality.

**SDK Type Definitions Location:**
- node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts

**Package Source Files:**
- packages/claude-code-hooks/src/*

**Instructions:**

1. Run 'yarn snapshot:sdk-types' to identify changes since the last snapshot

2. Read the SDK type definitions to identify:
   - New hook event types (e.g., new *HookInput types)
   - New tool input types (e.g., new *Input types for tools)
   - Changed or renamed types
   - New fields on existing types

3. Compare with the current package types in src/types.ts to find gaps

4. For any new hook types found:
   - Add the input type to src/types.ts
   - Add the output type and builder to src/outputs.ts
   - Add the hook factory to src/hooks.ts
   - Add the mapping to src/constants.ts
   - Update src/scaffold.ts if needed
   - Export from src/index.ts

5. For any new tool types found:
   - Add imports and re-exports in src/types.ts
   - Add type guards if appropriate

6. Update tests if you add new functionality:
   - tests/types/inputs.test.ts
   - tests/hooks.test.ts

7. Run validation after changes:
   - yarn typecheck
   - yarn test

8. Run 'yarn snapshot:sdk-types --update' to store a new snapshot

9. Update documentation:
   - Find the last release tag: git tag --sort=-version:refname | grep -E '^claude-code-hooks-v[0-9]+\.[0-9]+\.[0-9]+' | head -1
   - Run git diff <last-tag>..HEAD -- packages/claude-code-hooks/src/ to see what changed
   - Review and update these files based on the source changes:
     - packages/claude-code-hooks/README.md
     - plugins/claude-code-hooks/skills/sdk/**/*.md
   - Add new hook types, update API signatures, update examples, update counts (e.g. '17 hook types' -> '19 hook types')
   - Maintain the existing style and structure; only change what is outdated

10. Bump the version number

11. Commit the changes

If no new functionality needs to be added, explain what you found and confirm the package is up to date.

Start by reading the SDK type definitions."
  fi

  # When validation failed, the priority is to get the package green again.
  FIX_INSTRUCTIONS=""
  if [[ "$LINT_FAILED" == "true" || "$TYPECHECK_FAILED" == "true" || "$TEST_FAILED" == "true" ]]; then
    FIX_INSTRUCTIONS="

**Your Task:** The dependency upgrade left the @goodfoot/claude-code-hooks package failing validation. Fix the errors reported above so that 'yarn lint', 'yarn typecheck', and 'yarn test' all pass.

**Package Source Files:**
- packages/claude-code-hooks/src/*

**Instructions:**

1. Investigate the reported lint / type / test errors in packages/claude-code-hooks.
2. Fix the underlying cause. Do NOT disable lint or TypeScript rules, and do NOT use the 'any' type.
3. Re-run validation until everything passes:
   - cd packages/claude-code-hooks && yarn lint && yarn typecheck && yarn test
4. Bump the version number.
5. Commit the changes."
  fi

  CLAUDE_PROMPT="$SDK_UPGRADE_NOTE$LINT_FAILURE_NOTE$TYPECHECK_FAILURE_NOTE$TEST_FAILURE_NOTE$SDK_INSTRUCTIONS$FIX_INSTRUCTIONS"

  claude -p "$CLAUDE_PROMPT"

  echo ""
  echo "=== Claude Analysis Complete ==="
  echo "Review any changes made and run validation:"
  echo "  cd packages/claude-code-hooks"
  echo "  yarn lint && yarn typecheck && yarn test"
  if [[ "$LINT_FAILED" == "true" || "$TYPECHECK_FAILED" == "true" || "$TEST_FAILED" == "true" ]]; then
    echo ""
    echo "⚠️  The following were failing at the start of this run — confirm they are now fixed:"
    [[ "$LINT_FAILED" == "true" ]] && echo "   - linting"
    [[ "$TYPECHECK_FAILED" == "true" ]] && echo "   - type checking"
    [[ "$TEST_FAILED" == "true" ]] && echo "   - tests"
  fi
fi
