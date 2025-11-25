# Issue Commands

## Quick Reference

| Command | Purpose |
|---------|---------|
| `linctl issue list` | List issues with filters |
| `linctl issue get <ID>` | Get issue details |
| `linctl issue search "query"` | Full-text search |
| `linctl issue create` | Create new issue |
| `linctl issue update <ID>` | Update issue fields |
| `linctl issue assign <ID>` | Assign to yourself |

For complete flags: `linctl issue <command> --help`

---

## Listing Issues {#listing}

```bash
linctl issue list [flags]
```

### Common Flags

| Flag | Example | Description |
|------|---------|-------------|
| `--assignee` | `--assignee me` | Filter by assignee (email or `me`) |
| `--team` | `--team ENG` | Filter by team key |
| `--state` | `--state "In Progress"` | Filter by state name |
| `--priority` | `--priority 1` | Filter by priority (0-4) |
| `--include-completed` | `-c` | Include completed/canceled |
| `--limit` | `--limit 20` | Max results (default: 50) |
| `--newer-than` | `--newer-than 1_week_ago` | Time filter |
| `--json` | `--json` | JSON output |

### Examples

```bash
# My assigned issues
linctl issue list --assignee me

# Team's high-priority issues
linctl issue list --team ENG --priority 1

# Issues in specific state
linctl issue list --state "In Review"

# Include completed issues
linctl issue list --assignee me --include-completed

# JSON for parsing
linctl issue list --team ENG --json
```

### Time Filters

| Value | Meaning |
|-------|---------|
| `1_day_ago` | Last 24 hours |
| `1_week_ago` | Last 7 days |
| `2_weeks_ago` | Last 14 days |
| `1_month_ago` | Last 30 days |
| `6_months_ago` | Default |
| `1_year_ago` | Last year |
| `all_time` | No time filter |
| `2025-01-01` | Since specific date |

---

## Getting Issue Details {#getting}

```bash
linctl issue get <identifier>
```

### Arguments

`<identifier>` - Issue ID like `ENG-1234` or UUID

### Examples

```bash
linctl issue get ENG-1234
linctl issue get ENG-1234 --json
```

### Output Includes

- Title, description
- State, priority
- Assignee, team
- Project, cycle
- Labels
- Comments
- Parent/child relationships
- Git branch info
- Attachments

---

## Searching Issues {#searching}

```bash
linctl issue search "query" [flags]
```

Full-text search across issue titles and descriptions.

### Examples

```bash
linctl issue search "authentication bug"
linctl issue search "API error" --team ENG
linctl issue search "login" --limit 10
```

---

## Creating Issues {#creating}

```bash
linctl issue create [flags]
```

### Required Flags

| Flag | Description |
|------|-------------|
| `--title` | Issue title |
| `--team` | Team key (e.g., `ENG`) |

### Optional Flags

| Flag | Example | Description |
|------|---------|-------------|
| `--description` | `--description "Details..."` | Issue body (markdown) |
| `--assignee` | `--assignee user@example.com` | Assignee email or `me` |
| `--state` | `--state "Todo"` | Initial state |
| `--priority` | `--priority 2` | Priority (0-4) |
| `--labels` | `--labels "bug,urgent"` | Comma-separated labels |

### Examples

```bash
# Minimal
linctl issue create --title "Fix login bug" --team ENG

# With details
linctl issue create \
  --title "Implement OAuth" \
  --team ENG \
  --description "Add Google OAuth support" \
  --priority 2 \
  --assignee me \
  --state "Todo"
```

---

## Updating Issues {#updating}

```bash
linctl issue update <identifier> [flags]
```

### Flags

| Flag | Example | Description |
|------|---------|-------------|
| `--title` | `--title "New title"` | Change title |
| `--description` | `--description "New desc"` | Change description |
| `--state` | `--state "Done"` | Change state |
| `--assignee` | `--assignee user@example.com` | Change assignee |
| `--priority` | `--priority 1` | Change priority |

### Examples

```bash
# Mark done
linctl issue update ENG-1234 --state "Done"

# Change assignee
linctl issue update ENG-1234 --assignee jane@example.com

# Multiple changes
linctl issue update ENG-1234 --state "In Progress" --priority 1

# Unassign
linctl issue update ENG-1234 --assignee ""
```

---

## Assigning to Yourself {#assigning}

```bash
linctl issue assign <identifier>
```

Shortcut for `linctl issue update <ID> --assignee me`.

### Example

```bash
linctl issue assign ENG-1234
```
