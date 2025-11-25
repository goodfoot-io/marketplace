# Comment Commands

## Quick Reference

| Command | Purpose |
|---------|---------|
| `linctl comment list <ID>` | List comments on an issue |
| `linctl comment create <ID>` | Add a comment to an issue |

For complete flags: `linctl comment <command> --help`

---

## Listing Comments {#listing}

```bash
linctl comment list <identifier>
```

### Arguments

`<identifier>` - Issue ID like `ENG-1234` or UUID

### Examples

```bash
linctl comment list ENG-1234
linctl comment list ENG-1234 --json
```

### Output Includes

- Comment body (markdown)
- Author name and email
- Created/edited timestamps
- Reactions

---

## Creating Comments {#creating}

```bash
linctl comment create <identifier> --body "message"
```

### Arguments

`<identifier>` - Issue ID like `ENG-1234` or UUID

### Required Flags

| Flag | Description |
|------|-------------|
| `--body` | Comment text (markdown supported) |

### Examples

```bash
# Simple comment
linctl comment create ENG-1234 --body "Looking into this now."

# With markdown
linctl comment create ENG-1234 --body "## Investigation

Found the issue in \`src/auth.ts\`:
- Line 45 had incorrect null check
- Fixed in PR #123"

# With @mention
linctl comment create ENG-1234 --body "@jane I've fixed this, ready for review."
```

### Multiline Comments

For longer comments, use shell quoting:

```bash
linctl comment create ENG-1234 --body "First line.

Second paragraph here.

- Bullet point
- Another point"
```

### Notes

- Comments are created as **top-level comments**
- Thread replies require Linear UI or API directly
- Markdown formatting is preserved
- `@mentions` work: include `@username` in body text
- Issue references like `ENG-5678` are auto-linked
