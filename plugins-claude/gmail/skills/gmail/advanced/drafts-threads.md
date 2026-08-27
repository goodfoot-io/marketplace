# Drafts and Threads Operations

> **Official docs**: https://developers.google.com/gmail/api/reference/rest/v1/users.drafts and https://developers.google.com/gmail/api/reference/rest/v1/users.threads

This document covers draft management (create, update, delete, send) and thread operations (get, list, modify, navigate conversations).

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

## Draft Lifecycle Overview

```
+-------------------+
| CREATE DRAFT      |
| drafts.create()   |
+-------------------+
         |
         v
+-------------------+
| UPDATE DRAFT      |  <--- Can update multiple times
| drafts.update()   |
+-------------------+
         |
         v
    +----+----+
    |         |
    v         v
+-------+  +--------+
| SEND  |  | DELETE |
| .send |  | .delete|
+-------+  +--------+
```

Drafts are mutable until sent. Once sent, a draft becomes an immutable message.

---

## Create Draft {#create}

### Simple Text Draft

```bash
TO="recipient@example.com" SUBJECT="Draft Subject" BODY="Draft body text" tsx << 'EOF'
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

const { TO, SUBJECT, BODY } = process.env;

const message = [
  `To: ${TO}`,
  `Subject: ${SUBJECT}`,
  "Content-Type: text/plain; charset=utf-8",
  "",
  BODY
].join("\r\n");

const encodedMessage = Buffer.from(message)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const res = await gmail.users.drafts.create({
  userId: "me",
  requestBody: {
    message: {
      raw: encodedMessage
    }
  }
});

console.log("Draft created!");
console.log("Draft ID:", res.data.id);
console.log("Message ID:", res.data.message?.id);
EOF
```

### HTML Draft

```bash
TO="recipient@example.com" SUBJECT="HTML Draft" tsx << 'EOF'
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

const htmlContent = `
<html>
<body>
  <h1>Draft Email</h1>
  <p>This is an <strong>HTML</strong> draft that can be edited before sending.</p>
</body>
</html>
`;

const message = [
  `To: ${process.env.TO}`,
  `Subject: ${process.env.SUBJECT}`,
  "MIME-Version: 1.0",
  "Content-Type: text/html; charset=utf-8",
  "",
  htmlContent
].join("\r\n");

const encodedMessage = Buffer.from(message)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const res = await gmail.users.drafts.create({
  userId: "me",
  requestBody: {
    message: {
      raw: encodedMessage
    }
  }
});

console.log("HTML draft created! Draft ID:", res.data.id);
EOF
```

### Draft with Attachments

```bash
TO="recipient@example.com" SUBJECT="Draft with Attachment" ATTACHMENT_PATH="/path/to/file.pdf" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createTransport } from "nodemailer";

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

const { TO, SUBJECT, ATTACHMENT_PATH } = process.env;

// Use nodemailer to build MIME message with attachment
const transporter = createTransport({ streamTransport: true });
const mailOptions = {
  from: "me",
  to: TO,
  subject: SUBJECT,
  text: "Please review the attached file.",
  attachments: [{ path: ATTACHMENT_PATH }]
};

const info = await transporter.sendMail(mailOptions);

const chunks: Buffer[] = [];
for await (const chunk of info.message) {
  chunks.push(chunk);
}
const rawMessage = Buffer.concat(chunks);

const encodedMessage = rawMessage
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const res = await gmail.users.drafts.create({
  userId: "me",
  requestBody: {
    message: {
      raw: encodedMessage
    }
  }
});

console.log("Draft with attachment created! Draft ID:", res.data.id);
EOF
```

---

## Get Draft {#get}

### Retrieve Draft by ID

```bash
DRAFT_ID="..." tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.drafts.get({
  userId: "me",
  id: process.env.DRAFT_ID!,
  format: "full"
});

const headers = res.data.message?.payload?.headers || [];
const getHeader = (name: string) =>
  headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

console.log("Draft ID:", res.data.id);
console.log("Message ID:", res.data.message?.id);
console.log("To:", getHeader("to"));
console.log("Subject:", getHeader("subject"));
console.log("Thread ID:", res.data.message?.threadId);
EOF
```

### Format Options

| Format | Returns | Use Case |
|--------|---------|----------|
| `full` | Complete parsed message | Reading/editing draft content |
| `metadata` | Headers only | Quick listing |
| `minimal` | IDs only | Batch operations |
| `raw` | Base64url encoded RFC 2822 | Full message export |

---

## List Drafts {#list}

### List All Drafts

```bash
MAX_RESULTS="20" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.drafts.list({
  userId: "me",
  maxResults: parseInt(process.env.MAX_RESULTS || "20")
});

const drafts = res.data.drafts || [];
console.log(`Found ${drafts.length} draft(s)\n`);

for (const draft of drafts) {
  const detail = await gmail.users.drafts.get({
    userId: "me",
    id: draft.id!,
    format: "metadata"
  });

  const headers = detail.data.message?.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name === name)?.value || "";

  console.log(`Draft ID: ${draft.id}`);
  console.log(`  To: ${getHeader("To")}`);
  console.log(`  Subject: ${getHeader("Subject")}`);
  console.log();
}

if (res.data.nextPageToken) {
  console.log("More drafts available. Use pageToken:", res.data.nextPageToken);
}
EOF
```

### Search Drafts

Drafts can be filtered using Gmail query syntax:

```bash
QUERY="subject:proposal" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.drafts.list({
  userId: "me",
  q: process.env.QUERY,
  maxResults: 50
});

const drafts = res.data.drafts || [];
console.log(`Found ${drafts.length} draft(s) matching: ${process.env.QUERY}`);

for (const draft of drafts) {
  console.log(`- Draft ID: ${draft.id}, Message ID: ${draft.message?.id}`);
}
EOF
```

---

## Update Draft {#update}

### Replace Draft Content

```bash
DRAFT_ID="..." NEW_SUBJECT="Updated Subject" NEW_BODY="Updated body content" tsx << 'EOF'
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

const { DRAFT_ID, NEW_SUBJECT, NEW_BODY } = process.env;

// First, get the existing draft to preserve the recipient
const existing = await gmail.users.drafts.get({
  userId: "me",
  id: DRAFT_ID!,
  format: "metadata"
});

const headers = existing.data.message?.payload?.headers || [];
const existingTo = headers.find(h => h.name === "To")?.value || "";

// Build new message content
const message = [
  `To: ${existingTo}`,
  `Subject: ${NEW_SUBJECT}`,
  "Content-Type: text/plain; charset=utf-8",
  "",
  NEW_BODY
].join("\r\n");

const encodedMessage = Buffer.from(message)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const res = await gmail.users.drafts.update({
  userId: "me",
  id: DRAFT_ID!,
  requestBody: {
    message: {
      raw: encodedMessage
    }
  }
});

console.log("Draft updated!");
console.log("Draft ID:", res.data.id);
console.log("New Message ID:", res.data.message?.id);
EOF
```

**Note**: Updating a draft replaces the entire message content. Always preserve fields you want to keep (like recipients).

---

## Delete Draft {#delete}

### Remove Draft

```bash
DRAFT_ID="..." tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

await gmail.users.drafts.delete({
  userId: "me",
  id: process.env.DRAFT_ID!
});

console.log("Draft deleted:", process.env.DRAFT_ID);
EOF
```

**Note**: Draft deletion is permanent. There is no trash for drafts.

---

## Send Draft {#send}

### Send an Existing Draft

```bash
DRAFT_ID="..." tsx << 'EOF'
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

const res = await gmail.users.drafts.send({
  userId: "me",
  requestBody: {
    id: process.env.DRAFT_ID
  }
});

console.log("Draft sent!");
console.log("Message ID:", res.data.id);
console.log("Thread ID:", res.data.threadId);
console.log("Labels:", res.data.labelIds?.join(", "));
EOF
```

**Important**: Once sent, the draft is deleted and becomes an immutable message.

---

## Thread Operations {#threads}

Threads group related messages (conversations). Operations on threads affect all messages in the conversation.

### Get Thread

```bash
THREAD_ID="..." tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.threads.get({
  userId: "me",
  id: process.env.THREAD_ID!,
  format: "full"
});

console.log("Thread ID:", res.data.id);
console.log("Message count:", res.data.messages?.length || 0);
console.log("Snippet:", res.data.snippet);
console.log();

// List all messages in thread
const messages = res.data.messages || [];
for (const msg of messages) {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

  console.log(`Message ${msg.id}:`);
  console.log(`  From: ${getHeader("from")}`);
  console.log(`  Date: ${getHeader("date")}`);
  console.log(`  Subject: ${getHeader("subject")}`);
  console.log();
}
EOF
```

### List Threads

```bash
MAX_RESULTS="20" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.threads.list({
  userId: "me",
  maxResults: parseInt(process.env.MAX_RESULTS || "20"),
  labelIds: ["INBOX"]
});

const threads = res.data.threads || [];
console.log(`Found ${threads.length} threads in INBOX\n`);

for (const thread of threads) {
  const detail = await gmail.users.threads.get({
    userId: "me",
    id: thread.id!,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Date"]
  });

  const firstMessage = detail.data.messages?.[0];
  const headers = firstMessage?.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name === name)?.value || "";

  console.log(`Thread: ${thread.id} (${detail.data.messages?.length || 0} messages)`);
  console.log(`  Subject: ${getHeader("Subject")}`);
  console.log(`  Started by: ${getHeader("From")}`);
  console.log(`  Snippet: ${thread.snippet?.substring(0, 60)}...`);
  console.log();
}

if (res.data.nextPageToken) {
  console.log("More threads available. Use pageToken:", res.data.nextPageToken);
}
EOF
```

### Search Threads

```bash
QUERY="subject:meeting after:2024/01/01" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.threads.list({
  userId: "me",
  q: process.env.QUERY,
  maxResults: 50
});

const threads = res.data.threads || [];
console.log(`Found ${threads.length} threads matching: ${process.env.QUERY}\n`);

for (const thread of threads.slice(0, 10)) {
  console.log(`Thread ID: ${thread.id}`);
  console.log(`  Snippet: ${thread.snippet?.substring(0, 80)}...`);
  console.log();
}
EOF
```

---

## Thread Label Operations {#thread-labels}

### Modify Thread Labels

Apply or remove labels from all messages in a thread:

```bash
THREAD_ID="..." ADD_LABELS="STARRED,Label_work" REMOVE_LABELS="UNREAD" tsx << 'EOF'
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

const addLabels = process.env.ADD_LABELS?.split(",").filter(Boolean) || [];
const removeLabels = process.env.REMOVE_LABELS?.split(",").filter(Boolean) || [];

const res = await gmail.users.threads.modify({
  userId: "me",
  id: process.env.THREAD_ID!,
  requestBody: {
    addLabelIds: addLabels,
    removeLabelIds: removeLabels
  }
});

console.log("Thread modified:", res.data.id);
console.log("Messages affected:", res.data.messages?.length || 0);

// Show updated labels on first message
const firstMsgLabels = res.data.messages?.[0]?.labelIds || [];
console.log("Current labels (first message):", firstMsgLabels.join(", "));
EOF
```

### Mark Thread as Read

```bash
THREAD_ID="..." tsx << 'EOF'
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

await gmail.users.threads.modify({
  userId: "me",
  id: process.env.THREAD_ID!,
  requestBody: {
    removeLabelIds: ["UNREAD"]
  }
});

console.log("Thread marked as read:", process.env.THREAD_ID);
EOF
```

---

## Thread Trash Operations {#thread-trash}

### Move Thread to Trash

```bash
THREAD_ID="..." tsx << 'EOF'
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

const res = await gmail.users.threads.trash({
  userId: "me",
  id: process.env.THREAD_ID!
});

console.log("Thread moved to trash:", res.data.id);
console.log("Messages affected:", res.data.messages?.length || 0);
EOF
```

### Restore Thread from Trash

```bash
THREAD_ID="..." tsx << 'EOF'
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

const res = await gmail.users.threads.untrash({
  userId: "me",
  id: process.env.THREAD_ID!
});

console.log("Thread restored from trash:", res.data.id);
EOF
```

### Permanently Delete Thread

```bash
THREAD_ID="..." tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// WARNING: This permanently deletes all messages in the thread!
await gmail.users.threads.delete({
  userId: "me",
  id: process.env.THREAD_ID!
});

console.log("Thread permanently deleted:", process.env.THREAD_ID);
EOF
```

---

## Reply in Thread {#reply}

### Reply to a Thread

To add a message to an existing thread, include the `threadId` and proper email headers:

```bash
THREAD_ID="..." REPLY_BODY="Thanks for your message!" tsx << 'EOF'
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

const { THREAD_ID, REPLY_BODY } = process.env;

// Get the thread to find the original message
const thread = await gmail.users.threads.get({
  userId: "me",
  id: THREAD_ID!,
  format: "metadata",
  metadataHeaders: ["From", "Subject", "Message-ID", "References"]
});

// Get the last message in the thread for reply context
const messages = thread.data.messages || [];
const lastMessage = messages[messages.length - 1];
const headers = lastMessage?.payload?.headers || [];

const getHeader = (name: string) =>
  headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

const originalFrom = getHeader("From");
const originalSubject = getHeader("Subject") || "";
const originalMessageId = getHeader("Message-ID");
const originalReferences = getHeader("References");

// Build References header for email threading
const references = originalReferences
  ? `${originalReferences} ${originalMessageId}`
  : originalMessageId;

// Format reply subject
const replySubject = originalSubject.startsWith("Re:")
  ? originalSubject
  : `Re: ${originalSubject}`;

// Build reply message
const message = [
  `To: ${originalFrom}`,
  `Subject: ${replySubject}`,
  `In-Reply-To: ${originalMessageId}`,
  `References: ${references}`,
  "Content-Type: text/plain; charset=utf-8",
  "",
  REPLY_BODY
].join("\r\n");

const encodedMessage = Buffer.from(message)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const res = await gmail.users.messages.send({
  userId: "me",
  requestBody: {
    raw: encodedMessage,
    threadId: THREAD_ID  // This keeps the reply in the same thread
  }
});

console.log("Reply sent!");
console.log("Message ID:", res.data.id);
console.log("Thread ID:", res.data.threadId);
EOF
```

### Threading Headers

For proper email client threading, include these headers:

| Header | Purpose | Example |
|--------|---------|---------|
| `In-Reply-To` | References the message being replied to | `<original-message-id@mail.gmail.com>` |
| `References` | Chain of all message IDs in thread | `<id1@mail.gmail.com> <id2@mail.gmail.com>` |
| `Subject` | Must start with "Re: " for replies | `Re: Original Subject` |

**Important**: The `threadId` parameter groups messages in Gmail's UI, while the headers ensure proper threading in other email clients.

### Create Reply Draft

```bash
THREAD_ID="..." tsx << 'EOF'
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

const THREAD_ID = process.env.THREAD_ID!;

// Get thread for reply context
const thread = await gmail.users.threads.get({
  userId: "me",
  id: THREAD_ID,
  format: "metadata",
  metadataHeaders: ["From", "Subject", "Message-ID", "References"]
});

const messages = thread.data.messages || [];
const lastMessage = messages[messages.length - 1];
const headers = lastMessage?.payload?.headers || [];

const getHeader = (name: string) =>
  headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

const originalFrom = getHeader("From");
const originalSubject = getHeader("Subject") || "";
const originalMessageId = getHeader("Message-ID");
const originalReferences = getHeader("References");

const references = originalReferences
  ? `${originalReferences} ${originalMessageId}`
  : originalMessageId;

const replySubject = originalSubject.startsWith("Re:")
  ? originalSubject
  : `Re: ${originalSubject}`;

// Build draft reply message
const message = [
  `To: ${originalFrom}`,
  `Subject: ${replySubject}`,
  `In-Reply-To: ${originalMessageId}`,
  `References: ${references}`,
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Your reply message here..."
].join("\r\n");

const encodedMessage = Buffer.from(message)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const res = await gmail.users.drafts.create({
  userId: "me",
  requestBody: {
    message: {
      raw: encodedMessage,
      threadId: THREAD_ID
    }
  }
});

console.log("Reply draft created!");
console.log("Draft ID:", res.data.id);
console.log("Thread ID:", res.data.message?.threadId);
EOF
```

---

## Threads vs Messages {#comparison}

| Feature | messages.list() | threads.list() |
|---------|-----------------|----------------|
| Returns | Individual messages | Grouped conversations |
| For search | Finding specific emails | Finding conversations |
| Batch ops | Operate on single messages | Operate on all messages in conversation |
| Display | Email-by-email view | Conversation view |

**Best practices**:
- Use `threads.list()` for conversation-based UI
- Use `messages.list()` when processing individual emails
- Use `threads.get()` to fetch all messages in a conversation at once

---

## Error Handling {#errors}

### Draft-Specific Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 404 Not Found | Draft ID doesn't exist | Verify draft ID, may have been sent or deleted |
| 400 Invalid draft | Malformed message content | Check base64url encoding and headers |
| 403 Forbidden | Missing gmail.compose scope | Re-authorize with correct scopes |

### Thread-Specific Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 404 Not Found | Thread ID doesn't exist | Verify thread ID |
| 400 Invalid thread | threadId doesn't match message | Ensure message belongs to thread |
| 403 Forbidden | Missing gmail.modify scope | Re-authorize with correct scopes |

### Robust Error Pattern

```bash
tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");

if (!existsSync(join(credPath, "client_secret.json"))) {
  console.error("ERROR: client_secret.json not found");
  console.error("See advanced/oauth-setup.md for setup");
  process.exit(1);
}

if (!existsSync(join(credPath, "tokens.json"))) {
  console.error("ERROR: tokens.json not found");
  console.error("Run authorization flow first");
  process.exit(1);
}

try {
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

  // Your draft/thread operations here
  const drafts = await gmail.users.drafts.list({ userId: "me" });
  console.log("Drafts found:", drafts.data.drafts?.length || 0);

} catch (error: any) {
  if (error.code === 401) {
    console.error("ERROR: Authentication failed - tokens expired or revoked");
    console.error("Re-run authorization flow");
  } else if (error.code === 403) {
    console.error("ERROR: Permission denied");
    console.error("Ensure you have gmail.compose and gmail.modify scopes");
  } else if (error.code === 404) {
    console.error("ERROR: Draft or thread not found");
    console.error("The item may have been deleted or never existed");
  } else {
    console.error("ERROR:", error.message);
  }
  process.exit(1);
}
EOF
```

---

## Required OAuth Scopes {#scopes}

| Operation | Minimum Scope |
|-----------|---------------|
| Read drafts | `gmail.readonly` |
| Create/update drafts | `gmail.compose` |
| Send drafts | `gmail.send` or `gmail.compose` |
| Delete drafts | `gmail.modify` |
| Read threads | `gmail.readonly` |
| Modify thread labels | `gmail.modify` |
| Trash/delete threads | `gmail.modify` |

**Recommended**: Use `gmail.modify` for full draft and thread functionality.
