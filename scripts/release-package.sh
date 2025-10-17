#!/usr/bin/env bash
set -e

# Script to release a package from the monorepo
# Orchestrates the full release process:
#   1. Validates package and version
#   2. Checks for existing tags
#   3. Updates CHANGELOG
#   4. Creates and pushes git tag
#   5. Triggers GitHub Actions workflow
#
# Usage: ./scripts/release-package.sh <package-name> [--dry-run]
# Example: ./scripts/release-package.sh streamable-http-mcp-server-daemon
# Example: ./scripts/release-package.sh streamable-http-mcp-server-daemon --dry-run

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
PACKAGE_NAME=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      if [ -z "$PACKAGE_NAME" ]; then
        PACKAGE_NAME="$1"
      fi
      shift
      ;;
  esac
done

# Validate arguments
if [ -z "$PACKAGE_NAME" ]; then
  echo -e "${RED}❌ Error: Package name is required${NC}"
  echo ""
  echo "Usage: $0 <package-name> [--dry-run]"
  echo ""
  echo "Available packages:"
  ls -1 /workspace/packages/ | grep -v "CLAUDE.md" | grep -v ".DS_Store" | sed 's/^/  - /'
  exit 1
fi
WORKSPACE_ROOT="/workspace"
PACKAGE_DIR="$WORKSPACE_ROOT/packages/$PACKAGE_NAME"
PACKAGE_JSON="$PACKAGE_DIR/package.json"
CHANGELOG_FILE="$PACKAGE_DIR/CHANGELOG.md"

# Validate package exists
if [ ! -d "$PACKAGE_DIR" ]; then
  echo -e "${RED}❌ Error: Package not found at $PACKAGE_DIR${NC}"
  echo ""
  echo "Available packages:"
  ls -1 "$WORKSPACE_ROOT/packages/" | grep -v "CLAUDE.md" | grep -v ".DS_Store" | sed 's/^/  - /'
  exit 1
fi

# Validate package.json exists
if [ ! -f "$PACKAGE_JSON" ]; then
  echo -e "${RED}❌ Error: package.json not found at $PACKAGE_JSON${NC}"
  exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('$PACKAGE_JSON').version" 2>/dev/null)
if [ -z "$VERSION" ]; then
  echo -e "${RED}❌ Error: Could not read version from $PACKAGE_JSON${NC}"
  exit 1
fi

# Convert slashes to hyphens for git tag (e.g., mcp/ts-extra -> mcp-ts-extra)
TAG_PACKAGE_NAME="${PACKAGE_NAME//\//-}"
TAG="${TAG_PACKAGE_NAME}-v${VERSION}"

# Validate version format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo -e "${RED}❌ Error: Invalid version format '$VERSION'${NC}"
  echo "   Version must follow semantic versioning: MAJOR.MINOR.PATCH (e.g., 1.0.0)"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo -e "${MAGENTA}🔍 DRY RUN MODE - No changes will be made${NC}"
fi
echo -e "${CYAN}🚀 Preparing release for ${PACKAGE_NAME} v${VERSION}${NC}"
echo ""

# Check if tag already exists locally
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: Tag $TAG already exists locally${NC}"
  echo "   If you want to release this version, you must:"
  echo "   1. Delete the local tag: git tag -d $TAG"
  echo "   2. Delete the remote tag: git push --delete origin $TAG"
  echo "   3. Or bump the version in package.json"
  exit 1
fi

# Check if tag already exists on remote
if git ls-remote --tags origin | grep -q "refs/tags/$TAG"; then
  echo -e "${RED}❌ Error: Tag $TAG already exists on remote${NC}"
  echo "   If you want to release this version, you must:"
  echo "   1. Delete the remote tag: git push --delete origin $TAG"
  echo "   2. Delete the local tag: git tag -d $TAG"
  echo "   3. Or bump the version in package.json"
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
  echo ""
  git status --short
  echo ""
  if [ "$DRY_RUN" = false ]; then
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${RED}❌ Release cancelled${NC}"
      exit 1
    fi
  fi
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${YELLOW}⚠️  Warning: You are on branch '$CURRENT_BRANCH', not 'main'${NC}"
  echo ""
  if [ "$DRY_RUN" = false ]; then
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${RED}❌ Release cancelled${NC}"
      exit 1
    fi
  fi
fi

# Update CHANGELOG.md
echo ""
if [ "$DRY_RUN" = true ]; then
  echo -e "${MAGENTA}[DRY RUN]${NC} ${BLUE}Would update CHANGELOG.md${NC}"
  CHANGELOG_SCRIPT="$WORKSPACE_ROOT/scripts/update-package-changelog.sh"
  if [ -f "$CHANGELOG_SCRIPT" ]; then
    echo -e "${MAGENTA}[DRY RUN]${NC} Would run: bash $CHANGELOG_SCRIPT $PACKAGE_NAME"
    echo -e "${MAGENTA}[DRY RUN]${NC} Would commit and push CHANGELOG if modified"
  else
    echo -e "${YELLOW}⚠️  CHANGELOG update script not found at $CHANGELOG_SCRIPT${NC}"
  fi
else
  echo -e "${BLUE}📝 Updating CHANGELOG.md...${NC}"
  CHANGELOG_SCRIPT="$WORKSPACE_ROOT/scripts/update-package-changelog.sh"

  if [ -f "$CHANGELOG_SCRIPT" ]; then
    if bash "$CHANGELOG_SCRIPT" "$PACKAGE_NAME"; then
      echo ""
      echo -e "${GREEN}✅ CHANGELOG.md updated successfully${NC}"
      echo ""

      # Check if CHANGELOG was actually modified in the package directory
      cd "$WORKSPACE_ROOT"
      if ! git diff --quiet "$CHANGELOG_FILE" || ! git diff --cached --quiet "$CHANGELOG_FILE" 2>/dev/null; then
        echo -e "${BLUE}📄 CHANGELOG.md has been updated${NC}"
        echo ""
        git diff "$CHANGELOG_FILE" | head -30
        echo ""
        echo -e "${BLUE}📝 Committing and pushing CHANGELOG to main...${NC}"
        git add "$CHANGELOG_FILE"
        git commit -m "Update CHANGELOG for $PACKAGE_NAME v${VERSION}"
        git push origin main
        echo -e "${GREEN}✅ CHANGELOG committed and pushed${NC}"
      else
        echo -e "${CYAN}ℹ️  No changes to CHANGELOG.md (already up to date)${NC}"
      fi
    else
      echo -e "${YELLOW}⚠️  Warning: Failed to update CHANGELOG.md${NC}"
      echo ""
      read -p "Continue release anyway? (y/N) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Release cancelled${NC}"
        exit 1
      fi
    fi
  else
    echo -e "${YELLOW}⚠️  CHANGELOG update script not found at $CHANGELOG_SCRIPT${NC}"
    echo "   Skipping CHANGELOG update"
  fi
fi
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${MAGENTA}[DRY RUN]${NC} ${BLUE}Would create tag: $TAG${NC}"
  echo -e "${MAGENTA}[DRY RUN]${NC} Command: git tag -a \"$TAG\" -m \"Release $PACKAGE_NAME v${VERSION}\""
  echo ""
  echo -e "${MAGENTA}[DRY RUN]${NC} ${BLUE}Would push tag to origin${NC}"
  echo -e "${MAGENTA}[DRY RUN]${NC} Command: git push origin \"$TAG\""
else
  echo -e "${BLUE}📋 Creating tag: $TAG${NC}"
  git tag -a "$TAG" -m "Release $PACKAGE_NAME v${VERSION}"

  echo -e "${BLUE}📤 Pushing tag to origin...${NC}"
  git push origin "$TAG"
fi

echo ""
if [ "$DRY_RUN" = true ]; then
  echo -e "${MAGENTA}✅ Dry run completed successfully!${NC}"
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}📦 Package:${NC} $PACKAGE_NAME"
  echo -e "${BLUE}📍 Git Tag (not created):${NC} $TAG"
  echo -e "${BLUE}📦 Release Version:${NC} v${VERSION}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${MAGENTA}ℹ️  No changes were made. To perform the actual release, run:${NC}"
  echo -e "${CYAN}   $0 $PACKAGE_NAME${NC}"
  echo ""
else
  echo -e "${GREEN}✅ Release initiated!${NC}"
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}📦 Package:${NC} $PACKAGE_NAME"
  echo -e "${BLUE}📍 Git Tag:${NC} $TAG"
  echo -e "${BLUE}📦 Release Version:${NC} v${VERSION}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${BLUE}🔗 Monitor the automated workflow at:${NC}"
  echo "   https://github.com/wehriam/goodfoot/actions"
  echo ""
  echo -e "${BLUE}📋 The workflow will automatically:${NC}"
  echo "   1. Build the package"
  echo "   2. Run tests"
  echo "   3. Publish to NPM at:"
  echo "      https://www.npmjs.com/package/@goodfoot/$PACKAGE_NAME"
  echo "   4. Create GitHub release at:"
  echo "      https://github.com/wehriam/goodfoot/releases/tag/$TAG"
  echo ""

  # Check if CHANGELOG exists and show link
  if [ -f "$CHANGELOG_FILE" ]; then
    echo -e "${BLUE}📝 CHANGELOG:${NC}"
    echo "   https://github.com/wehriam/goodfoot/blob/main/packages/$PACKAGE_NAME/CHANGELOG.md"
    echo ""
  fi

  echo -e "${CYAN}⏱️  Expected completion time: 5-10 minutes${NC}"
  echo -e "${CYAN}📢 NPM may take additional time to process and display the package${NC}"
  echo ""
fi
