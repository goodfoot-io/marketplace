# Comment Webhooks

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

## Detecting Mentions {#mentions}

Mentions appear as `@username` in `data.body` text. They are plain text, not structured data.

**To detect if you were mentioned:**

Parse `data.body` for patterns like:
- `@claude`
- `@your-username`

**Common mention patterns:**
- `@claude Can you...` - Request for action
- `@claude please...` - Request for action
- `cc @claude` - FYI, may not need response

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

Use `issue.identifier` to get more context: `linctl issue get ENG-5678`

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

| I want to... | Command | Reference |
|--------------|---------|-----------|
| Get full issue context | `linctl issue get ENG-5678` | [linctl/issues.md](../linctl/issues.md#getting) |
| See all comments | `linctl comment list ENG-5678` | [linctl/comments.md](../linctl/comments.md#listing) |
| Reply with a comment | `linctl comment create ENG-5678 --body "..."` | [linctl/comments.md](../linctl/comments.md#creating) |

**Note:** linctl creates top-level comments. Thread replies require the Linear UI or API.

For all available flags: `linctl comment create --help`
