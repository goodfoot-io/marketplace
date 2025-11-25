# Issue Webhooks

## Example Payload

```json
{
  "action": "update",
  "type": "Issue",
  "actor": { "id": "user-123", "name": "Sarah Chen", "email": "sarah@example.com" },
  "data": {
    "id": "a1b2c3d4-uuid",
    "identifier": "ENG-1234",
    "title": "Implement user authentication",
    "description": "Add OAuth2 support for Google and GitHub",
    "state": { "id": "state-id", "name": "In Progress", "type": "started" },
    "assignee": { "id": "user-456", "name": "Developer", "email": "dev@example.com" },
    "team": { "id": "team-id", "key": "ENG", "name": "Engineering" },
    "priority": 2,
    "labels": [{ "id": "label-id", "name": "feature" }],
    "project": { "id": "proj-id", "name": "Q1 Goals" },
    "cycle": { "id": "cycle-id", "number": 42, "name": "Sprint 42" }
  },
  "updatedFrom": { "stateId": "old-state", "state": { "name": "Todo", "type": "unstarted" } },
  "url": "https://linear.app/company/issue/ENG-1234"
}
```

## Actions

| `action` | Meaning |
|----------|---------|
| `create` | New issue created |
| `update` | Issue field(s) changed |
| `remove` | Issue deleted or archived |

## Detecting What Changed

### Assignment {#assignment}

Assignment changed if `updatedFrom.assigneeId` exists.

**Assigned to you** if:
- `updatedFrom.assigneeId` exists AND
- `data.assignee.email` matches your email

**Unassigned from you** if:
- `updatedFrom.assigneeId` matches your user ID AND
- `data.assignee` is `null` or different email

### State Change {#state}

State changed if `updatedFrom.stateId` or `updatedFrom.state` exists.

Compare `updatedFrom.state.name` → `data.state.name` to see the transition.

### Priority Change

Priority changed if `updatedFrom.priority` exists.

Compare values: `1`=urgent, `2`=high, `3`=medium, `4`=low, `0`=none.

### Other Changes

Check `updatedFrom` for any field that changed:
- `updatedFrom.title` - Title changed
- `updatedFrom.description` - Description changed
- `updatedFrom.projectId` - Moved to different project
- `updatedFrom.cycleId` - Moved to different cycle/sprint

## Field Reference

### state

| `state.type` | Meaning |
|--------------|---------|
| `backlog` | In backlog, not planned |
| `unstarted` | Planned, ready to start |
| `started` | Work in progress |
| `completed` | Done |
| `canceled` | Won't do |

`state.name` is team-customizable (e.g., "In Review", "QA", "Deployed").

To see a team's workflow states: `linctl team get <KEY>`

### priority

| Value | Label |
|-------|-------|
| `0` | No priority |
| `1` | Urgent |
| `2` | High |
| `3` | Medium |
| `4` | Low |

### assignee

```json
{ "id": "user-uuid", "name": "Display Name", "email": "user@example.com" }
```

Value is `null` if unassigned.

### team

```json
{ "id": "team-uuid", "key": "ENG", "name": "Engineering" }
```

Use `team.key` with linctl commands.

### labels

Array of label objects:
```json
[{ "id": "label-id", "name": "bug" }, { "id": "label-id", "name": "urgent" }]
```

May be empty `[]`.

### project

```json
{ "id": "project-uuid", "name": "Project Name" }
```

Value is `null` if not in a project.

### cycle

```json
{ "id": "cycle-uuid", "number": 42, "name": "Sprint 42" }
```

Value is `null` if not in a cycle/sprint.

### Parent/Child Issues

Issues can have parent-child relationships:
- `parent` - Parent issue if this is a sub-issue
- `children` - Array of sub-issues (in detailed responses)

## Responding

| I want to... | Command | Reference |
|--------------|---------|-----------|
| Get full issue details | `linctl issue get ENG-1234` | [linctl/issues.md](../linctl/issues.md#getting) |
| Change status | `linctl issue update ENG-1234 --state "Done"` | [linctl/issues.md](../linctl/issues.md#updating) |
| Add a comment | `linctl comment create ENG-1234 --body "..."` | [linctl/comments.md](../linctl/comments.md#creating) |
| See comments | `linctl comment list ENG-1234` | [linctl/comments.md](../linctl/comments.md#listing) |
| Change assignee | `linctl issue update ENG-1234 --assignee email` | [linctl/issues.md](../linctl/issues.md#updating) |
| Change priority | `linctl issue update ENG-1234 --priority 1` | [linctl/issues.md](../linctl/issues.md#updating) |

For all available flags: `linctl issue update --help`
