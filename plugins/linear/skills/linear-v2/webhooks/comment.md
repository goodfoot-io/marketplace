# Comment Webhooks

> **Official docs**: https://developers.linear.app/docs/graphql/webhooks

## Example Payload

```json
{
  "action": "create",
  "type": "Comment",
  "actor": { "id": "user-789", "name": "Mike Johnson", "email": "mike@example.com" },
  "data": {
    "id": "comment-uuid",
    "body": "@claude Can you investigate this issue? The logs show errors since yesterday.",
    "issue": { "id": "issue-uuid", "identifier": "ENG-5678", "title": "API errors" },
    "user": { "id": "user-789", "name": "Mike Johnson", "email": "mike@example.com" },
    "parent": null,
    "reactions": []
  },
  "url": "https://linear.app/company/issue/ENG-5678#comment-uuid"
}
```

## Actions

| `action` | Meaning |
|----------|---------|
| `create` | New comment added |
| `update` | Comment edited |
| `remove` | Comment deleted |

## Bot Loop Prevention {#loop-prevention}

**CRITICAL:** When your bot posts a comment, Linear sends a webhook for that comment. You MUST detect and ignore your own comments to prevent infinite loops.

```typescript
// Get your bot's user ID (cache this at startup)
const viewer = await client.viewer;
const myUserId = viewer?.id;

// In webhook handler - check FIRST before any processing
if (webhook.data.user.id === myUserId) {
  return; // Ignore own comments
}

// Safe to process - this is from a human
```

**Why this matters:**
- User comments → Bot responds → Bot comment webhook → Bot responds → **INFINITE LOOP**
- Can cause rate limiting, server overload, and spam

## Detecting Mentions {#mentions}

Mentions appear as `@username` in `data.body` text. They are plain text, not structured data.

**To detect if you were mentioned:**

```typescript
const body = webhook.data.body;
const wasMentioned = /@claude\b/i.test(body);
```

**Extract all mentions:**

```typescript
const mentions = body.match(/@[\w-]+/g) || [];
// ["@claude", "@jane", "@team-lead"]
```

**Common mention patterns:**
| Pattern | Intent | Suggested Action |
|---------|--------|------------------|
| `@claude Can you...` | Direct request | Respond with action |
| `@claude please...` | Direct request | Respond with action |
| `cc @claude` | FYI | Acknowledge, may not need action |
| `@claude thoughts?` | Opinion request | Provide analysis |

## Extracting Issue References

Comments may reference other issues by identifier:

```typescript
const body = webhook.data.body;
const issueRefs = body.match(/[A-Z]+-\d+/g) || [];
// ["ENG-1234", "BUG-567"]

// Fetch referenced issues
for (const ref of issueRefs) {
  const issue = await client.issue(ref);
  console.log(issue.identifier, "-", issue.title);
}
```

## Detecting Replies

If `data.parent` is not `null`, this comment is a reply to another comment:

```json
"parent": { "id": "parent-comment-uuid" }
```

Top-level comments have `"parent": null`.

## Field Reference

### body

Markdown-formatted text. May contain:
- `@mentions` - Plain text mentions
- Issue references like `ENG-1234` - Auto-linked by Linear
- Code blocks, links, formatting

### issue

The parent issue this comment belongs to:

```json
{ "id": "issue-uuid", "identifier": "ENG-5678", "title": "Issue title" }
```

Use `issue.identifier` to get more context:
```typescript
const issue = await client.issue("ENG-5678");
```

### user

The comment author:

```json
{ "id": "user-uuid", "name": "Display Name", "email": "user@example.com" }
```

For `create` actions, `user` matches `actor`.

### parent

For replies, contains the parent comment:

```json
{ "id": "parent-comment-uuid" }
```

Value is `null` for top-level comments.

### reactions

Array of emoji reactions:

```json
[{ "id": "reaction-id", "emoji": "thumbsup", "user": { "id": "user-id" } }]
```

## Responding

| I want to... | SDK Operation | Reference |
|--------------|---------------|-----------|
| Get full issue context | `await client.issue("ENG-5678")` | [sdk/issues.md](../sdk/issues.md#getting) |
| See all comments | `const comments = await issue.comments()` | [sdk/comments.md](../sdk/comments.md#listing) |
| Reply with a comment | `await client.createComment({ issueId, body })` | [sdk/comments.md](../sdk/comments.md#creating) |
| Reply in a thread | `await client.createComment({ issueId, parentId, body })` | [sdk/comments.md](../sdk/comments.md#creating) |

**Note:** The SDK supports thread replies via `parentId` in `createComment()`.

See [sdk/comments.md](../sdk/comments.md) for complete SDK reference.
