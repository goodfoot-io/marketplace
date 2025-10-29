#!/usr/bin/env bash
set -e

# Script to update CHANGELOG.md for a specific package in the monorepo
# Uses the claude CLI to analyze git history and generate changelog entries
#
# Usage: ./scripts/update-package-changelog.sh <package-name>
# Example: ./scripts/update-package-changelog.sh streamable-http-mcp-server-daemon

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validate arguments
if [ $# -eq 0 ]; then
  echo -e "${RED}❌ Error: Package name is required${NC}"
  echo ""
  echo "Usage: $0 <package-name>"
  echo ""
  echo "Available packages:"
  ls -1 /workspace/packages/ | grep -v "CLAUDE.md" | sed 's/^/  - /'
  exit 1
fi

PACKAGE_NAME="$1"
WORKSPACE_ROOT="/workspace"
PACKAGE_DIR="$WORKSPACE_ROOT/packages/$PACKAGE_NAME"
PACKAGE_JSON="$PACKAGE_DIR/package.json"
CHANGELOG_FILE="$PACKAGE_DIR/CHANGELOG.md"

echo -e "${BLUE}📝 Updating CHANGELOG.md for package: $PACKAGE_NAME${NC}"
echo ""

# Validate package exists
if [ ! -d "$PACKAGE_DIR" ]; then
  echo -e "${RED}❌ Error: Package not found at $PACKAGE_DIR${NC}"
  echo ""
  echo "Available packages:"
  ls -1 "$WORKSPACE_ROOT/packages/" | grep -v "CLAUDE.md" | sed 's/^/  - /'
  exit 1
fi

# Validate package.json exists
if [ ! -f "$PACKAGE_JSON" ]; then
  echo -e "${RED}❌ Error: package.json not found at $PACKAGE_JSON${NC}"
  exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('$PACKAGE_JSON').version" 2>/dev/null)
if [ -z "$CURRENT_VERSION" ]; then
  echo -e "${RED}❌ Error: Could not read version from $PACKAGE_JSON${NC}"
  exit 1
fi
echo -e "Current version: ${GREEN}$CURRENT_VERSION${NC}"

# Get package description for context
PACKAGE_DESCRIPTION=$(node -p "require('$PACKAGE_JSON').description || ''" 2>/dev/null)

# Check if CHANGELOG.md exists, create if not
if [ ! -f "$CHANGELOG_FILE" ]; then
  echo -e "${YELLOW}Creating new CHANGELOG.md...${NC}"
  echo "# Changelog" > "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"
fi

# Change to workspace root for git operations
cd "$WORKSPACE_ROOT"

# Convert slashes to hyphens for git tag matching (e.g., mcp/browser -> mcp-browser)
TAG_PACKAGE_NAME="${PACKAGE_NAME//\//-}"

# Get the last version tag for this package
# Expected format: {package-name}-v{version}
LAST_TAG=$(git tag --sort=-version:refname | grep -E "^${TAG_PACKAGE_NAME}-v[0-9]+\.[0-9]+\.[0-9]+" | head -1 || echo "")

if [ -z "$LAST_TAG" ]; then
  echo -e "${YELLOW}⚠️  No previous version tags found for this package.${NC}"
  echo -e "${YELLOW}⚠️  Will analyze all commits affecting this package.${NC}"
  COMMIT_RANGE=""
else
  echo -e "Last release tag: ${GREEN}$LAST_TAG${NC}"
  COMMIT_RANGE="$LAST_TAG..HEAD"
fi

# Get git log for commits that modified files in this package
echo ""
echo "Analyzing changes affecting packages/$PACKAGE_NAME/..."

if [ -z "$COMMIT_RANGE" ]; then
  # No previous tag - get all commits for this package
  GIT_LOG=$(git log --oneline --no-merges -- "packages/$PACKAGE_NAME/" 2>/dev/null || echo "")
else
  # Get commits since last tag that affected this package
  GIT_LOG=$(git log $COMMIT_RANGE --oneline --no-merges -- "packages/$PACKAGE_NAME/" 2>/dev/null || echo "")
fi

if [ -z "$GIT_LOG" ]; then
  echo -e "${YELLOW}⚠️  No commits found affecting this package since last release${NC}"
  echo "Current CHANGELOG.md is up to date."
  exit 0
fi

COMMIT_COUNT=$(echo "$GIT_LOG" | wc -l | tr -d ' ')
echo -e "Found ${GREEN}$COMMIT_COUNT${NC} commit(s) to analyze"
echo ""

# Get file changes summary for this package
if [ -z "$COMMIT_RANGE" ]; then
  FILES_CHANGED=$(git log --name-only --pretty=format: -- "packages/$PACKAGE_NAME/" | sort -u | head -20 || echo "")
else
  FILES_CHANGED=$(git diff --name-only $COMMIT_RANGE -- "packages/$PACKAGE_NAME/" 2>/dev/null | head -20 || echo "")
fi

# Create a prompt for Claude to generate changelog entry
PROMPT="You are helping to generate a CHANGELOG entry for version $CURRENT_VERSION of the $PACKAGE_NAME package.

Here are the commits since the last release that affected this package:

\`\`\`
$GIT_LOG
\`\`\`

Files changed in this package:
\`\`\`
$FILES_CHANGED
\`\`\`"

# Add package description if available
if [ -n "$PACKAGE_DESCRIPTION" ]; then
  PROMPT="$PROMPT

Package description: \"$PACKAGE_DESCRIPTION\""
fi

PROMPT="$PROMPT

Please analyze these changes and generate a changelog entry following this format:

## $CURRENT_VERSION

- Brief, user-facing description of change 1
- Brief, user-facing description of change 2
- Brief, user-facing description of change 3

Guidelines:
1. Focus ONLY on user-facing changes (new features, improvements, bug fixes that users will notice)
2. Be concise - one line per change
3. Group similar changes together
4. Use action verbs (Added, Fixed, Improved, Enhanced, etc.)
5. EXCLUDE internal implementation details (e.g., class names, manager implementations, internal refactoring)
6. EXCLUDE developer tooling changes (e.g., build scripts, test additions, CI/CD changes)
7. EXCLUDE infrastructure changes unless they directly improve user experience
8. Don't include version numbers or dates in individual bullets
9. Prioritize important changes first
10. If there are only minor internal changes, summarize as \"Minor improvements and bug fixes\"

Output ONLY the changelog entry in the format shown above, starting with ## $CURRENT_VERSION"

echo "Generating changelog entry with Claude..."
echo ""

# Use claude CLI to generate changelog entry
CHANGELOG_ENTRY=$(claude -p "$PROMPT" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$CHANGELOG_ENTRY" ]; then
  echo -e "${RED}❌ Error: Failed to generate changelog entry with Claude${NC}"
  echo -e "${YELLOW}Make sure the 'claude' CLI is installed and available in your PATH${NC}"
  exit 1
fi

# Extract only the changelog entry (from ## onwards, including all bullet points)
# Remove any preamble/explanation text from Claude before the ## header
CLEANED_ENTRY=$(echo "$CHANGELOG_ENTRY" | awk '/^## /{flag=1} flag' | sed '/^[[:space:]]*$/d')

# If no ## found, try to find it with leading text on same line
if [ -z "$CLEANED_ENTRY" ]; then
  # Try to extract starting from any line containing ##
  CLEANED_ENTRY=$(echo "$CHANGELOG_ENTRY" | awk '/## /{flag=1} flag' | sed 's/^.*## /## /' | sed '/^[[:space:]]*$/d')
fi

if [ -z "$CLEANED_ENTRY" ]; then
  echo -e "${RED}❌ Error: Could not extract changelog entry from Claude's response${NC}"
  echo "Raw response:"
  echo "$CHANGELOG_ENTRY"
  exit 1
fi

echo -e "${GREEN}Generated changelog entry:${NC}"
echo ""
echo "$CLEANED_ENTRY"
echo ""

# Read current changelog content (everything after the header)
CURRENT_CONTENT=$(sed -n '/^## /,$p' "$CHANGELOG_FILE")

# Create new changelog with entry at the top
{
  echo "# Changelog"
  echo ""
  echo "$CLEANED_ENTRY"
  echo ""
  if [ -n "$CURRENT_CONTENT" ]; then
    echo "$CURRENT_CONTENT"
  fi
} > "$CHANGELOG_FILE.tmp"

mv "$CHANGELOG_FILE.tmp" "$CHANGELOG_FILE"

echo -e "${GREEN}✅ CHANGELOG.md updated successfully!${NC}"
echo ""
echo -e "Location: ${BLUE}$CHANGELOG_FILE${NC}"
echo ""
echo "Next steps:"
echo "1. Review the generated changelog entry"
echo "2. Edit if needed: $CHANGELOG_FILE"
echo "3. Commit the changes"
echo "4. Tag the release: git tag ${PACKAGE_NAME}-v${CURRENT_VERSION}"
echo ""
