# GraphQL API

> **Official docs**: https://docs.github.com/en/graphql

## When to Use GraphQL vs REST

| Scenario | Use |
|----------|-----|
| Simple CRUD on one resource | REST |
| Need nested/related data efficiently | **GraphQL** |
| Get issue + all comments + authors | **GraphQL** |
| Create an issue | REST |
| Get PR with review threads and reactions | **GraphQL** |
| Search with specific fields only | **GraphQL** |

**Rule of thumb**: If REST would require multiple sequential API calls to gather related data, use GraphQL instead.

---

## Basic Query

```typescript
const { data } = await octokit.graphql(`
  query {
    viewer {
      login
      name
      repositories(first: 5) {
        nodes {
          name
          stargazerCount
        }
      }
    }
  }
`);

console.log("User:", data.viewer.login);
console.log("Repos:", data.viewer.repositories.nodes);
```

---

## Query with Variables

```typescript
const { repository } = await octokit.graphql(`
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      name
      description
      stargazerCount
      forkCount
      issues(states: OPEN, first: 10) {
        totalCount
        nodes {
          number
          title
          author {
            login
          }
        }
      }
    }
  }
`, {
  owner: "owner",
  repo: "repo",
});

console.log("Repo:", repository.name);
console.log("Open issues:", repository.issues.totalCount);
```

---

## Common Queries

### Get Issue with All Comments

REST would require: 1. Get issue + 2. List comments (paginated)

GraphQL gets everything in one request:

```typescript
const { repository } = await octokit.graphql(`
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        title
        body
        state
        author {
          login
          avatarUrl
        }
        labels(first: 10) {
          nodes {
            name
            color
          }
        }
        comments(first: 100) {
          totalCount
          nodes {
            body
            createdAt
            author {
              login
            }
          }
        }
      }
    }
  }
`, {
  owner: "owner",
  repo: "repo",
  number: 123,
});

const issue = repository.issue;
console.log("Issue:", issue.title);
console.log("Comments:", issue.comments.totalCount);

for (const comment of issue.comments.nodes) {
  console.log(comment.author?.login + ":", comment.body.substring(0, 50));
}
```

### Get PR with Reviews and Threads

```typescript
const { repository } = await octokit.graphql(`
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        title
        state
        mergeable
        author {
          login
        }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
              }
            }
          }
        }
        reviews(first: 20) {
          nodes {
            author {
              login
            }
            state
            body
          }
        }
        reviewThreads(first: 50) {
          nodes {
            isResolved
            comments(first: 10) {
              nodes {
                body
                author {
                  login
                }
              }
            }
          }
        }
      }
    }
  }
`, {
  owner: "owner",
  repo: "repo",
  number: 123,
});

const pr = repository.pullRequest;
console.log("PR:", pr.title);
console.log("Reviews:", pr.reviews.nodes.length);
console.log("Review threads:", pr.reviewThreads.nodes.length);
```

### Search with Custom Fields

```typescript
const { search } = await octokit.graphql(`
  query($query: String!) {
    search(query: $query, type: ISSUE, first: 20) {
      issueCount
      nodes {
        ... on Issue {
          number
          title
          repository {
            nameWithOwner
          }
          labels(first: 5) {
            nodes {
              name
            }
          }
          reactions(first: 0) {
            totalCount
          }
        }
      }
    }
  }
`, {
  query: 'language:typescript label:"good first issue" state:open',
});

console.log("Found:", search.issueCount, "issues");

for (const issue of search.nodes) {
  console.log(issue.repository.nameWithOwner + " #" + issue.number);
  console.log("  " + issue.title);
  console.log("  Reactions:", issue.reactions.totalCount);
}
```

---

## Pagination with Cursors

GraphQL uses cursor-based pagination:

```typescript
async function getAllIssues(owner: string, repo: string) {
  let hasNextPage = true;
  let cursor: string | null = null;
  const allIssues: any[] = [];

  while (hasNextPage) {
    const { repository } = await octokit.graphql(`
      query($owner: String!, $repo: String!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100, after: $cursor, states: OPEN) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              number
              title
            }
          }
        }
      }
    `, {
      owner,
      repo,
      cursor,
    });

    allIssues.push(...repository.issues.nodes);
    hasNextPage = repository.issues.pageInfo.hasNextPage;
    cursor = repository.issues.pageInfo.endCursor;
  }

  return allIssues;
}

const issues = await getAllIssues("owner", "repo");
console.log("Total open issues:", issues.length);
```

---

## Mutations

### Create Issue

```typescript
const { createIssue } = await octokit.graphql(`
  mutation($input: CreateIssueInput!) {
    createIssue(input: $input) {
      issue {
        number
        url
      }
    }
  }
`, {
  input: {
    repositoryId: "R_xxxxx",  // Must get repo ID first
    title: "Issue title",
    body: "Issue body",
  },
});

console.log("Created issue #" + createIssue.issue.number);
```

### Get Repository ID

```typescript
const { repository } = await octokit.graphql(`
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      id
    }
  }
`, {
  owner: "owner",
  repo: "repo",
});

console.log("Repo ID:", repository.id);
```

### Add Comment

```typescript
const { addComment } = await octokit.graphql(`
  mutation($input: AddCommentInput!) {
    addComment(input: $input) {
      commentEdge {
        node {
          id
          body
        }
      }
    }
  }
`, {
  input: {
    subjectId: "I_xxxxx",  // Issue or PR node ID
    body: "Comment text",
  },
});
```

### Add Reaction

```typescript
await octokit.graphql(`
  mutation($input: AddReactionInput!) {
    addReaction(input: $input) {
      reaction {
        content
      }
    }
  }
`, {
  input: {
    subjectId: "I_xxxxx",  // Issue, PR, or comment node ID
    content: "THUMBS_UP",  // THUMBS_UP, THUMBS_DOWN, LAUGH, HOORAY, CONFUSED, HEART, ROCKET, EYES
  },
});
```

---

## Error Handling

```typescript
try {
  const result = await octokit.graphql(`
    query {
      repository(owner: "nonexistent", name: "repo") {
        name
      }
    }
  `);
} catch (error: any) {
  if (error.errors) {
    // GraphQL errors
    for (const err of error.errors) {
      console.error("GraphQL error:", err.message);
      console.error("  Type:", err.type);
      console.error("  Path:", err.path?.join(" > "));
    }
  } else {
    // Network or other errors
    console.error("Error:", error.message);
  }
}
```

---

## Rate Limits

GraphQL has separate rate limits from REST:

```typescript
const { rateLimit } = await octokit.graphql(`
  query {
    rateLimit {
      limit
      remaining
      resetAt
      cost
      nodeCount
    }
  }
`);

console.log("GraphQL Rate Limit:");
console.log("  Remaining:", rateLimit.remaining, "/", rateLimit.limit);
console.log("  Resets at:", rateLimit.resetAt);
console.log("  Last query cost:", rateLimit.cost);
```

**Note**: Complex queries cost more points. The `cost` field shows how many points your last query used.

---

## Complete Example: Dashboard Data

Get all data needed for a project dashboard in one request:

```typescript
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const { repository } = await octokit.graphql(`
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      name
      description
      stargazerCount
      forkCount

      openIssues: issues(states: OPEN) {
        totalCount
      }

      openPRs: pullRequests(states: OPEN) {
        totalCount
      }

      recentIssues: issues(first: 5, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          number
          title
          createdAt
          author { login }
        }
      }

      recentPRs: pullRequests(first: 5, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          number
          title
          createdAt
          author { login }
          reviewDecision
        }
      }

      releases(first: 1, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          tagName
          publishedAt
        }
      }
    }
  }
`, {
  owner: "owner",
  repo: "repo",
});

console.log("=== " + repository.name + " Dashboard ===\n");
console.log("Stars:", repository.stargazerCount);
console.log("Forks:", repository.forkCount);
console.log("Open Issues:", repository.openIssues.totalCount);
console.log("Open PRs:", repository.openPRs.totalCount);

if (repository.releases.nodes.length > 0) {
  const release = repository.releases.nodes[0];
  console.log("Latest Release:", release.tagName);
}

console.log("\nRecent Issues:");
for (const issue of repository.recentIssues.nodes) {
  console.log("  #" + issue.number + ":", issue.title);
}

console.log("\nRecent PRs:");
for (const pr of repository.recentPRs.nodes) {
  console.log("  #" + pr.number + ":", pr.title, "[" + (pr.reviewDecision || "pending") + "]");
}
```
