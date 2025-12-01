# Git Operations

> [Back to SKILL.md](../SKILL.md) | [Issues](issues.md) | [Pull Requests](pull-requests.md) | [Files](files.md) | [Search](search.md) | [Actions](actions.md)

> **Official docs**: https://docs.github.com/en/rest/git

## Quick Reference

| Operation | Method | Anchor |
|-----------|--------|--------|
| Get ref | `git.getRef()` | #get-ref |
| Create branch | `git.createRef()` | #create-branch |
| List branches | `repos.listBranches()` | #list-branches |
| Get commit | `repos.getCommit()` | #get-commit |
| List commits | `repos.listCommits()` | #list-commits |

---

## Critical: Ref Format

**Different methods use different ref formats!**

| Method | Ref Format | Example |
|--------|------------|---------|
| `git.getRef()` | No `refs/` prefix | `heads/main` |
| `git.createRef()` | Full path with `refs/` | `refs/heads/main` |
| `git.updateRef()` | No `refs/` prefix | `heads/main` |
| `git.deleteRef()` | No `refs/` prefix | `heads/feature` |

---

## Get Ref (Branch SHA) {#get-ref}

Get the SHA of a branch or tag:

```typescript
// Get branch SHA
const { data: ref } = await octokit.rest.git.getRef({
  owner: "owner",
  repo: "repo",
  ref: "heads/main",       // No "refs/" prefix!
});

console.log("Branch:", "main");
console.log("SHA:", ref.object.sha);
console.log("Type:", ref.object.type);  // Usually "commit"
```

### Get Tag Ref

```typescript
const { data: tagRef } = await octokit.rest.git.getRef({
  owner: "owner",
  repo: "repo",
  ref: "tags/v1.0.0",      // No "refs/" prefix!
});

console.log("Tag SHA:", tagRef.object.sha);
```

### Error Handling

```typescript
try {
  const { data } = await octokit.rest.git.getRef({
    owner: "owner",
    repo: "repo",
    ref: "heads/nonexistent",
  });
} catch (error: any) {
  if (error.status === 404) {
    console.log("Branch does not exist");
  }
}
```

---

## Create Branch {#create-branch}

```typescript
// Step 1: Get SHA of the base branch
const { data: mainRef } = await octokit.rest.git.getRef({
  owner: "owner",
  repo: "repo",
  ref: "heads/main",
});

// Step 2: Create new branch from that SHA
const { data: newRef } = await octokit.rest.git.createRef({
  owner: "owner",
  repo: "repo",
  ref: "refs/heads/feature-branch",  // Full path with "refs/"!
  sha: mainRef.object.sha,
});

console.log("Created branch: feature-branch");
console.log("SHA:", newRef.object.sha);
```

### Common Mistake

```typescript
// WRONG - missing refs/ prefix
await octokit.rest.git.createRef({
  ref: "heads/feature",  // This will fail!
  sha: sha,
});

// CORRECT
await octokit.rest.git.createRef({
  ref: "refs/heads/feature",  // Full path required
  sha: sha,
});
```

### Create Branch from Specific Commit

```typescript
await octokit.rest.git.createRef({
  owner: "owner",
  repo: "repo",
  ref: "refs/heads/hotfix",
  sha: "abc1234567890",  // Specific commit SHA
});
```

---

## List Branches {#list-branches}

```typescript
const { data: branches } = await octokit.rest.repos.listBranches({
  owner: "owner",
  repo: "repo",
  per_page: 100,
});

for (const branch of branches) {
  console.log(branch.name);
  console.log("  SHA:", branch.commit.sha);
  console.log("  Protected:", branch.protected);
}
```

### Get All Branches (Pagination)

```typescript
const allBranches = await octokit.paginate(octokit.rest.repos.listBranches, {
  owner: "owner",
  repo: "repo",
  per_page: 100,
});

console.log("Total branches:", allBranches.length);
```

### Filter Protected Branches

```typescript
const { data: branches } = await octokit.rest.repos.listBranches({
  owner: "owner",
  repo: "repo",
  protected: true,  // Only protected branches
});
```

---

## Get Commit {#get-commit}

```typescript
const { data: commit } = await octokit.rest.repos.getCommit({
  owner: "owner",
  repo: "repo",
  ref: "abc1234",  // Commit SHA, branch name, or tag
});

console.log("SHA:", commit.sha);
console.log("Message:", commit.commit.message);
console.log("Author:", commit.commit.author?.name);
console.log("Date:", commit.commit.author?.date);
console.log("Committer:", commit.commit.committer?.name);

// Files changed in this commit
console.log("\nFiles changed:");
for (const file of commit.files ?? []) {
  console.log("  " + file.filename + " (" + file.status + ")");
  console.log("    +" + file.additions + "/-" + file.deletions);
}

// Stats
console.log("\nStats:");
console.log("  Additions:", commit.stats?.additions);
console.log("  Deletions:", commit.stats?.deletions);
console.log("  Total:", commit.stats?.total);
```

### Get Commit by Branch Name

```typescript
// Get HEAD commit of a branch
const { data: commit } = await octokit.rest.repos.getCommit({
  owner: "owner",
  repo: "repo",
  ref: "main",  // Branch name works too
});
```

---

## List Commits {#list-commits}

```typescript
const { data: commits } = await octokit.rest.repos.listCommits({
  owner: "owner",
  repo: "repo",
  per_page: 10,
});

for (const commit of commits) {
  const shortSha = commit.sha.substring(0, 7);
  const message = commit.commit.message.split("\n")[0];  // First line only
  console.log(shortSha + " " + message);
  console.log("  Author:", commit.commit.author?.name);
  console.log("  Date:", commit.commit.author?.date);
}
```

### Filter Commits

```typescript
// Commits by author
const { data: authorCommits } = await octokit.rest.repos.listCommits({
  owner: "owner",
  repo: "repo",
  author: "username",  // GitHub username or email
  per_page: 10,
});

// Commits on specific branch
const { data: branchCommits } = await octokit.rest.repos.listCommits({
  owner: "owner",
  repo: "repo",
  sha: "feature-branch",  // Branch name
  per_page: 10,
});

// Commits affecting specific file
const { data: fileCommits } = await octokit.rest.repos.listCommits({
  owner: "owner",
  repo: "repo",
  path: "src/index.ts",
  per_page: 10,
});

// Commits in date range
const { data: dateCommits } = await octokit.rest.repos.listCommits({
  owner: "owner",
  repo: "repo",
  since: "2024-01-01T00:00:00Z",
  until: "2024-12-31T23:59:59Z",
  per_page: 10,
});
```

### Get All Commits (Pagination)

```typescript
const allCommits = await octokit.paginate(octokit.rest.repos.listCommits, {
  owner: "owner",
  repo: "repo",
  per_page: 100,
});

console.log("Total commits:", allCommits.length);
```

---

## Delete Branch {#delete-branch}

```typescript
await octokit.rest.git.deleteRef({
  owner: "owner",
  repo: "repo",
  ref: "heads/feature-branch",  // No "refs/" prefix for deleteRef!
});

console.log("Branch deleted");
```

### Error Handling

```typescript
try {
  await octokit.rest.git.deleteRef({
    owner: "owner",
    repo: "repo",
    ref: "heads/main",
  });
} catch (error: any) {
  if (error.status === 422) {
    console.log("Cannot delete protected branch or default branch");
  } else if (error.status === 404) {
    console.log("Branch does not exist");
  }
}
```

---

## Compare Commits {#compare}

```typescript
const { data: comparison } = await octokit.rest.repos.compareCommits({
  owner: "owner",
  repo: "repo",
  base: "main",
  head: "feature-branch",
});

console.log("Status:", comparison.status);  // "ahead", "behind", "diverged", "identical"
console.log("Ahead by:", comparison.ahead_by);
console.log("Behind by:", comparison.behind_by);
console.log("Total commits:", comparison.total_commits);

// List commits between branches
console.log("\nCommits:");
for (const commit of comparison.commits) {
  console.log("  " + commit.sha.substring(0, 7) + " " + commit.commit.message.split("\n")[0]);
}

// List changed files
console.log("\nFiles changed:");
for (const file of comparison.files ?? []) {
  console.log("  " + file.filename + " (" + file.status + ")");
}
```

---

## Complete Example: Feature Branch Workflow

```typescript
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = "owner";
const repo = "repo";

// 1. Get main branch SHA
const { data: mainRef } = await octokit.rest.git.getRef({
  owner,
  repo,
  ref: "heads/main",
});
console.log("Main branch SHA:", mainRef.object.sha);

// 2. Create feature branch
const branchName = "feature/my-feature";
await octokit.rest.git.createRef({
  owner,
  repo,
  ref: "refs/heads/" + branchName,
  sha: mainRef.object.sha,
});
console.log("Created branch:", branchName);

// 3. (Make changes via files API - see sdk/files.md)

// 4. List commits on feature branch
const { data: commits } = await octokit.rest.repos.listCommits({
  owner,
  repo,
  sha: branchName,
  per_page: 5,
});
console.log("\nRecent commits on " + branchName + ":");
for (const commit of commits) {
  console.log("  " + commit.sha.substring(0, 7) + " " + commit.commit.message.split("\n")[0]);
}

// 5. Compare with main
const { data: comparison } = await octokit.rest.repos.compareCommits({
  owner,
  repo,
  base: "main",
  head: branchName,
});
console.log("\nBranch status:", comparison.status);
console.log("Commits ahead:", comparison.ahead_by);
```
