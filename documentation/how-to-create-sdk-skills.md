# How to Create SDK-Based Claude Code Skills

A practical guide for creating skills that use NPM packages (SDKs) to accomplish tasks, based on lessons learned building the Linear SDK skill.

## Overview

SDK-based skills help Claude interact with external services through their official TypeScript/JavaScript SDKs. This guide covers the **routing model**: a main SKILL.md that routes to specialized sub-documents based on context.

**This guide assumes** you've read the official Claude Code skill documentation and understand basic skill structure.

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
1. Route to sub-documents by context
2. Show decision trees for core intents
3. List verified gotchas
4. Provide essential patterns (not exhaustive examples)

```markdown
# Service Reference (SDK)

Uses `@service/sdk` with `tsx`. Run: `dotenv -- tsx script.ts`

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

## Phase 3: Verification-Driven Documentation

### 3.1 The Verification Loop

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

## Phase 4: Gotcha Documentation

### 4.1 Common SDK Gotchas

Every SDK has these. Document them prominently:

| Category | Common Issue |
|----------|--------------|
| **Bot loops** | Your actions trigger webhooks → infinite loop |
| **Null vs undefined** | SDK and webhooks often differ |
| **Field naming** | `name` might not be the display name |
| **ID formats** | Some methods need UUID, others accept slugs |
| **Async relations** | `item.relation` might need `await` |
| **Type collisions** | Multiple statuses/categories share same type |

### 4.2 Gotcha Table Format

```markdown
## Critical Gotchas (Verified)

| Issue | Reality | Fix |
|-------|---------|-----|
| Bot loops | Your comments trigger webhooks | Check `event.user.id === myId` first |
| Null check | SDK returns `undefined`, not `null` | Use `!value` or `=== undefined` |
| Name field | `user.name` = email in SDK | Use `user.displayName` instead |
```

The "Verified" label signals these were tested, not assumed.

## Phase 5: Webhook Handling

### 5.1 Bot Loop Prevention (Critical)

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

### 5.2 Webhook vs SDK Field Differences

Document mismatches between webhook payloads and SDK responses:

```markdown
| Field | Webhook | SDK |
|-------|---------|-----|
| Display name | `user.name` | `user.displayName` |
| Missing parent | `null` | `undefined` |
| Timestamps | ISO string | Date object |
```

### 5.3 Change Detection Patterns

```typescript
// Detect what changed
const fieldChanged = event.updatedFrom?.fieldName !== undefined;

// Detect specific transitions
const wasCompleted =
  event.updatedFrom?.status !== "done" &&
  event.data.status === "done";
```

## Phase 6: Quality Checklist

Before considering the skill complete:

### Documentation Quality
- [ ] SKILL.md under 200 lines
- [ ] Decision trees for top 5 intents
- [ ] Gotcha table with verified findings
- [ ] Each sub-doc has official docs link
- [ ] Examples are minimal (not exhaustive)

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

1. **Start from user intents**, not API methods
2. **Verify everything** with runnable scripts
3. **Keep SKILL.md small** (under 200 lines)
4. **Document gotchas prominently** - these prevent real bugs
5. **Bot loop prevention** is critical for webhook handlers
6. **Link, don't inline** - sub-docs handle details

The goal is a skill that helps users accomplish tasks quickly, warns them about pitfalls, and routes them to details only when needed.
