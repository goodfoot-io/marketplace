# Messages Operations

> **Official docs**: https://developers.google.com/gmail/api/reference/rest/v1/users.messages

This document covers all message-related operations for the Gmail API: sending, reading, searching, deleting, and batch operations.

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

## Base64url Encoding {#encoding}

Gmail API uses base64url encoding (RFC 4648), NOT standard base64.

```typescript
// Encode for sending to Gmail API
function encodeBase64url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Decode from Gmail API response
function decodeBase64url(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}
```

**Common mistake**: Using standard base64 causes `400 Bad Request` errors.

---

## Send Email {#send}

### Simple Text Email

```bash
TO="recipient@example.com" SUBJECT="Hello" BODY="Message body" tsx << 'EOF'
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

// Base64url encode
const encodedMessage = Buffer.from(message)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const res = await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw: encodedMessage }
});

console.log("Email sent! Message ID:", res.data.id);
EOF
```

### HTML Email

```bash
TO="recipient@example.com" SUBJECT="HTML Email" tsx << 'EOF'
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
  <h1>Hello!</h1>
  <p>This is an <strong>HTML</strong> email.</p>
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

const res = await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw: encodedMessage }
});

console.log("HTML email sent! Message ID:", res.data.id);
EOF
```

### Send with Attachments (Nodemailer)

For attachments, use `nodemailer` to construct RFC 2822 compliant MIME messages:

```bash
TO="recipient@example.com" SUBJECT="With Attachment" ATTACHMENT_PATH="/path/to/file.pdf" tsx << 'EOF'
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

// Use nodemailer to build MIME message
const transporter = createTransport({ streamTransport: true });
const mailOptions = {
  from: "me",
  to: TO,
  subject: SUBJECT,
  text: "Please see the attached file.",
  attachments: [
    {
      path: ATTACHMENT_PATH
    }
  ]
};

// Build the message
const info = await transporter.sendMail(mailOptions);

// Get the raw message
const chunks: Buffer[] = [];
for await (const chunk of info.message) {
  chunks.push(chunk);
}
const rawMessage = Buffer.concat(chunks);

// Base64url encode
const encodedMessage = rawMessage
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const res = await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw: encodedMessage }
});

console.log("Email with attachment sent! Message ID:", res.data.id);
EOF
```

### Send with Multiple Attachments

```bash
TO="recipient@example.com" SUBJECT="Multiple Attachments" tsx << 'EOF'
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

const transporter = createTransport({ streamTransport: true });
const mailOptions = {
  from: "me",
  to: process.env.TO,
  subject: process.env.SUBJECT,
  text: "Here are your files.",
  html: "<p>Here are your <strong>files</strong>.</p>",
  attachments: [
    { path: "/path/to/document.pdf" },
    { path: "/path/to/image.png" },
    {
      filename: "data.json",
      content: JSON.stringify({ key: "value" }, null, 2),
      contentType: "application/json"
    }
  ]
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

const res = await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw: encodedMessage }
});

console.log("Email with multiple attachments sent! Message ID:", res.data.id);
EOF
```

### Attachment Size Limits

| Method | Size Limit | When to Use |
|--------|------------|-------------|
| Raw message body | 5MB | Small attachments |
| Resumable upload | 35MB | Large attachments |

For files larger than 5MB, use resumable upload:

```bash
ATTACHMENT_PATH="/path/to/large-file.zip" tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync, createReadStream, statSync } from "fs";
import { homedir } from "os";
import { join, basename } from "path";
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

const attachmentPath = process.env.ATTACHMENT_PATH!;
const fileSize = statSync(attachmentPath).size;

console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

if (fileSize > 5 * 1024 * 1024) {
  console.log("Using resumable upload for large file...");
}

// Build MIME message with nodemailer
const transporter = createTransport({ streamTransport: true });
const mailOptions = {
  from: "me",
  to: "recipient@example.com",
  subject: "Large attachment",
  text: "Large file attached.",
  attachments: [{ path: attachmentPath }]
};

const info = await transporter.sendMail(mailOptions);
const chunks: Buffer[] = [];
for await (const chunk of info.message) {
  chunks.push(chunk);
}
const rawMessage = Buffer.concat(chunks);

// For large files, use media upload
const res = await gmail.users.messages.send({
  userId: "me",
  uploadType: "resumable",
  requestBody: {},
  media: {
    mimeType: "message/rfc822",
    body: rawMessage.toString()
  }
});

console.log("Large email sent! Message ID:", res.data.id);
EOF
```

---

## Read Email {#read}

### Get Message by ID

```bash
MESSAGE_ID="..." tsx << 'EOF'
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

const res = await gmail.users.messages.get({
  userId: "me",
  id: process.env.MESSAGE_ID!,
  format: "full"
});

const headers = res.data.payload?.headers || [];
const getHeader = (name: string) =>
  headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

console.log("From:", getHeader("from"));
console.log("To:", getHeader("to"));
console.log("Subject:", getHeader("subject"));
console.log("Date:", getHeader("date"));
console.log("Labels:", res.data.labelIds?.join(", "));
EOF
```

### Format Options

| Format | Returns | Use Case |
|--------|---------|----------|
| `full` | Complete parsed message | Reading email content |
| `metadata` | Headers only | Quick listing |
| `minimal` | IDs and labels only | Batch operations |
| `raw` | Base64url encoded RFC 2822 | Downloading/archiving |

### MIME Parsing {#mime-parsing}

Gmail messages can have complex nested multipart structures. Use recursive extraction:

```bash
MESSAGE_ID="..." tsx << 'EOF'
import { google, gmail_v1 } from "googleapis";
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

interface EmailContent {
  text: string;
  html: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    attachmentId: string;
    size: number;
  }>;
}

function extractEmailContent(payload: gmail_v1.Schema$MessagePart): EmailContent {
  const result: EmailContent = { text: "", html: "", attachments: [] };

  function processPayload(part: gmail_v1.Schema$MessagePart) {
    const mimeType = part.mimeType || "";

    // Check for attachment
    if (part.filename && part.body?.attachmentId) {
      result.attachments.push({
        filename: part.filename,
        mimeType: mimeType,
        attachmentId: part.body.attachmentId,
        size: part.body.size || 0
      });
      return;
    }

    // Extract text content
    if (mimeType === "text/plain" && part.body?.data) {
      result.text += Buffer.from(part.body.data, "base64url").toString("utf8");
    }

    // Extract HTML content
    if (mimeType === "text/html" && part.body?.data) {
      result.html += Buffer.from(part.body.data, "base64url").toString("utf8");
    }

    // Handle simple message with body at top level
    if (!part.parts && part.body?.data && !mimeType.startsWith("multipart/")) {
      const decoded = Buffer.from(part.body.data, "base64url").toString("utf8");
      if (mimeType === "text/plain" || !mimeType) {
        result.text = decoded;
      } else if (mimeType === "text/html") {
        result.html = decoded;
      }
    }

    // Recursively process nested parts
    if (part.parts) {
      for (const subPart of part.parts) {
        processPayload(subPart);
      }
    }
  }

  processPayload(payload);
  return result;
}

const res = await gmail.users.messages.get({
  userId: "me",
  id: process.env.MESSAGE_ID!,
  format: "full"
});

const content = extractEmailContent(res.data.payload!);

console.log("=== TEXT CONTENT ===");
console.log(content.text || "(no text content)");

console.log("\n=== HTML CONTENT ===");
console.log(content.html ? "(HTML available)" : "(no HTML content)");

console.log("\n=== ATTACHMENTS ===");
if (content.attachments.length > 0) {
  for (const att of content.attachments) {
    console.log(`- ${att.filename} (${att.mimeType}, ${att.size} bytes)`);
  }
} else {
  console.log("(no attachments)");
}
EOF
```

### Get Raw Message

```bash
MESSAGE_ID="..." tsx << 'EOF'
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.messages.get({
  userId: "me",
  id: process.env.MESSAGE_ID!,
  format: "raw"
});

// Decode raw message (RFC 2822 format)
const rawMessage = Buffer.from(res.data.raw!, "base64url").toString("utf8");
console.log(rawMessage);

// Save to file
writeFileSync("message.eml", rawMessage);
console.log("\nSaved to message.eml");
EOF
```

---

## List and Search Emails {#list}

### List Recent Emails

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

const res = await gmail.users.messages.list({
  userId: "me",
  maxResults: parseInt(process.env.MAX_RESULTS || "20"),
  labelIds: ["INBOX"]
});

const messages = res.data.messages || [];
console.log(`Found ${messages.length} messages in INBOX\n`);

for (const msg of messages) {
  const detail = await gmail.users.messages.get({
    userId: "me",
    id: msg.id!,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Date"]
  });

  const headers = detail.data.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name === name)?.value || "";

  console.log(`ID: ${msg.id}`);
  console.log(`  From: ${getHeader("From")}`);
  console.log(`  Subject: ${getHeader("Subject")}`);
  console.log(`  Date: ${getHeader("Date")}`);
  console.log();
}

if (res.data.nextPageToken) {
  console.log("More messages available. Use pageToken:", res.data.nextPageToken);
}
EOF
```

### Search with Gmail Query Syntax {#query-syntax}

```bash
QUERY="from:example@gmail.com has:attachment after:2024/01/01" tsx << 'EOF'
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

const res = await gmail.users.messages.list({
  userId: "me",
  q: process.env.QUERY,
  maxResults: 50
});

const messages = res.data.messages || [];
console.log(`Found ${messages.length} messages matching: ${process.env.QUERY}\n`);

for (const msg of messages.slice(0, 10)) {
  const detail = await gmail.users.messages.get({
    userId: "me",
    id: msg.id!,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Date"]
  });

  const headers = detail.data.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name === name)?.value || "";

  console.log(`${msg.id}: ${getHeader("Subject")}`);
  console.log(`  From: ${getHeader("From")}, Date: ${getHeader("Date")}`);
}
EOF
```

### Gmail Query Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:user@example.com` | Messages from sender |
| `to:` | `to:me` | Messages to recipient |
| `subject:` | `subject:"meeting notes"` | Subject contains phrase |
| `has:attachment` | `has:attachment` | Has any attachment |
| `filename:` | `filename:pdf` | Attachment filename contains |
| `after:` | `after:2024/01/01` | After date (YYYY/MM/DD) |
| `before:` | `before:2024/12/31` | Before date |
| `older_than:` | `older_than:7d` | Older than duration (d/m/y) |
| `newer_than:` | `newer_than:2d` | Newer than duration |
| `is:unread` | `is:unread` | Unread messages |
| `is:starred` | `is:starred` | Starred messages |
| `is:important` | `is:important` | Important messages |
| `label:` | `label:work` | Has specific label |
| `in:` | `in:trash` | In specific folder |
| `larger:` | `larger:5M` | Larger than size |
| `smaller:` | `smaller:100K` | Smaller than size |
| `category:` | `category:promotions` | In category tab |

### Combining Operators

```bash
# AND (space-separated)
QUERY="from:alice subject:project after:2024/01/01"

# OR
QUERY="from:alice OR from:bob"

# Alternative OR syntax (braces)
QUERY="{from:alice from:bob}"

# NOT (minus sign)
QUERY="from:alice -subject:spam"

# Grouping
QUERY="(from:alice OR from:bob) has:attachment"
```

### Paginated Search

```bash
QUERY="is:unread" tsx << 'EOF'
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

let pageToken: string | undefined;
let totalMessages = 0;
const maxPages = 5; // Limit pagination
let currentPage = 0;

do {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: process.env.QUERY,
    maxResults: 100,
    pageToken: pageToken
  });

  const messages = res.data.messages || [];
  totalMessages += messages.length;
  currentPage++;

  console.log(`Page ${currentPage}: ${messages.length} messages`);

  pageToken = res.data.nextPageToken || undefined;

} while (pageToken && currentPage < maxPages);

console.log(`\nTotal: ${totalMessages} messages found`);
EOF
```

---

## Delete and Trash Operations {#delete}

### Move to Trash (Recoverable)

```bash
MESSAGE_ID="..." tsx << 'EOF'
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

const res = await gmail.users.messages.trash({
  userId: "me",
  id: process.env.MESSAGE_ID!
});

console.log("Message moved to trash:", res.data.id);
console.log("Labels:", res.data.labelIds?.join(", "));
EOF
```

### Restore from Trash

```bash
MESSAGE_ID="..." tsx << 'EOF'
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

const res = await gmail.users.messages.untrash({
  userId: "me",
  id: process.env.MESSAGE_ID!
});

console.log("Message restored from trash:", res.data.id);
console.log("Labels:", res.data.labelIds?.join(", "));
EOF
```

### Permanent Delete (Irreversible)

```bash
MESSAGE_ID="..." tsx << 'EOF'
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

// WARNING: This permanently deletes the message!
await gmail.users.messages.delete({
  userId: "me",
  id: process.env.MESSAGE_ID!
});

console.log("Message permanently deleted:", process.env.MESSAGE_ID);
EOF
```

---

## Modify Messages {#modify}

### Add/Remove Labels

```bash
MESSAGE_ID="..." ADD_LABELS="STARRED,Label_123" REMOVE_LABELS="UNREAD" tsx << 'EOF'
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

const addLabels = process.env.ADD_LABELS?.split(",").filter(Boolean) || [];
const removeLabels = process.env.REMOVE_LABELS?.split(",").filter(Boolean) || [];

const res = await gmail.users.messages.modify({
  userId: "me",
  id: process.env.MESSAGE_ID!,
  requestBody: {
    addLabelIds: addLabels,
    removeLabelIds: removeLabels
  }
});

console.log("Message modified:", res.data.id);
console.log("Current labels:", res.data.labelIds?.join(", "));
EOF
```

### Mark as Read/Unread

```bash
# Mark as read
MESSAGE_ID="..." tsx << 'EOF'
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

await gmail.users.messages.modify({
  userId: "me",
  id: process.env.MESSAGE_ID!,
  requestBody: {
    removeLabelIds: ["UNREAD"]
  }
});

console.log("Message marked as read");
EOF
```

```bash
# Mark as unread
MESSAGE_ID="..." tsx << 'EOF'
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

await gmail.users.messages.modify({
  userId: "me",
  id: process.env.MESSAGE_ID!,
  requestBody: {
    addLabelIds: ["UNREAD"]
  }
});

console.log("Message marked as unread");
EOF
```

### Star/Unstar Messages

```bash
MESSAGE_ID="..." tsx << 'EOF'
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

// Star the message
await gmail.users.messages.modify({
  userId: "me",
  id: process.env.MESSAGE_ID!,
  requestBody: {
    addLabelIds: ["STARRED"]
  }
});

console.log("Message starred");
EOF
```

---

## Batch Operations {#batch}

### Batch Modify (Change Labels on Multiple Messages)

```bash
MESSAGE_IDS="id1,id2,id3" ADD_LABELS="Label_work" REMOVE_LABELS="UNREAD" tsx << 'EOF'
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

const messageIds = process.env.MESSAGE_IDS!.split(",");
const addLabels = process.env.ADD_LABELS?.split(",").filter(Boolean) || [];
const removeLabels = process.env.REMOVE_LABELS?.split(",").filter(Boolean) || [];

await gmail.users.messages.batchModify({
  userId: "me",
  requestBody: {
    ids: messageIds,
    addLabelIds: addLabels,
    removeLabelIds: removeLabels
  }
});

console.log(`Batch modified ${messageIds.length} messages`);
console.log("Added labels:", addLabels.join(", ") || "(none)");
console.log("Removed labels:", removeLabels.join(", ") || "(none)");
EOF
```

### Batch Delete (Permanent)

```bash
MESSAGE_IDS="id1,id2,id3" tsx << 'EOF'
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

const messageIds = process.env.MESSAGE_IDS!.split(",");

// WARNING: This permanently deletes all specified messages!
await gmail.users.messages.batchDelete({
  userId: "me",
  requestBody: {
    ids: messageIds
  }
});

console.log(`Permanently deleted ${messageIds.length} messages`);
EOF
```

### Batch Operations with Fallback

For robust batch operations with error recovery:

```bash
QUERY="is:unread older_than:30d" tsx << 'EOF'
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

const BATCH_SIZE = 50;  // Gmail batch limit

// Find messages matching query
const res = await gmail.users.messages.list({
  userId: "me",
  q: process.env.QUERY,
  maxResults: 500
});

const messages = res.data.messages || [];
console.log(`Found ${messages.length} messages to process`);

// Process in batches
let processed = 0;
let errors = 0;

for (let i = 0; i < messages.length; i += BATCH_SIZE) {
  const batch = messages.slice(i, i + BATCH_SIZE);
  const batchIds = batch.map(m => m.id!);

  try {
    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {
        ids: batchIds,
        removeLabelIds: ["UNREAD"]
      }
    });
    processed += batchIds.length;
    console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchIds.length} messages`);
  } catch (error: any) {
    console.error(`Batch failed, falling back to individual operations...`);

    // Fall back to individual operations
    for (const id of batchIds) {
      try {
        await gmail.users.messages.modify({
          userId: "me",
          id: id,
          requestBody: { removeLabelIds: ["UNREAD"] }
        });
        processed++;
      } catch (e: any) {
        errors++;
        console.error(`Failed to modify ${id}: ${e.message}`);
      }
    }
  }
}

console.log(`\nComplete: ${processed} processed, ${errors} errors`);
EOF
```

---

## Attachment Operations {#attachments}

### List Attachments

```bash
MESSAGE_ID="..." tsx << 'EOF'
import { google, gmail_v1 } from "googleapis";
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

const res = await gmail.users.messages.get({
  userId: "me",
  id: process.env.MESSAGE_ID!,
  format: "full"
});

interface Attachment {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}

function findAttachments(payload: gmail_v1.Schema$MessagePart): Attachment[] {
  const attachments: Attachment[] = [];

  function processPayload(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        attachmentId: part.body.attachmentId,
        size: part.body.size || 0
      });
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        processPayload(subPart);
      }
    }
  }

  processPayload(payload);
  return attachments;
}

const attachments = findAttachments(res.data.payload!);

if (attachments.length === 0) {
  console.log("No attachments found");
} else {
  console.log(`Found ${attachments.length} attachment(s):\n`);
  for (const att of attachments) {
    console.log(`Filename: ${att.filename}`);
    console.log(`  Type: ${att.mimeType}`);
    console.log(`  Size: ${(att.size / 1024).toFixed(2)} KB`);
    console.log(`  ID: ${att.attachmentId}`);
    console.log();
  }
}
EOF
```

### Download Attachment

```bash
MESSAGE_ID="..." ATTACHMENT_ID="..." OUTPUT_PATH="/path/to/output" tsx << 'EOF'
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

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const res = await gmail.users.messages.attachments.get({
  userId: "me",
  messageId: process.env.MESSAGE_ID!,
  id: process.env.ATTACHMENT_ID!
});

// Decode base64url attachment data
const data = res.data.data!;
const buffer = Buffer.from(data, "base64url");

const outputPath = process.env.OUTPUT_PATH!;
writeFileSync(outputPath, buffer);

console.log(`Attachment saved to: ${outputPath}`);
console.log(`Size: ${(buffer.length / 1024).toFixed(2)} KB`);
EOF
```

### Download All Attachments from Message

```bash
MESSAGE_ID="..." OUTPUT_DIR="/path/to/output/dir" tsx << 'EOF'
import { google, gmail_v1 } from "googleapis";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
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

const outputDir = process.env.OUTPUT_DIR!;

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Get message
const res = await gmail.users.messages.get({
  userId: "me",
  id: process.env.MESSAGE_ID!,
  format: "full"
});

// Find attachments
interface Attachment {
  filename: string;
  attachmentId: string;
}

function findAttachments(payload: gmail_v1.Schema$MessagePart): Attachment[] {
  const attachments: Attachment[] = [];

  function processPayload(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        attachmentId: part.body.attachmentId
      });
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        processPayload(subPart);
      }
    }
  }

  processPayload(payload);
  return attachments;
}

const attachments = findAttachments(res.data.payload!);

if (attachments.length === 0) {
  console.log("No attachments found");
  process.exit(0);
}

console.log(`Downloading ${attachments.length} attachment(s)...\n`);

for (const att of attachments) {
  const attachmentRes = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId: process.env.MESSAGE_ID!,
    id: att.attachmentId
  });

  const buffer = Buffer.from(attachmentRes.data.data!, "base64url");
  const filePath = join(outputDir, att.filename);

  writeFileSync(filePath, buffer);
  console.log(`Saved: ${att.filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
}

console.log(`\nAll attachments saved to: ${outputDir}`);
EOF
```

---

## Reply Operations {#reply}

### Reply to a Message

```bash
ORIGINAL_MESSAGE_ID="..." REPLY_BODY="Thanks for your email!" tsx << 'EOF'
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

// Get original message for headers
const original = await gmail.users.messages.get({
  userId: "me",
  id: process.env.ORIGINAL_MESSAGE_ID!,
  format: "metadata",
  metadataHeaders: ["From", "Subject", "Message-ID", "References"]
});

const headers = original.data.payload?.headers || [];
const getHeader = (name: string) =>
  headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

const originalFrom = getHeader("From");
const originalSubject = getHeader("Subject") || "";
const originalMessageId = getHeader("Message-ID");
const originalReferences = getHeader("References");

// Build References header for threading
const references = originalReferences
  ? `${originalReferences} ${originalMessageId}`
  : originalMessageId;

// Construct reply
const replySubject = originalSubject.startsWith("Re:")
  ? originalSubject
  : `Re: ${originalSubject}`;

const message = [
  `To: ${originalFrom}`,
  `Subject: ${replySubject}`,
  `In-Reply-To: ${originalMessageId}`,
  `References: ${references}`,
  "Content-Type: text/plain; charset=utf-8",
  "",
  process.env.REPLY_BODY
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
    threadId: original.data.threadId  // Keep in same thread
  }
});

console.log("Reply sent! Message ID:", res.data.id);
console.log("Thread ID:", res.data.threadId);
EOF
```

---

## Error Handling {#errors}

### Common Error Codes

| Code | Error | Cause | Solution |
|------|-------|-------|----------|
| 400 | `Invalid request` | Malformed base64, missing fields | Check encoding, required params |
| 401 | `Unauthorized` | Token expired or revoked | Re-authorize |
| 403 | `Forbidden` | Missing scopes, quota exceeded | Add scopes, implement backoff |
| 404 | `Not Found` | Invalid message ID | Verify message exists |
| 429 | `Too Many Requests` | Rate limited | Implement exponential backoff |
| 500 | `Internal Error` | Gmail server issue | Retry with backoff |

### Robust Error Handling Pattern

```bash
tsx << 'EOF'
import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");

// Check credentials exist
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

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on auth errors
      if (error.code === 401 || error.code === 403) {
        throw error;
      }

      // Retry on rate limiting or server errors
      if (error.code === 429 || error.code >= 500) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError;
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

  // Example with retry
  const profile = await withRetry(() =>
    gmail.users.getProfile({ userId: "me" })
  );

  console.log("Connected as:", profile.data.emailAddress);

} catch (error: any) {
  if (error.code === 401) {
    console.error("ERROR: Authentication failed - tokens expired or revoked");
    console.error("Re-run authorization flow");
  } else if (error.code === 403) {
    console.error("ERROR: Permission denied - check OAuth scopes");
  } else if (error.code === 429) {
    console.error("ERROR: Rate limited - try again later");
  } else {
    console.error("ERROR:", error.message);
  }
  process.exit(1);
}
EOF
```

---

## Rate Limits {#rate-limits}

Gmail API has quota-based rate limiting:

| Operation | Cost (quota units) |
|-----------|-------------------|
| messages.get | 5 |
| messages.list | 5 |
| messages.send | 100 |
| messages.modify | 5 |
| messages.delete | 10 |
| messages.batchModify | 50 |
| messages.batchDelete | 50 |

**Default quotas**:
- 250 quota units per user per second
- 1,000,000 quota units per day

**Best practices**:
- Use batch operations where possible
- Implement exponential backoff
- Cache message metadata
- Use `format: "metadata"` when full content not needed
