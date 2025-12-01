# Search

> [Back to SKILL.md](../SKILL.md) | [Issues](issues.md) | [Pull Requests](pull-requests.md) | [Files](files.md) | [Git](git.md) | [Actions](actions.md)

> **Official docs**: https://docs.github.com/en/rest/search

## Quick Reference

| Operation | Method | Anchor |
|-----------|--------|--------|
| Search code | `search.code()` | #code |
| Search issues/PRs | `search.issuesAndPullRequests()` | #issues |
| Search repos | `search.repos()` | #repos |
| Search users | `search.users()` | #users |

---

## Query Syntax

GitHub search uses special qualifiers. Combine them with spaces:

### Query Logic (AND/OR)

**Spaces = AND**: Qualifiers separated by spaces are AND-ed together.
```
repo:owner/repo is:issue state:open
```
Means: in this repo AND is an issue AND is open

**OR operator**: Use `OR` (uppercase) for alternatives.
```
label:bug OR label:enhancement
```
Means: has bug label OR enhancement label

**Combining AND/OR**:
```
repo:owner/repo is:issue (label:bug OR label:critical)
```
Means: in repo AND is issue AND (has bug OR critical label)

**Negation**: Use `-` prefix to exclude.
```
repo:owner/repo is:issue -label:wontfix
```
Means: in repo AND is issue AND does NOT have wontfix label

### Common Qualifiers

| Qualifier | Example | Description |
|-----------|---------|-------------|
| `repo:owner/name` | `repo:facebook/react` | Limit to repository |
| `org:name` | `org:microsoft` | Limit to organization |
| `user:name` | `user:octocat` | Limit to user's repos |
| `language:lang` | `language:typescript` | Filter by language |
| `path:dir` | `path:src/` | Filter by path |
| `filename:name` | `filename:package.json` | Filter by filename |
| `extension:ext` | `extension:tsx` | Filter by extension |

---

## Search Code {#code}

```typescript
const { data } = await octokit.rest.search.code({
  q: "useState language:typescript",
  per_page: 10,
});

console.log("Total results:", data.total_count);

for (const item of data.items) {
  console.log(item.repository.full_name + "/" + item.path);
  console.log("  URL:", item.html_url);
}
```

### Search Within Specific Repository

```typescript
const { data } = await octokit.rest.search.code({
  q: "handleSubmit repo:facebook/react",
  per_page: 10,
});
```

### Search by Path and Extension

```typescript
// Find all TypeScript files in src directory
const { data } = await octokit.rest.search.code({
  q: "repo:owner/repo path:src extension:ts",
  per_page: 20,
});

// Find specific filename
const { data: configs } = await octokit.rest.search.code({
  q: "repo:owner/repo filename:tsconfig.json",
});
```

### Rate Limiting Note

Code search has stricter rate limits (10 requests/minute for authenticated users). Handle accordingly:

```typescript
try {
  const { data } = await octokit.rest.search.code({ q: "query" });
} catch (error: any) {
  if (error.status === 403) {
    console.log("Search rate limit exceeded. Wait before retrying.");
  }
}
```

---

## Search Issues/PRs {#issues}

```typescript
const { data } = await octokit.rest.search.issuesAndPullRequests({
  q: "repo:facebook/react is:issue state:open label:bug",
  sort: "created",
  order: "desc",
  per_page: 10,
});

console.log("Total results:", data.total_count);

for (const item of data.items) {
  const type = item.pull_request ? "PR" : "Issue";
  console.log(type + " #" + item.number + ":", item.title);
  console.log("  State:", item.state);
  console.log("  Author:", item.user?.login);
}
```

### Issue/PR Qualifiers

| Qualifier | Example | Description |
|-----------|---------|-------------|
| `is:issue` | `is:issue` | Only issues |
| `is:pr` | `is:pr` | Only PRs |
| `state:open` | `state:open` | Open items |
| `state:closed` | `state:closed` | Closed items |
| `label:name` | `label:bug` | Has label |
| `author:user` | `author:octocat` | By author |
| `assignee:user` | `assignee:octocat` | Assigned to |
| `mentions:user` | `mentions:octocat` | Mentions user |
| `milestone:name` | `milestone:"v1.0"` | In milestone |
| `no:label` | `no:label` | Has no labels |
| `no:assignee` | `no:assignee` | Unassigned |

### Example Queries

```typescript
// Open bugs in repo
const bugs = await octokit.rest.search.issuesAndPullRequests({
  q: "repo:owner/repo is:issue state:open label:bug",
});

// My open PRs across all repos
const myPRs = await octokit.rest.search.issuesAndPullRequests({
  q: "is:pr author:@me state:open",
});

// Issues mentioning me
const mentions = await octokit.rest.search.issuesAndPullRequests({
  q: "is:issue mentions:myusername state:open",
});

// Recently updated issues
const recent = await octokit.rest.search.issuesAndPullRequests({
  q: "repo:owner/repo is:issue",
  sort: "updated",
  order: "desc",
});
```

---

## Search Repositories {#repos}

```typescript
const { data } = await octokit.rest.search.repos({
  q: "topic:typescript stars:>1000",
  sort: "stars",
  order: "desc",
  per_page: 10,
});

console.log("Total results:", data.total_count);

for (const repo of data.items) {
  console.log(repo.full_name);
  console.log("  Stars:", repo.stargazers_count);
  console.log("  Language:", repo.language);
  console.log("  Description:", repo.description?.substring(0, 60));
}
```

### Repository Qualifiers

| Qualifier | Example | Description |
|-----------|---------|-------------|
| `stars:n` | `stars:>1000` | By star count |
| `forks:n` | `forks:>100` | By fork count |
| `language:lang` | `language:rust` | By language |
| `topic:name` | `topic:react` | By topic |
| `archived:bool` | `archived:false` | Archived status |
| `is:public` | `is:public` | Public repos |
| `is:private` | `is:private` | Private repos |
| `created:date` | `created:>2024-01-01` | By creation date |
| `pushed:date` | `pushed:>2024-01-01` | By last push |

### Example Queries

```typescript
// Popular TypeScript repos
const popular = await octokit.rest.search.repos({
  q: "language:typescript stars:>5000",
  sort: "stars",
});

// Recently created React libraries
const newReact = await octokit.rest.search.repos({
  q: "topic:react created:>2024-01-01",
  sort: "stars",
});

// Active repos (pushed recently)
const active = await octokit.rest.search.repos({
  q: "language:python pushed:>2024-06-01 stars:>100",
  sort: "updated",
});
```

---

## Search Users {#users}

```typescript
const { data } = await octokit.rest.search.users({
  q: "type:user location:seattle language:typescript",
  sort: "followers",
  order: "desc",
  per_page: 10,
});

console.log("Total results:", data.total_count);

for (const user of data.items) {
  console.log(user.login);
  console.log("  Profile:", user.html_url);
  console.log("  Type:", user.type);  // User or Organization
}
```

### User Qualifiers

| Qualifier | Example | Description |
|-----------|---------|-------------|
| `type:user` | `type:user` | Only users |
| `type:org` | `type:org` | Only organizations |
| `followers:n` | `followers:>1000` | By followers |
| `repos:n` | `repos:>50` | By repo count |
| `location:place` | `location:tokyo` | By location |
| `language:lang` | `language:go` | Uses language |
| `created:date` | `created:<2020-01-01` | By join date |

---

## Sorting and Pagination

### Sort Options by Search Type

| Search Type | Sort Options |
|-------------|--------------|
| Code | `indexed` (default) |
| Issues/PRs | `comments`, `reactions`, `created`, `updated` |
| Repos | `stars`, `forks`, `help-wanted-issues`, `updated` |
| Users | `followers`, `repositories`, `joined` |

### Pagination

```typescript
// Manual pagination
let page = 1;
let allResults: any[] = [];

while (true) {
  const { data } = await octokit.rest.search.repos({
    q: "topic:react",
    per_page: 100,
    page: page,
  });

  allResults = allResults.concat(data.items);

  if (data.items.length < 100) break;
  page++;

  // Respect rate limits
  await new Promise(resolve => setTimeout(resolve, 1000));
}

console.log("Total fetched:", allResults.length);
```

---

## Complete Example: Find Issues to Contribute

```typescript
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Find "good first issue" labeled issues in popular TypeScript repos
const { data } = await octokit.rest.search.issuesAndPullRequests({
  q: 'language:typescript label:"good first issue" state:open',
  sort: "created",
  order: "desc",
  per_page: 10,
});

console.log("Found " + data.total_count + " good first issues\n");

for (const issue of data.items) {
  const repoName = issue.repository_url.split("/").slice(-2).join("/");
  console.log(repoName + " #" + issue.number);
  console.log("  Title:", issue.title);
  console.log("  Created:", issue.created_at);
  console.log("  URL:", issue.html_url);
  console.log();
}
```
