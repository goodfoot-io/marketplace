---
name: github
description: GitHub operations using the octokit NPM package. Use when
  creating issues, managing pull requests, reading repository files,
  searching code, or interacting with GitHub Actions workflows.
---

# GitHub Reference (SDK)

```!
# === GitHub Skill Environment Check ===
BLOCKED=""

# Package manager detection
if [ -f "yarn.lock" ]; then
  PKG_MGR="yarn"
  PKG_ADD="yarn add"
  PKG_GLOBAL="yarn global add"
elif [ -f "pnpm-lock.yaml" ]; then
  PKG_MGR="pnpm"
  PKG_ADD="pnpm add"
  PKG_GLOBAL="pnpm add -g"
else
  PKG_MGR="npm"
  PKG_ADD="npm install"
  PKG_GLOBAL="npm install -g"
fi

# 1. Token check (GITHUB_TOKEN only)
if [ -z "$GITHUB_TOKEN" ]; then
  BLOCKED="yes"
  echo "BLOCKED: GITHUB_TOKEN not set"
  echo ""
  echo "STOP. Do not attempt GitHub operations."
  echo "Ask user to set up their token:"
  echo "  export GITHUB_TOKEN=ghp_..."
  echo ""
  echo "See advanced/token-setup.md for setup instructions."
else
  TOKEN_PREFIX=$(echo "$GITHUB_TOKEN" | cut -c1-4)
  echo "GITHUB_TOKEN set (${TOKEN_PREFIX}...)"
fi

# 2. Runtime check
if command -v tsx >/dev/null 2>&1; then
  TSX_VER=$(tsx --version 2>&1 | head -1)
  echo "tsx $TSX_VER"
else
  BLOCKED="yes"
  echo "BLOCKED: tsx not installed"
  echo "   Install with: $PKG_GLOBAL tsx"
fi

# 3. Package check
if [ -d "node_modules/octokit" ]; then
  VER=$(node -e "console.log(require('./node_modules/octokit/package.json').version)" 2>/dev/null || echo "?")
  echo "octokit@$VER"
else
  BLOCKED="yes"
  echo "BLOCKED: octokit not installed"
  echo "   Install with: $PKG_ADD octokit"
fi

# Final status
if [ -z "$BLOCKED" ]; then
  echo ""
  echo "Ready to execute GitHub operations."
fi
```

## Quick Start {#setup}

Uses `octokit` with `tsx`. Every script starts with:

```typescript
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
```

Run scripts using heredoc syntax:

```bash
tsx << 'EOF'
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Your code here with top-level await
const { data: user } = await octokit.rest.users.getAuthenticated();
console.log("Logged in as:", user.login);
EOF
```

## Copy-Paste Examples {#examples}

These complete examples work immediately after environment check passes.

### Create an Issue

```bash
tsx << 'EOF'
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const { data: issue } = await octokit.rest.issues.create({
  owner: "OWNER",      // Replace with repo owner
  repo: "REPO",        // Replace with repo name
  title: "Issue title",
  body: "Issue description",
});
console.log("Created issue #" + issue.number + ":", issue.html_url);
EOF
```

### Read a File

```bash
tsx << 'EOF'
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const { data } = await octokit.rest.repos.getContent({
  owner: "OWNER", repo: "REPO", path: "README.md",
});
if ("content" in data) {
  // CRITICAL: File content is base64 encoded - always decode!
  const content = Buffer.from(data.content, "base64").toString("utf8");
  console.log(content);
}
EOF
```

### List Branches

```bash
tsx << 'EOF'
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const { data: branches } = await octokit.rest.repos.listBranches({
  owner: "OWNER", repo: "REPO",
});
for (const b of branches) console.log(b.name);
EOF
```

### Search Issues

```bash
tsx << 'EOF'
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Query syntax: qualifiers separated by spaces are AND-ed together
const { data } = await octokit.rest.search.issuesAndPullRequests({
  q: "repo:OWNER/REPO is:issue state:open",
});
console.log("Found:", data.total_count);
for (const issue of data.items) console.log("#" + issue.number + ":", issue.title);
EOF
```

### List Workflow Runs

```bash
tsx << 'EOF'
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
  owner: "OWNER", repo: "REPO", per_page: 5,
});
console.log("Total runs:", data.total_count);
for (const run of data.workflow_runs) {
  console.log(run.name + ":", run.conclusion ?? run.status);
}
EOF
```

> **Need >30 results?** Most endpoints return max 30 items per page. See [Pagination](#pagination) for fetching all results.

## Common Parameters

All API calls follow: `octokit.rest.<category>.<method>({ owner, repo, ... })`

| Parameter | Description | Example |
|-----------|-------------|---------|
| `owner` | Repository owner (user or org) | `"octocat"` |
| `repo` | Repository name | `"Hello-World"` |
| `issue_number` | Issue number (integer) | `123` |
| `pull_number` | PR number (integer) | `45` |
| `path` | File path in repo | `"src/index.ts"` |
| `ref` | Branch/tag/commit reference | `"main"` or `"refs/heads/feature"` |

## I Want To... {#router}

### Issues
| Task | Reference |
|------|-----------|
| Create an issue | sdk/issues.md#create |
| Get issue details | sdk/issues.md#get |
| Comment on an issue | sdk/issues.md#comments |
| Update/close an issue | sdk/issues.md#update |
| Add labels | sdk/issues.md#labels |
| List issues | sdk/issues.md#list |

### Pull Requests
| Task | Reference |
|------|-----------|
| Create a PR | sdk/pull-requests.md#create |
| Get PR details | sdk/pull-requests.md#get |
| Get PR diff | sdk/pull-requests.md#diff |
| List changed files | sdk/pull-requests.md#files |
| Create a review | sdk/pull-requests.md#reviews |
| Merge a PR | sdk/pull-requests.md#merge |
| Update PR branch | sdk/pull-requests.md#update-branch |

### Files & Content
| Task | Reference |
|------|-----------|
| Read a file | sdk/files.md#read |
| Create a file | sdk/files.md#create |
| Update a file | sdk/files.md#update |
| Delete a file | sdk/files.md#delete |
| List directory contents | sdk/files.md#list |

### Branches & Commits
| Task | Reference |
|------|-----------|
| Create a branch | sdk/git.md#create-branch |
| List branches | sdk/git.md#list-branches |
| Get commit details | sdk/git.md#get-commit |
| List commits | sdk/git.md#list-commits |

### Search
| Task | Reference |
|------|-----------|
| Search code | sdk/search.md#code |
| Search issues/PRs | sdk/search.md#issues |
| Search repositories | sdk/search.md#repos |

### Actions
| Task | Reference |
|------|-----------|
| List workflow runs | sdk/actions.md#runs |
| Get run details | sdk/actions.md#get-run |
| Get job logs | sdk/actions.md#logs |
| Trigger a workflow | sdk/actions.md#trigger |

### Setup & Account
| Task | Reference |
|------|-----------|
| Set up GITHUB_TOKEN | advanced/token-setup.md |
| Use GraphQL API | advanced/graphql.md |
| Diagnose issues | #troubleshooting |
| Common errors | #troubleshooting |

## When Do I Need Advanced Docs? {#when-advanced}

### Use sdk/files.md when:
- Reading or writing file contents
- Listing directory contents
- Deleting files

### Use sdk/git.md when:
- Creating or listing branches
- Getting commit history
- Working with refs/SHAs

### Use sdk/search.md when:
- Finding code across repositories
- Searching for issues/PRs with complex filters
- Looking for repositories by topic/stars

### Use advanced/graphql.md when:
- **You need nested data in one request** (e.g., issue + all comments + author details)
- **REST would require multiple sequential calls** for related data
- **You need specific fields only** (reduce bandwidth)
- Example: "Get PR with all review comments and their authors" -> GraphQL is better

**REST vs GraphQL Decision:**
```
Need simple CRUD on one resource? -> Use REST (this skill's main docs)
Need nested/related data efficiently? -> Use GraphQL (advanced/graphql.md)
```

## Multi-Step Workflows {#workflows}

### Creating a PR with Changes

This requires multiple steps in sequence:

1. **Get main branch SHA** -> sdk/git.md#get-ref
2. **Create feature branch** -> sdk/git.md#create-branch
3. **Create/update files on branch** -> sdk/files.md#create (pass `branch` param)
4. **Create the PR** -> sdk/pull-requests.md#create

> **Warning**: `getRef()` uses `heads/main` but `createRef()` needs `refs/heads/main`. See sdk/git.md for details.

### Updating a File

File updates require the current SHA:

1. **Read current file** -> sdk/files.md#read (get `sha` from response)
2. **Update with new content** -> sdk/files.md#update (pass `sha`)

## Quick Operations {#quick}

### Get Authenticated User {#user-info}

```typescript
const { data: user } = await octokit.rest.users.getAuthenticated();
console.log("User:", user.login);
console.log("Name:", user.name ?? "(not set)");
```

### Check Rate Limits {#rate-limits}

```typescript
const { data } = await octokit.rest.rateLimit.get();
console.log("Remaining:", data.rate.remaining, "/", data.rate.limit);
console.log("Resets:", new Date(data.rate.reset * 1000).toISOString());
```

### Pagination {#pagination}

Use `paginate()` to automatically fetch all pages:

```typescript
const allIssues = await octokit.paginate(octokit.rest.issues.listForRepo, {
  owner: "owner",
  repo: "repo",
  state: "all",
  per_page: 100,
});
console.log("Total:", allIssues.length);
```

## Critical Gotchas {#gotchas}

| Issue | What Happens | Fix |
|-------|--------------|-----|
| **File content is base64** | Get garbled text | `Buffer.from(data.content, 'base64').toString('utf8')` |
| **File updates need SHA** | 409 Conflict error | Get SHA from `getContent()`, pass to update |
| **PR mergeable is null** | Can't check if mergeable | Wait 2 seconds or poll until non-null |
| **Missing resource** | 404 error thrown | Use try/catch, check `error.status === 404` |
| **Rate limit exceeded** | 403 error | Check `rateLimit.get()`, wait for reset |
| **Branch ref format** | Wrong ref error | `createRef()` needs `refs/heads/name`, `getRef()` needs `heads/name` |

## Error Handling {#errors}

```typescript
try {
  const { data } = await octokit.rest.issues.get({ owner, repo, issue_number: 999 });
} catch (error: any) {
  if (error.status === 404) {
    console.log("Issue not found");
  } else if (error.status === 403) {
    console.log("Rate limited or no permission");
  } else if (error.status === 401) {
    console.log("Bad credentials - check GITHUB_TOKEN");
  } else {
    throw error;
  }
}
```

## Troubleshooting {#troubleshooting}

### Quick Diagnostics

```bash
tsx << 'EOF'
import { Octokit } from "octokit";

// Check 1: Token exists
if (!process.env.GITHUB_TOKEN) {
  console.log("GITHUB_TOKEN not set");
  process.exit(1);
}
console.log("Token:", process.env.GITHUB_TOKEN.substring(0, 4) + "...");

// Check 2: Authentication works
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
try {
  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log("Authenticated as:", user.login);
} catch (e: any) {
  console.log("Auth failed:", e.status, e.message);
  process.exit(1);
}

// Check 3: Rate limits
const { data: rate } = await octokit.rest.rateLimit.get();
console.log("Rate limit:", rate.rate.remaining + "/" + rate.rate.limit);
EOF
```

### Common Errors

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `401 Bad credentials` | Token invalid or expired | Generate new token at github.com/settings/tokens |
| `403 Resource not accessible` | Token lacks required permissions | Add permissions or use fine-grained token with repo access |
| `404 Not Found` | Repo doesn't exist OR token can't access private repo | Verify repo name; ensure token has `repo` scope |
| `409 Conflict` (file update) | SHA mismatch - file changed | Re-read file to get current SHA, then update |
| `422 Unprocessable` | Invalid parameters or state | Check API docs for required fields |
| `rate.remaining = 0` | Hit 5000 req/hour limit | Wait until `rate.reset` time or reduce requests |

### Search Not Finding Results?

Search queries use AND logic between qualifiers:
- `repo:owner/repo is:issue state:open` = issues in repo AND open
- Add qualifiers one at a time to narrow down
- Check spelling of repo name and qualifiers

### File Content Garbled?

Always decode base64:
```typescript
// Wrong: console.log(data.content)
// Right:
const text = Buffer.from(data.content, "base64").toString("utf8");
```

### Branch Operations Failing?

Check ref format - different methods need different formats:
- `git.getRef()` needs `heads/main` (no `refs/` prefix)
- `git.createRef()` needs `refs/heads/main` (with prefix)
