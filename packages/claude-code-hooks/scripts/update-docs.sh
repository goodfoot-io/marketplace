#!/usr/bin/env bash
set -e

# Script to update documentation files for claude-code-hooks package
# Uses Claude to review changes since last release and update docs accordingly
#
# Usage: ./scripts/update-docs.sh [--dry-run]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

WORKSPACE_ROOT="/workspace"
PACKAGE_DIR="$WORKSPACE_ROOT/packages/claude-code-hooks"
PACKAGE_JSON="$PACKAGE_DIR/package.json"

# Get current version
CURRENT_VERSION=$(node -p "require('$PACKAGE_JSON').version" 2>/dev/null)
if [ -z "$CURRENT_VERSION" ]; then
  echo -e "${RED}❌ Error: Could not read version from $PACKAGE_JSON${NC}"
  exit 1
fi

echo -e "${CYAN}📚 Updating documentation for claude-code-hooks v${CURRENT_VERSION}${NC}"
echo ""

# Get the last version tag
LAST_TAG=$(git tag --sort=-version:refname | grep -E "^claude-code-hooks-v[0-9]+\.[0-9]+\.[0-9]+" | head -1 || echo "")

if [ -z "$LAST_TAG" ]; then
  echo -e "${YELLOW}⚠️  No previous version tags found.${NC}"
  LAST_TAG="HEAD~20"
fi

echo -e "Last release tag: ${GREEN}$LAST_TAG${NC}"
echo ""

# Documentation file locations (using globs)
DOC_FILES_LIST="packages/claude-code-hooks/README.md
plugins/claude-code-hooks/skills/sdk/**/*.md"

# Create the prompt for Claude
PROMPT="Review the changes to the @goodfoot/claude-code-hooks package since tag '${LAST_TAG}' and update the documentation files if needed.

**Last Published Tag:** ${LAST_TAG}

**Documentation Files to Review and Update:**
${DOC_FILES_LIST}

**Instructions:**
1. Use git diff ${LAST_TAG}..HEAD -- packages/claude-code-hooks/src/ to see what source code has changed
2. Review each documentation file listed above
3. Update any documentation that is outdated based on the source changes:
   - Add new hook types if any were added
   - Update API signatures if they changed
   - Add new features or capabilities
   - Update examples if the API changed
   - Update counts (e.g., '12 hook types' -> '13 hook types' if a new hook was added)
4. Maintain the existing style and structure of each file
5. Only make changes that are necessary - don't rewrite content that is still accurate

If no documentation updates are needed, say so and explain why.

Start by examining the git diff to understand what changed."

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}[DRY RUN]${NC} Would run Claude with the following prompt:"
  echo ""
  echo "─────────────────────────────────────────"
  echo "$PROMPT"
  echo "─────────────────────────────────────────"
  echo ""
  echo -e "${CYAN}ℹ️  Run without --dry-run to execute${NC}"
else
  echo -e "${BLUE}🤖 Invoking Claude to review and update documentation...${NC}"
  echo ""

  cd "$WORKSPACE_ROOT"
  claude -p "$PROMPT"

  echo ""
  echo -e "${GREEN}✅ Documentation review complete${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Review any changes: git diff"
  echo "2. Commit if satisfied: git add -A && git commit -m 'docs: update claude-code-hooks documentation for v${CURRENT_VERSION}'"
fi
