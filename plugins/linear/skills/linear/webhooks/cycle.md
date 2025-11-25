# Cycle Webhooks

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

| I want to... | Command |
|--------------|---------|
| Get team info | `linctl team get ENG` |
| List team's issues | `linctl issue list --team ENG` |

**Note:** linctl has limited cycle support. Issues include cycle info when retrieved with `linctl issue get`.

For team flags: `linctl team get --help`
