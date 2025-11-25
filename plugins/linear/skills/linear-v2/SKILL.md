---
name: linear-v2
description: Reference for Linear webhooks and TypeScript SDK. Use when receiving
  Linear webhook payloads, responding to issues or comments, changing issue status,
  or querying Linear state via the @linear/sdk package.
---

# Linear Reference (SDK)

This skill uses the Linear TypeScript SDK (`@linear/sdk`) with `tsx` for all operations.

## I received a webhook...

| `type` value | Reference |
|--------------|-----------|
| `Issue` | webhooks/issue.md |
| `Comment` | webhooks/comment.md |
| `Project`, `ProjectUpdate` | webhooks/project.md |
| `Cycle` | webhooks/cycle.md |

## I want to...

| Task | Reference |
|------|-----------|
| Reply to a comment or mention | sdk/comments.md#creating |
| Add a comment to an issue | sdk/comments.md#creating |
| Change issue status | sdk/issues.md#updating |
| Get full issue details | sdk/issues.md#getting |
| Find related issues | sdk/issues.md#searching |
| See the conversation on an issue | sdk/comments.md#listing |
| Check who's on a team | sdk/queries.md#teams |
| Check project progress | sdk/queries.md#projects |
| Create a new issue | sdk/issues.md#creating |
| Find workflow state IDs | sdk/queries.md#teams |
| Find user IDs | sdk/queries.md#users |
| Handle invalid/missing issue references | sdk/error-handling.md |
| Process multiple issue references with partial results | sdk/error-handling.md#pattern-1 |
| Distinguish between error types | sdk/error-handling.md#pattern-5 |

## Quick Detection Patterns

| Pattern in webhook | Meaning |
|--------------------|---------|
| `updatedFrom.assigneeId` exists | Assignment changed |
| `data.assignee.email` matches yours | Assigned to you |
| `@your-name` in `data.body` | You were mentioned |
| `updatedFrom.stateId` exists | Status changed |
| `updatedFrom.labelIds` exists | Labels changed |
| `action: "create"` + `type: "Comment"` | New comment added |
| `action: "create"` + `type: "Issue"` | New issue created |

## Parsing Helpers

### Detect Mentions

```typescript
const body = webhook.data.body;
const wasMentioned = /@claude\b/i.test(body);
const allMentions = body.match(/@[\w-]+/g) || [];
```

### Extract Issue References

Issue identifiers like `ENG-1234` appear in comment/update bodies:

```typescript
const body = webhook.data.body;

// Regex handles multi-part team keys: GOO-1, ENG-1234, MY-LONG-KEY-99
const allRefs = body.match(/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+/g) || [];

// Deduplicate (same issue may be mentioned multiple times)
const issueRefs = [...new Set(allRefs)];
// ["GOO-42", "ENG-1234"]

// Fetch with error handling (invalid refs throw "Entity not found")
const validIssues = [];
const invalidRefs = [];

for (const ref of issueRefs) {
  try {
    const issue = await client.issue(ref);
    validIssues.push(issue);
  } catch (error) {
    // Both non-existent issues and invalid teams throw same error
    invalidRefs.push(ref);
  }
}

// Report results
console.log("Valid:", validIssues.map(i => i.identifier));
console.log("Invalid:", invalidRefs);
```

**Important:** Both non-existent issues (GOO-99999) and invalid teams (FAKE-123) throw the same `"Entity not found"` error. Handle each reference independently with try-catch to get partial results. See [sdk/error-handling.md](sdk/error-handling.md) for more patterns.

## End-to-End Examples

### Respond to a Mention

```typescript
// Webhook: Comment with @claude mention
const webhook = {
  type: "Comment",
  action: "create",
  data: {
    body: "@claude can you check this?",
    issue: { identifier: "GOO-42" }
  }
};

// Response flow
const issue = await client.issue(webhook.data.issue.identifier);
const state = await issue.state;

await client.createComment({
  issueId: issue.id,
  body: `Looking into this. Current status: ${state?.name}`
});
```

### Acknowledge Assignment

```typescript
// Webhook: Issue assigned to me
const webhook = {
  type: "Issue",
  action: "update",
  data: { identifier: "GOO-42", assignee: { email: "claude@example.com" } },
  updatedFrom: { assigneeId: null }
};

// Response flow
const issue = await client.issue(webhook.data.identifier);

// Change status to In Progress
const team = await issue.team;
const states = await team?.states();
const inProgress = states?.nodes.find(s => s.type === "started");

if (inProgress) {
  await client.updateIssue(issue.id, { stateId: inProgress.id });
}

await client.createComment({
  issueId: issue.id,
  body: "Acknowledged. Starting work on this now."
});
```

### Handle Status Change

```typescript
// Webhook: Issue moved to Done
const webhook = {
  type: "Issue",
  action: "update",
  data: { identifier: "GOO-42", state: { type: "completed" } },
  updatedFrom: { stateId: "old-state-id" }
};

// Check if issue is completed
if (webhook.data.state.type === "completed") {
  const issue = await client.issue(webhook.data.identifier);

  // Add completion comment
  await client.createComment({
    issueId: issue.id,
    body: "Great work! This issue has been completed."
  });
}
```

### Handle Label Changes

```typescript
// Webhook: Labels changed on issue
const webhook = {
  type: "Issue",
  action: "update",
  data: {
    identifier: "GOO-42",
    labels: [
      { id: "label-1", name: "bug" },
      { id: "label-2", name: "urgent" }
    ]
  },
  updatedFrom: {
    labelIds: ["label-1"]  // Previously only had "bug"
  }
};

// Detect what labels were added/removed
const previousLabelIds = new Set(webhook.updatedFrom.labelIds || []);
const currentLabelIds = new Set(webhook.data.labels.map(l => l.id));

const addedLabels = webhook.data.labels.filter(
  label => !previousLabelIds.has(label.id)
);
const removedLabelIds = Array.from(previousLabelIds).filter(
  id => !currentLabelIds.has(id)
);

console.log("Added:", addedLabels.map(l => l.name));  // ["urgent"]
console.log("Removed:", removedLabelIds);              // []

// Check if a specific label was added
const urgentWasAdded = addedLabels.some(
  label => label.name.toLowerCase() === "urgent"
);

if (urgentWasAdded) {
  const issue = await client.issue(webhook.data.identifier);

  // Escalate urgent issues
  await client.createComment({
    issueId: issue.id,
    body: "@team This issue has been marked as urgent. Please prioritize."
  });
}

// Check if issue currently has a label
const isBlocked = (webhook.data.labels || []).some(
  label => label.name.toLowerCase() === "blocked"
);

if (isBlocked) {
  console.log("Issue is currently blocked");
}
```

## Common Field Values

### priority
| Value | Label |
|-------|-------|
| `0` | No priority |
| `1` | Urgent |
| `2` | High |
| `3` | Normal |
| `4` | Low |

### state.type
| Value | Meaning |
|-------|---------|
| `backlog` | In backlog, not yet planned |
| `unstarted` | Planned, ready to start |
| `started` | Work in progress |
| `completed` | Done |
| `canceled` | Won't do |

Typical flow: `backlog` → `unstarted` → `started` → `completed`

### health (ProjectUpdate only)
| Value | Meaning |
|-------|---------|
| `onTrack` | Progressing as planned |
| `atRisk` | May miss deadlines |
| `offTrack` | Behind schedule |

## Webhook Payload Structure

All webhooks include:

| Field | Description |
|-------|-------------|
| `action` | `create`, `update`, or `remove` |
| `type` | Entity type (Issue, Comment, etc.) |
| `actor` | User who made the change |
| `data` | Current entity state |
| `updatedFrom` | Previous values (update only) |
| `url` | Link to entity in Linear |

## SDK Quick Start

```typescript
import { LinearClient } from "@linear/sdk";

(async () => {
  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

  // Get issue details
  const issue = await client.issue("ENG-1234");
  const state = await issue.state;
  console.log(issue.title, "-", state?.name);

  // Update issue status
  await client.updateIssue(issue.id, { stateId: "new-state-uuid" });

  // Add comment
  await client.createComment({
    issueId: issue.id,
    body: "Working on this now."
  });

  // List my issues
  const me = await client.viewer;
  const myIssues = await me.assignedIssues();
})();
```

Run with: `dotenv -- tsx -e '...'` or `dotenv -- tsx script.ts`

## Official Documentation

- **TypeScript SDK**: https://developers.linear.app/docs/sdk/getting-started
- **Webhooks**: https://developers.linear.app/docs/graphql/webhooks
- **GraphQL API**: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
- **API Reference**: https://studio.apollographql.com/public/Linear-API/variant/current/home

## ID Formats

Both formats work with the SDK:
- `ENG-1234` - Human-readable identifier (for `client.issue()`)
- `a1b2c3d4-...` - UUID (required for update operations)

To get the UUID from an identifier:
```typescript
const issue = await client.issue("ENG-1234");
console.log(issue.id);  // UUID for use in updateIssue()
```
