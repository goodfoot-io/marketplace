# Labels and Filters Operations

> **Official docs**: https://developers.google.com/gmail/api/reference/rest/v1/users.labels and https://developers.google.com/gmail/api/reference/rest/v1/users.settings.filters

This document covers label management (create, read, update, delete) and filter automation (create filters with criteria, pre-built templates for common patterns).

## Setup

All examples require OAuth client initialization. Use this pattern:

```bash
tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// ========== YOUR CODE HERE ==========

EOF
```

---

## Label Types Overview

Gmail has two types of labels:

| Type | Description | Can Delete? | Examples |
|------|-------------|-------------|----------|
| **System labels** | Built-in Gmail labels | No | INBOX, SENT, DRAFT, SPAM, TRASH |
| **User labels** | Custom labels you create | Yes | Projects, Clients, Priority |

---

## System Labels Reference {#system-labels}

These labels are built into Gmail and cannot be created or deleted:

### Primary System Labels

| Label ID | Description |
|----------|-------------|
| `INBOX` | Main inbox |
| `SENT` | Sent messages |
| `DRAFT` | Saved drafts |
| `SPAM` | Spam folder |
| `TRASH` | Deleted messages |
| `UNREAD` | Unread messages |
| `STARRED` | Starred messages |
| `IMPORTANT` | Important messages (Gmail's priority) |

### Category Labels

| Label ID | Description |
|----------|-------------|
| `CATEGORY_PERSONAL` | Personal emails |
| `CATEGORY_SOCIAL` | Social network notifications |
| `CATEGORY_PROMOTIONS` | Marketing and promotional |
| `CATEGORY_UPDATES` | Notifications and updates |
| `CATEGORY_FORUMS` | Mailing lists and forums |

### Visibility Labels

| Label ID | Description |
|----------|-------------|
| `CHAT` | Google Chat messages |
| `CATEGORY_PRIMARY` | Primary inbox tab |

**Note**: System labels use ALL_CAPS format. User-created labels use the `Label_<id>` format internally but display with custom names.

---

## Label CRUD Operations

### Create Label {#create-label}

Create a custom label with optional color:

```bash
LABEL_NAME="My Project" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.labels.create({
  userId: "me",
  requestBody: {
    name: process.env.LABEL_NAME,
    labelListVisibility: "labelShow",      // Show in label list
    messageListVisibility: "show",          // Show in message list
    color: {
      backgroundColor: "#16a765",           // Green background
      textColor: "#ffffff"                  // White text
    }
  }
});

console.log("Label created!");
console.log("Label ID:", res.data.id);
console.log("Name:", res.data.name);
EOF
```

### Create Nested Label (Sublabel)

Use forward slash in the name to create nested labels:

```bash
PARENT="Projects" CHILD="Website Redesign" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { PARENT, CHILD } = process.env;

// Create parent label first (if it doesn't exist)
try {
  await gmail.users.labels.create({
    userId: "me",
    requestBody: { name: PARENT }
  });
  console.log("Created parent label:", PARENT);
} catch (e: any) {
  if (e.code === 409) {
    console.log("Parent label already exists:", PARENT);
  } else {
    throw e;
  }
}

// Create nested label using forward slash
const nestedName = `${PARENT}/${CHILD}`;
const res = await gmail.users.labels.create({
  userId: "me",
  requestBody: { name: nestedName }
});

console.log("Nested label created!");
console.log("Label ID:", res.data.id);
console.log("Full name:", res.data.name);
EOF
```

### Get Label by ID {#get-label}

```bash
LABEL_ID="Label_123456" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.labels.get({
  userId: "me",
  id: process.env.LABEL_ID
});

console.log("Label details:");
console.log("  ID:", res.data.id);
console.log("  Name:", res.data.name);
console.log("  Type:", res.data.type);
console.log("  Message count:", res.data.messagesTotal);
console.log("  Unread count:", res.data.messagesUnread);
console.log("  Thread count:", res.data.threadsTotal);
console.log("  Threads unread:", res.data.threadsUnread);
if (res.data.color) {
  console.log("  Background:", res.data.color.backgroundColor);
  console.log("  Text color:", res.data.color.textColor);
}
EOF
```

### List All Labels {#list-labels}

```bash
tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.labels.list({
  userId: "me"
});

const labels = res.data.labels || [];

// Separate system and user labels
const systemLabels = labels.filter(l => l.type === "system");
const userLabels = labels.filter(l => l.type === "user");

console.log("=== System Labels ===");
systemLabels.forEach(label => {
  console.log(`  ${label.id}: ${label.name}`);
});

console.log("\n=== User Labels ===");
userLabels.forEach(label => {
  console.log(`  ${label.id}: ${label.name}`);
});

console.log(`\nTotal: ${systemLabels.length} system, ${userLabels.length} user labels`);
EOF
```

### Update Label (Full Update) {#update-label}

Full update replaces all label properties:

```bash
LABEL_ID="Label_123456" NEW_NAME="Updated Name" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { LABEL_ID, NEW_NAME } = process.env;

const res = await gmail.users.labels.update({
  userId: "me",
  id: LABEL_ID,
  requestBody: {
    id: LABEL_ID,
    name: NEW_NAME,
    labelListVisibility: "labelShow",
    messageListVisibility: "show",
    color: {
      backgroundColor: "#fb4c2f",  // Red
      textColor: "#ffffff"
    }
  }
});

console.log("Label updated!");
console.log("  ID:", res.data.id);
console.log("  New name:", res.data.name);
EOF
```

### Patch Label (Partial Update) {#patch-label}

Partial update modifies only specified fields:

```bash
LABEL_ID="Label_123456" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// Only update the color, keep everything else
const res = await gmail.users.labels.patch({
  userId: "me",
  id: process.env.LABEL_ID,
  requestBody: {
    color: {
      backgroundColor: "#42d692",  // Teal
      textColor: "#ffffff"
    }
  }
});

console.log("Label patched!");
console.log("  Name (unchanged):", res.data.name);
console.log("  New background:", res.data.color?.backgroundColor);
EOF
```

### Delete Label {#delete-label}

**Warning**: Only user-created labels can be deleted. Deleting a label removes it from all messages.

```bash
LABEL_ID="Label_123456" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

await gmail.users.labels.delete({
  userId: "me",
  id: process.env.LABEL_ID
});

console.log("Label deleted successfully!");
console.log("Note: The label has been removed from all messages.");
EOF
```

---

## Label Color Reference

Gmail supports a predefined set of colors. Here are the available options:

| Color Name | Background | Text |
|------------|------------|------|
| Berry | `#dc3912` | `#ffffff` |
| Red | `#fb4c2f` | `#ffffff` |
| Orange | `#ffad47` | `#ffffff` |
| Yellow | `#fad165` | `#000000` |
| Green | `#16a765` | `#ffffff` |
| Teal | `#42d692` | `#ffffff` |
| Cyan | `#2da2bb` | `#ffffff` |
| Blue | `#4986e7` | `#ffffff` |
| Purple | `#a479e2` | `#ffffff` |
| Pink | `#f691b3` | `#000000` |
| Gray | `#999999` | `#ffffff` |

---

## Filter Operations

Filters automatically apply actions to incoming messages based on criteria.

### Filter Criteria Options

| Criteria | Description | Example |
|----------|-------------|---------|
| `from` | Sender address | `"boss@company.com"` |
| `to` | Recipient address | `"team@company.com"` |
| `subject` | Subject contains | `"Invoice"` |
| `query` | Gmail search query | `"has:attachment larger:5M"` |
| `hasAttachment` | Has attachments | `true` |
| `excludeChats` | Exclude chat messages | `true` |
| `negatedQuery` | Exclude matching | `"unsubscribe"` |
| `size` | Message size (bytes) | `5242880` (5MB) |
| `sizeComparison` | Size comparison | `"larger"` or `"smaller"` |

### Filter Actions

| Action | Description | Value |
|--------|-------------|-------|
| `addLabelIds` | Apply labels | `["Label_123", "STARRED"]` |
| `removeLabelIds` | Remove labels | `["INBOX", "UNREAD"]` |
| `forward` | Forward to address | `"backup@example.com"` |

**Note**: Actions like `archive` and `markRead` are achieved through `removeLabelIds`:
- **Archive**: Remove `INBOX` label
- **Mark as read**: Remove `UNREAD` label
- **Mark important**: Add `IMPORTANT` label

---

### Create Filter {#create-filter}

```bash
FROM_ADDRESS="newsletter@example.com" LABEL_ID="Label_123456" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { FROM_ADDRESS, LABEL_ID } = process.env;

const res = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      from: FROM_ADDRESS
    },
    action: {
      addLabelIds: [LABEL_ID],
      removeLabelIds: ["INBOX"]  // Archive the message
    }
  }
});

console.log("Filter created!");
console.log("Filter ID:", res.data.id);
console.log("Criteria:", JSON.stringify(res.data.criteria, null, 2));
console.log("Actions:", JSON.stringify(res.data.action, null, 2));
EOF
```

### Get Filter by ID {#get-filter}

```bash
FILTER_ID="ABC123" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.settings.filters.get({
  userId: "me",
  id: process.env.FILTER_ID
});

console.log("Filter details:");
console.log("  ID:", res.data.id);
console.log("  Criteria:", JSON.stringify(res.data.criteria, null, 2));
console.log("  Actions:", JSON.stringify(res.data.action, null, 2));
EOF
```

### List All Filters {#list-filters}

```bash
tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.settings.filters.list({
  userId: "me"
});

const filters = res.data.filter || [];

if (filters.length === 0) {
  console.log("No filters configured.");
} else {
  console.log(`Found ${filters.length} filter(s):\n`);
  filters.forEach((filter, index) => {
    console.log(`--- Filter ${index + 1} ---`);
    console.log("ID:", filter.id);
    if (filter.criteria?.from) console.log("From:", filter.criteria.from);
    if (filter.criteria?.to) console.log("To:", filter.criteria.to);
    if (filter.criteria?.subject) console.log("Subject:", filter.criteria.subject);
    if (filter.criteria?.query) console.log("Query:", filter.criteria.query);
    if (filter.criteria?.hasAttachment) console.log("Has attachment:", filter.criteria.hasAttachment);
    if (filter.action?.addLabelIds) console.log("Add labels:", filter.action.addLabelIds.join(", "));
    if (filter.action?.removeLabelIds) console.log("Remove labels:", filter.action.removeLabelIds.join(", "));
    if (filter.action?.forward) console.log("Forward to:", filter.action.forward);
    console.log("");
  });
}
EOF
```

### Delete Filter {#delete-filter}

```bash
FILTER_ID="ABC123" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

await gmail.users.settings.filters.delete({
  userId: "me",
  id: process.env.FILTER_ID
});

console.log("Filter deleted successfully!");
EOF
```

---

## Pre-Built Filter Templates {#templates}

These templates provide ready-to-use filter patterns for common scenarios.

### 1. fromSender - Auto-Label by Sender {#from-sender}

Automatically label and organize emails from specific senders:

```bash
SENDER="important-client@company.com" LABEL_NAME="VIP Clients" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { SENDER, LABEL_NAME } = process.env;

// Step 1: Create or find the label
let labelId: string;
const labelsRes = await gmail.users.labels.list({ userId: "me" });
const existingLabel = labelsRes.data.labels?.find(l => l.name === LABEL_NAME);

if (existingLabel) {
  labelId = existingLabel.id!;
  console.log("Using existing label:", LABEL_NAME);
} else {
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: LABEL_NAME,
      color: {
        backgroundColor: "#16a765",
        textColor: "#ffffff"
      }
    }
  });
  labelId = newLabel.data.id!;
  console.log("Created new label:", LABEL_NAME);
}

// Step 2: Create the filter
const filter = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      from: SENDER
    },
    action: {
      addLabelIds: [labelId, "IMPORTANT"],
      removeLabelIds: ["UNREAD"]  // Auto-mark as read (optional)
    }
  }
});

console.log("\nFilter created successfully!");
console.log("Filter ID:", filter.data.id);
console.log("Emails from", SENDER, "will be:");
console.log("  - Labeled as:", LABEL_NAME);
console.log("  - Marked as Important");
EOF
```

### 2. withSubject - Match Subject Text {#with-subject}

Filter emails based on subject line content:

```bash
SUBJECT_TEXT="[URGENT]" LABEL_NAME="Urgent" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { SUBJECT_TEXT, LABEL_NAME } = process.env;

// Step 1: Create or find the label
let labelId: string;
const labelsRes = await gmail.users.labels.list({ userId: "me" });
const existingLabel = labelsRes.data.labels?.find(l => l.name === LABEL_NAME);

if (existingLabel) {
  labelId = existingLabel.id!;
  console.log("Using existing label:", LABEL_NAME);
} else {
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: LABEL_NAME,
      color: {
        backgroundColor: "#fb4c2f",  // Red for urgent
        textColor: "#ffffff"
      }
    }
  });
  labelId = newLabel.data.id!;
  console.log("Created new label:", LABEL_NAME);
}

// Step 2: Create the filter
const filter = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      subject: SUBJECT_TEXT
    },
    action: {
      addLabelIds: [labelId, "STARRED", "IMPORTANT"]
    }
  }
});

console.log("\nFilter created successfully!");
console.log("Filter ID:", filter.data.id);
console.log("Emails with subject containing", SUBJECT_TEXT, "will be:");
console.log("  - Labeled as:", LABEL_NAME);
console.log("  - Starred");
console.log("  - Marked as Important");
EOF
```

### 3. withAttachments - Filter Attachments {#with-attachments}

Filter emails that have attachments:

```bash
LABEL_NAME="Has Attachments" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { LABEL_NAME } = process.env;

// Step 1: Create or find the label
let labelId: string;
const labelsRes = await gmail.users.labels.list({ userId: "me" });
const existingLabel = labelsRes.data.labels?.find(l => l.name === LABEL_NAME);

if (existingLabel) {
  labelId = existingLabel.id!;
  console.log("Using existing label:", LABEL_NAME);
} else {
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: LABEL_NAME,
      color: {
        backgroundColor: "#4986e7",  // Blue
        textColor: "#ffffff"
      }
    }
  });
  labelId = newLabel.data.id!;
  console.log("Created new label:", LABEL_NAME);
}

// Step 2: Create the filter
const filter = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      hasAttachment: true
    },
    action: {
      addLabelIds: [labelId]
    }
  }
});

console.log("\nFilter created successfully!");
console.log("Filter ID:", filter.data.id);
console.log("Emails with attachments will be labeled as:", LABEL_NAME);
EOF
```

### 4. largeEmails - Size-Based Filtering {#large-emails}

Filter emails larger than a specified size:

```bash
SIZE_MB="10" LABEL_NAME="Large Emails" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { SIZE_MB, LABEL_NAME } = process.env;
const sizeBytes = parseInt(SIZE_MB) * 1024 * 1024;  // Convert MB to bytes

// Step 1: Create or find the label
let labelId: string;
const labelsRes = await gmail.users.labels.list({ userId: "me" });
const existingLabel = labelsRes.data.labels?.find(l => l.name === LABEL_NAME);

if (existingLabel) {
  labelId = existingLabel.id!;
  console.log("Using existing label:", LABEL_NAME);
} else {
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: LABEL_NAME,
      color: {
        backgroundColor: "#ffad47",  // Orange
        textColor: "#ffffff"
      }
    }
  });
  labelId = newLabel.data.id!;
  console.log("Created new label:", LABEL_NAME);
}

// Step 2: Create the filter using query syntax
const filter = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      size: sizeBytes,
      sizeComparison: "larger"
    },
    action: {
      addLabelIds: [labelId]
    }
  }
});

console.log("\nFilter created successfully!");
console.log("Filter ID:", filter.data.id);
console.log(`Emails larger than ${SIZE_MB}MB will be labeled as: ${LABEL_NAME}`);
EOF
```

### 5. containingText - Content Matching {#containing-text}

Filter emails containing specific text in the body:

```bash
SEARCH_TEXT="invoice" LABEL_NAME="Invoices" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { SEARCH_TEXT, LABEL_NAME } = process.env;

// Step 1: Create or find the label
let labelId: string;
const labelsRes = await gmail.users.labels.list({ userId: "me" });
const existingLabel = labelsRes.data.labels?.find(l => l.name === LABEL_NAME);

if (existingLabel) {
  labelId = existingLabel.id!;
  console.log("Using existing label:", LABEL_NAME);
} else {
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: LABEL_NAME,
      color: {
        backgroundColor: "#a479e2",  // Purple
        textColor: "#ffffff"
      }
    }
  });
  labelId = newLabel.data.id!;
  console.log("Created new label:", LABEL_NAME);
}

// Step 2: Create the filter using query for body content
const filter = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      query: SEARCH_TEXT  // Searches subject and body
    },
    action: {
      addLabelIds: [labelId]
    }
  }
});

console.log("\nFilter created successfully!");
console.log("Filter ID:", filter.data.id);
console.log(`Emails containing "${SEARCH_TEXT}" will be labeled as: ${LABEL_NAME}`);
EOF
```

### 6. mailingList - Mailing List Organization {#mailing-list}

Filter emails from mailing lists to organize them:

```bash
LIST_ADDRESS="dev-team@company.com" LABEL_NAME="Dev Team List" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { LIST_ADDRESS, LABEL_NAME } = process.env;

// Step 1: Create or find the label (nested under "Mailing Lists")
const parentName = "Mailing Lists";
const fullLabelName = `${parentName}/${LABEL_NAME}`;

// Create parent if needed
let parentExists = false;
const labelsRes = await gmail.users.labels.list({ userId: "me" });
parentExists = labelsRes.data.labels?.some(l => l.name === parentName) || false;

if (!parentExists) {
  await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: parentName,
      color: {
        backgroundColor: "#999999",
        textColor: "#ffffff"
      }
    }
  });
  console.log("Created parent label:", parentName);
}

// Create or find the nested label
let labelId: string;
const existingLabel = labelsRes.data.labels?.find(l => l.name === fullLabelName);

if (existingLabel) {
  labelId = existingLabel.id!;
  console.log("Using existing label:", fullLabelName);
} else {
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: fullLabelName,
      color: {
        backgroundColor: "#2da2bb",  // Cyan
        textColor: "#ffffff"
      }
    }
  });
  labelId = newLabel.data.id!;
  console.log("Created new label:", fullLabelName);
}

// Step 2: Create the filter using list: query
const filter = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      query: `list:${LIST_ADDRESS}`  // Matches List-ID header
    },
    action: {
      addLabelIds: [labelId],
      removeLabelIds: ["INBOX"]  // Archive mailing list emails
    }
  }
});

console.log("\nFilter created successfully!");
console.log("Filter ID:", filter.data.id);
console.log(`Emails from mailing list ${LIST_ADDRESS} will be:`);
console.log("  - Labeled as:", fullLabelName);
console.log("  - Archived (removed from Inbox)");
EOF
```

---

## Advanced Filter Patterns

### Combine Multiple Criteria

Create a filter with multiple conditions:

```bash
tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// Create filter for: emails from boss with "report" in subject
const filter = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      from: "boss@company.com",
      subject: "report",
      hasAttachment: true
    },
    action: {
      addLabelIds: ["STARRED", "IMPORTANT"]
    }
  }
});

console.log("Multi-criteria filter created!");
console.log("Filter ID:", filter.data.id);
console.log("Matches: Emails from boss with 'report' in subject AND attachments");
EOF
```

### Exclusion Filter (negatedQuery)

Filter emails that do NOT match certain criteria:

```bash
tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// Create filter: newsletters, but exclude those with "unsubscribe" link
const filter = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      from: "@newsletter.com",
      negatedQuery: "unsubscribe"  // Exclude if contains "unsubscribe"
    },
    action: {
      addLabelIds: ["IMPORTANT"]  // Only important newsletters
    }
  }
});

console.log("Exclusion filter created!");
console.log("Filter ID:", filter.data.id);
EOF
```

### Forward Filter

Automatically forward matching emails:

```bash
FROM_ADDRESS="alerts@system.com" FORWARD_TO="oncall@team.com" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { FROM_ADDRESS, FORWARD_TO } = process.env;

// NOTE: Forwarding requires the address to be verified first
// See advanced/settings.md for forwarding setup

const filter = await gmail.users.settings.filters.create({
  userId: "me",
  requestBody: {
    criteria: {
      from: FROM_ADDRESS
    },
    action: {
      forward: FORWARD_TO
    }
  }
});

console.log("Forwarding filter created!");
console.log("Filter ID:", filter.data.id);
console.log(`Emails from ${FROM_ADDRESS} will be forwarded to ${FORWARD_TO}`);
EOF
```

---

## Error Handling

### Common Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `400 Bad Request` | Invalid label color or criteria | Use predefined colors; check criteria format |
| `404 Not Found` | Label or filter ID doesn't exist | Verify ID before operations |
| `409 Conflict` | Label name already exists | Use unique names or find existing |
| `403 Forbidden` | Cannot delete system label | Only user labels can be deleted |
| `400 invalidArgument` | Invalid filter criteria | Check query syntax; verify size is numeric |

### Robust Error Handling

```bash
tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const credentials = JSON.parse(readFileSync(join(credPath, "client_secret.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(credPath, "tokens.json"), "utf8"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);
oauth2Client.on("tokens", (newTokens) => {
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify({ ...tokens, ...newTokens }, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

async function createLabelSafely(name: string): Promise<string | null> {
  try {
    // First, check if label exists
    const labelsRes = await gmail.users.labels.list({ userId: "me" });
    const existing = labelsRes.data.labels?.find(l => l.name === name);

    if (existing) {
      console.log("Label already exists:", name);
      return existing.id!;
    }

    // Create new label
    const res = await gmail.users.labels.create({
      userId: "me",
      requestBody: { name }
    });

    console.log("Label created:", name);
    return res.data.id!;

  } catch (error: any) {
    if (error.code === 409) {
      console.log("Label name conflict - fetching existing...");
      const labelsRes = await gmail.users.labels.list({ userId: "me" });
      const existing = labelsRes.data.labels?.find(l => l.name === name);
      return existing?.id || null;
    }

    console.error("Error creating label:", error.message);
    return null;
  }
}

async function createFilterSafely(
  criteria: any,
  action: any
): Promise<string | null> {
  try {
    const res = await gmail.users.settings.filters.create({
      userId: "me",
      requestBody: { criteria, action }
    });

    console.log("Filter created:", res.data.id);
    return res.data.id!;

  } catch (error: any) {
    if (error.code === 400) {
      console.error("Invalid filter criteria or action");
      console.error("Details:", error.message);
    } else {
      console.error("Error creating filter:", error.message);
    }
    return null;
  }
}

// Example usage
const labelId = await createLabelSafely("Test Label");
if (labelId) {
  await createFilterSafely(
    { from: "test@example.com" },
    { addLabelIds: [labelId] }
  );
}
EOF
```

---

## Required OAuth Scopes

| Operation | Minimum Scope |
|-----------|---------------|
| Read labels | `gmail.labels` or `gmail.readonly` |
| Create/modify labels | `gmail.labels` or `gmail.modify` |
| Delete labels | `gmail.labels` or `gmail.modify` |
| List/get filters | `gmail.settings.basic` |
| Create/delete filters | `gmail.settings.basic` |

**Recommended**: Use `gmail.modify` for full label operations and `gmail.settings.basic` for filter management.
