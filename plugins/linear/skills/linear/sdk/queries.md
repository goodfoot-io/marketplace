# Query Operations

> **Official docs**: https://developers.linear.app/docs/sdk/getting-started

Read-only operations for teams, projects, users, and workflow states.

## Quick Reference

| Operation | SDK Method |
|-----------|------------|
| List teams | `client.teams()` |
| Get team | `client.team(id)` |
| Team workflow states | `team.states()` |
| Team members | `team.members()` |
| Team labels | `team.labels()` |
| List projects | `client.projects()` |
| Get project | `client.project(id)` |
| List users | `client.users()` |
| Get user | `client.user(id)` |
| Current user | `client.viewer` |
| List cycles | `client.cycles()` |

---

## Setup

```bash
tsx -e '
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

// Your code here
'
```

**IMPORTANT**: Always use inline `tsx -e` execution rather than writing script files.

---

## Team Operations {#teams}

### List Teams

```typescript
const teams = await client.teams();

teams.nodes.forEach(team => {
  console.log(team.key, "-", team.name);
  console.log("  ID:", team.id);
});
```

### Get Team by ID

```typescript
const team = await client.team("team-uuid");

console.log("Team:", team.key, "-", team.name);
console.log("Description:", team.description);
```

### Team Workflow States

Essential for creating/updating issues with correct state IDs:

```typescript
const teams = await client.teams();
const team = teams.nodes.find(t => t.key === "ENG");

const states = await team!.states();

console.log("Workflow states for", team!.key + ":");
states.nodes.forEach(state => {
  console.log("  ", state.name);
  console.log("    Type:", state.type);
  console.log("    ID:", state.id);
});
```

### State Type Values

| Type | Meaning |
|------|---------|
| `backlog` | In backlog, not yet planned |
| `unstarted` | Planned, ready to start |
| `started` | Work in progress |
| `completed` | Done |
| `canceled` | Won't do |

**Warning**: Multiple states can share the same type. For example, a team might have both "Canceled" and "Duplicate" states with type `canceled`. When finding by type, you'll get the first match.

### Team Members

```typescript
const team = await client.team("team-uuid");
const members = await team.members();

console.log("Members of", team.key + ":");
members.nodes.forEach(member => {
  console.log("  ", member.displayName);
  console.log("    Email:", member.email);
  console.log("    ID:", member.id);
});
```

### Team Labels

Get all labels available for a team:

```typescript
const team = await client.team("team-uuid");
const labels = await team.labels();

console.log("Labels for", team.key + ":");
labels.nodes.forEach(label => {
  console.log("  -", label.name);
  console.log("    ID:", label.id);
  console.log("    Color:", label.color);
});
```

**Use case: Resolve label IDs from webhooks**

```typescript
// In a webhook handler, you might receive removed label IDs
// Use team.labels() to map them back to names

const webhook = {
  updatedFrom: { labelIds: ["label-id-1", "label-id-2"] }
};

const team = await client.team(teamId);
const teamLabels = await team.labels();
const labelMap = new Map(teamLabels.nodes.map(l => [l.id, l.name]));

const removedNames = webhook.updatedFrom.labelIds
  .map(id => labelMap.get(id))
  .filter(Boolean);

console.log("Removed labels:", removedNames);
```

### Team Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Team UUID |
| `key` | string | Short identifier (e.g., "ENG") |
| `name` | string | Full team name |
| `description` | string | Team description |

---

## Project Operations {#projects}

### List Projects

```typescript
const projects = await client.projects({ first: 20 });

projects.nodes.forEach(project => {
  console.log(project.name);
  console.log("  State:", project.state);
  console.log("  Progress:", Math.round(project.progress * 100) + "%");
  console.log("  ID:", project.id);
});

// Filter by state
const activeProjects = await client.projects({
  filter: { state: { eq: "started" } }
});
```

### Project States

| State | Meaning |
|-------|---------|
| `planned` | Not yet started |
| `started` | In progress |
| `paused` | Temporarily stopped |
| `completed` | Finished |
| `canceled` | Abandoned |

### Get Project Details

```typescript
const project = await client.project("project-uuid");

console.log("Project:", project.name);
console.log("Description:", project.description);
console.log("State:", project.state);
console.log("Progress:", Math.round(project.progress * 100) + "%");
console.log("Start date:", project.startDate);
console.log("Target date:", project.targetDate);

// Get project lead
const lead = await project.lead;
console.log("Lead:", lead?.displayName);

// Get associated teams
const teams = await project.teams();
teams.nodes.forEach(t => console.log("  Team:", t.key));

// Get project issues
const issues = await project.issues();
console.log("Issues:", issues.nodes.length);
```

### Project Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Project UUID |
| `name` | string | Project name |
| `description` | string | Project description |
| `state` | string | planned/started/paused/completed/canceled |
| `progress` | number | 0.0 to 1.0 (multiply by 100 for %) |
| `startDate` | string | Start date |
| `targetDate` | string | Target completion date |

---

## User Operations {#users}

### List Users

```typescript
const users = await client.users();

users.nodes.forEach(user => {
  console.log(user.displayName);
  console.log("  Email:", user.email);
  console.log("  Active:", user.active);
  console.log("  ID:", user.id);
});

// Filter active users only
const activeUsers = await client.users({
  filter: { active: { eq: true } }
});
```

### Get User by ID

```typescript
const user = await client.user("user-uuid");

console.log("User:", user.displayName);
console.log("Email:", user.email);
console.log("Admin:", user.admin);

// Get user's assigned issues
const assignedIssues = await user.assignedIssues({ first: 10 });
```

### Current User (Viewer)

```typescript
const me = await client.viewer;

console.log("Logged in as:", me.displayName);
console.log("Email:", me.email);
console.log("ID:", me.id);

// Get my assigned issues
const myIssues = await me.assignedIssues();
myIssues.nodes.forEach(i => console.log("  ", i.identifier, "-", i.title));
```

### User Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | User UUID |
| `displayName` | string | Display name (use this for display!) |
| `email` | string | Email address |
| `name` | string | ⚠️ This is the email, NOT the display name |
| `active` | boolean | Is active user |
| `admin` | boolean | Is admin |

**Warning**: `user.name` returns the email address, not the display name. Use `user.displayName` instead.

---

## Cycle Operations {#cycles}

### List Cycles

```typescript
const cycles = await client.cycles({ first: 10 });

cycles.nodes.forEach(cycle => {
  console.log(cycle.name || `Cycle ${cycle.number}`);
  console.log("  Number:", cycle.number);
  console.log("  Starts:", cycle.startsAt);
  console.log("  Ends:", cycle.endsAt);
  console.log("  ID:", cycle.id);
});

// Get active cycle for a team
const team = await client.team("team-uuid");
const activeCycle = await team.activeCycle;
console.log("Active cycle:", activeCycle?.name);
```

### Cycle Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Cycle UUID |
| `number` | number | Cycle number |
| `name` | string | Cycle name (optional) |
| `startsAt` | Date | Start date |
| `endsAt` | Date | End date |
| `progress` | number | 0.0 to 1.0 |

---

## Finding IDs

Common pattern for finding IDs needed for create/update operations:

```typescript
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

// Find team ID by key
const teams = await client.teams();
const eng = teams.nodes.find(t => t.key === "ENG");
console.log("Team ID:", eng?.id);

// Find workflow state ID by name
const states = await eng!.states();
const inProgress = states.nodes.find(s => s.name === "In Progress");
console.log("'In Progress' state ID:", inProgress?.id);

// Find user ID by email
const users = await client.users();
const jane = users.nodes.find(u => u.email === "jane@example.com");
console.log("Jane's ID:", jane?.id);

// Current user ID
const me = await client.viewer;
console.log("My ID:", me.id);
```

---

## Complete Example

```bash
# Get all teams, workflow states, and projects overview
tsx -e '
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

// Get all teams and their workflow states
const teams = await client.teams();

for (const team of teams.nodes) {
  console.log("\n=== Team:", team.key, "-", team.name, "===");

  // Members
  const members = await team.members();
  console.log("\nMembers:");
  members.nodes.forEach(m => console.log("  -", m.displayName, `(${m.email})`));

  // Workflow states
  const states = await team.states();
  console.log("\nWorkflow States:");
  states.nodes.forEach(s => console.log("  -", s.name, `(${s.type})`));

  // Active cycle
  const cycle = await team.activeCycle;
  if (cycle) {
    console.log("\nActive Cycle:", cycle.name || `Cycle ${cycle.number}`);
  }
}

// Projects overview
const projects = await client.projects();
console.log("\n=== Projects ===");
projects.nodes.forEach(p => {
  console.log("-", p.name, `(${p.state}, ${Math.round(p.progress * 100)}%)`);
});
'
```
