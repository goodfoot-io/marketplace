#!/usr/bin/env bash
set -e

# Script to update CHANGELOG.md with changes since last release
# Uses the claude CLI to analyze git history and generate changelog entries

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(dirname "$SCRIPT_DIR")"
PUBLIC_REPO_DIR="$EXTENSION_DIR/public-repository"
CHANGELOG_FILE="$PUBLIC_REPO_DIR/CHANGELOG.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📝 Updating CHANGELOG.md for Compare Branch Extension"
echo ""

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('$EXTENSION_DIR/package.json').version")
echo "Current version: $CURRENT_VERSION"

# Check if public repository exists
if [ ! -d "$PUBLIC_REPO_DIR" ]; then
  echo -e "${RED}❌ Error: Public repository not found at $PUBLIC_REPO_DIR${NC}"
  exit 1
fi

# Check if CHANGELOG.md exists, create if not
if [ ! -f "$CHANGELOG_FILE" ]; then
  echo "Creating new CHANGELOG.md..."
  echo "# Changelog" > "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"
fi

# Get the last version tag from main extension repo
cd "$EXTENSION_DIR"
LAST_TAG=$(git tag --sort=-version:refname | grep -E '^compare-branch-v[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || echo "")

if [ -z "$LAST_TAG" ]; then
  echo -e "${YELLOW}⚠️  No previous version tags found. Will analyze all commits.${NC}"
  COMMIT_RANGE="--all"
else
  echo "Last release tag: $LAST_TAG"
  COMMIT_RANGE="$LAST_TAG..HEAD"
fi

# Get git log since last tag
echo ""
echo "Analyzing changes since last release..."
GIT_LOG=$(git log $COMMIT_RANGE --oneline --no-merges 2>/dev/null || echo "No commits found")

if [ "$GIT_LOG" = "No commits found" ] || [ -z "$GIT_LOG" ]; then
  echo -e "${YELLOW}⚠️  No new commits found since last release${NC}"
  echo "Current CHANGELOG.md is up to date."
  exit 0
fi

echo "Found $(echo "$GIT_LOG" | wc -l) commits to analyze"
echo ""

# Get file changes summary
FILES_CHANGED=$(git diff --name-only $COMMIT_RANGE 2>/dev/null | head -20 || echo "")

# Create a prompt for Claude to generate changelog entry
PROMPT="You are helping to generate a CHANGELOG entry for version $CURRENT_VERSION of the Compare Branch VS Code extension.

Here are the commits since the last release:

\`\`\`
$GIT_LOG
\`\`\`

Files changed:
\`\`\`
$FILES_CHANGED
\`\`\`

Current package.json description: \"Lightning-fast git branch comparison with tree view and auto-detection. Perfect for AI coding agents like Claude Code, GitHub Copilot, and Cursor. Streamline your PR workflow.\"

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
6. EXCLUDE developer tooling changes (e.g., devcontainer, build scripts, test additions, CI/CD changes)
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

echo "Generated changelog entry:"
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
echo "Location: $CHANGELOG_FILE"
echo ""
echo "Next steps:"
echo "1. Review the generated changelog entry"
echo "2. Edit if needed: $CHANGELOG_FILE"
echo "3. Commit the changes to the public repository"
