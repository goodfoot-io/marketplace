# Settings Operations

> **Official docs**: https://developers.google.com/gmail/api/reference/rest/v1/users.settings

This document covers Gmail settings operations: vacation responder configuration, auto-forwarding setup, and profile information retrieval.

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

## Profile Information {#profile}

Retrieve basic account information including email address and message statistics.

### Get Profile

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

const res = await gmail.users.getProfile({
  userId: "me"
});

console.log("Profile Information:");
console.log("  Email:", res.data.emailAddress);
console.log("  Total messages:", res.data.messagesTotal);
console.log("  Total threads:", res.data.threadsTotal);
console.log("  History ID:", res.data.historyId);
EOF
```

### Profile Response Fields

| Field | Description |
|-------|-------------|
| `emailAddress` | User's email address |
| `messagesTotal` | Total number of messages in the mailbox |
| `threadsTotal` | Total number of threads in the mailbox |
| `historyId` | Current history record ID (for incremental sync) |

**Use cases for historyId**:
- Track changes since last sync using `gmail.users.history.list()`
- Implement incremental backup strategies
- Build real-time sync features

---

## Vacation Responder {#vacation}

Configure automatic out-of-office replies.

### Vacation Responder Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `enableAutoReply` | boolean | Enable or disable the vacation responder |
| `responseSubject` | string | Subject line for auto-reply messages |
| `responseBodyPlainText` | string | Plain text body of the auto-reply |
| `responseBodyHtml` | string | HTML body of the auto-reply (optional) |
| `restrictToContacts` | boolean | Only reply to people in contacts |
| `restrictToDomain` | boolean | Only reply to people in same domain |
| `startTime` | number | Start time in milliseconds since epoch |
| `endTime` | number | End time in milliseconds since epoch |

### Get Vacation Settings {#get-vacation}

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

const res = await gmail.users.settings.getVacation({
  userId: "me"
});

console.log("Vacation Responder Settings:");
console.log("  Enabled:", res.data.enableAutoReply || false);
console.log("  Subject:", res.data.responseSubject || "(not set)");
console.log("  Body:", res.data.responseBodyPlainText || "(not set)");

if (res.data.startTime) {
  console.log("  Start:", new Date(parseInt(res.data.startTime)).toISOString());
}
if (res.data.endTime) {
  console.log("  End:", new Date(parseInt(res.data.endTime)).toISOString());
}

console.log("  Restrict to contacts:", res.data.restrictToContacts || false);
console.log("  Restrict to domain:", res.data.restrictToDomain || false);
EOF
```

### Enable Vacation Responder {#enable-vacation}

```bash
START_DATE="2024-12-20" END_DATE="2024-12-31" tsx << 'EOF'
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

const { START_DATE, END_DATE } = process.env;

// Convert dates to milliseconds since epoch
const startTime = new Date(START_DATE!).getTime();
const endTime = new Date(END_DATE!).getTime();

const res = await gmail.users.settings.updateVacation({
  userId: "me",
  requestBody: {
    enableAutoReply: true,
    responseSubject: "Out of Office",
    responseBodyPlainText: `Thank you for your email. I am currently out of the office from ${START_DATE} to ${END_DATE} with limited access to email.

I will respond to your message when I return. For urgent matters, please contact the team at team@example.com.

Best regards`,
    startTime: startTime.toString(),
    endTime: endTime.toString(),
    restrictToContacts: false,
    restrictToDomain: false
  }
});

console.log("Vacation responder enabled!");
console.log("  Subject:", res.data.responseSubject);
console.log("  Start:", new Date(parseInt(res.data.startTime!)).toLocaleDateString());
console.log("  End:", new Date(parseInt(res.data.endTime!)).toLocaleDateString());
EOF
```

### Enable Vacation with HTML Body {#vacation-html}

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

const startTime = new Date("2024-12-20").getTime();
const endTime = new Date("2024-12-31").getTime();

const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <h2 style="color: #333;">Out of Office</h2>
  <p>Thank you for your email. I am currently out of the office with limited access to email.</p>
  <p><strong>Return date:</strong> December 31, 2024</p>
  <p>For urgent matters, please contact:</p>
  <ul>
    <li>Team inbox: <a href="mailto:team@example.com">team@example.com</a></li>
    <li>Emergency: +1-555-0123</li>
  </ul>
  <p style="color: #666; font-size: 12px;">This is an automated response.</p>
</div>
`;

const res = await gmail.users.settings.updateVacation({
  userId: "me",
  requestBody: {
    enableAutoReply: true,
    responseSubject: "Out of Office - Will Return Dec 31",
    responseBodyPlainText: "Thank you for your email. I am out of the office until December 31.",
    responseBodyHtml: htmlBody,
    startTime: startTime.toString(),
    endTime: endTime.toString()
  }
});

console.log("Vacation responder enabled with HTML body!");
console.log("  Subject:", res.data.responseSubject);
EOF
```

### Enable Vacation with Restrictions {#vacation-restricted}

Limit auto-replies to contacts only or same domain:

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

const res = await gmail.users.settings.updateVacation({
  userId: "me",
  requestBody: {
    enableAutoReply: true,
    responseSubject: "Out of Office",
    responseBodyPlainText: "I am currently out of the office. I will respond when I return.",
    restrictToContacts: true,  // Only reply to people in my contacts
    restrictToDomain: false
  }
});

console.log("Vacation responder enabled (contacts only)!");
console.log("  Restrict to contacts:", res.data.restrictToContacts);
console.log("  Restrict to domain:", res.data.restrictToDomain);
EOF
```

### Disable Vacation Responder {#disable-vacation}

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

const res = await gmail.users.settings.updateVacation({
  userId: "me",
  requestBody: {
    enableAutoReply: false
  }
});

console.log("Vacation responder disabled!");
console.log("  Enabled:", res.data.enableAutoReply);
EOF
```

---

## Auto-Forwarding {#forwarding}

Configure automatic email forwarding to another address.

### Forwarding Setup Overview

Auto-forwarding requires two steps:
1. **Add and verify forwarding address** - Gmail sends a verification email
2. **Enable forwarding** - Configure what to do with forwarded messages

### Forwarding Parameters

| Parameter | Description |
|-----------|-------------|
| `enabled` | Enable or disable forwarding |
| `emailAddress` | Verified forwarding destination |
| `disposition` | What to do with original message after forwarding |

### Disposition Options

| Value | Description |
|-------|-------------|
| `leaveInInbox` | Keep message in inbox (default) |
| `archive` | Remove from inbox, keep in All Mail |
| `trash` | Move to trash |
| `markRead` | Mark as read, keep in inbox |

---

### Step 1: Add Forwarding Address {#add-forwarding}

Add a new forwarding address (sends verification email):

```bash
FORWARD_TO="backup@example.com" tsx << 'EOF'
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

const { FORWARD_TO } = process.env;

try {
  const res = await gmail.users.settings.forwardingAddresses.create({
    userId: "me",
    requestBody: {
      forwardingEmail: FORWARD_TO
    }
  });

  console.log("Forwarding address added!");
  console.log("  Email:", res.data.forwardingEmail);
  console.log("  Status:", res.data.verificationStatus);

  if (res.data.verificationStatus === "pending") {
    console.log("\n*** IMPORTANT ***");
    console.log(`A verification email has been sent to ${FORWARD_TO}`);
    console.log("The recipient must click the verification link before forwarding can be enabled.");
  }
} catch (error: any) {
  if (error.code === 409) {
    console.log("Forwarding address already exists:", FORWARD_TO);
  } else {
    throw error;
  }
}
EOF
```

### Step 2: Check Verification Status {#check-verification}

Check if a forwarding address has been verified:

```bash
FORWARD_TO="backup@example.com" tsx << 'EOF'
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

const { FORWARD_TO } = process.env;

const res = await gmail.users.settings.forwardingAddresses.get({
  userId: "me",
  forwardingEmail: FORWARD_TO
});

console.log("Forwarding Address Status:");
console.log("  Email:", res.data.forwardingEmail);
console.log("  Status:", res.data.verificationStatus);

if (res.data.verificationStatus === "accepted") {
  console.log("\n  Ready to enable forwarding!");
} else if (res.data.verificationStatus === "pending") {
  console.log("\n  Waiting for verification - check inbox of forwarding address.");
}
EOF
```

### List All Forwarding Addresses {#list-forwarding}

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

const res = await gmail.users.settings.forwardingAddresses.list({
  userId: "me"
});

const addresses = res.data.forwardingAddresses || [];

if (addresses.length === 0) {
  console.log("No forwarding addresses configured.");
} else {
  console.log("Forwarding Addresses:\n");
  addresses.forEach(addr => {
    const status = addr.verificationStatus === "accepted" ? "[VERIFIED]" : "[PENDING]";
    console.log(`  ${status} ${addr.forwardingEmail}`);
  });
}
EOF
```

### Step 3: Enable Auto-Forwarding {#enable-forwarding}

Enable forwarding to a verified address:

```bash
FORWARD_TO="backup@example.com" DISPOSITION="archive" tsx << 'EOF'
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

const { FORWARD_TO, DISPOSITION } = process.env;

// First verify the address is verified
const addrRes = await gmail.users.settings.forwardingAddresses.get({
  userId: "me",
  forwardingEmail: FORWARD_TO
});

if (addrRes.data.verificationStatus !== "accepted") {
  console.error("ERROR: Forwarding address not verified yet");
  console.error("Status:", addrRes.data.verificationStatus);
  process.exit(1);
}

// Enable forwarding
const res = await gmail.users.settings.updateAutoForwarding({
  userId: "me",
  requestBody: {
    enabled: true,
    emailAddress: FORWARD_TO,
    disposition: DISPOSITION as "leaveInInbox" | "archive" | "trash" | "markRead"
  }
});

console.log("Auto-forwarding enabled!");
console.log("  Forward to:", res.data.emailAddress);
console.log("  Disposition:", res.data.disposition);
console.log("  Enabled:", res.data.enabled);
EOF
```

### Get Current Forwarding Settings {#get-forwarding}

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

const res = await gmail.users.settings.getAutoForwarding({
  userId: "me"
});

console.log("Auto-Forwarding Settings:");
console.log("  Enabled:", res.data.enabled || false);

if (res.data.enabled) {
  console.log("  Forward to:", res.data.emailAddress);
  console.log("  Disposition:", res.data.disposition);
} else {
  console.log("  (Forwarding is disabled)");
}
EOF
```

### Disable Auto-Forwarding {#disable-forwarding}

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

const res = await gmail.users.settings.updateAutoForwarding({
  userId: "me",
  requestBody: {
    enabled: false
  }
});

console.log("Auto-forwarding disabled!");
console.log("  Enabled:", res.data.enabled);
EOF
```

### Delete Forwarding Address {#delete-forwarding}

Remove a forwarding address from the account:

```bash
FORWARD_TO="backup@example.com" tsx << 'EOF'
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

const { FORWARD_TO } = process.env;

// First disable forwarding if this address is active
const currentSettings = await gmail.users.settings.getAutoForwarding({
  userId: "me"
});

if (currentSettings.data.enabled && currentSettings.data.emailAddress === FORWARD_TO) {
  await gmail.users.settings.updateAutoForwarding({
    userId: "me",
    requestBody: { enabled: false }
  });
  console.log("Disabled forwarding before removing address.");
}

// Delete the forwarding address
await gmail.users.settings.forwardingAddresses.delete({
  userId: "me",
  forwardingEmail: FORWARD_TO
});

console.log("Forwarding address removed:", FORWARD_TO);
EOF
```

---

## Complete Settings Workflow

### Setup Vacation and Forwarding Together

```bash
FORWARD_TO="backup@example.com" START_DATE="2024-12-20" END_DATE="2024-12-31" tsx << 'EOF'
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

const { FORWARD_TO, START_DATE, END_DATE } = process.env;

// Get current profile
const profile = await gmail.users.getProfile({ userId: "me" });
console.log("Setting up vacation for:", profile.data.emailAddress);
console.log("---");

// Step 1: Set up vacation responder
const startTime = new Date(START_DATE!).getTime();
const endTime = new Date(END_DATE!).getTime();

await gmail.users.settings.updateVacation({
  userId: "me",
  requestBody: {
    enableAutoReply: true,
    responseSubject: "Out of Office",
    responseBodyPlainText: `Thank you for your email. I am out of the office from ${START_DATE} to ${END_DATE}.

For urgent matters, please contact ${FORWARD_TO}.

Best regards`,
    startTime: startTime.toString(),
    endTime: endTime.toString()
  }
});
console.log("[OK] Vacation responder enabled");
console.log("     Period:", START_DATE, "to", END_DATE);

// Step 2: Check if forwarding address is verified
try {
  const addrStatus = await gmail.users.settings.forwardingAddresses.get({
    userId: "me",
    forwardingEmail: FORWARD_TO
  });

  if (addrStatus.data.verificationStatus === "accepted") {
    // Enable forwarding
    await gmail.users.settings.updateAutoForwarding({
      userId: "me",
      requestBody: {
        enabled: true,
        emailAddress: FORWARD_TO,
        disposition: "leaveInInbox"
      }
    });
    console.log("[OK] Auto-forwarding enabled to:", FORWARD_TO);
  } else {
    console.log("[WARN] Forwarding address pending verification:", FORWARD_TO);
    console.log("       Please verify before enabling forwarding.");
  }
} catch (error: any) {
  if (error.code === 404) {
    // Add forwarding address
    await gmail.users.settings.forwardingAddresses.create({
      userId: "me",
      requestBody: { forwardingEmail: FORWARD_TO }
    });
    console.log("[INFO] Forwarding address added:", FORWARD_TO);
    console.log("       Verification email sent - verify before forwarding works.");
  } else {
    throw error;
  }
}

console.log("---");
console.log("Vacation setup complete!");
EOF
```

### Reset All Settings

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

console.log("Resetting Gmail settings...\n");

// Disable vacation responder
await gmail.users.settings.updateVacation({
  userId: "me",
  requestBody: {
    enableAutoReply: false
  }
});
console.log("[OK] Vacation responder disabled");

// Disable auto-forwarding
await gmail.users.settings.updateAutoForwarding({
  userId: "me",
  requestBody: {
    enabled: false
  }
});
console.log("[OK] Auto-forwarding disabled");

console.log("\nAll settings reset to defaults.");
EOF
```

---

## Error Handling

### Common Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `400 Bad Request` | Invalid date format or disposition | Use milliseconds for dates; valid disposition values |
| `401 Unauthorized` | Token expired | Re-authorize |
| `403 Forbidden` | Missing settings scope | Add `gmail.settings.basic` or `gmail.settings.sharing` |
| `404 Not Found` | Forwarding address not found | Add the address first |
| `409 Conflict` | Forwarding address already exists | Check existing addresses |

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

      // Don't retry on auth or permission errors
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

  // Example: Get vacation settings with retry
  const vacation = await withRetry(() =>
    gmail.users.settings.getVacation({ userId: "me" })
  );

  console.log("Vacation status:", vacation.data.enableAutoReply ? "enabled" : "disabled");

} catch (error: any) {
  if (error.code === 401) {
    console.error("ERROR: Authentication failed - tokens expired or revoked");
    console.error("Re-run authorization flow");
  } else if (error.code === 403) {
    console.error("ERROR: Permission denied - check OAuth scopes");
    console.error("Required: gmail.settings.basic or gmail.settings.sharing");
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

## Required OAuth Scopes

| Operation | Minimum Scope |
|-----------|---------------|
| Get profile | `gmail.readonly` |
| Get vacation settings | `gmail.settings.basic` |
| Update vacation settings | `gmail.settings.basic` |
| Get forwarding settings | `gmail.settings.basic` |
| Update forwarding settings | `gmail.settings.sharing` |
| Manage forwarding addresses | `gmail.settings.sharing` |

**Recommended**: Use `gmail.settings.sharing` for full settings access (includes vacation and forwarding).
