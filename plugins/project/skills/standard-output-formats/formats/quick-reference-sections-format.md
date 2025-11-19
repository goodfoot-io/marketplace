Use this component when:
- Users need quick command references
- Providing cheat sheets or quick starts
- Documenting keyboard shortcuts or CLI commands
- Creating API endpoint summaries
- Building quick configuration templates

**Example user message:**
Give me a quick reference for all the Git commands I need for our workflow.

## Template

## [Tool/System] Quick Reference

### Essential Commands
```bash
# [Category 1]
[command 1]                    # [Description]
[command 2] [args]            # [Description]

# [Category 2]
[command 3] --flag            # [Description]
[command 4] "[value]"         # [Description]

# [Category 3]
[command 5] | [command 6]     # [Description]
```

### Common Operations
```text
Task                         Command                          Notes
────────────────────────────────────────────────────────────────────
[Task description 1]         [command]                       [Important note]
[Task description 2]         [command with arguments]        [Gotcha/tip]
[Task description 3]         [multi-step && command]         [When to use]
[Task description 4]         [complex | piped | command]     [Expected output]
```

### Configuration Snippets
```yaml
# Minimal [configuration type]
[setting1]: [value]
[setting2]: [value]

# Production [configuration type]
[setting1]: [production_value]
[setting2]: [production_value]
[setting3]:
  [nested1]: [value]
  [nested2]: [value]
```

### API Endpoints Quick Reference
```text
Method   Endpoint                    Description              Auth Required
────────────────────────────────────────────────────────────────────────────
GET      /[resource]                List all [resources]     No
GET      /[resource]/{id}          Get single [resource]    No
POST     /[resource]               Create [resource]        Yes
PUT      /[resource]/{id}          Update [resource]        Yes
DELETE   /[resource]/{id}          Delete [resource]        Yes
POST     /[resource]/{id}/[action] Perform [action]         Yes
```

### Keyboard Shortcuts
```text
Action                  Windows/Linux        macOS              Context
──────────────────────────────────────────────────────────────────────
[Action 1]              Ctrl+[Key]          ⌘+[Key]            [Where available]
[Action 2]              Alt+[Key]           ⌥+[Key]            [Where available]
[Action 3]              Ctrl+Shift+[Key]    ⌘+⇧+[Key]          [Where available]
[Action 4]              F[Number]           F[Number]          [Where available]
```

### Environment Variables
```bash
# Required
export [VAR1]="[value]"              # [Description]
export [VAR2]="[value]"              # [Description]

# Optional
export [VAR3]="${[VAR3]:-default}"   # [Description] (default: [value])
export [VAR4]="${[VAR4]:-}"          # [Description] (optional)
```
