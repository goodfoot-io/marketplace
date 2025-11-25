---
name: linear-v2
description: Reference for Linear webhooks and TypeScript SDK. Use when receiving
  Linear webhook payloads, responding to issues or comments, changing issue status,
  or querying Linear state via the @linear/sdk package.
---

# Linear Reference (SDK)

Uses `@linear/sdk` with `tsx`. Run: `dotenv -- tsx script.ts`

## Decision Trees

### Webhook Received
```
1. Is this from my bot?
   → if (webhook.data.user?.id === viewerId) return; // STOP - prevent loop

2. What type?
   → Issue:   webhooks/issue.md
   → Comment: webhooks/comment.md
   → Project: webhooks/project.md
   → Cycle:   webhooks/cycle.md
```

### Responding to Mentions
```
1. Check if mentioned: /@claude\b/i.test(webhook.data.body)
2. Get issue context: await client.issue(webhook.data.issue.identifier)
3. Reply: await client.createComment({ issueId: issue.id, body: "..." })
```

### Handling Assignment
```
1. Detect: webhook.updatedFrom?.assigneeId exists
2. Is it me? webhook.data.assignee?.id === viewerId
3. Acknowledge: update state + add comment (see sdk/issues.md#updating)
```

### Tracking Status Changes
```
1. Detect: webhook.updatedFrom?.stateId exists
2. Get transition: webhook.updatedFrom.state.type → webhook.data.state.type
3. React based on new type (started, completed, etc.)
```

## Critical Gotchas (Verified)

| Issue | Reality | Fix |
|-------|---------|-----|
| Bot loops | Your comments trigger webhooks | Check `webhook.data.user.id === viewerId` first |
| Unassigned check | SDK returns `undefined`, not `null` | Use `!assignee` or `=== undefined` |
| State types | Multiple states can share same type | "canceled" may have "Canceled" AND "Duplicate" |
| SDK `name` field | `viewer.name` = email, not display name | Use `viewer.displayName` for display |
| `issue.parent` | Returns `undefined` for top-level | Webhooks send `null`, SDK returns `undefined` |
| State IDs | Team-specific | Re-lookup by `state.type` when moving issues between teams |

## Quick Lookups

### Webhook → Reference
| `type` | File |
|--------|------|
| `Issue` | webhooks/issue.md |
| `Comment` | webhooks/comment.md |
| `Project`, `ProjectUpdate` | webhooks/project.md |
| `Cycle` | webhooks/cycle.md |

### Task → Reference
| I want to... | File |
|--------------|------|
| Reply to comment/mention | sdk/comments.md#creating |
| Change issue status | sdk/issues.md#updating |
| Get issue details | sdk/issues.md#getting |
| Find workflow states | sdk/queries.md#teams |
| Find user IDs | sdk/queries.md#users |

### Webhook Detection
| Pattern | Meaning |
|---------|---------|
| `updatedFrom.assigneeId` exists | Assignment changed |
| `updatedFrom.stateId` exists | Status changed |
| `updatedFrom.labelIds` exists | Labels changed |
| `action: "create"` + `type: "Comment"` | New comment |

### Field Values

**priority**: `1`=Urgent, `2`=High, `3`=Normal, `4`=Low, `0`=None

**state.type**: `backlog` → `unstarted` → `started` → `completed` | `canceled`

## Essential Patterns

### Bot Loop Prevention (CRITICAL)
```typescript
const viewer = await client.viewer;
const viewerId = viewer.id;  // Cache at startup

// In every webhook handler - check FIRST
if (webhook.type === "Comment" && webhook.data.user?.id === viewerId) {
  return;  // Ignore own comments
}
```

### Detect Mentions
```typescript
const wasMentioned = /@claude\b/i.test(webhook.data.body);
```

### Extract Issue References
```typescript
const refs = [...new Set(body.match(/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+/g) || [])];
```

### Find State by Type
```typescript
const team = await issue.team;
const states = await team?.states();
const inProgress = states?.nodes.find(s => s.type === "started");
// ⚠️ Multiple states may match - this returns first
```

### Detect State Transition
```typescript
const wasCompleted =
  webhook.updatedFrom?.state?.type !== "completed" &&
  webhook.data.state?.type === "completed";
```

## SDK Quick Start

```typescript
import { LinearClient } from "@linear/sdk";

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

// Get issue
const issue = await client.issue("ENG-1234");
const state = await issue.state;

// Update status
await client.updateIssue(issue.id, { stateId: "state-uuid" });

// Add comment
await client.createComment({ issueId: issue.id, body: "Done." });

// Get my ID (for loop prevention)
const viewer = await client.viewer;
console.log(viewer.id, viewer.displayName);  // NOT viewer.name!
```

## Official Documentation

- **SDK**: https://developers.linear.app/docs/sdk/getting-started
- **Webhooks**: https://developers.linear.app/docs/graphql/webhooks
- **API Reference**: https://studio.apollographql.com/public/Linear-API
