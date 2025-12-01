# Pull Requests

> [Back to SKILL.md](../SKILL.md) | [Issues](issues.md) | [Files](files.md) | [Git](git.md) | [Search](search.md) | [Actions](actions.md)

> **Official docs**: https://docs.github.com/en/rest/pulls

## Quick Reference

| Operation | Method | Anchor |
|-----------|--------|--------|
| Create PR | `pulls.create()` | #create |
| Get PR | `pulls.get()` | #get |
| Get diff | `pulls.get({ mediaType: { format: 'diff' }})` | #diff |
| List files | `pulls.listFiles()` | #files |
| Create review | `pulls.createReview()` | #reviews |
| Merge | `pulls.merge()` | #merge |
| Update branch | `pulls.updateBranch()` | #update-branch |

---

## Create PR {#create}

```typescript
const { data: pr } = await octokit.rest.pulls.create({
  owner: "owner",
  repo: "repo",
  title: "Add new feature",
  body: "## Summary\nThis PR adds...\n\n## Changes\n- Added X\n- Fixed Y",
  head: "feature-branch",       // Source branch
  base: "main",                 // Target branch
  draft: false,                 // Optional: create as draft
  maintainer_can_modify: true,  // Optional: allow maintainer edits
});

console.log("Created PR #" + pr.number);
console.log("URL:", pr.html_url);
```

### Cross-Repository PR

For forks, specify the full head reference:

```typescript
const { data: pr } = await octokit.rest.pulls.create({
  owner: "upstream-owner",
  repo: "repo",
  title: "Feature from fork",
  head: "fork-owner:feature-branch",  // fork-owner:branch format
  base: "main",
});
```

---

## Get PR Details {#get}

```typescript
const { data: pr } = await octokit.rest.pulls.get({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
});

console.log("Title:", pr.title);
console.log("State:", pr.state);              // "open" or "closed"
console.log("Merged:", pr.merged);            // boolean
console.log("Mergeable:", pr.mergeable);      // boolean | null (see note)
console.log("Draft:", pr.draft);
console.log("Author:", pr.user?.login);
console.log("Head:", pr.head.ref);            // Source branch
console.log("Base:", pr.base.ref);            // Target branch
console.log("Commits:", pr.commits);
console.log("Changed files:", pr.changed_files);
console.log("Additions:", pr.additions);
console.log("Deletions:", pr.deletions);
```

### Important: Mergeable Field

The `mergeable` field may be `null` if GitHub hasn't computed it yet. Poll until it's non-null:

```typescript
async function getPRWithMergeableState(owner: string, repo: string, pull_number: number) {
  let pr;
  let attempts = 0;

  do {
    const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number });
    pr = data;

    if (pr.mergeable === null && attempts < 5) {
      await new Promise(resolve => setTimeout(resolve, 2000));  // Wait 2 seconds
      attempts++;
    }
  } while (pr.mergeable === null && attempts < 5);

  return pr;
}
```

---

## Get PR Diff {#diff}

```typescript
// Get diff as text
const { data: diff } = await octokit.rest.pulls.get({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  mediaType: { format: "diff" },
});

console.log("Diff:");
console.log(String(diff));  // Cast to string - returns raw diff text
```

### Get Patch Format

```typescript
const { data: patch } = await octokit.rest.pulls.get({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  mediaType: { format: "patch" },
});

console.log("Patch:");
console.log(String(patch));
```

---

## List Changed Files {#files}

```typescript
const { data: files } = await octokit.rest.pulls.listFiles({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  per_page: 100,
});

for (const file of files) {
  console.log(file.filename);
  console.log("  Status:", file.status);       // "added", "modified", "removed", "renamed"
  console.log("  Changes:", "+" + file.additions + "/-" + file.deletions);
  if (file.previous_filename) {
    console.log("  Renamed from:", file.previous_filename);
  }
}
```

### File Status Values

| Status | Meaning |
|--------|---------|
| `added` | New file |
| `removed` | Deleted file |
| `modified` | Changed file |
| `renamed` | File was renamed (check `previous_filename`) |
| `copied` | File was copied |
| `changed` | File permissions changed |

### Get File Patch

```typescript
for (const file of files) {
  if (file.patch) {
    console.log("Patch for " + file.filename + ":");
    console.log(file.patch);
  }
}
```

---

## Reviews {#reviews}

### Create Review

```typescript
// Simple approval
const { data: review } = await octokit.rest.pulls.createReview({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  body: "LGTM!",
  event: "APPROVE",
});

// Request changes
const { data: review2 } = await octokit.rest.pulls.createReview({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  body: "Please fix the issues mentioned below.",
  event: "REQUEST_CHANGES",
});

// Just comment (no approval/rejection)
const { data: review3 } = await octokit.rest.pulls.createReview({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  body: "Some observations...",
  event: "COMMENT",
});
```

### Review Events

| Event | Meaning |
|-------|---------|
| `APPROVE` | Approve the PR |
| `REQUEST_CHANGES` | Request changes before merge |
| `COMMENT` | Leave comments without approval |

### Review with Line Comments

```typescript
const { data: review } = await octokit.rest.pulls.createReview({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  body: "Review with inline comments",
  event: "REQUEST_CHANGES",
  comments: [
    {
      path: "src/index.ts",
      line: 42,               // Line number in the new version
      body: "Consider using const here",
    },
    {
      path: "src/utils.ts",
      start_line: 10,         // For multi-line comments
      line: 15,
      body: "This function could be simplified",
    },
  ],
});
```

### List Reviews

```typescript
const { data: reviews } = await octokit.rest.pulls.listReviews({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
});

for (const review of reviews) {
  console.log(review.user?.login + ":", review.state);
  // States: APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED, PENDING
}
```

---

## Merge PR {#merge}

```typescript
const { data: result } = await octokit.rest.pulls.merge({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  merge_method: "squash",     // "merge", "squash", or "rebase"
  commit_title: "feat: Add new feature (#123)",
  commit_message: "This PR adds the new feature as described.",
});

if (result.merged) {
  console.log("PR merged successfully");
  console.log("Merge SHA:", result.sha);
} else {
  console.log("Merge failed:", result.message);
}
```

### Merge Methods

| Method | Behavior |
|--------|----------|
| `merge` | Create a merge commit |
| `squash` | Squash all commits into one |
| `rebase` | Rebase and merge |

### Check Before Merge

```typescript
// First check if mergeable
const { data: pr } = await octokit.rest.pulls.get({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
});

if (pr.mergeable === false) {
  console.log("PR has conflicts and cannot be merged");
} else if (pr.mergeable === null) {
  console.log("Merge status being computed, try again in a moment");
} else {
  // Safe to merge
  await octokit.rest.pulls.merge({
    owner: "owner",
    repo: "repo",
    pull_number: 123,
    merge_method: "squash",
  });
}
```

---

## Update PR Branch {#update-branch}

Sync PR branch with base branch (equivalent to "Update branch" button):

```typescript
try {
  const { data: result } = await octokit.rest.pulls.updateBranch({
    owner: "owner",
    repo: "repo",
    pull_number: 123,
  });
  console.log("Branch updated. New SHA:", result.sha);
} catch (error: any) {
  if (error.status === 422) {
    console.log("Branch is already up to date or cannot be updated");
  } else {
    throw error;
  }
}
```

---

## Update PR {#update}

```typescript
// Update title and body
await octokit.rest.pulls.update({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  title: "Updated PR title",
  body: "Updated description",
});

// Change base branch
await octokit.rest.pulls.update({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  base: "develop",  // Change target branch
});

// Close PR without merging
await octokit.rest.pulls.update({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  state: "closed",
});
```

---

## List PRs {#list}

```typescript
// List open PRs
const { data: prs } = await octokit.rest.pulls.list({
  owner: "owner",
  repo: "repo",
  state: "open",     // "open", "closed", or "all"
  per_page: 30,
});

for (const pr of prs) {
  console.log("#" + pr.number + ":", pr.title);
  console.log("  " + pr.head.ref + " -> " + pr.base.ref);
}
```

### Filter by Head/Base Branch

```typescript
// PRs from specific branch
const { data: featurePRs } = await octokit.rest.pulls.list({
  owner: "owner",
  repo: "repo",
  head: "owner:feature-branch",  // Must include owner
  state: "all",
});

// PRs targeting specific branch
const { data: mainPRs } = await octokit.rest.pulls.list({
  owner: "owner",
  repo: "repo",
  base: "main",
  state: "open",
});
```

---

## Request Reviewers {#request-reviewers}

```typescript
// Request individual reviewers
await octokit.rest.pulls.requestReviewers({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  reviewers: ["user1", "user2"],
});

// Request team reviewers
await octokit.rest.pulls.requestReviewers({
  owner: "owner",
  repo: "repo",
  pull_number: 123,
  team_reviewers: ["team-slug"],
});
```

---

## Complete Example: Create PR with Changes

This workflow shows how to create a PR by first creating a branch with changes.
See also: sdk/git.md#create-branch, sdk/files.md#create

```typescript
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = "owner";
const repo = "repo";
const baseBranch = "main";
const newBranch = "feature/add-config";

// 1. Get the SHA of the base branch
const { data: ref } = await octokit.rest.git.getRef({
  owner,
  repo,
  ref: "heads/" + baseBranch,
});
const baseSha = ref.object.sha;

// 2. Create new branch
await octokit.rest.git.createRef({
  owner,
  repo,
  ref: "refs/heads/" + newBranch,
  sha: baseSha,
});
console.log("Created branch:", newBranch);

// 3. Create a file on the new branch
const content = "# Configuration\n\nAdd your config here.";
await octokit.rest.repos.createOrUpdateFileContents({
  owner,
  repo,
  path: "CONFIG.md",
  message: "Add configuration file",
  content: Buffer.from(content).toString("base64"),
  branch: newBranch,
});
console.log("Created file on branch");

// 4. Create the PR
const { data: pr } = await octokit.rest.pulls.create({
  owner,
  repo,
  title: "Add configuration file",
  body: "This PR adds a new configuration file.\n\n## Changes\n- Added CONFIG.md",
  head: newBranch,
  base: baseBranch,
});

console.log("Created PR #" + pr.number);
console.log("URL:", pr.html_url);
```
