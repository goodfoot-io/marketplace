# Comment Operations

> **Official docs**: https://developers.linear.app/docs/sdk/getting-started

## Quick Reference

| Operation | SDK Method |
|-----------|------------|
| List comments on issue | `issue.comments()` |
| Create comment | `client.createComment(input)` |
| Update comment | `client.updateComment(id, input)` |
| Delete comment | `client.deleteComment(id)` |

---

## Setup

```typescript
import { LinearClient } from "@linear/sdk";

(async () => {
  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

  // Your code here
})();
```

Run with: `dotenv -- tsx -e '...'` or `dotenv -- tsx script.ts`

---

## Listing Comments {#listing}

```typescript
// Get issue first
const issue = await client.issue("ENG-1234");

// List comments
const comments = await issue.comments();

comments.nodes.forEach(async (comment) => {
  // Get comment author
  const user = await comment.user;

  console.log("---");
  console.log("Author:", user?.displayName);
  console.log("Created:", comment.createdAt);
  console.log("Body:", comment.body);
});
```

### Comment Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Comment UUID |
| `body` | string | Comment text (markdown) |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last edit timestamp |
| `url` | string | Link to comment in Linear |

### Related Data (async)

| Method/Property | Returns | Description |
|-----------------|---------|-------------|
| `comment.user` | User | Comment author |
| `comment.issue` | Issue | Parent issue |
| `comment.parent` | Comment | Parent comment (if reply) |

---

## Creating Comments {#creating}

```typescript
// Get issue ID
const issue = await client.issue("ENG-1234");

// Simple comment
const payload = await client.createComment({
  issueId: issue.id,
  body: "Looking into this now."
});

const comment = await payload.comment;
console.log("Created comment:", comment?.id);

// Comment with markdown
await client.createComment({
  issueId: issue.id,
  body: `## Investigation

Found the issue in \`src/auth.ts\`:

- Line 45 had incorrect null check
- Fixed in commit abc123

**Status:** Ready for review`
});

// Comment with @mention
await client.createComment({
  issueId: issue.id,
  body: "@jane I've fixed this, ready for your review."
});
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `issueId` | string | Issue UUID (required) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `body` | string | Comment text (markdown supported) |
| `parentId` | string | Parent comment UUID (for replies) |

### Mentions

Mentions are plain text in the comment body:

```typescript
// Mention by username
body: "@jane Can you review this?"

// Mention in context
body: "I've fixed the bug.\n\n@bob @alice Please test when you can."
```

### Issue References

Issue identifiers in comments are automatically linked:

```typescript
body: "This is related to ENG-5678 and blocks ENG-9012."
```

---

## Thread Replies

Comments can be nested as replies:

```typescript
// Get the parent comment ID
const issue = await client.issue("ENG-1234");
const comments = await issue.comments();
const parentComment = comments.nodes[0];

// Create a reply
await client.createComment({
  issueId: issue.id,
  parentId: parentComment.id,
  body: "Replying to this thread."
});
```

**Note:** Thread depth may be limited. Check Linear's current threading behavior.

---

## Updating Comments

```typescript
await client.updateComment("comment-uuid", {
  body: "Updated comment text with **new content**."
});
```

---

## Deleting Comments

```typescript
await client.deleteComment("comment-uuid");
```

---

## Complete Example

```typescript
import { LinearClient } from "@linear/sdk";

(async () => {
  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

  // Get the issue
  const issue = await client.issue("ENG-1234");

  // Read existing comments
  const comments = await issue.comments();
  console.log("Existing comments:", comments.nodes.length);

  // Add investigation notes
  await client.createComment({
    issueId: issue.id,
    body: `## Investigation Complete

**Root cause:** Database connection timeout

**Fix:** Increased pool size in \`config/database.ts\`

**Testing:**
- [x] Local tests pass
- [x] Staging deployment verified

@reviewer Ready for code review.`
  });

  console.log("Comment added to", issue.identifier);
})();
```
