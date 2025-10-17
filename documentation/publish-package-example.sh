#!/bin/bash

# Example script to publish an NPM package from this monorepo
# This demonstrates the workflow for publishing a package to NPM

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
  echo -e "${BLUE}==>${NC} $1"
}

print_success() {
  echo -e "${GREEN}✅${NC} $1"
}

print_error() {
  echo -e "${RED}❌${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠️${NC}  $1"
}

# Usage information
usage() {
  echo "Usage: $0 <package-name> <version>"
  echo ""
  echo "Example: $0 example 1.2.3"
  echo "         $0 streamable-http-mcp-server-daemon 0.1.0"
  echo ""
  echo "This will:"
  echo "  1. Validate the package exists"
  echo "  2. Update package.json version"
  echo "  3. Run local validation (build, test, lint)"
  echo "  4. Create and push a git tag"
  echo "  5. Trigger GitHub Actions workflow for NPM publishing"
  exit 1
}

# Check arguments
if [ $# -ne 2 ]; then
  usage
fi

PACKAGE_NAME="$1"
VERSION="$2"
PACKAGE_DIR="packages/${PACKAGE_NAME}"

# Validate version format
if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  print_error "Invalid version format: ${VERSION}"
  echo "Expected format: X.Y.Z (e.g., 1.2.3)"
  exit 1
fi

# Validate package exists
if [ ! -d "${PACKAGE_DIR}" ]; then
  print_error "Package directory not found: ${PACKAGE_DIR}"
  echo ""
  echo "Available packages:"
  ls -1 packages/
  exit 1
fi

if [ ! -f "${PACKAGE_DIR}/package.json" ]; then
  print_error "package.json not found in ${PACKAGE_DIR}"
  exit 1
fi

print_success "Package found: ${PACKAGE_DIR}"

# Extract current version
CURRENT_VERSION=$(node -p "require('./${PACKAGE_DIR}/package.json').version")
NPM_NAME=$(node -p "require('./${PACKAGE_DIR}/package.json').name")

print_step "Current version: ${CURRENT_VERSION}"
print_step "New version: ${VERSION}"
print_step "NPM package name: ${NPM_NAME}"

# Check if package is private
IS_PRIVATE=$(node -p "require('./${PACKAGE_DIR}/package.json').private || false")
if [ "${IS_PRIVATE}" = "true" ]; then
  print_error "Package is marked as private in package.json"
  echo "Remove '\"private\": true' to publish to NPM"
  exit 1
fi

# Confirm with user
echo ""
read -p "Continue with version bump and release? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  print_warning "Release cancelled"
  exit 0
fi

# Update package.json version
print_step "Updating package.json version..."
cd "${PACKAGE_DIR}"
npm version "${VERSION}" --no-git-tag-version
cd ../..
print_success "Version updated in package.json"

# Run local validation
print_step "Running local validation..."

print_step "Installing dependencies..."
yarn install --immutable

print_step "Building package..."
cd "${PACKAGE_DIR}"
yarn build || {
  print_error "Build failed"
  exit 1
}
print_success "Build passed"

print_step "Running type check..."
yarn typecheck || {
  print_error "Type check failed"
  exit 1
}
print_success "Type check passed"

print_step "Running tests..."
yarn test || {
  print_error "Tests failed"
  exit 1
}
print_success "Tests passed"

print_step "Running lint..."
yarn lint || {
  print_error "Lint failed"
  exit 1
}
print_success "Lint passed"

cd ../..

# Commit changes
print_step "Committing version bump..."
git add "${PACKAGE_DIR}/package.json"
git commit -m "Release ${PACKAGE_NAME} v${VERSION}"
print_success "Changes committed"

# Create and push tag
TAG_NAME="${PACKAGE_NAME}-v${VERSION}"
print_step "Creating tag: ${TAG_NAME}"
git tag "${TAG_NAME}"
print_success "Tag created"

print_step "Pushing changes and tag..."
git push origin main
git push origin "${TAG_NAME}"
print_success "Changes and tag pushed"

# Show next steps
echo ""
print_success "Release initiated!"
echo ""
echo "Next steps:"
echo "  1. Go to GitHub Actions: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
echo "  2. Monitor the 'Publish NPM Package' workflow"
echo "  3. Once complete, verify the package:"
echo "     - NPM: https://www.npmjs.com/package/${NPM_NAME}/v/${VERSION}"
echo "     - GitHub Release: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases/tag/${TAG_NAME}"
echo ""
echo "To install the published package:"
echo "  npm install ${NPM_NAME}@${VERSION}"
echo ""
