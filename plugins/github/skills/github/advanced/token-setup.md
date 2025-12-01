# GITHUB_TOKEN Setup Guide

> **Official docs**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

This document covers the complete setup process for GitHub API authentication via Personal Access Tokens.

## Token Storage

The GitHub token is stored as an environment variable:

| Variable | Purpose | Source |
|----------|---------|--------|
| `GITHUB_TOKEN` | API authentication | Generated from GitHub Settings |

```bash
# Verify token is set
echo "Token: $(echo $GITHUB_TOKEN | cut -c1-4)..."
```

---

## Step 1: Choose Token Type {#choose-type}

GitHub offers two types of Personal Access Tokens:

| Type | Use Case | Expiration | Recommendation |
|------|----------|------------|----------------|
| **Fine-grained** | Specific repos, limited scope | Required | Recommended |
| **Classic** | All repos, broader access | Optional | Use for legacy needs |

**Recommendation**: Use fine-grained tokens for better security and granular control.

---

## Step 2: Create Fine-Grained Token {#create-fine-grained}

1. Go to [GitHub Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**
3. Configure token:

### Token Details

| Field | Value |
|-------|-------|
| Token name | Descriptive name (e.g., "Claude Code GitHub Skill") |
| Expiration | Choose based on security needs (30-90 days recommended) |
| Description | Optional description |

### Repository Access

| Option | When to Use |
|--------|-------------|
| **All repositories** | Full access to all current and future repos |
| **Only select repositories** | Limited to specific repos (more secure) |

### Permissions

Select permissions based on your needs:

| Permission | Access Level | Required For |
|------------|--------------|--------------|
| **Contents** | Read and write | Read/write files, create branches |
| **Issues** | Read and write | Create, update, comment on issues |
| **Pull requests** | Read and write | Create, review, merge PRs |
| **Actions** | Read and write | Trigger workflows, view runs |
| **Metadata** | Read-only | Basic repo info (auto-granted) |

**Minimum for full functionality**:
- Contents: Read and write
- Issues: Read and write
- Pull requests: Read and write
- Actions: Read-only (or Read and write to trigger)

4. Click **Generate token**
5. **Copy the token immediately** - it won't be shown again

---

## Step 3: Create Classic Token (Alternative) {#create-classic}

If you need broader access or compatibility:

1. Go to [GitHub Settings -> Developer settings -> Personal access tokens -> Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Configure:

### Scopes for Classic Tokens

| Scope | Description | Required For |
|-------|-------------|--------------|
| `repo` | Full repository access | Most operations |
| `workflow` | GitHub Actions | Trigger workflows |
| `read:org` | Read org membership | Org-level operations |
| `gist` | Gists | Gist operations |

**Recommended minimum**: `repo` scope covers most use cases.

4. Click **Generate token**
5. **Copy the token immediately**

---

## Step 4: Set Environment Variable {#set-env}

### Option A: Shell Profile (Persistent)

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.profile`):

```bash
# Add to ~/.bashrc or ~/.zshrc
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Then reload:

```bash
source ~/.bashrc  # or ~/.zshrc
```

### Option B: .env File (Project-Specific)

Create or edit `.env` in your project root:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Important**: Add `.env` to `.gitignore`:

```bash
echo ".env" >> .gitignore
```

### Option C: Session Only (Temporary)

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

This lasts only for the current terminal session.

---

## Step 5: Verify Token {#verify}

Run this verification script:

```bash
tsx << 'EOF'
import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

try {
  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log("Authentication successful");
  console.log("  User:", user.login);
  console.log("  Name:", user.name);
  console.log("  Type:", user.type);

  // Check rate limits
  const { data: rateLimit } = await octokit.rest.rateLimit.get();
  console.log("\nRate limits");
  console.log("  Remaining:", rateLimit.rate.remaining, "/", rateLimit.rate.limit);
  console.log("  Resets at:", new Date(rateLimit.rate.reset * 1000).toISOString());

} catch (error: any) {
  console.error("Authentication failed:", error.message);
  if (error.status === 401) {
    console.error("\n  Your token may be invalid or expired.");
    console.error("  Generate a new token at: https://github.com/settings/tokens");
  }
  process.exit(1);
}
EOF
```

---

## Token Permissions Reference {#permissions}

### Fine-Grained Token Permissions by Operation

| Operation | Required Permission | Access Level |
|-----------|---------------------|--------------|
| Read file contents | Contents | Read |
| Create/update files | Contents | Read and write |
| Create branch | Contents | Read and write |
| List issues | Issues | Read |
| Create/update issues | Issues | Read and write |
| Add issue comment | Issues | Read and write |
| List PRs | Pull requests | Read |
| Create PR | Contents + Pull requests | Read and write |
| Merge PR | Contents + Pull requests | Read and write |
| Create review | Pull requests | Read and write |
| List workflows | Actions | Read |
| Trigger workflow | Actions | Read and write |
| Search code | Contents | Read |
| Search issues | Issues | Read |

### Classic Token Scopes by Operation

| Operation | Required Scope |
|-----------|----------------|
| Repository operations | `repo` |
| Public repo only | `public_repo` |
| Workflow operations | `repo` + `workflow` |
| Gist operations | `gist` |
| Organization data | `read:org` |

---

## Troubleshooting {#troubleshooting}

### Error: "Bad credentials"

**Symptoms**:
```
Error 401: Bad credentials
```

**Causes**:
1. Token is invalid or malformed
2. Token was revoked or deleted
3. Token has expired

**Solutions**:
```bash
# Check token is set correctly
echo "Token starts with: $(echo $GITHUB_TOKEN | cut -c1-4)"

# Verify token format (should start with ghp_ or github_pat_)
```

If invalid, generate a new token.

### Error: "Resource not accessible by integration"

**Symptoms**:
```
Error 403: Resource not accessible by integration
```

**Causes**:
1. Token lacks required permissions/scopes
2. Fine-grained token doesn't have access to this repository

**Solutions**:
1. Check token permissions at GitHub Settings
2. For fine-grained tokens, ensure the repository is included
3. Add required permissions and regenerate token

### Error: "Not Found"

**Symptoms**:
```
Error 404: Not Found
```

**Causes**:
1. Repository doesn't exist
2. Token doesn't have access to private repository
3. Resource (issue, PR, file) doesn't exist

**Solutions**:
1. Verify repository name and owner
2. Ensure token has `repo` scope (classic) or repository access (fine-grained)
3. Check the resource exists

### Error: "API rate limit exceeded"

**Symptoms**:
```
Error 403: API rate limit exceeded
```

**Causes**:
Exceeded 5000 requests/hour for authenticated users

**Solutions**:
```bash
# Check current rate limit status
tsx << 'EOF'
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const { data } = await octokit.rest.rateLimit.get();
console.log("Limit:", data.rate.limit);
console.log("Remaining:", data.rate.remaining);
console.log("Resets at:", new Date(data.rate.reset * 1000).toISOString());
EOF
```

Wait until reset time or implement request caching.

### Token Expiration

Fine-grained tokens have mandatory expiration. Check expiration:

1. Go to [GitHub Settings -> Personal access tokens](https://github.com/settings/tokens)
2. Find your token and check expiration date
3. Regenerate before expiration

---

## Security Best Practices {#security}

### Never Commit Tokens

Add to `.gitignore`:
```
.env
*.env
.env.*
```

### Use Minimum Required Permissions

Only grant permissions needed for your use case:
- Read-only operations -> Read permissions only
- Specific repos -> Fine-grained with repo selection

### Rotate Tokens Regularly

Set calendar reminders before expiration:
- Fine-grained: Before mandatory expiration date
- Classic: Every 90 days recommended

### Revoke Compromised Tokens Immediately

If a token is exposed:
1. Go to [GitHub Settings -> Personal access tokens](https://github.com/settings/tokens)
2. Find the token and click **Delete**
3. Generate a new token
4. Update your environment variable

### Audit Token Usage

Review token activity:
1. Go to [GitHub Settings -> Security log](https://github.com/settings/security-log)
2. Filter by token-related events
3. Check for unexpected access patterns

---

## Quick Verification Script {#quick-verify}

Copy and run this complete verification:

```bash
tsx << 'EOF'
import { Octokit } from "octokit";

console.log("=== GitHub Token Verification ===\n");

// Check token exists
if (!process.env.GITHUB_TOKEN) {
  console.log("GITHUB_TOKEN not set");
  console.log("\nSet your token:");
  console.log("  export GITHUB_TOKEN=ghp_...");
  process.exit(1);
}

console.log("GITHUB_TOKEN is set");
console.log("  Format:", process.env.GITHUB_TOKEN.substring(0, 4) + "...");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

try {
  // Test authentication
  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log("\nAuthentication successful");
  console.log("  User:", user.login);
  console.log("  Type:", user.type);

  // Check rate limits
  const { data: rateLimit } = await octokit.rest.rateLimit.get();
  console.log("\nRate limit status");
  console.log("  Remaining:", rateLimit.rate.remaining, "/", rateLimit.rate.limit);

  // Test a simple API call
  const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
    per_page: 1,
    sort: "updated"
  });
  console.log("\nAPI access confirmed");
  console.log("  Can list repositories:", repos.length > 0 ? "Yes" : "No repos found");

  console.log("\n=== All checks passed ===");

} catch (error: any) {
  console.error("\nVerification failed:", error.message);

  if (error.status === 401) {
    console.error("\nToken is invalid or expired.");
    console.error("Generate new token: https://github.com/settings/tokens");
  } else if (error.status === 403) {
    console.error("\nToken lacks required permissions.");
    console.error("Check token scopes at: https://github.com/settings/tokens");
  }

  process.exit(1);
}
EOF
```
