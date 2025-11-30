# Issue Operations

> **Official docs**: https://developers.linear.app/docs/sdk/getting-started

## Quick Reference

| Operation | SDK Method |
|-----------|------------|
| List issues | `client.issues({ filter, first })` |
| My assigned issues | `me.assignedIssues()` |
| Get single issue | `client.issue(id)` |
| Search issues | `client.searchIssues(term)` |
| Create issue | `client.createIssue(input)` |
| Update issue | `client.updateIssue(id, input)` |

---

## Setup

All examples use the Linear TypeScript SDK with `tsx -e` inline execution:

```bash
tsx -e '
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

// Your code here
'
```

**IMPORTANT**: Always use inline `tsx -e` execution rather than writing script files.

---

## Listing Issues {#listing}

```typescript
// Basic listing (returns first 50)
const issues = await client.issues();
issues.nodes.forEach(i => console.log(i.identifier, i.title));

// Limit results
const issues = await client.issues({ first: 10 });

// Filter by team
const issues = await client.issues({
  filter: { team: { key: { eq: "ENG" } } },
  first: 20
});

// Filter by state type
const issues = await client.issues({
  filter: { state: { type: { eq: "started" } } }
});

// Multiple filters
const issues = await client.issues({
  filter: {
    team: { key: { eq: "ENG" } },
    state: { type: { eq: "started" } },
    priority: { lte: 2 }  // Urgent or High
  }
});

// My assigned issues
const me = await client.viewer;
const myIssues = await me.assignedIssues({ first: 10 });
```

### Common Filters

| Filter | Example |
|--------|---------|
| By team key | `{ team: { key: { eq: "ENG" } } }` |
| By team ID | `{ team: { id: { eq: "uuid" } } }` |
| By state type | `{ state: { type: { eq: "started" } } }` |
| By state name | `{ state: { name: { eq: "In Progress" } } }` |
| By priority | `{ priority: { eq: 1 } }` |
| Priority <= value | `{ priority: { lte: 2 } }` |
| By assignee email | `{ assignee: { email: { eq: "user@example.com" } } }` |
| Unassigned | `{ assignee: { null: true } }` |
| Combined (AND) | `{ team: {...}, state: {...} }` |

### State Type Values

| Value | Meaning |
|-------|---------|
| `backlog` | In backlog |
| `unstarted` | Ready to start |
| `started` | In progress |
| `completed` | Done |
| `canceled` | Won't do |

---

## Getting Issue Details {#getting}

```typescript
// By identifier (e.g., ENG-1234)
const issue = await client.issue("ENG-1234");

// Or by UUID
const issue = await client.issue("a1b2c3d4-...");

// Direct properties
console.log(issue.identifier);   // "ENG-1234"
console.log(issue.title);        // "Issue title"
console.log(issue.description);  // Markdown content
console.log(issue.priority);     // 0-4
console.log(issue.url);          // Link to Linear

// Related data (async - must await)
const state = await issue.state;
console.log(state?.name, state?.type);

const assignee = await issue.assignee;
console.log(assignee?.displayName, assignee?.email);

const team = await issue.team;
console.log(team?.key, team?.name);

const labels = await issue.labels();
labels.nodes.forEach(l => console.log(l.name));

const comments = await issue.comments();
comments.nodes.forEach(c => console.log(c.body));

const project = await issue.project;
const cycle = await issue.cycle;
const parent = await issue.parent;
const children = await issue.children();
```

### Issue Properties

| Property | Type | Description |
|----------|------|-------------|
| `identifier` | string | Human-readable ID (e.g., "ENG-1234") |
| `id` | string | UUID |
| `title` | string | Issue title |
| `description` | string | Markdown description |
| `priority` | number | 0=none, 1=urgent, 2=high, 3=normal, 4=low |
| `url` | string | Link to issue in Linear |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

### Related Data (async)

| Method/Property | Returns | Description |
|-----------------|---------|-------------|
| `issue.state` | WorkflowState | Current status |
| `issue.assignee` | User | Assigned user |
| `issue.team` | Team | Parent team |
| `issue.project` | Project | Associated project |
| `issue.cycle` | Cycle | Associated cycle/sprint |
| `issue.labels()` | LabelConnection | Issue labels |
| `issue.comments()` | CommentConnection | Comments |
| `issue.parent` | Issue \| undefined | Parent issue (⚠️ returns `undefined`, not `null`) |
| `issue.children()` | IssueConnection | Sub-issues |

**Note**: `issue.parent` and `issue.assignee` return `undefined` (not `null`) when unset. Use `!parent` or `parent === undefined` for checks.

---

## Searching Issues {#searching}

```typescript
// Full-text search across titles and descriptions
const results = await client.searchIssues("authentication bug");

console.log("Found:", results.nodes.length, "issues");
results.nodes.forEach(issue => {
  console.log(issue.identifier, "-", issue.title);
});

// With filters
const results = await client.searchIssues("login error", {
  filter: { team: { key: { eq: "ENG" } } }
});
```

---

## Creating Issues {#creating}

```typescript
// Get team ID first
const teams = await client.teams();
const team = teams.nodes.find(t => t.key === "ENG");

// Minimal (requires teamId)
const payload = await client.createIssue({
  teamId: team.id,
  title: "Fix login bug"
});
const issue = await payload.issue;
console.log("Created:", issue?.identifier);

// With all common fields
const payload = await client.createIssue({
  teamId: team.id,
  title: "Implement OAuth",
  description: "Add Google OAuth support.\n\n**Requirements:**\n- Sign in\n- Sign up",
  priority: 2,           // High priority
  stateId: "state-uuid", // Specific workflow state
  assigneeId: "user-uuid",
  labelIds: ["label-uuid-1", "label-uuid-2"],
  projectId: "project-uuid",
  cycleId: "cycle-uuid"
});
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `teamId` | string | Team UUID (required) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Issue title |
| `description` | string | Markdown description |
| `priority` | number | 0=none, 1=urgent, 2=high, 3=normal, 4=low |
| `stateId` | string | Workflow state UUID |
| `assigneeId` | string | Assignee user UUID |
| `labelIds` | string[] | Array of label UUIDs |
| `projectId` | string | Project UUID |
| `cycleId` | string | Cycle UUID |
| `parentId` | string | Parent issue UUID (for sub-issues) |
| `dueDate` | string | Due date (YYYY-MM-DD format) |
| `estimate` | number | Story points estimate |

### Getting IDs for Creation

```typescript
// Team ID
const teams = await client.teams();
const team = teams.nodes.find(t => t.key === "ENG");
console.log("Team ID:", team?.id);

// Workflow state ID
const states = await team.states();
const todoState = states.nodes.find(s => s.name === "Todo");
console.log("State ID:", todoState?.id);

// User ID (for assignee)
const users = await client.users();
const user = users.nodes.find(u => u.email === "user@example.com");
console.log("User ID:", user?.id);

// Current user ID
const me = await client.viewer;
console.log("My ID:", me.id);
```

---

## Updating Issues {#updating}

```typescript
// Get issue ID (either from issue.id or use identifier)
const issue = await client.issue("ENG-1234");

// Change status
await client.updateIssue(issue.id, {
  stateId: "done-state-uuid"
});

// Change priority
await client.updateIssue(issue.id, {
  priority: 1  // Urgent
});

// Assign to user
await client.updateIssue(issue.id, {
  assigneeId: "user-uuid"
});

// Unassign
await client.updateIssue(issue.id, {
  assigneeId: null
});

// Multiple changes at once
await client.updateIssue(issue.id, {
  stateId: "in-progress-uuid",
  priority: 2,
  assigneeId: "user-uuid"
});

// Update title/description
await client.updateIssue(issue.id, {
  title: "Updated title",
  description: "New description with **markdown**"
});

// Add labels
await client.updateIssue(issue.id, {
  addedLabelIds: ["label-uuid-1", "label-uuid-2"]
});

// Remove labels
await client.updateIssue(issue.id, {
  removedLabelIds: ["label-uuid"]
});
```

### Update Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | New title |
| `description` | string | New description (markdown) |
| `stateId` | string | New workflow state UUID |
| `assigneeId` | string \| null | Assignee UUID (null to unassign) |
| `priority` | number | New priority (0-4) |
| `addedLabelIds` | string[] | Labels to add |
| `removedLabelIds` | string[] | Labels to remove |
| `projectId` | string \| null | Project assignment |
| `cycleId` | string \| null | Cycle assignment |
| `dueDate` | string \| null | Due date (YYYY-MM-DD) |

---

## Assign to Yourself {#assigning}

```typescript
const me = await client.viewer;
const issue = await client.issue("ENG-1234");

await client.updateIssue(issue.id, {
  assigneeId: me.id
});
```

---

## Complete Example

```bash
# Create issue, assign to self, and start work
tsx -e '
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

// Get team and "In Progress" state
const teams = await client.teams();
const team = teams.nodes.find(t => t.key === "ENG");
const states = await team!.states();
const inProgress = states.nodes.find(s => s.name === "In Progress");

// Create issue
const payload = await client.createIssue({
  teamId: team!.id,
  title: "Investigate login failure",
  description: "Users reporting intermittent login issues",
  priority: 2
});

const issue = await payload.issue;
console.log("Created:", issue?.identifier);

// Assign to self and start work
const me = await client.viewer;
await client.updateIssue(issue!.id, {
  assigneeId: me.id,
  stateId: inProgress?.id
});

console.log("Assigned and started:", issue?.identifier);
'
```
