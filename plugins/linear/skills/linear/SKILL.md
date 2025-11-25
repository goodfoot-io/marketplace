---
name: linear
description: Reference for Linear webhooks and linctl CLI. Use when receiving
  Linear webhook payloads, responding to issues or comments, changing issue status,
  or querying Linear state.
---

# Linear Reference

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
| Reply to a comment or mention | linctl/comments.md#creating |
| Add a comment to an issue | linctl/comments.md#creating |
| Change issue status | linctl/issues.md#updating |
| Get full issue details | linctl/issues.md#getting |
| Find related issues | linctl/issues.md#searching |
| See the conversation on an issue | linctl/comments.md#listing |
| Check who's on a team | linctl/queries.md#teams |
| Check project progress | linctl/queries.md#projects |
| Create a new issue | linctl/issues.md#creating |

## Quick Detection Patterns

| Pattern in webhook | Meaning |
|--------------------|---------|
| `updatedFrom.assigneeId` exists | Assignment changed |
| `data.assignee.email` matches yours | Assigned to you |
| `@your-name` in `data.body` | You were mentioned |
| `updatedFrom.stateId` exists | Status changed |
| `action: "create"` + `type: "Comment"` | New comment added |
| `action: "create"` + `type: "Issue"` | New issue created |

## Common Field Values

### priority
| Value | Label |
|-------|-------|
| `0` | No priority |
| `1` | Urgent |
| `2` | High |
| `3` | Medium |
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

## Linctl Basics

```bash
linctl issue get ENG-1234                    # Get issue details
linctl issue update ENG-1234 --state "Done"  # Change status
linctl comment create ENG-1234 --body "..."  # Add comment
linctl comment list ENG-1234                 # See conversation
linctl issue list --assignee me              # My issues
linctl <command> --help                      # Full flag details
```

## ID Formats

Both formats work with linctl:
- `ENG-1234` - Human-readable identifier (preferred)
- `a1b2c3d4-...` - Internal UUID
