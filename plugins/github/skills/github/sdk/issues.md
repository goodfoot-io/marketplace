# Issues

> [Back to SKILL.md](../SKILL.md) | [Files](files.md) | [Pull Requests](pull-requests.md) | [Git](git.md) | [Search](search.md) | [Actions](actions.md)

> **Official docs**: https://docs.github.com/en/rest/issues

## Quick Reference

| Operation | Method | Anchor |
|-----------|--------|--------|
| Create issue | `issues.create()` | #create |
| Get issue | `issues.get()` | #get |
| Update issue | `issues.update()` | #update |
| List issues | `issues.listForRepo()` | #list |
| Create comment | `issues.createComment()` | #comments |
| Add labels | `issues.addLabels()` | #labels |

---

## Create Issue {#create}

```typescript
const { data: issue } = await octokit.rest.issues.create({
  owner: "owner",
  repo: "repo",
  title: "Issue title",
  body: "Issue description with **markdown** support",
  labels: ["bug", "priority:high"],  // Optional
  assignees: ["username"],            // Optional
  milestone: 1,                       // Optional - milestone number
});

console.log("Created issue #" + issue.number);
console.log("URL:", issue.html_url);
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner` | string | Yes | Repository owner |
| `repo` | string | Yes | Repository name |
| `title` | string | Yes | Issue title |
| `body` | string | No | Issue body (markdown) |
| `labels` | string[] | No | Label names to add |
| `assignees` | string[] | No | Usernames to assign |
| `milestone` | number | No | Milestone number |

---

## Get Issue {#get}

```typescript
const { data: issue } = await octokit.rest.issues.get({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
});

console.log("Title:", issue.title);
console.log("State:", issue.state);           // "open" or "closed"
console.log("Author:", issue.user?.login);
console.log("Created:", issue.created_at);
console.log("Labels:", issue.labels.map(l => typeof l === 'string' ? l : l.name).join(", "));
console.log("Body:", issue.body);
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `number` | number | Issue number |
| `title` | string | Issue title |
| `body` | string | Issue body |
| `state` | string | "open" or "closed" |
| `state_reason` | string | "completed", "not_planned", or null |
| `user` | object | Author info |
| `labels` | array | Label objects |
| `assignees` | array | Assigned users |
| `milestone` | object | Milestone info |
| `html_url` | string | Web URL |
| `created_at` | string | ISO timestamp |
| `updated_at` | string | ISO timestamp |
| `closed_at` | string | ISO timestamp (if closed) |

---

## Update/Close Issue {#update}

```typescript
// Update title and body
await octokit.rest.issues.update({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  title: "Updated title",
  body: "Updated description",
});

// Close issue
await octokit.rest.issues.update({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  state: "closed",
  state_reason: "completed",  // or "not_planned"
});

// Reopen issue
await octokit.rest.issues.update({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  state: "open",
});

// Add assignees
await octokit.rest.issues.update({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  assignees: ["user1", "user2"],
});
```

### State Reasons

| state_reason | Meaning |
|--------------|---------|
| `completed` | Issue was resolved |
| `not_planned` | Issue won't be addressed |
| `reopened` | Issue was reopened (auto-set) |

---

## List Issues {#list}

```typescript
// List open issues
const { data: issues } = await octokit.rest.issues.listForRepo({
  owner: "owner",
  repo: "repo",
  state: "open",      // "open", "closed", or "all"
  per_page: 30,
});

for (const issue of issues) {
  console.log("#" + issue.number + ":", issue.title);
}
```

### With Filters

```typescript
// Filter by label
const { data: bugs } = await octokit.rest.issues.listForRepo({
  owner: "owner",
  repo: "repo",
  labels: "bug,priority:high",  // Comma-separated
  state: "open",
});

// Filter by assignee
const { data: myIssues } = await octokit.rest.issues.listForRepo({
  owner: "owner",
  repo: "repo",
  assignee: "username",
  state: "open",
});

// Filter by milestone
const { data: milestoneIssues } = await octokit.rest.issues.listForRepo({
  owner: "owner",
  repo: "repo",
  milestone: "1",  // Milestone number as string
});

// Sort by updated time
const { data: recentIssues } = await octokit.rest.issues.listForRepo({
  owner: "owner",
  repo: "repo",
  sort: "updated",      // "created", "updated", "comments"
  direction: "desc",    // "asc" or "desc"
  per_page: 10,
});
```

### Pagination

```typescript
// Get all issues (automatic pagination)
const allIssues = await octokit.paginate(octokit.rest.issues.listForRepo, {
  owner: "owner",
  repo: "repo",
  state: "all",
  per_page: 100,
});

console.log("Total issues:", allIssues.length);
```

---

## Comments {#comments}

### Create Comment

```typescript
const { data: comment } = await octokit.rest.issues.createComment({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  body: "This is a comment with **markdown** support",
});

console.log("Comment ID:", comment.id);
console.log("URL:", comment.html_url);
```

### List Comments

```typescript
const { data: comments } = await octokit.rest.issues.listComments({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  per_page: 100,
});

for (const comment of comments) {
  console.log(comment.user?.login + ":", comment.body?.substring(0, 50) + "...");
}
```

### Update Comment

```typescript
await octokit.rest.issues.updateComment({
  owner: "owner",
  repo: "repo",
  comment_id: 456789,
  body: "Updated comment content",
});
```

### Delete Comment

```typescript
await octokit.rest.issues.deleteComment({
  owner: "owner",
  repo: "repo",
  comment_id: 456789,
});
```

---

## Labels {#labels}

### Add Labels to Issue

```typescript
const { data: labels } = await octokit.rest.issues.addLabels({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  labels: ["bug", "needs-review"],
});

console.log("Labels added:", labels.map(l => l.name).join(", "));
```

### Remove Label from Issue

```typescript
await octokit.rest.issues.removeLabel({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  name: "needs-review",
});
```

### Set All Labels (Replace)

```typescript
await octokit.rest.issues.setLabels({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  labels: ["bug", "priority:high"],  // Replaces all existing labels
});
```

### List Repository Labels

```typescript
const { data: labels } = await octokit.rest.issues.listLabelsForRepo({
  owner: "owner",
  repo: "repo",
});

for (const label of labels) {
  console.log(label.name + " (" + label.color + ")");
}
```

### Create Label

```typescript
const { data: label } = await octokit.rest.issues.createLabel({
  owner: "owner",
  repo: "repo",
  name: "priority:critical",
  color: "d73a4a",        // Hex color without #
  description: "Critical priority issues",
});
```

---

## Assignees {#assignees}

### Add Assignees

```typescript
const { data: issue } = await octokit.rest.issues.addAssignees({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  assignees: ["user1", "user2"],
});
```

### Remove Assignees

```typescript
const { data: issue } = await octokit.rest.issues.removeAssignees({
  owner: "owner",
  repo: "repo",
  issue_number: 123,
  assignees: ["user1"],
});
```

### Check if User Can Be Assigned

```typescript
try {
  await octokit.rest.issues.checkUserCanBeAssigned({
    owner: "owner",
    repo: "repo",
    assignee: "username",
  });
  console.log("User can be assigned");
} catch (error: any) {
  if (error.status === 404) {
    console.log("User cannot be assigned to this repo");
  }
}
```

---

## Complete Example: Issue Workflow

```typescript
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = "owner";
const repo = "repo";

// 1. Create issue
const { data: issue } = await octokit.rest.issues.create({
  owner,
  repo,
  title: "Bug: Application crashes on startup",
  body: "## Description\nThe app crashes immediately after launch.\n\n## Steps to reproduce\n1. Start the app\n2. Observe crash",
  labels: ["bug"],
});
console.log("Created issue #" + issue.number);

// 2. Add comment
await octokit.rest.issues.createComment({
  owner,
  repo,
  issue_number: issue.number,
  body: "Investigating this issue...",
});

// 3. Add more labels
await octokit.rest.issues.addLabels({
  owner,
  repo,
  issue_number: issue.number,
  labels: ["priority:high", "needs-review"],
});

// 4. Assign to someone
await octokit.rest.issues.addAssignees({
  owner,
  repo,
  issue_number: issue.number,
  assignees: ["developer"],
});

// 5. Close when fixed
await octokit.rest.issues.update({
  owner,
  repo,
  issue_number: issue.number,
  state: "closed",
  state_reason: "completed",
});

console.log("Issue workflow complete");
```
