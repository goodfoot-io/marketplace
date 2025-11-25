# Cycle Webhooks

> **Official docs**: https://developers.linear.app/docs/graphql/webhooks

Cycles are time-boxed iterations (sprints) that group issues.

## Example Payload

```json
{
  "action": "update",
  "type": "Cycle",
  "actor": { "id": "user-123", "name": "Scrum Master", "email": "sm@example.com" },
  "data": {
    "id": "cycle-uuid",
    "number": 42,
    "name": "Sprint 42",
    "startsAt": "2025-01-13T00:00:00.000Z",
    "endsAt": "2025-01-27T00:00:00.000Z",
    "team": { "id": "team-id", "key": "ENG" },
    "progress": 0.75,
    "scope": 34,
    "completedScope": 25
  },
  "updatedFrom": { "progress": 0.65, "completedScope": 22 },
  "url": "https://linear.app/company/team/ENG/cycle/42"
}
```

## Actions

| `action` | Meaning |
|----------|---------|
| `create` | New cycle created |
| `update` | Cycle field(s) changed |
| `remove` | Cycle deleted |

## Field Reference

### number

Integer cycle/sprint number (e.g., `42`).

### name

Display name (e.g., `"Sprint 42"`).

### startsAt / endsAt

ISO timestamps for cycle boundaries.

### team

The team this cycle belongs to:

```json
{ "id": "team-uuid", "key": "ENG" }
```

### progress

Float from `0.0` to `1.0` representing completion:
- `0.0` = 0% complete
- `0.75` = 75% complete
- `1.0` = 100% complete

### scope

Total number of issues or points in the cycle.

### completedScope

Number of completed issues or points.

## Detecting Changes

Check `updatedFrom` for what changed:
- `updatedFrom.progress` - Completion changed
- `updatedFrom.completedScope` - Issues completed
- `updatedFrom.scope` - Issues added/removed
- `updatedFrom.startsAt` / `endsAt` - Dates changed

## Responding

| I want to... | SDK Operation | Reference |
|--------------|---------------|-----------|
| Get cycle details | `await client.cycle("cycle-uuid")` | [sdk/queries.md](../sdk/queries.md#cycles) |
| Get team's active cycle | `await team.activeCycle` | [sdk/queries.md](../sdk/queries.md#cycles) |
| List cycles | `await client.cycles({ first: 10 })` | [sdk/queries.md](../sdk/queries.md#cycles) |
| Get cycle's issues | `const issues = await cycle.issues()` | [sdk/queries.md](../sdk/queries.md#cycles) |

The SDK provides full cycle access:

```typescript
// Get cycle details
const cycle = await client.cycle("cycle-uuid");
console.log(cycle.name, cycle.progress);

// Get team's active cycle
const team = await client.team("team-id");
const activeCycle = await team.activeCycle;
console.log("Active:", activeCycle?.name);

// Get issues in the cycle
const issues = await cycle.issues();
issues.nodes.forEach(i => console.log(i.identifier, i.title));
```

See [sdk/queries.md](../sdk/queries.md#cycles) for complete cycle operations.
