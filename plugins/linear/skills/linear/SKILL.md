---
name: linear
description: Reference for Linear webhooks and TypeScript SDK. Use when receiving
  Linear webhook payloads, responding to issues or comments, changing issue status,
  or querying Linear state via the @linear/sdk package.
---

# Linear Reference (SDK)

```!
# === Linear Skill Environment Check ===
BLOCKED=""

# 1. API Key check
if [ -z "$LINEAR_API_KEY" ]; then
  BLOCKED="yes"
  echo "❌ BLOCKED: LINEAR_API_KEY not set"
  echo ""
  echo "STOP. Do not attempt Linear operations."
  echo "Ask user to set their API key:"
  echo "  export LINEAR_API_KEY=lin_api_..."
  echo ""
  echo "Get key from: Linear → Settings → API → Personal API keys"
else
  case "$LINEAR_API_KEY" in
    lin_api_*)
      echo "✓ Linear API key set (${LINEAR_API_KEY:0:12}...)"
      ;;
    *)
      # Non-standard format - warn but don't block (might still work)
      echo "✓ LINEAR_API_KEY set (${LINEAR_API_KEY:0:8}...)"
      echo "  ⚠️ Unexpected format (should start with lin_api_)"
      ;;
  esac
fi

# 2. Runtime check
if command -v tsx >/dev/null 2>&1; then
  echo "✓ tsx $(tsx --version 2>&1 | head -1)"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: tsx not installed"
  echo "   Cannot execute scripts. Install with: npm install -g tsx"
fi

# 3. Package check
if [ -d "node_modules/@linear/sdk" ]; then
  VER=$(node -p "JSON.parse(require('fs').readFileSync('node_modules/@linear/sdk/package.json')).version" 2>/dev/null || echo "?")
  echo "✓ @linear/sdk@$VER"
elif command -v npm >/dev/null 2>&1 && npm list @linear/sdk 2>/dev/null | grep -q @linear/sdk; then
  echo "✓ @linear/sdk (npm)"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: @linear/sdk not installed"
  echo "   Cannot execute scripts. Install with: npm install @linear/sdk"
fi

# Final status (must exit 0 to not fail skill load)
if [ -z "$BLOCKED" ]; then
  echo ""
  echo "Ready to execute Linear operations."
fi
```

Uses `@linear/sdk` with `tsx`. Run inline scripts using heredocs for top-level await support:

```bash
tsx << 'EOF'
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
// your code with top-level await
EOF
```

**IMPORTANT**: Use `tsx << 'EOF' ... EOF` heredoc syntax for inline execution with top-level await. The `tsx -e` flag does NOT support top-level await.

## Decision Trees

### Webhook Received
```
1. Is this from my bot?
   → if (webhook.data.user?.id === viewerId) return; // STOP - prevent loop

2. What type?
   → Issue:   webhooks/issue.md
   → Comment: webhooks/comment.md
   → Project: webhooks/project.md
   → Cycle:   webhooks/cycle.md
```

### Responding to Mentions
```
1. Check if mentioned: /@claude\b/i.test(webhook.data.body)
2. Get issue context: await client.issue(webhook.data.issue.identifier)
3. Reply: await client.createComment({ issueId: issue.id, body: "..." })
```

### Handling Assignment
```
1. Detect: webhook.updatedFrom?.assigneeId exists
2. Is it me? webhook.data.assignee?.id === viewerId
3. Acknowledge: update state + add comment (see sdk/issues.md#updating)
```

### Tracking Status Changes
```
1. Detect: webhook.updatedFrom?.stateId exists
2. Get transition: webhook.updatedFrom.state.type → webhook.data.state.type
3. React based on new type (started, completed, etc.)
```

## Critical Gotchas (Verified)

| Issue | Reality | Fix |
|-------|---------|-----|
| Bot loops | Your comments trigger webhooks | Check `webhook.data.user.id === viewerId` first |
| Unassigned check | SDK returns `undefined`, not `null` | Use `!assignee` or `=== undefined` |
| State types | Multiple states can share same type | "canceled" may have "Canceled" AND "Duplicate" |
| SDK `name` field | `viewer.name` = email, not display name | Use `viewer.displayName` for display |
| `issue.parent` | Returns `undefined` for top-level | Webhooks send `null`, SDK returns `undefined` |
| State IDs | Team-specific | Re-lookup by `state.type` when moving issues between teams |

## Quick Lookups

### Webhook → Reference
| `type` | File |
|--------|------|
| `Issue` | webhooks/issue.md |
| `Comment` | webhooks/comment.md |
| `Project`, `ProjectUpdate` | webhooks/project.md |
| `Cycle` | webhooks/cycle.md |

### Task → Reference
| I want to... | File |
|--------------|------|
| Reply to comment/mention | sdk/comments.md#creating |
| Change issue status | sdk/issues.md#updating |
| Get issue details | sdk/issues.md#getting |
| Find workflow states | sdk/queries.md#teams |
| Find user IDs | sdk/queries.md#users |

### Webhook Detection
| Pattern | Meaning |
|---------|---------|
| `updatedFrom.assigneeId` exists | Assignment changed |
| `updatedFrom.stateId` exists | Status changed |
| `updatedFrom.labelIds` exists | Labels changed |
| `action: "create"` + `type: "Comment"` | New comment |

### Field Values

**priority**: `1`=Urgent, `2`=High, `3`=Normal, `4`=Low, `0`=None

**state.type**: `backlog` → `unstarted` → `started` → `completed` | `canceled`

## Essential Patterns

### Bot Loop Prevention (CRITICAL)
```bash
# Get viewer ID for loop prevention
tsx << 'EOF'
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const viewer = await client.viewer;
const viewerId = viewer.id;  // Cache at startup
console.log("Viewer ID:", viewerId);
console.log("Display Name:", viewer.displayName);  // NOT viewer.name!

// In webhook handler - check FIRST:
// if (webhook.type === "Comment" && webhook.data.user?.id === viewerId) return;
EOF
```

### Detect Mentions
```bash
# Check if @claude is mentioned in webhook body
WEBHOOK_BODY="Hello @claude please help" tsx << 'EOF'
const body = process.env.WEBHOOK_BODY || "";
const wasMentioned = /@claude\b/i.test(body);
console.log("Was mentioned:", wasMentioned);
EOF
```

### Extract Issue References
```bash
# Extract issue identifiers like ENG-123, PROJ-456
TEXT="See ENG-123 and PROJ-456" tsx << 'EOF'
const body = process.env.TEXT || "";
const refs = [...new Set(body.match(/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+/g) || [])];
console.log("Issue refs:", refs);
EOF
```

### Find State by Type
```bash
# Find workflow state by type
ISSUE_ID="ENG-123" tsx << 'EOF'
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const issue = await client.issue(process.env.ISSUE_ID!);
const team = await issue.team;
const states = await team?.states();
const inProgress = states?.nodes.find(s => s.type === "started");
console.log("In Progress state:", inProgress?.name, inProgress?.id);
// ⚠️ Multiple states may match - this returns first
EOF
```

### Detect State Transition
```typescript
// In webhook handler - detect completion
const wasCompleted =
  webhook.updatedFrom?.state?.type !== "completed" &&
  webhook.data.state?.type === "completed";
```

## SDK Quick Start

### Get Issue Details
```bash
ISSUE_ID="ENG-1234" tsx << 'EOF'
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const issue = await client.issue(process.env.ISSUE_ID!);
const state = await issue.state;
console.log("Issue:", issue.identifier, issue.title);
console.log("State:", state?.name, state?.type);
EOF
```

### Update Issue Status
```bash
ISSUE_ID="ENG-1234" STATE_ID="state-uuid" tsx << 'EOF'
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

await client.updateIssue(process.env.ISSUE_ID!, { stateId: process.env.STATE_ID });
console.log("Issue updated");
EOF
```

### Add Comment
```bash
ISSUE_ID="ENG-1234" tsx << 'EOF'
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const issue = await client.issue(process.env.ISSUE_ID!);
await client.createComment({ issueId: issue.id, body: "Done." });
console.log("Comment added");
EOF
```

### Get Viewer ID (for loop prevention)
```bash
tsx << 'EOF'
import { LinearClient } from "@linear/sdk";
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const viewer = await client.viewer;
console.log("ID:", viewer.id);
console.log("Display Name:", viewer.displayName);  // NOT viewer.name!
EOF
```

## Official Documentation

- **SDK**: https://developers.linear.app/docs/sdk/getting-started
- **Webhooks**: https://developers.linear.app/docs/graphql/webhooks
- **API Reference**: https://studio.apollographql.com/public/Linear-API
