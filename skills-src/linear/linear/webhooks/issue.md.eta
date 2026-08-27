# Issue Webhooks

> **Official docs**: https://developers.linear.app/docs/graphql/webhooks

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
- `data.assignee` is `null`

**Reassigned from you to someone else** if:
- `updatedFrom.assigneeId` matches your user ID AND
- `data.assignee` is not `null` (different person)

```typescript
// Get your user ID at startup
const viewer = await client.viewer;
const myUserId = viewer?.id;

// Detection logic
const wasUnassignedFromMe =
  webhook.updatedFrom?.assigneeId === myUserId &&
  webhook.data.assignee === null;

const wasReassignedFromMe =
  webhook.updatedFrom?.assigneeId === myUserId &&
  webhook.data.assignee !== null;
```

### State Change {#state}

State changed if `updatedFrom.stateId` or `updatedFrom.state` exists.

Compare `updatedFrom.state.name` → `data.state.name` to see the transition.

### Priority Change {#priority}

Priority changed if `updatedFrom.priority` exists.

**Priority values** (lower number = higher priority):
| Value | Label |
|-------|-------|
| `1` | Urgent |
| `2` | High |
| `3` | Medium |
| `4` | Low |
| `0` | No priority |

**Detect priority escalation** (issue became more urgent):

```typescript
function isPriorityEscalated(webhook) {
  if (!webhook.updatedFrom?.priority) return false;

  const oldPriority = webhook.updatedFrom.priority;
  const newPriority = webhook.data.priority;

  // Lower number = higher priority
  // Escalation: 4→1 (low to urgent), 3→2 (medium to high), etc.
  // Special case: 0 (no priority) is not comparable
  if (oldPriority === 0 || newPriority === 0) return false;

  return newPriority < oldPriority;
}

if (isPriorityEscalated(webhook)) {
  console.log("Issue was escalated!");
}
```

**Detect escalation to urgent specifically:**

```typescript
const escalatedToUrgent =
  webhook.updatedFrom?.priority !== undefined &&
  webhook.updatedFrom.priority > 1 &&
  webhook.data.priority === 1;
```

### Team Change {#team}

Team changed if `updatedFrom.teamId` or `updatedFrom.team` exists.

**Critical**: State IDs are team-specific. When an issue is moved between teams, the state ID must be re-looked-up in the new team, or the old state ID will be invalid.

```typescript
// Detect team change
if (payload.updatedFrom?.teamId || payload.updatedFrom?.team) {
  const oldTeamId = payload.updatedFrom.teamId;
  const newTeamId = payload.data.team.id;
  const oldStateType = payload.updatedFrom.state?.type;

  // Get new team's equivalent state by matching type
  const newTeam = await client.team(newTeamId);
  const newStates = await newTeam.states();
  const newState = newStates.nodes.find(s => s.type === oldStateType);

  // Update issue with new state ID if found
  if (newState) {
    await client.updateIssue(payload.data.id, { stateId: newState.id });
  }
}
```

**Why re-mapping is needed**:
- Each team has its own workflow states with unique IDs
- A state like "In Progress" might have:
  - ENG team: `state-id-123`
  - PLATFORM team: `state-id-456`
- To preserve the issue's work status, match by `state.type` (backlog, unstarted, started, completed, canceled)
- If no matching state type exists in the new team, handle manually or use a default state

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

To see a team's workflow states:
```typescript
const team = await client.team("team-id");
const states = await team.states();
states.nodes.forEach(s => console.log(s.name, s.type, s.id));
```

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

Use `team.id` for SDK operations (e.g., creating issues, getting states).

### labels

Array of label objects:
```json
[{ "id": "label-id", "name": "bug" }, { "id": "label-id", "name": "urgent" }]
```

May be empty `[]`.

#### Detecting Label Changes {#labels-changes}

Label change detected if `updatedFrom.labelIds` exists.

**Compare current labels with previous** to find what changed:

```typescript
// Detect label additions and removals
const previousLabelIds = new Set(webhook.updatedFrom.labelIds || []);
const currentLabelIds = new Set(webhook.data.labels.map(l => l.id));

// Added labels (new IDs not in previous)
const addedLabels = webhook.data.labels.filter(
  label => !previousLabelIds.has(label.id)
);

// Removed labels (IDs that were in previous but not in current)
const removedLabelIds = Array.from(previousLabelIds).filter(
  id => !currentLabelIds.has(id)
);

console.log("Added:", addedLabels.map(l => l.name));
console.log("Removed:", removedLabelIds);
```

**Check if a specific label was added:**

```typescript
function wasLabelAdded(webhook, labelName) {
  const previousLabelIds = new Set(webhook.updatedFrom?.labelIds || []);
  const currentLabels = webhook.data.labels || [];

  return currentLabels.some(
    label => !previousLabelIds.has(label.id) &&
             label.name.toLowerCase() === labelName.toLowerCase()
  );
}

if (wasLabelAdded(webhook, "urgent")) {
  console.log("Urgent label was added!");
}
```

**Check if issue currently has a label:**

```typescript
function hasLabel(webhook, labelName) {
  return (webhook.data.labels || []).some(
    label => label.name.toLowerCase() === labelName.toLowerCase()
  );
}

if (hasLabel(webhook, "blocked")) {
  console.log("Issue is blocked");
}
```

**Map removed label IDs to names** (requires team labels):

```typescript
const team = await client.team(webhook.data.team.id);
const teamLabels = await team.labels();
const labelMap = new Map(
  teamLabels.nodes.map(l => [l.id, l.name])
);

const removedNames = removedLabelIds.map(
  id => labelMap.get(id)
).filter(Boolean);

console.log("Removed label names:", removedNames);
```

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

### Parent/Child Issues {#parent-child}

Issues can have parent-child relationships:
- `parent` - Parent issue if this is a sub-issue (`null` if top-level)
- `children` - Array of sub-issues (in detailed responses)

**Detect sub-issue created:**

```typescript
// New sub-issue created (has parent on create)
const isNewSubIssue =
  webhook.action === "create" &&
  webhook.data.parent !== null;

if (isNewSubIssue) {
  console.log("Sub-issue of:", webhook.data.parent.identifier);
}
```

**Detect issue converted to sub-issue:**

```typescript
// Issue was made a sub-issue (parent added via update)
const convertedToSubIssue =
  webhook.action === "update" &&
  webhook.updatedFrom?.parentId === null &&
  webhook.data.parent !== null;
```

**Detect issue removed from parent:**

```typescript
// Issue was promoted from sub-issue to standalone
const removedFromParent =
  webhook.action === "update" &&
  webhook.updatedFrom?.parentId !== undefined &&
  webhook.data.parent === null;
```

**SDK: Navigate parent/child hierarchy:**

```typescript
const issue = await client.issue("ENG-1234");

// Get parent (returns undefined for top-level, not null)
const parent = await issue.parent;
if (parent) {
  console.log("Parent:", parent.identifier);
}

// Get children
const children = await issue.children();
children.nodes.forEach(child => {
  console.log("Child:", child.identifier);
});
```

**Note:** `issue.parent` returns `undefined` (not `null`) for issues without a parent.

## Responding

| I want to... | SDK Operation | Reference |
|--------------|---------------|-----------|
| Get full issue details | `await client.issue("ENG-1234")` | [sdk/issues.md](../sdk/issues.md#getting) |
| Change status | `await client.updateIssue(id, { stateId })` | [sdk/issues.md](../sdk/issues.md#updating) |
| Add a comment | `await client.createComment({ issueId, body })` | [sdk/comments.md](../sdk/comments.md#creating) |
| See comments | `const comments = await issue.comments()` | [sdk/comments.md](../sdk/comments.md#listing) |
| Change assignee | `await client.updateIssue(id, { assigneeId })` | [sdk/issues.md](../sdk/issues.md#updating) |
| Change priority | `await client.updateIssue(id, { priority })` | [sdk/issues.md](../sdk/issues.md#updating) |

See [sdk/issues.md](../sdk/issues.md) for complete SDK reference.
