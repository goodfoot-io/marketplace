#!/usr/bin/env bash
set -e

# Get version from package.json
VERSION=$(node -p "require('../package.json').version")
TAG="compare-branch-v${VERSION}"

# Validate version format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Error: Invalid version format '$VERSION'"
  echo "   Version must follow semantic versioning: MAJOR.MINOR.PATCH (e.g., 1.0.0)"
  exit 1
fi

echo "🚀 Preparing release for Compare Branch v${VERSION}"
echo ""

# Check if tag already exists locally
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "❌ Error: Tag $TAG already exists locally"
  echo "   If you want to release this version, you must:"
  echo "   1. Delete the local tag: git tag -d $TAG"
  echo "   2. Delete the remote tag: git push --delete origin $TAG"
  echo "   3. Or bump the version in package.json"
  exit 1
fi

# Check if tag already exists on remote
if git ls-remote --tags origin | grep -q "refs/tags/$TAG"; then
  echo "❌ Error: Tag $TAG already exists on remote"
  echo "   If you want to release this version, you must:"
  echo "   1. Delete the remote tag: git push --delete origin $TAG"
  echo "   2. Delete the local tag: git tag -d $TAG"
  echo "   3. Or bump the version in package.json"
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "⚠️  Warning: You have uncommitted changes"
  echo ""
  git status --short
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Release cancelled"
    exit 1
  fi
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  Warning: You are on branch '$CURRENT_BRANCH', not 'main'"
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Release cancelled"
    exit 1
  fi
fi

# Update CHANGELOG.md
echo ""
echo "📝 Updating CHANGELOG.md..."
if [ -f "./update-changelog.sh" ]; then
  if bash ./update-changelog.sh; then
    echo ""
    echo "✅ CHANGELOG.md updated successfully"
    echo ""

    # Check if CHANGELOG was actually modified (check inside the public-repository git repo)
    cd public-repository
    if ! git diff --quiet CHANGELOG.md || ! git diff --cached --quiet CHANGELOG.md; then
      echo "📄 CHANGELOG.md has been updated"
      echo ""
      git diff CHANGELOG.md | head -30
      echo ""
      echo "📝 Committing and pushing CHANGELOG to public repository..."
      git add CHANGELOG.md
      git commit -m "Update CHANGELOG for v${VERSION}"
      git push origin main
      cd ..
      echo "✅ CHANGELOG committed and pushed to public repository"
    else
      echo "ℹ️  No changes to CHANGELOG.md (already up to date)"
      cd ..
    fi
  else
    echo "⚠️  Warning: Failed to update CHANGELOG.md"
    echo ""
    read -p "Continue release anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "❌ Release cancelled"
      exit 1
    fi
  fi
else
  echo "⚠️  CHANGELOG update script not found (./update-changelog.sh)"
  echo "   Skipping CHANGELOG update"
fi
echo ""

echo "📋 Creating tag: $TAG"
git tag -a "$TAG" -m "Release Compare Branch v${VERSION}"

echo "📤 Pushing tag to origin..."
git push origin "$TAG"

echo ""
echo "✅ Release initiated!"
echo ""
echo "📍 Git Tag: $TAG"
echo "📦 Release Version: v${VERSION}"
echo ""
echo "🔗 Monitor the automated workflow at:"
echo "   https://github.com/wehriam/goodfoot/actions"
echo ""
echo "📋 The workflow will automatically:"
echo "   1. Build the extension"
echo "   2. Create GitHub release at:"
echo "      https://github.com/goodfoot-io/compare-branch-extension/releases/tag/v${VERSION}"
echo "   3. Publish to VS Code Marketplace:"
echo "      https://marketplace.visualstudio.com/items?itemName=goodfoot.compare-branch"
echo "   4. Publish to Open VSX Registry:"
echo "      https://open-vsx.org/extension/goodfoot/compare-branch"
echo ""
echo "📝 CHANGELOG: https://github.com/goodfoot-io/compare-branch-extension/blob/main/CHANGELOG.md"
echo ""
echo "⏱️  Expected completion time: 5-10 minutes"
echo "📢 Both marketplaces may take additional time to process and display the extension"
