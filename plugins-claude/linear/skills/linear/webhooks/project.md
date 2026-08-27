# Project Webhooks

> **Official docs**: https://developers.linear.app/docs/graphql/webhooks

This file covers both `Project` and `ProjectUpdate` webhook types.

---

## Project Webhooks

Project metadata changes (name, dates, state, etc.).

### Example Payload

```json
{
  "action": "update",
  "type": "Project",
  "actor": { "id": "user-111", "name": "Project Lead", "email": "lead@example.com" },
  "data": {
    "id": "project-uuid",
    "name": "Q1 Authentication Overhaul",
    "description": "Modernize the auth system",
    "state": "started",
    "progress": 0.65,
    "startDate": "2025-01-01",
    "targetDate": "2025-03-31",
    "lead": { "id": "user-111", "name": "Project Lead" },
    "teams": [{ "id": "team-id", "key": "ENG" }]
  },
  "updatedFrom": { "progress": 0.60 },
  "url": "https://linear.app/company/project/project-uuid"
}
```

### Actions

| `action` | Meaning |
|----------|---------|
| `create` | New project created |
| `update` | Project field(s) changed |
| `remove` | Project deleted or archived |

### Field Reference

#### state

| Value | Meaning |
|-------|---------|
| `planned` | Not yet started |
| `started` | Active work |
| `paused` | Temporarily stopped |
| `completed` | Finished |
| `canceled` | Abandoned |

#### progress

Float from `0.0` to `1.0`:
- `0.0` = 0% complete
- `0.65` = 65% complete
- `1.0` = 100% complete

#### lead

Project owner:
```json
{ "id": "user-uuid", "name": "Display Name" }
```

#### teams

Associated teams:
```json
[{ "id": "team-uuid", "key": "ENG" }]
```

#### startDate / targetDate

ISO date strings: `"2025-01-01"`

---

## ProjectUpdate Webhooks

Status posts about project progress. These are written updates, not automatic changes.

### Example Payload

```json
{
  "action": "create",
  "type": "ProjectUpdate",
  "actor": { "id": "user-222", "name": "PM", "email": "pm@example.com" },
  "data": {
    "id": "update-uuid",
    "body": "Sprint complete. Auth feature shipped. @claude please prioritize ENG-7890.",
    "health": "atRisk",
    "project": {
      "id": "project-uuid",
      "name": "Q1 Authentication Overhaul",
      "state": "started",
      "progress": 0.65
    }
  },
  "url": "https://linear.app/company/project/project-uuid/update/update-uuid"
}
```

### Actions

| `action` | Meaning |
|----------|---------|
| `create` | New status update posted |
| `update` | Update edited |
| `remove` | Update deleted |

### Detecting Mentions

Like comments, mentions appear as `@username` in `data.body`:

```typescript
const body = webhook.data.body;
const wasMentioned = /@claude\b/i.test(body);
const allMentions = body.match(/@[\w-]+/g) || [];
```

### Extracting Issue References

Project updates often reference issues:

```typescript
const body = webhook.data.body;
const issueRefs = body.match(/[A-Z]+-\d+/g) || [];
// ["ENG-7890", "BUG-123"]

for (const ref of issueRefs) {
  const issue = await client.issue(ref);
  console.log(issue.identifier, "-", issue.title);
}
```

### Field Reference

#### health

Project health indicator:

| Value | Meaning |
|-------|---------|
| `onTrack` | Progressing as planned |
| `atRisk` | May miss deadlines |
| `offTrack` | Behind schedule |

#### body

Markdown text of the status update. May contain:
- `@mentions`
- Issue references like `ENG-1234`
- Status information

#### project

The parent project (embedded, not just ID):

```json
{
  "id": "project-uuid",
  "name": "Project Name",
  "state": "started",
  "progress": 0.65
}
```

---

## Responding

| I want to... | SDK Operation | Reference |
|--------------|---------------|-----------|
| Get project details | `await client.project("project-uuid")` | [sdk/queries.md](../sdk/queries.md#projects) |
| List project's issues | `const issues = await project.issues()` | [sdk/queries.md](../sdk/queries.md#projects) |
| Get a referenced issue | `await client.issue("ENG-7890")` | [sdk/issues.md](../sdk/issues.md#getting) |

**Note:** The SDK can read ProjectUpdates via `client.projectUpdates()` but cannot create them directly. Use Linear UI for status updates.

See [sdk/queries.md](../sdk/queries.md#projects) for complete project operations.
