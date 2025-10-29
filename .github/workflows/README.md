# GitHub Actions Workflows

## NPM Package Publishing Workflow

### Overview

The `publish-npm-package.yml` workflow automates the process of building, testing, and publishing NPM packages from this monorepo to the NPM registry.

### Triggering the Workflow

#### Option 1: Tag-based Publishing (Recommended)

Create and push a tag following the naming convention: `{package-name}-v{version}`

```bash
# Example: Publishing the example package version 1.2.3
git tag example-v1.2.3
git push origin example-v1.2.3

# Example: Publishing streamable-http-mcp-server-daemon version 0.1.0
git tag streamable-http-mcp-server-daemon-v0.1.0
git push origin streamable-http-mcp-server-daemon-v0.1.0
```

#### Option 2: Manual Workflow Dispatch

1. Go to Actions tab in GitHub
2. Select "Publish NPM Package" workflow
3. Click "Run workflow"
4. Enter:
   - Package name (e.g., `example`)
   - Version (e.g., `1.2.3`)

### Tag Format

**Pattern:** `{package-name}-v{major}.{minor}.{patch}`

**Valid Examples:**
- `example-v1.2.3`
- `streamable-http-mcp-server-daemon-v0.1.0`
- `test-utilities-v2.0.0`

**Invalid Examples:**
- `example-1.2.3` (missing `-v` separator)
- `example-v1.2` (incomplete version)
- `v1.2.3` (missing package name)

### Workflow Steps

1. **Tag Parsing & Validation**
   - Extracts package name and version from tag
   - Validates tag format
   - Checks package directory exists

2. **Version Consistency Check**
   - Compares tag version with `package.json` version
   - Fails if versions don't match

3. **Package Metadata Extraction**
   - Reads NPM package name
   - Checks if package is marked as private
   - Extracts description

4. **Build & Test**
   - Installs dependencies with Yarn
   - Builds the package
   - Runs type checking
   - Runs tests
   - Runs linting

5. **NPM Publishing**
   - Publishes to NPM registry with `--access public`
   - Requires `NPM_TOKEN` secret

6. **GitHub Release Creation**
   - Creates GitHub release with tag
   - Includes installation instructions
   - Links to NPM package
   - Appends CHANGELOG if exists

7. **Summary Report**
   - Displays validation results
   - Shows NPM package URL
   - Shows GitHub release URL

### Prerequisites

#### Repository Secrets

You must configure the following secret in your GitHub repository:

- **`NPM_TOKEN`**: NPM authentication token with publish access
  1. Generate token at https://www.npmjs.com/settings/tokens
  2. Choose "Automation" token type
  3. Add to GitHub: Settings → Secrets and variables → Actions → New repository secret

#### Package Requirements

Each package must:
- Have a valid `package.json` with `name` and `version` fields
- Not be marked as `private: true` (unless you intend to skip publishing)
- Include these scripts in `package.json`:
  - `build`: Build the package
  - `typecheck`: Run TypeScript type checking
  - `test`: Run tests
  - `lint`: Run linting

### Publishing Checklist

Before creating a release tag:

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` (if exists)
- [ ] Commit all changes
- [ ] Ensure all tests pass locally
- [ ] Create and push tag with correct format

### Example Publishing Flow

```bash
# 1. Update version in package.json
cd packages/example
# Edit package.json: "version": "1.2.3"

# 2. Update CHANGELOG.md
# Add entry for version 1.2.3

# 3. Commit changes
git add package.json CHANGELOG.md
git commit -m "Release example v1.2.3"

# 4. Create and push tag
git tag example-v1.2.3
git push origin main
git push origin example-v1.2.3

# 5. Monitor workflow
# Go to GitHub Actions tab to watch the workflow
```

### Troubleshooting

#### Version Mismatch Error

```
❌ Version mismatch!
   package.json: 1.2.2
   tag:          1.2.3
```

**Solution:** Ensure the version in `package.json` matches the tag version.

#### Package Not Found Error

```
❌ Package directory not found: packages/example
```

**Solution:** Verify the package name in the tag matches a directory in `packages/`.

#### Invalid Tag Format Error

```
❌ Invalid tag format: example-1.2.3
Expected format: package-name-v1.2.3
```

**Solution:** Add `-v` separator between package name and version.

#### Private Package Error

```
⚠️  Package is marked as private in package.json
Cannot publish private packages to NPM registry
```

**Solution:** Remove `"private": true` from `package.json` or keep it private intentionally.

#### NPM Authentication Error

```
npm ERR! code ENEEDAUTH
npm ERR! need auth This command requires you to be logged in.
```

**Solution:** Ensure `NPM_TOKEN` secret is configured correctly in GitHub repository settings.

### Workflow Output

The workflow generates a summary showing:

- ✅/❌ Validation results (typecheck, tests, lint)
- ✅/❌ Publishing status
- 📦 NPM package URL
- 🔗 GitHub release URL
- Installation instructions

### Example Output

```
# 📦 NPM Package Release

**Package:** `@goodfoot/example`
**Version:** `1.2.3`
**Description:** Minimal example MCP server package

## Validation Results

✅ **Type Check:** Passed
✅ **Tests:** Passed
✅ **Lint:** Passed

## Publishing Results

✅ **NPM:** Published successfully
📦 **NPM Package:** https://www.npmjs.com/package/@goodfoot/example/v/1.2.3

✅ **GitHub Release:** Created successfully
🔗 **Release URL:** https://github.com/owner/repo/releases/tag/example-v1.2.3

---

### Installation

npm install @goodfoot/example@1.2.3
```

### Related Files

- Workflow: `.github/workflows/publish-npm-package.yml`
- Package directories: `packages/*/`
- Package metadata: `packages/*/package.json`
