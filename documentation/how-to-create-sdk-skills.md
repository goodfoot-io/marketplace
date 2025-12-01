# How to Create SDK-Based Claude Code Skills

A practical guide for creating skills that use NPM packages (SDKs) to accomplish tasks, based on lessons learned building the Linear, Gmail, and Browser skills.

## Overview

SDK-based skills help Claude interact with external services through their official TypeScript/JavaScript SDKs. This guide covers the **routing model**: a main SKILL.md that routes to specialized sub-documents based on context.

**This guide assumes** you've read the official Claude Code skill documentation, understand basic skill structure, and have read `documentation/how-to-use-embedded-bash-in-skills.md`.

## When to Use This Pattern

Use the SDK routing pattern when:
- The service has a TypeScript/JavaScript SDK on NPM
- You need to handle multiple entity types (issues, comments, users, etc.)
- The service sends webhooks that trigger actions
- Operations span create, read, update, delete across entities

**Examples**: Linear, GitHub, Notion, Stripe, Slack, Airtable

## Phase 1: Discovery (Before Writing Anything)

### 1.1 Identify the 5 Core User Intents

Don't start from the API surface. Start from what users actually want to do:

```
❌ "Document all 47 API methods"
✅ "What are the 5 things users will do 90% of the time?"
```

For Linear, these were:
1. Respond when mentioned in a comment
2. Acknowledge when assigned to an issue
3. React to status changes
4. Parse and resolve issue references
5. Prevent infinite bot loops

**Exercise**: Write your 5 intents before reading any SDK docs.

### 1.2 Map Decision Trees, Not API Methods

For each intent, map the decision flow:

```
Intent: Respond to mention
├── Is this my own message? → STOP (prevent loop)
├── Am I actually mentioned? → Check regex
├── What's the context? → Get parent issue
└── How do I respond? → Create comment
```

This reveals the **actual logic** users need, not just API calls.

### 1.3 Create Verification Scripts First

Before writing documentation, write code that tests real SDK behavior:

```typescript
// tests/verify-sdk-behavior.ts
import { ServiceClient } from "@service/sdk";

const client = new ServiceClient({ apiKey: process.env.API_KEY });

async function verifyUserIdentity() {
  const me = await client.getCurrentUser();
  console.log("ID:", me.id);
  console.log("Name field:", me.name);        // What does this actually return?
  console.log("Display name:", me.displayName); // Is this different?
}

async function verifyNullBehavior() {
  const item = await client.getItem("test-123");
  const parent = await item.parent;
  console.log("parent value:", parent);
  console.log("parent === null:", parent === null);
  console.log("parent === undefined:", parent === undefined);
}
```

Run these scripts. Document what you **actually observe**, not what you assume.

## Phase 2: Structure

### 2.1 Directory Layout

```
skills/
└── your-skill/
    ├── SKILL.md           # Router (under 200 lines)
    ├── sdk/
    │   ├── entities.md    # CRUD for main entity (issues, records, etc.)
    │   ├── comments.md    # Comment operations
    │   └── queries.md     # Read-only lookups (users, teams, etc.)
    ├── webhooks/
    │   ├── entity.md      # Main entity webhook handling
    │   └── comment.md     # Comment webhook handling
    └── tests/
        └── verify-behavior.ts  # Runnable verification scripts
```

### 2.2 SKILL.md as a Router

Keep SKILL.md **under 200 lines**. It should:
1. **Start with embedded bash environment check** (see Phase 3)
2. Route to sub-documents by context
3. Show decision trees for core intents
4. List verified gotchas with cleanup requirements
5. Provide essential patterns (not exhaustive examples)

```markdown
# Service Reference (SDK)

\`\`\`!
# Embedded bash environment check - runs when skill loads
# See Phase 3 for full template
\`\`\`

Uses `@service/sdk` with `tsx`. Run inline scripts using heredocs:

\`\`\`bash
tsx << 'EOF'
import { Client } from "@service/sdk";
// your code with top-level await
EOF
\`\`\`

**IMPORTANT**: Use `tsx << 'EOF' ... EOF` heredoc syntax for inline execution with top-level await. The `tsx -e` flag does NOT support top-level await.

## ⚠️ Cleanup Requirements

[Document what files/artifacts the skill creates and how to clean them up]

## Decision Trees

### Webhook Received
\`\`\`
1. Is this from my bot? → STOP
2. What type? → Route to webhooks/*.md
\`\`\`

## Critical Gotchas (Verified)

| Issue | Reality | Fix |
|-------|---------|-----|
| ... | ... | ... |

## Quick Lookups

| I want to... | File |
|--------------|------|
| ... | ... |
```

### 2.3 Sub-Document Structure

Each sub-document should be self-contained:

```markdown
# Entity Operations

> **Official docs**: https://...

## Quick Reference

| Operation | SDK Method |
|-----------|------------|
| List | `client.entities()` |
| Get | `client.entity(id)` |
| Create | `client.createEntity(input)` |
| Update | `client.updateEntity(id, input)` |

## [Operation Name] {#anchor}

\`\`\`typescript
// Minimal working example
\`\`\`

### Fields

| Field | Type | Description |
|-------|------|-------------|
```

## Phase 3: Embedded Bash Environment Checks

Every SDK skill should start with an embedded bash block that validates prerequisites before Claude attempts any operations. This prevents confusing failures and provides clear guidance.

### 3.1 Environment Check Template

```bash
```!
# === [Skill Name] Environment Check ===
BLOCKED=""

# Detect package manager (for install suggestions)
if [ -f "yarn.lock" ]; then
  PKG_MGR="yarn" PKG_ADD="yarn add" PKG_GLOBAL="yarn global add"
elif [ -f "pnpm-lock.yaml" ]; then
  PKG_MGR="pnpm" PKG_ADD="pnpm add" PKG_GLOBAL="pnpm add -g"
else
  PKG_MGR="npm" PKG_ADD="npm install" PKG_GLOBAL="npm install -g"
fi

# 1. API Key / Credentials check
if [ -z "$SERVICE_API_KEY" ]; then
  BLOCKED="yes"
  echo "❌ BLOCKED: SERVICE_API_KEY not set"
  echo ""
  echo "STOP. Do not attempt [service] operations."
  echo "Ask user to set their API key:"
  echo "  export SERVICE_API_KEY=..."
else
  echo "✓ API key set (${SERVICE_API_KEY:0:8}...)"
fi

# 2. Runtime check (tsx for TypeScript execution)
if command -v tsx >/dev/null 2>&1; then
  echo "✓ tsx $(tsx --version 2>&1 | head -1)"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: tsx not installed"
  echo "   Cannot execute scripts. Install with: $PKG_GLOBAL tsx"
fi

# 3. Package check
if [ -d "node_modules/@service/sdk" ]; then
  VER=$(node -p "require('@service/sdk/package.json').version" 2>/dev/null || echo "?")
  echo "✓ @service/sdk@$VER"
else
  BLOCKED="yes"
  echo "❌ BLOCKED: @service/sdk not installed"
  echo "   Cannot execute scripts. Install with: $PKG_ADD @service/sdk"
fi

# Final status (MUST exit 0 to not fail skill load)
if [ -z "$BLOCKED" ]; then
  echo ""
  echo "Ready to execute [service] operations."
fi
```
```

### 3.2 Critical Requirements

| Requirement | Why | How |
|-------------|-----|-----|
| **Exit code 0** | Non-zero fails skill load | Use `if` statements, not `&&` chains for final output |
| **BLOCKED messaging** | Agents need clear instructions | Use `❌ BLOCKED:` + `STOP. Do not attempt X.` |
| **Package manager detection** | Correct install commands | Check for `yarn.lock` / `pnpm-lock.yaml` |
| **Partial success** | Show what's working | Check each prerequisite independently |

### 3.3 BLOCKED Message Pattern

When a prerequisite is missing, provide explicit agent instructions:

```bash
BLOCKED="yes"
echo "❌ BLOCKED: [what's missing]"
echo ""
echo "STOP. Do not attempt [service] operations."
echo "Ask user: \"[specific question or action]\""
echo ""
echo "[Additional context or setup instructions]"
```

**Key elements:**
- `❌ BLOCKED:` prefix makes the issue obvious
- `STOP. Do not attempt X.` tells agent what NOT to do
- `Ask user: "..."` provides exact phrasing for agent to use

### 3.4 Exit Code 0 Requirement

**Critical**: The embedded bash block MUST exit with code 0 or the skill fails to load.

```bash
# ❌ WRONG - returns exit code 1 when BLOCKED is set
[ -z "$BLOCKED" ] && echo "Ready to execute operations."

# ✅ CORRECT - if statement always returns 0
if [ -z "$BLOCKED" ]; then
  echo ""
  echo "Ready to execute operations."
fi
```

### 3.5 Credential Check Patterns

**Environment variable (simple):**
```bash
if [ -z "$API_KEY" ]; then
  BLOCKED="yes"
  echo "❌ BLOCKED: API_KEY not set"
fi
```

**File-based credentials (OAuth tokens, etc.):**
```bash
CRED_PATH="$HOME/.service-skill"
if [ ! -d "$CRED_PATH" ]; then
  BLOCKED="yes"
  echo "❌ BLOCKED: ~/.service-skill/ directory not found"
  echo "Setup guide: @${CLAUDE_PLUGIN_ROOT}/skills/service/advanced/setup.md"
elif [ ! -f "$CRED_PATH/tokens.json" ]; then
  BLOCKED="yes"
  echo "❌ BLOCKED: tokens.json not found"
fi
```

**Token validation (with expiry check):**
```bash
if node -e "JSON.parse(require('fs').readFileSync('$CRED_PATH/tokens.json'))" 2>/dev/null; then
  EXPIRY=$(node -p "JSON.parse(require('fs').readFileSync('$CRED_PATH/tokens.json')).expiry_date || 0" 2>/dev/null)
  NOW_MS=$(($(date +%s) * 1000))
  if [ -n "$EXPIRY" ] && [ "$EXPIRY" -gt "$NOW_MS" ] 2>/dev/null; then
    REMAINING_MIN=$(((EXPIRY - NOW_MS) / 60000))
    echo "✓ Token valid (${REMAINING_MIN}m remaining)"
  else
    echo "✓ Token expired (will auto-refresh)"
  fi
fi
```

---

## Phase 4: Verification-Driven Documentation

### 4.1 The Verification Loop

```
1. Write assumption → "parent returns null for top-level items"
2. Write test → console.log(item.parent, item.parent === null)
3. Run test → Observe: returns undefined, not null!
4. Update docs → Document actual behavior with warning
```

### 3.2 What to Verify

Always verify these for any SDK:

| Category | Test |
|----------|------|
| Identity | How do I get my bot's user ID? |
| Null behavior | Does missing data return `null` or `undefined`? |
| Field naming | Is `name` the display name or something else? |
| Type mappings | Can multiple items share the same type/status? |
| ID formats | Human-readable vs UUID? Which works where? |

### 3.3 Verification Script Template

```typescript
/**
 * SDK Behavior Verification
 * Run: dotenv -- tsx tests/verify-behavior.ts
 */

import { Client } from "@service/sdk";

const client = new Client({ apiKey: process.env.API_KEY! });

async function verifyIdentity() {
  console.log("\n=== Identity ===");
  const me = await client.viewer;
  console.log("id:", me.id);
  console.log("name:", me.name);
  console.log("email:", me.email);
  // Document which field to use for what purpose
}

async function verifyNullBehavior() {
  console.log("\n=== Null Behavior ===");
  // Get an item that might have null fields
  const item = await client.getItem("...");
  const optionalField = await item.optionalRelation;
  console.log("value:", optionalField);
  console.log("=== null:", optionalField === null);
  console.log("=== undefined:", optionalField === undefined);
}

async function verifyTypeUniqueness() {
  console.log("\n=== Type Uniqueness ===");
  // Check if types/statuses are unique
  const statuses = await client.getStatuses();
  const byType = new Map();
  for (const s of statuses) {
    const list = byType.get(s.type) || [];
    list.push(s.name);
    byType.set(s.type, list);
  }
  for (const [type, names] of byType) {
    if (names.length > 1) {
      console.log(`⚠️ Type "${type}" has multiple: ${names.join(", ")}`);
    }
  }
}

async function main() {
  await verifyIdentity();
  await verifyNullBehavior();
  await verifyTypeUniqueness();
}

main();
```

## Phase 5: Gotcha Documentation

### 5.1 Common SDK Gotchas

Every SDK has these. Document them prominently:

| Category | Common Issue |
|----------|--------------|
| **Bot loops** | Your actions trigger webhooks → infinite loop |
| **Null vs undefined** | SDK and webhooks often differ |
| **Field naming** | `name` might not be the display name |
| **ID formats** | Some methods need UUID, others accept slugs |
| **Async relations** | `item.relation` might need `await` |
| **Type collisions** | Multiple statuses/categories share same type |

### 5.2 Gotcha Table Format

```markdown
## Critical Gotchas (Verified)

| Issue | Reality | Fix |
|-------|---------|-----|
| Bot loops | Your comments trigger webhooks | Check `event.user.id === myId` first |
| Null check | SDK returns `undefined`, not `null` | Use `!value` or `=== undefined` |
| Name field | `user.name` = email in SDK | Use `user.displayName` instead |
| **File accumulation** | Screenshots/PDFs persist after script | Delete files after use |
```

The "Verified" label signals these were tested, not assumed.

### 5.3 Cleanup Requirements Section

Every skill that creates files should document cleanup requirements prominently:

```markdown
## ⚠️ Cleanup Requirements

**CRITICAL**: This skill creates [files]. You MUST clean up generated files:

\`\`\`bash
# After using files, delete them immediately
rm -f screenshot.png result.png output.pdf
\`\`\`

| File Type | Created By | Cleanup |
|-----------|------------|---------|
| `*.png` | `screenshot()` | Delete after viewing |
| `*.pdf` | `generatePDF()` | Delete after processing |

**Best Practice**: Use buffer/memory output instead of files when possible.
```

### 5.4 Buffer vs File Output

For skills that generate binary output (screenshots, PDFs, etc.), prefer buffer/memory output over file output to avoid file accumulation:

```typescript
// ✅ PREFERRED: Buffer output (no cleanup needed)
const buffer = await page.screenshot();
console.log("Screenshot:", buffer.length, "bytes");

// ⚠️ FILE OUTPUT: Only when needed - MUST clean up after
await page.screenshot({ path: "temp.png" });
// ... use file ...
// Then: rm -f temp.png
```

**Document both approaches** in your skill, with buffer as default and file as the exception.

**Example cleanup reminder pattern:**
```markdown
### Screenshot Options

\`\`\`typescript
// ✅ PREFERRED: Buffer output (no cleanup needed)
const buffer = await page.screenshot();

// ⚠️ FILE OUTPUT: Only when needed - MUST clean up after
// await page.screenshot({ path: "temp.png" });
// ... use file ...
// Then run: rm -f temp.png
\`\`\`
```

## Phase 6: Webhook Handling

### 6.1 Bot Loop Prevention (Critical)

Every webhook skill needs this. Make it prominent:

```typescript
// Cache at startup
const viewer = await client.viewer;
const myId = viewer.id;

// Check FIRST in every handler
function handleWebhook(event) {
  if (event.user?.id === myId) {
    return; // Ignore own actions
  }
  // ... rest of handler
}
```

### 6.2 Webhook vs SDK Field Differences

Document mismatches between webhook payloads and SDK responses:

```markdown
| Field | Webhook | SDK |
|-------|---------|-----|
| Display name | `user.name` | `user.displayName` |
| Missing parent | `null` | `undefined` |
| Timestamps | ISO string | Date object |
```

### 6.3 Change Detection Patterns

```typescript
// Detect what changed
const fieldChanged = event.updatedFrom?.fieldName !== undefined;

// Detect specific transitions
const wasCompleted =
  event.updatedFrom?.status !== "done" &&
  event.data.status === "done";
```

## Phase 7: Quality Checklist

Before considering the skill complete:

### Embedded Bash Environment Check
- [ ] Environment check block at start of SKILL.md
- [ ] Package manager auto-detection (yarn/pnpm/npm)
- [ ] Credential/API key validation with clear error messages
- [ ] Runtime check (tsx installed)
- [ ] SDK package check (node_modules)
- [ ] BLOCKED messages with explicit agent instructions
- [ ] Script exits with code 0 (use `if` not `&&`)

### Documentation Quality
- [ ] SKILL.md under 200 lines
- [ ] Decision trees for top 5 intents
- [ ] Gotcha table with verified findings
- [ ] Each sub-doc has official docs link
- [ ] Examples are minimal (not exhaustive)
- [ ] Heredoc syntax documented (`tsx << 'EOF' ... EOF`)

### Cleanup Requirements
- [ ] Cleanup section documents generated files
- [ ] Buffer output preferred over file output
- [ ] File output examples show cleanup commands
- [ ] File accumulation listed in gotchas table

### Verification
- [ ] Verification scripts exist and run
- [ ] Null/undefined behavior documented
- [ ] Field naming mismatches documented
- [ ] Bot loop prevention is prominent
- [ ] Type uniqueness verified

### Structure
- [ ] Clear routing from SKILL.md to sub-docs
- [ ] Anchors for deep linking (`#creating`, `#updating`)
- [ ] Tables for quick lookups
- [ ] Consistent formatting across files

## Anti-Patterns to Avoid

### ❌ Documenting the Entire API
```markdown
## createEntity()
## updateEntity()
## deleteEntity()
## getEntity()
## listEntities()
## searchEntities()
## ... (47 more methods)
```

### ✅ Document What Users Need
```markdown
## I want to...
| Task | Method | Reference |
|------|--------|-----------|
| Create a new item | `createEntity()` | #creating |
| Update status | `updateEntity()` | #updating |
```

### ❌ Assuming SDK Behavior
```markdown
The parent field returns `null` when not set.
```

### ✅ Verifying SDK Behavior
```markdown
The parent field returns `undefined` (not `null`) when not set.
Use `!parent` for checks. (Verified via tests/verify-behavior.ts)
```

### ❌ Long Examples in SKILL.md
```markdown
## Complete Example

```typescript
// 50 lines of code showing everything
```
```

### ✅ Minimal Patterns, Link for Details
```markdown
## Essential Patterns

### Create Comment
```typescript
await client.createComment({ entityId: id, body: "..." });
```

See sdk/comments.md#creating for full options.
```

### ❌ File Output Without Cleanup
```typescript
// Creates files that accumulate
await page.screenshot({ path: "screenshot.png" });
await page.screenshot({ path: "result.png" });
await page.pdf({ path: "output.pdf" });
// No cleanup - files pile up!
```

### ✅ Buffer Output or Cleanup Reminder
```typescript
// Buffer approach - no files to clean up
const buffer = await page.screenshot();
console.log("Screenshot:", buffer.length, "bytes");

// Or file with explicit cleanup
await page.screenshot({ path: "temp.png" });
// ... use file ...
// Then: rm -f temp.png
```

### ❌ Missing Environment Check
```markdown
# Service Reference (SDK)

Uses `@service/sdk` with `tsx`.
<!-- Agent tries operations without checking prerequisites -->
```

### ✅ Environment Check First
```markdown
# Service Reference (SDK)

\`\`\`!
# Check prerequisites before agent attempts anything
if [ -z "$API_KEY" ]; then
  echo "❌ BLOCKED: API_KEY not set"
  echo "STOP. Do not attempt operations."
fi
\`\`\`
```

## Example: Applying to a New SDK (Stripe)

### 1. Identify 5 Core Intents
1. Process a webhook event (payment succeeded, failed, etc.)
2. Create a checkout session
3. Look up customer details
4. Handle subscription changes
5. Prevent duplicate processing

### 2. Create Verification Script
```typescript
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function verifyCustomerShape() {
  const customer = await stripe.customers.retrieve("cus_xxx");
  console.log("name:", customer.name);
  console.log("email:", customer.email);
  console.log("deleted:", customer.deleted); // What type?
}
```

### 3. Structure
```
skills/stripe/
├── SKILL.md
├── sdk/
│   ├── customers.md
│   ├── subscriptions.md
│   └── checkout.md
├── webhooks/
│   ├── payments.md
│   └── subscriptions.md
└── tests/
    └── verify-behavior.ts
```

### 4. Document Gotchas
```markdown
| Issue | Reality | Fix |
|-------|---------|-----|
| Deleted customers | Returns object with `deleted: true` | Check `customer.deleted` first |
| Webhook idempotency | Same event can arrive multiple times | Store processed event IDs |
| API version | Shapes change between versions | Pin version in client |
```

## Summary

1. **Start with environment checks** - Validate prerequisites before agent attempts operations
2. **Auto-detect package manager** - Provide correct install commands (yarn/pnpm/npm)
3. **Use BLOCKED messaging** - Clear `❌ BLOCKED:` + `STOP. Do not attempt X.` pattern
4. **Prefer buffer over file output** - Avoid file accumulation issues
5. **Document cleanup requirements** - If files are created, show how to clean them up
6. **Start from user intents**, not API methods
7. **Verify everything** with runnable scripts
8. **Keep SKILL.md small** (under 200 lines)
9. **Document gotchas prominently** - these prevent real bugs
10. **Bot loop prevention** is critical for webhook handlers
11. **Link, don't inline** - sub-docs handle details

The goal is a skill that:
- Validates prerequisites before operations (environment checks)
- Guides agents clearly when blocked (BLOCKED messaging)
- Avoids file accumulation (buffer output preferred)
- Helps users accomplish tasks quickly
- Warns about pitfalls
- Routes to details only when needed
