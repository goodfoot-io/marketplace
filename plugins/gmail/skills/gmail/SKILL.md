---
name: gmail
description: Gmail operations using the googleapis NPM package. Use when sending,
  reading, searching, or organizing emails programmatically. Handles drafts, labels,
  threads, filters, and attachments through Google's official SDK.
---

# Gmail Reference (SDK)

Uses `googleapis` with `tsx`. Run inline scripts using heredocs for top-level await support:

```bash
tsx << 'EOF'
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
// your code with top-level await
EOF
```

## Agent Workflow

This skill enables you to interact with Gmail like a user would through the Gmail API. Authentication uses OAuth 2.0 with credentials stored locally.

**IMPORTANT**: Use `tsx << 'EOF' ... EOF` heredoc syntax for inline execution with top-level await. The `tsx -e` flag does NOT support top-level await.

### Credential Detection

1. **Check for credentials** -> Look for `~/.gmail-skill/` directory
2. **Validate files** -> Must contain `client_secret.json` and `tokens.json`
3. **Test authentication** -> Run a simple profile fetch to verify tokens work
4. **Handle failures** -> Guide user to OAuth setup if credentials missing or invalid

```bash
# Check credential status
tsx << 'EOF'
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const credPath = join(homedir(), ".gmail-skill");
const clientSecretPath = join(credPath, "client_secret.json");
const tokensPath = join(credPath, "tokens.json");

if (!existsSync(credPath)) {
  console.log("SETUP_REQUIRED: ~/.gmail-skill/ directory not found");
  console.log("See advanced/oauth-setup.md for setup instructions");
  process.exit(1);
}

if (!existsSync(clientSecretPath)) {
  console.log("SETUP_REQUIRED: client_secret.json not found");
  process.exit(1);
}

if (!existsSync(tokensPath)) {
  console.log("AUTH_REQUIRED: tokens.json not found - run authorization flow");
  process.exit(1);
}

const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
const expiryDate = tokens.expiry_date;
const isExpired = expiryDate && Date.now() > expiryDate;

console.log("CREDENTIALS_FOUND");
console.log("Access token expires:", new Date(expiryDate).toISOString());
console.log("Token status:", isExpired ? "EXPIRED (will auto-refresh)" : "VALID");
EOF
```

### Session Lifecycle

```
+-------------------------------------------------------------+
| FIRST CALL: Verify credentials                               |
|   1. Check ~/.gmail-skill/ for credential files              |
|   2. If missing, guide user to advanced/oauth-setup.md       |
|   3. Test connection with profile fetch                      |
+-------------------------------------------------------------+
                            |
+-------------------------------------------------------------+
| SUBSEQUENT CALLS: Execute operations                         |
|   1. Load credentials and create auth client                 |
|   2. Perform Gmail API operations                            |
|   3. Handle token refresh automatically                      |
+-------------------------------------------------------------+
```

---

## Critical Gotchas

| Issue | Reality | Fix |
|-------|---------|-----|
| Base64 encoding | Gmail uses base64url (RFC 4648), not standard base64 | Replace `+`->`-`, `/`->`_`, remove `=` padding |
| Token expiration | Access tokens expire in ~1 hour | googleapis handles auto-refresh; catch 401 errors |
| Refresh token validity | Expires if unused 6 months, password change, or >50 tokens | Re-authorize via OAuth flow when refresh fails |
| MIME parsing | Messages are nested multipart structures | Recursive traversal required for body extraction |
| Message immutability | Sent messages cannot be modified after sending | Delete and resend, or use drafts for edits |
| Rate limits | 250 quota units/user/second, varying costs per operation | Use batch operations, implement exponential backoff |
| Attachment size | 5MB limit for raw upload, 35MB with resumable | Use resumable upload for files >5MB |

---

## Quick Lookups

| Topic | When to Use | Reference |
|-------|-------------|-----------|
| OAuth credentials setup | First-time setup, re-authorization | advanced/oauth-setup.md |
| Send, read, search, delete | Core message operations | advanced/messages.md |
| Draft lifecycle, thread navigation | Drafts and conversation threads | advanced/drafts-threads.md |
| Label CRUD, filter templates | Organization and automation | advanced/labels-filters.md |
| Vacation responder, forwarding | Account settings | advanced/settings.md |

---

## Gmail Client Setup Pattern

Every script needs OAuth client initialization. Use this pattern:

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

// Handle token refresh - save new tokens when refreshed
oauth2Client.on("tokens", (newTokens) => {
  const updatedTokens = { ...tokens, ...newTokens };
  writeFileSync(join(credPath, "tokens.json"), JSON.stringify(updatedTokens, null, 2));
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// ========== YOUR CODE HERE ==========

EOF
```

---

## Essential Patterns

### Send a Simple Email

```bash
TO="recipient@example.com" SUBJECT="Hello" BODY="Message body here" tsx << 'EOF'
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

// Gmail requires base64url encoding
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

### Read an Email

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
  id: process.env.MESSAGE_ID,
  format: "full"
});

const headers = res.data.payload?.headers || [];
const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

console.log("From:", getHeader("from"));
console.log("To:", getHeader("to"));
console.log("Subject:", getHeader("subject"));
console.log("Date:", getHeader("date"));

// Extract body - handles both simple and multipart messages
function extractBody(payload: any): string {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf8");
      }
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }
  return "";
}

console.log("\nBody:\n", extractBody(res.data.payload));
EOF
```

### List Recent Emails

```bash
MAX_RESULTS="10" tsx << 'EOF'
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
  maxResults: parseInt(process.env.MAX_RESULTS || "10"),
  labelIds: ["INBOX"]
});

const messages = res.data.messages || [];
console.log(`Found ${messages.length} messages:\n`);

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
  console.log(`  Date: ${getHeader("Date")}\n`);
}
EOF
```

### Search Emails

```bash
# Gmail search query syntax: https://support.google.com/mail/answer/7190
QUERY="from:example@gmail.com after:2024/01/01 has:attachment" tsx << 'EOF'
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
  maxResults: 20
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

  console.log(`${msg.id}: ${getHeader("Subject")} (from ${getHeader("From")})`);
}
EOF
```

### Delete or Trash an Email

```bash
# Trash (recoverable)
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

await gmail.users.messages.trash({ userId: "me", id: process.env.MESSAGE_ID });
console.log("Message moved to trash:", process.env.MESSAGE_ID);
EOF
```

```bash
# Permanent delete (irreversible!)
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

await gmail.users.messages.delete({ userId: "me", id: process.env.MESSAGE_ID });
console.log("Message permanently deleted:", process.env.MESSAGE_ID);
EOF
```

---

## Gmail Query Syntax Reference

Common search operators for the `q` parameter:

| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:user@example.com` | Messages from sender |
| `to:` | `to:me` | Messages to recipient |
| `subject:` | `subject:meeting` | Subject contains word |
| `has:attachment` | `has:attachment` | Has any attachment |
| `filename:` | `filename:pdf` | Attachment filename |
| `after:` | `after:2024/01/01` | After date (YYYY/MM/DD) |
| `before:` | `before:2024/12/31` | Before date |
| `is:unread` | `is:unread` | Unread messages |
| `is:starred` | `is:starred` | Starred messages |
| `label:` | `label:work` | Has specific label |
| `larger:` | `larger:5M` | Larger than size |
| `in:` | `in:trash` | In specific folder |

Combine with spaces (AND) or `OR`:
- `from:alice subject:project` - Both conditions
- `from:alice OR from:bob` - Either condition
- `{from:alice from:bob}` - Alternative OR syntax

---

## Base64url Helper

Gmail API uses base64url encoding (RFC 4648). Use this pattern:

```typescript
// Encode for sending
function encodeBase64url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Decode from API response
function decodeBase64url(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}
```

---

## Error Handling

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
  console.error("Run OAuth setup: see advanced/oauth-setup.md");
  process.exit(1);
}

if (!existsSync(join(credPath, "tokens.json"))) {
  console.error("ERROR: tokens.json not found");
  console.error("Run authorization flow: see advanced/oauth-setup.md");
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

  // Test connection
  const profile = await gmail.users.getProfile({ userId: "me" });
  console.log("Connected as:", profile.data.emailAddress);

} catch (error: any) {
  if (error.code === 401) {
    console.error("ERROR: Authentication failed");
    console.error("Your tokens may be expired or revoked.");
    console.error("Re-run authorization: see advanced/oauth-setup.md");
  } else if (error.code === 403) {
    console.error("ERROR: Permission denied");
    console.error("Check that your OAuth app has the required Gmail scopes.");
  } else if (error.code === 429) {
    console.error("ERROR: Rate limited");
    console.error("Wait a moment and try again, or use batch operations.");
  } else {
    console.error("ERROR:", error.message);
  }
  process.exit(1);
}
EOF
```

---

## When to Ask the User

| Situation | Question |
|-----------|----------|
| Credentials not found | "Gmail credentials not found. Would you like me to guide you through OAuth setup?" |
| Token refresh failed | "Your Gmail authorization has expired. Please re-authorize the application." |
| Multiple recipients unclear | "Who should I send this email to?" |
| Delete vs trash | "Should I move this to trash (recoverable) or permanently delete it?" |
| Search returns many results | "Found many emails. Can you narrow the search criteria?" |

---

## Advanced Topics

| Topic | When to Use | Reference |
|-------|-------------|-----------|
| OAuth setup guide | First-time credential configuration | advanced/oauth-setup.md |
| Message operations | Send with attachments, batch operations | advanced/messages.md |
| Drafts and threads | Draft lifecycle, reply-in-thread | advanced/drafts-threads.md |
| Labels and filters | Organization, automation rules | advanced/labels-filters.md |
| Account settings | Vacation responder, forwarding | advanced/settings.md |

---

## Official Documentation

- **Gmail API Reference**: https://developers.google.com/gmail/api/reference/rest
- **googleapis npm**: https://www.npmjs.com/package/googleapis
- **OAuth 2.0 Guide**: https://developers.google.com/identity/protocols/oauth2
- **Gmail Search Operators**: https://support.google.com/mail/answer/7190
