# GitHub Setup for Automated NPM Publishing

## Overview

This repository includes a complete automated NPM publishing system that streamlines package releases from our Yarn 4.9.4 monorepo. When you push a properly formatted tag, the system automatically:

1. **Validates** the package and version
2. **Builds** and tests the package
3. **Publishes** to NPM registry
4. **Creates** a GitHub release with changelog

**Benefits:**
- No manual NPM commands needed
- Consistent release process across all packages
- Automated quality checks before publishing
- GitHub releases with changelogs automatically generated
- Reduces human error in the release process

---

## Prerequisites

Before setting up automated NPM publishing, ensure you have:

- [ ] **GitHub Repository Admin Access** - Required to configure secrets
- [ ] **NPM Account with Publishing Permissions** - You must be able to publish packages to NPM
- [ ] **Claude CLI Installed** - For changelog generation (install: `npm install -g @anthropic-ai/cli`)
- [ ] **Yarn 4.9.4** - Package manager used by this monorepo
- [ ] **Node.js 20.x or higher** - Required for building and testing packages

---

## NPM Token Setup

### Step 1: Create an NPM Automation Token

1. Navigate to your NPM account settings:
   - Go to https://www.npmjs.com/settings/tokens
   - Sign in if prompted

2. Generate a new token:
   - Click **"Generate New Token"**
   - Select **"Classic Token"** (not Granular Access Token)

3. Choose token type:
   - Select **"Automation"** type
   - **Important:** Do NOT select "Publish" - use "Automation" for CI/CD environments

4. Token permissions:
   - Automation tokens have full publish permissions
   - They work in non-interactive environments (like GitHub Actions)
   - They don't expire unless manually revoked

5. Copy the token:
   - **Critical:** The token is only shown once
   - Copy it immediately and store it securely
   - Token format: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Security Note:** Never commit this token to your repository or share it publicly. It will be stored securely in GitHub Secrets.

---

## GitHub Secrets Configuration

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository
2. Click **"Settings"** (tab at the top)
3. In the left sidebar, expand **"Secrets and variables"**
4. Click **"Actions"**

### Step 2: Add NPM_TOKEN Secret

1. Click the **"New repository secret"** button
2. Configure the secret:
   - **Name:** `NPM_TOKEN` (must be exactly this)
   - **Value:** Paste your NPM automation token
3. Click **"Add secret"**

### Step 3: Verify Secret is Added

- The secret should appear in the list as `NPM_TOKEN`
- The value will be hidden (shown as `***`)
- You cannot view the value again (only update or delete)

**Troubleshooting:**
- If the secret doesn't appear, refresh the page
- Ensure the name is exactly `NPM_TOKEN` (case-sensitive)
- If you need to update it, click the secret name and use "Update secret"

---

## Package Configuration

Each package in `/workspace/packages/` must be properly configured for NPM publishing.

### Required package.json Fields

```json
{
  "name": "@goodfoot/package-name",
  "version": "1.0.0",
  "description": "Clear description of what the package does",
  "private": false,
  "type": "module",
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "lint": "eslint ."
  },
  "exports": {
    ".": {
      "import": "./build/dist/src/index.js",
      "types": "./build/types/src/index.d.ts"
    }
  },
  "files": [
    "build",
    "tsconfig.json"
  ],
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### Critical Configuration Points

**1. Package Name**
- Format: `@goodfoot/package-name`
- Must be unique on NPM
- Use lowercase and hyphens (no underscores)

**2. Version**
- Must follow semantic versioning: `MAJOR.MINOR.PATCH`
- Valid: `1.0.0`, `0.1.5`, `2.3.1`
- Invalid: `1.0`, `v1.0.0`, `1.0.0-beta`

**3. Private Flag**
- Must be `false` or omitted entirely
- If `"private": true`, the workflow will fail

**4. Required Scripts**
- `build` - Compiles TypeScript to JavaScript
- `typecheck` - Validates TypeScript types
- `test` - Runs test suite
- `lint` - Runs linting checks

All four scripts must succeed for the package to be published.

**5. Files to Publish**
- List all files/directories to include in the NPM package
- Typically: `["build", "tsconfig.json", "README.md"]`
- Excludes source files, tests, and development files

---

## Release Process Workflow

### Option A: Using release-package.sh Script (Recommended)

This is the simplest and most reliable method.

**Step-by-Step:**

1. **Make your code changes**
   ```bash
   cd /workspace/packages/your-package
   # Edit files, add features, fix bugs, etc.
   ```

2. **Bump the version in package.json**
   ```bash
   # Edit package.json and update the version field
   # Example: "version": "1.2.3"
   ```

3. **Run the release script**
   ```bash
   cd /workspace
   ./scripts/release-package.sh your-package
   ```

**What happens automatically:**

1. **Validation**
   - Checks package exists
   - Verifies version format
   - Ensures tag doesn't already exist
   - Warns about uncommitted changes

2. **Changelog Generation**
   - Analyzes commits since last release
   - Uses Claude CLI to generate user-facing changelog
   - Commits and pushes CHANGELOG.md to main branch

3. **Tag Creation**
   - Creates git tag: `your-package-v1.2.3`
   - Pushes tag to origin

4. **Triggers GitHub Actions**
   - Workflow starts automatically when tag is pushed
   - Validates, builds, tests, and publishes to NPM
   - Creates GitHub release with changelog

**Example:**
```bash
# Release the streamable-http-mcp-server-daemon package
./scripts/release-package.sh streamable-http-mcp-server-daemon

# Output:
# 🚀 Preparing release for streamable-http-mcp-server-daemon v0.1.0
# 📝 Updating CHANGELOG.md...
# ✅ CHANGELOG.md updated successfully
# 📋 Creating tag: streamable-http-mcp-server-daemon-v0.1.0
# 📤 Pushing tag to origin...
# ✅ Release initiated!
```

---

### Option B: Manual Process

If you prefer more control or the script isn't available:

**Step 1: Update Version**
```bash
cd /workspace/packages/your-package
# Edit package.json and bump version to 1.2.3
```

**Step 2: Update CHANGELOG**
```bash
cd /workspace
./scripts/update-package-changelog.sh your-package
# Review the generated changelog entry
# Edit packages/your-package/CHANGELOG.md if needed
```

**Step 3: Commit Changes**
```bash
git add packages/your-package/package.json
git add packages/your-package/CHANGELOG.md
git commit -m "Release your-package v1.2.3"
git push origin main
```

**Step 4: Create and Push Tag**
```bash
git tag your-package-v1.2.3
git push origin your-package-v1.2.3
```

**Step 5: Monitor Workflow**
- GitHub Actions will automatically start
- Watch progress at: https://github.com/wehriam/goodfoot/actions

---

### Option C: GitHub UI Manual Dispatch

For manual releases without using git tags:

**Step 1: Navigate to Actions**
1. Go to your GitHub repository
2. Click the **"Actions"** tab
3. Select **"Publish NPM Package"** workflow

**Step 2: Run Workflow Manually**
1. Click **"Run workflow"** button (top right)
2. Fill in the form:
   - **package:** Enter package name (e.g., `streamable-http-mcp-server-daemon`)
   - **version:** Enter version to release (e.g., `1.2.3`)
3. Click **"Run workflow"** to start

**Note:** This method still requires:
- Version in package.json matches the input version
- Package is properly configured
- All validation checks pass

---

## Tag Format Documentation

### Expected Format

Tags must follow this exact format:

```
{package-name}-v{version}
```

Where:
- `{package-name}` - The directory name in `/workspace/packages/`
- `v` - Literal character "v" (lowercase)
- `{version}` - Semantic version: `MAJOR.MINOR.PATCH`

### Valid Examples

✅ **Correct Tags:**
```
streamable-http-mcp-server-daemon-v0.1.0
test-utilities-v1.2.3
mcp-v2.0.0
example-v0.0.1
my-awesome-package-v3.2.1
```

### Invalid Examples

❌ **Incorrect Tags:**

| Tag | Issue |
|-----|-------|
| `streamable-http-mcp-server-daemon-1.0.0` | Missing "v" prefix |
| `v1.0.0` | Missing package name |
| `package-V1.0.0` | Uppercase "V" (must be lowercase) |
| `package-v1.0` | Only two version numbers (need three) |
| `package-v1.0.0.1` | Four version numbers (only three allowed) |
| `package-v1.0.0-beta` | Pre-release suffix not supported |
| `package-name_v1.0.0` | Wrong separator (underscore instead of hyphen) |

### Why Tag Format Matters

The GitHub Actions workflow parses the tag to:
1. Extract the package name
2. Extract the version number
3. Validate version matches package.json
4. Determine which package to build and publish

**Incorrect format = Workflow fails immediately**

---

## Monitoring and Verification

### Tracking the Release

**1. GitHub Actions Dashboard**

Navigate to: https://github.com/wehriam/goodfoot/actions

- View all workflow runs
- See real-time progress
- Check logs for each step
- Download artifacts if needed

**2. Workflow Stages**

The workflow runs these steps in order:

| Stage | Duration | Description |
|-------|----------|-------------|
| Checkout | 5-10s | Clones repository |
| Validate | 10-15s | Checks package and version |
| Setup | 15-30s | Installs Node.js and enables Corepack |
| Install | 30-60s | Runs `yarn install --immutable` |
| Build | 20-40s | Compiles TypeScript |
| Typecheck | 10-20s | Validates types |
| Test | 20-60s | Runs test suite |
| Lint | 10-20s | Runs ESLint |
| Publish | 10-20s | Publishes to NPM |
| Release | 5-10s | Creates GitHub release |

**Total Time:** Typically 2-5 minutes

**3. NPM Package Verification**

After successful publish:

- Visit: https://www.npmjs.com/package/@goodfoot/your-package
- Check version appears in version dropdown
- Verify files are correct
- Test installation: `npm install @goodfoot/your-package@1.2.3`

**Note:** NPM's CDN may take 1-5 minutes to propagate worldwide

**4. GitHub Release Verification**

After workflow completes:

- Navigate to: https://github.com/wehriam/goodfoot/releases
- Find your release: `your-package-v1.2.3`
- Verify changelog is included
- Check installation instructions are correct

---

## Troubleshooting

### Version Mismatch Error

**Error Message:**
```
❌ Version mismatch!
   package.json: 1.2.3
   tag:          1.2.4
```

**Root Cause:**
- The version in package.json doesn't match the tag version
- Example: Tag is `package-v1.2.4` but package.json has `"version": "1.2.3"`

**Solution:**
```bash
# Option 1: Fix package.json version
cd /workspace/packages/your-package
# Edit package.json to match tag version
git add package.json
git commit -m "Fix version to 1.2.4"
git push origin main

# Option 2: Delete tag and recreate with correct version
git tag -d your-package-v1.2.4
git push --delete origin your-package-v1.2.4
git tag your-package-v1.2.3  # Match package.json version
git push origin your-package-v1.2.3
```

---

### Tag Already Exists Error

**Error Message:**
```
❌ Error: Tag your-package-v1.2.3 already exists on remote
```

**Root Cause:**
- You're trying to create a tag that's already been pushed
- Common when re-releasing after fixing issues

**Solution:**

**Option 1: Delete the existing tag**
```bash
# Delete remote tag
git push --delete origin your-package-v1.2.3

# Delete local tag
git tag -d your-package-v1.2.3

# Recreate and push
git tag your-package-v1.2.3
git push origin your-package-v1.2.3
```

**Option 2: Bump the version (recommended)**
```bash
cd /workspace/packages/your-package
# Edit package.json - change version to 1.2.4
git add package.json
git commit -m "Bump version to 1.2.4"
git push origin main

# Create new tag
git tag your-package-v1.2.4
git push origin your-package-v1.2.4
```

---

### NPM_TOKEN Invalid Error

**Error Message:**
```
❌ npm ERR! code E401
❌ npm ERR! 401 Unauthorized - PUT https://registry.npmjs.org/@goodfoot/package
```

**Root Cause:**
- NPM_TOKEN secret is invalid, expired, or has wrong permissions
- Token was revoked on NPM
- Token doesn't have publish permissions for the scope

**Solution:**

1. **Generate a new NPM token:**
   - Go to https://www.npmjs.com/settings/tokens
   - Click "Generate New Token" → "Classic Token"
   - Select "Automation" type
   - Copy the token

2. **Update GitHub secret:**
   - Go to repository Settings → Secrets and variables → Actions
   - Click `NPM_TOKEN`
   - Click "Update secret"
   - Paste new token
   - Click "Update secret"

3. **Verify permissions:**
   - Ensure your NPM account can publish to `@goodfoot` scope
   - Check you're a collaborator on the organization

4. **Re-run the workflow:**
   - Go to Actions tab
   - Find the failed workflow
   - Click "Re-run failed jobs"

---

### Tests/Build Failures

**Error Message:**
```
❌ Type checking failed
❌ Tests failed
Build validation failed. Please fix the issues before publishing.
```

**Root Cause:**
- Code doesn't compile
- Tests are failing
- Linting errors exist

**Solution:**

1. **Run checks locally:**
   ```bash
   cd /workspace/packages/your-package

   # Run all checks
   yarn typecheck    # Check TypeScript types
   yarn test         # Run tests
   yarn lint         # Check linting
   yarn build        # Build the package
   ```

2. **Fix issues:**
   - Address any TypeScript errors
   - Fix failing tests
   - Resolve linting warnings
   - Ensure build completes successfully

3. **Commit fixes:**
   ```bash
   git add .
   git commit -m "Fix tests and type errors"
   git push origin main
   ```

4. **Delete and recreate tag:**
   ```bash
   git tag -d your-package-v1.2.3
   git push --delete origin your-package-v1.2.3
   git tag your-package-v1.2.3
   git push origin your-package-v1.2.3
   ```

**Best Practice:** Always run validation locally before pushing tags:
```bash
cd /workspace/packages/your-package
yarn lint && yarn build && echo "✅ Ready to release"
```

---

### Private Package Error

**Error Message:**
```
⚠️  Package is marked as private in package.json
Cannot publish private packages to NPM registry
```

**Root Cause:**
- package.json has `"private": true`
- Private packages cannot be published to public NPM registry

**Solution:**

**Option 1: Make package public**
```bash
cd /workspace/packages/your-package
# Edit package.json
# Change: "private": true
# To:     "private": false
# Or remove the "private" field entirely

git add package.json
git commit -m "Make package public for NPM publishing"
git push origin main
```

**Option 2: Remove from publishing**
- If the package should remain private, don't create release tags for it
- The package can still be used within the monorepo
- Only create tags for packages intended for public release

---

### Missing Scripts Error

**Error Message:**
```
❌ Error: Command "build" not found
❌ Error: Command "test" not found
```

**Root Cause:**
- package.json is missing required script commands
- Workflow expects: `build`, `typecheck`, `test`, `lint`

**Solution:**

Add missing scripts to package.json:

```json
{
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "lint": "eslint ."
  }
}
```

**Minimal working scripts:**

```json
{
  "scripts": {
    "build": "echo 'No build needed' && exit 0",
    "typecheck": "tsc --noEmit",
    "test": "echo 'No tests yet' && exit 0",
    "lint": "echo 'No linting configured' && exit 0"
  }
}
```

Commit the changes:
```bash
git add package.json
git commit -m "Add required NPM scripts"
git push origin main
```

---

### Changelog Generation Failed

**Error Message:**
```
❌ Error: Failed to generate changelog entry with Claude
Make sure the 'claude' CLI is installed and available in your PATH
```

**Root Cause:**
- Claude CLI is not installed
- Claude CLI authentication failed
- Script couldn't access Claude API

**Solution:**

**Option 1: Install Claude CLI**
```bash
npm install -g @anthropic-ai/cli
claude login
```

**Option 2: Skip changelog (not recommended)**
- When prompted "Continue release anyway?", type `y`
- Manually update CHANGELOG.md after release

**Option 3: Update changelog manually**
```bash
cd /workspace/packages/your-package
# Edit CHANGELOG.md manually
# Add entry for new version

git add CHANGELOG.md
git commit -m "Update changelog for v1.2.3"
git push origin main
```

---

## Repository Settings Checklist

Before your first release, verify these settings:

### Required Configuration

- [ ] **NPM_TOKEN Secret**
  - Navigate to: Settings → Secrets and variables → Actions
  - Verify `NPM_TOKEN` exists
  - Token should be "Automation" type from NPM

- [ ] **GitHub Actions Enabled**
  - Navigate to: Settings → Actions → General
  - Ensure "Allow all actions and reusable workflows" is selected
  - Or at minimum: "Allow [organization] actions and reusable workflows"

- [ ] **Workflow Permissions**
  - Navigate to: Settings → Actions → General → Workflow permissions
  - Select "Read and write permissions"
  - Check "Allow GitHub Actions to create and approve pull requests"

- [ ] **Package Configuration**
  - Each package has valid package.json
  - All required scripts exist
  - `"private": false` or omitted
  - Valid semantic version

### Optional but Recommended

- [ ] **Branch Protection Rules**
  - Navigate to: Settings → Branches
  - Add rule for `main` branch
  - Require pull request reviews
  - Require status checks before merging

- [ ] **Required Status Checks**
  - If using branch protection, add required checks:
    - Build validation
    - Tests
    - Linting

- [ ] **Tag Protection Rules**
  - Navigate to: Settings → Tags → Tag protection rules
  - Add pattern: `*-v*.*.*`
  - Prevents accidental tag deletion

---

## Testing the Setup

### Test with a Real Package

**Step 1: Prepare Test Package**

```bash
cd /workspace/packages/example
# Or create a new test package
```

**Step 2: Set Test Version**

Edit package.json:
```json
{
  "name": "@goodfoot/example",
  "version": "0.0.1-test.1",
  "private": false
}
```

**Step 3: Run Local Validation**

```bash
yarn lint
yarn build
```

Ensure all checks pass.

**Step 4: Run Release Script**

```bash
cd /workspace
./scripts/release-package.sh example
```

**Step 5: Monitor Workflow**

1. Go to: https://github.com/wehriam/goodfoot/actions
2. Find the running workflow for `example-v0.0.1-test.1`
3. Watch each step complete
4. Check for any errors

**Step 6: Verify NPM Package**

1. Wait for workflow to complete (2-5 minutes)
2. Visit: https://www.npmjs.com/package/@goodfoot/example
3. Verify version `0.0.1-test.1` appears
4. Test installation:
   ```bash
   npm install @goodfoot/example@0.0.1-test.1
   ```

**Step 7: Verify GitHub Release**

1. Navigate to: https://github.com/wehriam/goodfoot/releases
2. Find release: `example-v0.0.1-test.1`
3. Verify changelog is included
4. Check installation instructions

**Step 8: Cleanup (Optional)**

If this was just a test:

```bash
# Deprecate the test version on NPM
npm deprecate @goodfoot/example@0.0.1-test.1 "Test release, do not use"

# Or unpublish within 72 hours
npm unpublish @goodfoot/example@0.0.1-test.1
```

**Note:** NPM only allows unpublishing within 72 hours. After that, you can only deprecate.

---

## Managing Multiple Packages

### Independent Versioning

Each package has its own version and release cycle:

```
packages/
├── streamable-http-mcp-server-daemon/
│   └── package.json (version: 1.0.0)
├── test-utilities/
│   └── package.json (version: 2.3.1)
└── mcp/
    └── package.json (version: 0.1.0)
```

**Tags don't conflict** because they include package names:
- `streamable-http-mcp-server-daemon-v1.0.0`
- `test-utilities-v2.3.1`
- `mcp-v0.1.0`

### Parallel Releases

You can release multiple packages simultaneously:

```bash
# Terminal 1
./scripts/release-package.sh streamable-http-mcp-server-daemon

# Terminal 2 (immediately after)
./scripts/release-package.sh test-utilities

# Terminal 3 (immediately after)
./scripts/release-package.sh mcp
```

Each workflow runs independently:
- No conflicts or race conditions
- Each package validated separately
- Published to NPM with different names
- Separate GitHub releases created

### Release Coordination

For coordinated releases (when packages depend on each other):

**Step 1: Release dependencies first**
```bash
# Release the foundational package
./scripts/release-package.sh mcp
# Wait for NPM to publish (2-5 minutes)
```

**Step 2: Update dependent packages**
```bash
cd /workspace/packages/streamable-http-mcp-server-daemon
# Update package.json to use new version of @goodfoot/mcp
yarn install
```

**Step 3: Release dependent packages**
```bash
./scripts/release-package.sh streamable-http-mcp-server-daemon
```

### Per-Package Changelogs

Each package maintains its own CHANGELOG.md:

```
packages/
├── streamable-http-mcp-server-daemon/
│   └── CHANGELOG.md (only commits affecting this package)
├── test-utilities/
│   └── CHANGELOG.md (only commits affecting this package)
└── mcp/
    └── CHANGELOG.md (only commits affecting this package)
```

The `update-package-changelog.sh` script automatically:
- Filters commits by package directory
- Generates changelog entries specific to that package
- Maintains separate version histories

### Viewing All Releases

**NPM Organization Page:**
- https://www.npmjs.com/org/goodfoot

**GitHub Releases Page:**
- https://github.com/wehriam/goodfoot/releases

**Filter by Package:**
- GitHub: Search releases for package name
- NPM: Click individual package links

---

## Best Practices

### 1. Test Locally Before Releasing

Always validate before pushing tags:

```bash
cd /workspace/packages/your-package

# Full validation
yarn lint           # Check code quality
yarn build          # Ensure builds successfully
yarn test           # Run test suite

# Quick validation
yarn lint && yarn build && echo "✅ Ready to release!"
```

### 2. Follow Semantic Versioning

Understand version bumping:

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking changes | MAJOR | 1.0.0 → 2.0.0 |
| New features (backward compatible) | MINOR | 1.0.0 → 1.1.0 |
| Bug fixes (backward compatible) | PATCH | 1.0.0 → 1.0.1 |

**Examples:**

- **Breaking change:** API method signature changes
  ```
  1.5.2 → 2.0.0
  ```

- **New feature:** Add new optional parameter
  ```
  1.5.2 → 1.6.0
  ```

- **Bug fix:** Fix crash or incorrect behavior
  ```
  1.5.2 → 1.5.3
  ```

### 3. Keep CHANGELOGs Up to Date

**Good changelog entries:**
```markdown
## 1.2.0

- Added support for streaming large files
- Fixed memory leak in connection pooling
- Improved error messages for timeout scenarios
```

**Poor changelog entries:**
```markdown
## 1.2.0

- Updated StreamManager class
- Refactored internal connection handling
- Modified test suite
```

Focus on **user impact**, not internal implementation.

### 4. Use Meaningful Commit Messages

Helps with automatic changelog generation:

**Good:**
```bash
git commit -m "Add support for custom timeout configuration"
git commit -m "Fix race condition in stream initialization"
git commit -m "Improve error handling for network failures"
```

**Poor:**
```bash
git commit -m "Update code"
git commit -m "Fix bug"
git commit -m "WIP"
```

### 5. Review Generated Changelog Before Finalizing

The `release-package.sh` script shows you the generated changelog:

```bash
./scripts/release-package.sh your-package

# Output shows:
# Generated changelog entry:
#
# ## 1.2.3
#
# - Added streaming support for large files
# - Fixed memory leak in connection pool
```

**If the changelog needs editing:**
1. Let the script commit the changelog
2. Edit `packages/your-package/CHANGELOG.md`
3. Commit the changes
4. The tag will already be created and pushed

### 6. Tag from Main Branch

Always create release tags from the main branch:

```bash
# Ensure you're on main
git checkout main

# Ensure main is up to date
git pull origin main

# Then run release script
./scripts/release-package.sh your-package
```

**Why?**
- Ensures released code is in main branch
- Avoids releasing experimental features
- Maintains clean git history

### 7. Don't Force Push Tags

**Never do this:**
```bash
git push --force origin your-package-v1.2.3
```

**Why?**
- Tags are meant to be immutable
- Other developers may have already pulled the tag
- NPM packages can't be "un-published" easily
- GitHub releases reference the tag

**If you need to fix a release:**
1. Delete the tag (if not published yet)
2. Fix the code
3. Bump the version
4. Create a new tag

### 8. Use Pre-release Versions for Testing

For testing without polluting version history:

```json
{
  "version": "1.2.3-beta.1"
}
```

**Note:** Currently, the workflow only supports stable versions (`X.Y.Z`). Pre-release versions will fail validation.

For now, use the workflow_dispatch method for testing:
1. Go to Actions tab
2. Run workflow manually with test parameters
3. Verify everything works
4. Release the stable version

### 9. Document Breaking Changes

When releasing a major version, clearly document breaking changes:

**In CHANGELOG.md:**
```markdown
## 2.0.0

### Breaking Changes

- Removed deprecated `connectLegacy()` method
- Changed `StreamOptions.timeout` from seconds to milliseconds
- Required Node.js version upgraded to 20.x

### Migration Guide

- Replace `connectLegacy()` with `connect()`
- Multiply all timeout values by 1000
- Upgrade Node.js to version 20 or higher
```

**In README.md:**
Include migration guide in the package README.

### 10. Monitor NPM Download Statistics

Track package adoption:

1. Visit: https://www.npmjs.com/package/@goodfoot/your-package
2. Click "Statistics" tab
3. View downloads over time
4. Identify popular versions

Use this data to:
- Understand which versions are still in use
- Plan deprecation timelines
- Identify successful releases

---

## Additional Resources

### Internal Documentation

- **Release Script:** `/workspace/scripts/RELEASE.md`
  - Detailed documentation of release-package.sh functionality
  - Troubleshooting release script issues
  - Script customization options

- **Changelog Script:** `/workspace/scripts/README.md`
  - How changelog generation works
  - Claude CLI integration details
  - Customizing changelog templates

- **GitHub Actions Workflow:** `/workspace/.github/workflows/README.md`
  - Workflow internals and customization
  - Adding custom validation steps
  - Modifying release notes format

### External Documentation

- **NPM Publishing:**
  - [npm publish documentation](https://docs.npmjs.com/cli/v10/commands/npm-publish)
  - [Creating and publishing scoped packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)
  - [npm Automation tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)

- **Semantic Versioning:**
  - [Semantic Versioning 2.0.0](https://semver.org/)
  - [npm semver calculator](https://semver.npmjs.com/)

- **GitHub Actions:**
  - [Workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
  - [Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
  - [Creating releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

- **Claude CLI:**
  - [Installation guide](https://github.com/anthropics/anthropic-cli)
  - [API documentation](https://docs.anthropic.com/)

### Getting Help

**For issues with:**

- **Release script failures:** Check `/workspace/scripts/RELEASE.md`
- **Changelog generation:** Review `/workspace/scripts/README.md`
- **GitHub Actions errors:** Check workflow logs in Actions tab
- **NPM publishing errors:** Verify NPM_TOKEN and package configuration
- **General questions:** Open an issue in the repository

---

## Quick Reference

### Release Checklist

Before every release:

- [ ] Code changes committed and pushed to main
- [ ] Version bumped in package.json
- [ ] All tests pass locally (`yarn test`)
- [ ] Build succeeds locally (`yarn build`)
- [ ] Linting passes (`yarn lint`)
- [ ] Type checking passes (`yarn typecheck`)
- [ ] No uncommitted changes
- [ ] On main branch

### Common Commands

```bash
# List available packages
ls -1 /workspace/packages/

# Release a package (recommended)
./scripts/release-package.sh package-name

# Update changelog only
./scripts/update-package-changelog.sh package-name

# Manual tag creation
git tag package-name-v1.2.3
git push origin package-name-v1.2.3

# Delete a tag
git tag -d package-name-v1.2.3
git push --delete origin package-name-v1.2.3

# View package version
node -p "require('/workspace/packages/package-name/package.json').version"

# Test installation from NPM
npm install @goodfoot/package-name@1.2.3
```

### Important URLs

Replace `{org}` with `wehriam` and `{repo}` with `goodfoot`:

- **GitHub Actions:** https://github.com/wehriam/goodfoot/actions
- **GitHub Releases:** https://github.com/wehriam/goodfoot/releases
- **NPM Organization:** https://www.npmjs.com/org/goodfoot
- **NPM Package:** https://www.npmjs.com/package/@goodfoot/{package-name}
- **Repository Settings:** https://github.com/wehriam/goodfoot/settings
- **Secrets Configuration:** https://github.com/wehriam/goodfoot/settings/secrets/actions

---

## Conclusion

You now have a complete automated NPM publishing system configured. The key points to remember:

1. **One-time setup:** NPM_TOKEN secret and package configuration
2. **Simple releases:** Run `./scripts/release-package.sh package-name`
3. **Automatic validation:** Tests, builds, and checks run automatically
4. **Consistent process:** Same workflow for all packages
5. **Full traceability:** GitHub releases with changelogs

For most releases, you'll only need to:
1. Update code
2. Bump version
3. Run release script
4. Monitor GitHub Actions

The automation handles everything else.

**Happy publishing!**
