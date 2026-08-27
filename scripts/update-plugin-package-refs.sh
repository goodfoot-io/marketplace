#!/usr/bin/env bash
set -e

# Script to update package version references in plugin .mcp.json files
# This ensures that plugin configurations reference the correct version after a release
#
# Usage: ./scripts/update-plugin-package-refs.sh <package-name> <version> [--dry-run]
# Example: ./scripts/update-plugin-package-refs.sh mcp/browser 0.1.15
# Example: ./scripts/update-plugin-package-refs.sh mcp/browser 0.1.15 --dry-run

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
VERSION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      if [ -z "$PACKAGE_NAME" ]; then
        PACKAGE_NAME="$1"
      elif [ -z "$VERSION" ]; then
        VERSION="$1"
      fi
      shift
      ;;
  esac
done

# Validate arguments
if [ -z "$PACKAGE_NAME" ] || [ -z "$VERSION" ]; then
  echo -e "${RED}❌ Error: Package name and version are required${NC}"
  echo ""
  echo "Usage: $0 <package-name> <version> [--dry-run]"
  echo ""
  echo "Example: $0 mcp/browser 0.1.15"
  exit 1
fi

WORKSPACE_ROOT="$(git rev-parse --show-toplevel)"
PACKAGE_DIR="$WORKSPACE_ROOT/packages/$PACKAGE_NAME"
PACKAGE_JSON="$PACKAGE_DIR/package.json"
PLUGINS_DIR="$WORKSPACE_ROOT/plugins"

# Validate package exists
if [ ! -d "$PACKAGE_DIR" ]; then
  echo -e "${RED}❌ Error: Package not found at $PACKAGE_DIR${NC}"
  exit 1
fi

# Get the npm package name from package.json
NPM_PACKAGE_NAME=$(node -p "require('$PACKAGE_JSON').name" 2>/dev/null)
if [ -z "$NPM_PACKAGE_NAME" ]; then
  echo -e "${RED}❌ Error: Could not read package name from $PACKAGE_JSON${NC}"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo -e "${MAGENTA}🔍 DRY RUN MODE - No changes will be made${NC}"
fi
echo -e "${CYAN}🔄 Updating plugin references for ${NPM_PACKAGE_NAME}@${VERSION}${NC}"
echo ""

# Find all .mcp.json files in the plugins directory
MCP_FILES=$(find "$PLUGINS_DIR" -name ".mcp.json" -type f)

if [ -z "$MCP_FILES" ]; then
  # Fails closed deliberately. This glob is the only thing that keeps voice's
  # MCP package version moving at release time, and an empty result means the
  # search is looking in the wrong place — not that there is nothing to do.
  # Exiting 0 here made that a green no-op with no error anywhere.
  echo -e "${RED}❌ Error: No .mcp.json files found in $PLUGINS_DIR${NC}" >&2
  echo "   At least one plugin ships an .mcp.json; an empty result means this script is looking in the wrong place." >&2
  exit 1
fi

UPDATED_COUNT=0
FILES_TO_COMMIT=()

# Process each .mcp.json file
while IFS= read -r mcp_file; do
  # Check if this file references our package
  if grep -q "$NPM_PACKAGE_NAME" "$mcp_file"; then
    echo -e "${BLUE}📄 Found reference in: ${mcp_file#$WORKSPACE_ROOT/}${NC}"

    # Show current content
    if [ "$DRY_RUN" = true ]; then
      echo -e "${CYAN}Current content:${NC}"
      grep -A2 -B2 "$NPM_PACKAGE_NAME" "$mcp_file" || true
      echo ""
    fi

    # Create a temporary file for the update
    TEMP_FILE="${mcp_file}.tmp"

    # Use node script to safely update the JSON
    # This updates both @latest and any existing version references
    node "$WORKSPACE_ROOT/scripts/update-mcp-json-version.js" "$mcp_file" "$NPM_PACKAGE_NAME" "$VERSION" "$TEMP_FILE"
    NODE_EXIT_CODE=$?

    if [ $NODE_EXIT_CODE -eq 0 ]; then
      if [ "$DRY_RUN" = true ]; then
        echo -e "${MAGENTA}[DRY RUN]${NC} Would update to:"
        grep -A2 -B2 "$NPM_PACKAGE_NAME" "$TEMP_FILE" || true
        echo ""
        rm -f "$TEMP_FILE"
      else
        # Replace the original file with the updated version
        mv "$TEMP_FILE" "$mcp_file"
        echo -e "${GREEN}✅ Updated: ${mcp_file#$WORKSPACE_ROOT/}${NC}"
        FILES_TO_COMMIT+=("$mcp_file")
        UPDATED_COUNT=$((UPDATED_COUNT + 1))
      fi
    elif [ $NODE_EXIT_CODE -eq 1 ]; then
      echo -e "${YELLOW}⚠️  File contains package reference but no changes needed${NC}"
      rm -f "$TEMP_FILE"
    else
      echo -e "${RED}❌ Error processing JSON file${NC}"
      rm -f "$TEMP_FILE"
    fi

    echo ""
  fi
done <<< "$MCP_FILES"

# Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${MAGENTA}✅ Dry run completed${NC}"
  echo -e "${BLUE}📦 Package:${NC} $NPM_PACKAGE_NAME"
  echo -e "${BLUE}📍 Version:${NC} $VERSION"
  echo -e "${BLUE}🔍 Files that would be updated:${NC} $UPDATED_COUNT"
else
  if [ $UPDATED_COUNT -eq 0 ]; then
    echo -e "${CYAN}ℹ️  No plugin files needed updating${NC}"
  else
    echo -e "${GREEN}✅ Successfully updated $UPDATED_COUNT plugin file(s)${NC}"
    echo -e "${BLUE}📦 Package:${NC} $NPM_PACKAGE_NAME"
    echo -e "${BLUE}📍 Version:${NC} $VERSION"

    # Return the list of files to commit (for use by release script)
    if [ ${#FILES_TO_COMMIT[@]} -gt 0 ]; then
      echo ""
      echo -e "${BLUE}📝 Updated files:${NC}"
      for file in "${FILES_TO_COMMIT[@]}"; do
        echo "   ${file#$WORKSPACE_ROOT/}"
      done
    fi
  fi
fi
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

exit 0
