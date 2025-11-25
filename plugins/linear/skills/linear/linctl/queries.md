# Query Commands

Commands for reading team, project, and user information.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `linctl team list` | List all teams |
| `linctl team get <KEY>` | Get team details |
| `linctl team members <KEY>` | List team members |
| `linctl project list` | List projects |
| `linctl project get <ID>` | Get project details |
| `linctl user list` | List users |
| `linctl user get <EMAIL>` | Get user details |
| `linctl whoami` | Current authenticated user |

---

## Team Commands {#teams}

### team list

List all teams in the organization.

```bash
linctl team list
linctl team list --json
```

### team get

Get team details including workflow states.

```bash
linctl team get <key>
```

**Example:**
```bash
linctl team get ENG
```

**Output includes:**
- Team name, description
- Workflow states (Todo, In Progress, Done, etc.)
- Issue count
- Cycle/sprint configuration

### team members

List team members with roles and status.

```bash
linctl team members <key>
```

**Example:**
```bash
linctl team members ENG
```

---

## Project Commands {#projects}

### project list

List projects with optional filters.

```bash
linctl project list [flags]
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--team` | Filter by team key |
| `--state` | Filter by state (planned, started, paused, completed, canceled) |
| `--include-completed` | Include completed/canceled projects |
| `--limit` | Max results (default: 50) |
| `--json` | JSON output |

**Examples:**
```bash
linctl project list
linctl project list --team ENG
linctl project list --state started
linctl project list --json
```

### project get

Get detailed project information.

```bash
linctl project get <id>
```

**Note:** Projects use UUIDs, not human-readable identifiers like issues.

**Output includes:**
- Name, description, state
- Progress (0-100%)
- Start/target dates
- Lead
- Associated teams

---

## User Commands {#users}

### user list

List users in the organization.

```bash
linctl user list [flags]
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--active` | Only active users |
| `--json` | JSON output |

### user get

Get user details by email.

```bash
linctl user get <email>
```

**Example:**
```bash
linctl user get jane@example.com
```

### whoami

Show current authenticated user.

```bash
linctl whoami
```

---

## Output Formats

All query commands support:

| Flag | Output |
|------|--------|
| (default) | Formatted table |
| `--json` | JSON for parsing |
| `--plaintext` | Tab-separated values |

**Examples:**
```bash
linctl team list --json
linctl project list --plaintext
linctl user list --json | jq '.[].email'
```
