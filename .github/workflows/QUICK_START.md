# Quick Start: Publishing NPM Packages

## Prerequisites

**No NPM token required!** This repository uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) with OIDC authentication. Packages are published automatically with provenance attestation.

## Publishing a Package (Tag Method)

```bash
# 1. Update version in package.json
cd packages/YOUR-PACKAGE-NAME
# Edit package.json: "version": "X.Y.Z"

# 2. Commit and create tag
cd ../..
git add packages/YOUR-PACKAGE-NAME/package.json
git commit -m "Release YOUR-PACKAGE-NAME vX.Y.Z"

# 3. Create and push tag (IMPORTANT: use correct format!)
git tag YOUR-PACKAGE-NAME-vX.Y.Z
git push origin main YOUR-PACKAGE-NAME-vX.Y.Z
```

## Publishing a Package (Automated Script)

```bash
./documentation/publish-package-example.sh YOUR-PACKAGE-NAME X.Y.Z
```

## Tag Format

**Pattern:** `{package-name}-v{version}`

**Examples:**
- `example-v1.2.3` ✅
- `streamable-http-mcp-server-daemon-v0.1.0` ✅
- `test-utilities-v2.0.0` ✅
- `example-1.2.3` ❌ (missing `-v`)
- `v1.2.3` ❌ (missing package name)

## Manual Workflow

1. Go to: Actions → Publish NPM Package
2. Click: "Run workflow"
3. Enter: Package name and version
4. Click: "Run workflow"

## Monitoring

After pushing tag:
1. Go to: Actions tab
2. Find: "Publish NPM Package" workflow
3. Watch: Build → Test → Publish → Release

## Verification

After successful publish:
- NPM: `https://www.npmjs.com/package/@goodfoot/YOUR-PACKAGE/v/X.Y.Z`
- Release: `https://github.com/OWNER/REPO/releases/tag/YOUR-PACKAGE-vX.Y.Z`

## Install Published Package

```bash
npm install @goodfoot/YOUR-PACKAGE@X.Y.Z
# or
yarn add @goodfoot/YOUR-PACKAGE@X.Y.Z
```

## Provenance

All packages published from this repository include [provenance attestation](https://docs.npmjs.com/generating-provenance-statements), which cryptographically links the published package to its source code and build environment.

## Troubleshooting

See [README.md](./README.md#troubleshooting) for detailed troubleshooting guide.
