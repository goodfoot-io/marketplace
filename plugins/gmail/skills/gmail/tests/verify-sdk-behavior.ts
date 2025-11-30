/**
 * Gmail SDK Behavior Verification Script
 * Run with: GMAIL_CREDENTIALS_PATH=~/.gmail-skill tsx plugins/gmail/skills/gmail/tests/verify-sdk-behavior.ts
 *
 * Tests actual SDK behavior to verify documentation accuracy.
 * Requires OAuth credentials configured in ~/.gmail-skill/ or GMAIL_CREDENTIALS_PATH.
 */

import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || join(homedir(), ".gmail-skill");
const CLIENT_SECRET_PATH = join(CREDENTIALS_PATH, "client_secret.json");
const TOKENS_PATH = join(CREDENTIALS_PATH, "tokens.json");

let oauth2Client: OAuth2Client;
let gmail: gmail_v1.Gmail;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Encode string to base64url format (RFC 4648)
 * Gmail API requires base64url, NOT standard base64
 */
function encodeBase64url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode base64url string to UTF-8
 */
function decodeBase64url(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

/**
 * Extract email content from MIME payload recursively
 */
function extractEmailContent(payload: gmail_v1.Schema$MessagePart): {
  text: string;
  html: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    attachmentId: string;
    size: number;
  }>;
} {
  const result = { text: "", html: "", attachments: [] as typeof result.attachments };

  function processPayload(part: gmail_v1.Schema$MessagePart): void {
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

// =============================================================================
// Verification Tests
// =============================================================================

async function verifyAuthentication(): Promise<void> {
  console.log("\n=== Test: Authentication ===");

  // Check credential files exist
  console.log("Checking credential files...");
  console.log("  Credentials path:", CREDENTIALS_PATH);

  if (!existsSync(CLIENT_SECRET_PATH)) {
    throw new Error(`client_secret.json not found at: ${CLIENT_SECRET_PATH}`);
  }
  console.log("  [OK] client_secret.json found");

  if (!existsSync(TOKENS_PATH)) {
    throw new Error(`tokens.json not found at: ${TOKENS_PATH}`);
  }
  console.log("  [OK] tokens.json found");

  // Load credentials
  const credentials = JSON.parse(readFileSync(CLIENT_SECRET_PATH, "utf8"));
  const tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));

  // Verify credential structure
  if (!credentials.installed) {
    throw new Error("Invalid client_secret.json: missing 'installed' key");
  }

  const { client_id, client_secret, redirect_uris } = credentials.installed;
  if (!client_id || !client_secret || !redirect_uris) {
    throw new Error("Invalid client_secret.json: missing required fields");
  }
  console.log("  [OK] client_secret.json structure valid");

  // Verify token structure
  if (!tokens.access_token) {
    throw new Error("Invalid tokens.json: missing access_token");
  }
  console.log("  [OK] tokens.json structure valid");
  console.log("  refresh_token present:", !!tokens.refresh_token);

  // Create OAuth2 client
  oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  oauth2Client.setCredentials(tokens);

  // Set up token refresh handler
  oauth2Client.on("tokens", (newTokens) => {
    console.log("  [INFO] Tokens refreshed, saving...");
    const updatedTokens = { ...tokens, ...newTokens };
    writeFileSync(TOKENS_PATH, JSON.stringify(updatedTokens, null, 2));
  });

  // Create Gmail client
  gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Test authentication with getProfile
  console.log("Testing API connection with getProfile()...");
  const profile = await gmail.users.getProfile({ userId: "me" });

  console.log("  [OK] API connection successful");
  console.log("  Email:", profile.data.emailAddress);
  console.log("  Messages total:", profile.data.messagesTotal);
  console.log("  Threads total:", profile.data.threadsTotal);

  console.log("\n[PASS] Authentication verification complete");
}

async function verifyTokenRefresh(): Promise<void> {
  console.log("\n=== Test: Token Refresh Behavior ===");

  const tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
  const expiryDate = new Date(tokens.expiry_date);
  const now = new Date();
  const isExpired = now > expiryDate;

  console.log("Token status:");
  console.log("  Access token expires:", expiryDate.toISOString());
  console.log("  Current time:", now.toISOString());
  console.log("  Is expired:", isExpired);
  console.log("  Has refresh token:", !!tokens.refresh_token);

  if (isExpired && tokens.refresh_token) {
    console.log("\n  [INFO] Access token is expired, will test auto-refresh...");
  } else if (isExpired && !tokens.refresh_token) {
    console.log("\n  [WARN] Access token expired with no refresh token - re-authorization needed");
  } else {
    console.log("\n  [INFO] Access token is still valid");
  }

  // Make an API call to test/trigger refresh
  console.log("Making API call to test/trigger refresh...");
  const profile = await gmail.users.getProfile({ userId: "me" });

  console.log("  [OK] API call succeeded");
  console.log("  Email:", profile.data.emailAddress);

  // Check if token was refreshed (file might have been updated)
  const currentTokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
  const tokenChanged = currentTokens.access_token !== tokens.access_token;

  console.log("  Token was refreshed:", tokenChanged);

  console.log("\n[PASS] Token refresh behavior verified");
}

async function verifyMimeParsing(): Promise<void> {
  console.log("\n=== Test: MIME Parsing ===");

  // Fetch a recent message to test MIME parsing
  console.log("Fetching recent messages...");
  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults: 5
  });

  const messages = listRes.data.messages || [];
  if (messages.length === 0) {
    console.log("  [SKIP] No messages found to test MIME parsing");
    return;
  }

  console.log(`  Found ${messages.length} messages`);

  // Get full message content
  const messageId = messages[0].id!;
  console.log(`\nTesting MIME extraction on message: ${messageId}`);

  const msgRes = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full"
  });

  const payload = msgRes.data.payload;
  if (!payload) {
    console.log("  [WARN] Message has no payload");
    return;
  }

  console.log("Message structure:");
  console.log("  mimeType:", payload.mimeType);
  console.log("  has parts:", !!payload.parts);
  console.log("  parts count:", payload.parts?.length || 0);

  // Test recursive extraction
  const content = extractEmailContent(payload);

  console.log("\nExtracted content:");
  console.log("  text length:", content.text.length, "chars");
  console.log("  html length:", content.html.length, "chars");
  console.log("  attachments:", content.attachments.length);

  if (content.attachments.length > 0) {
    console.log("\nAttachments found:");
    for (const att of content.attachments) {
      console.log(`    - ${att.filename} (${att.mimeType}, ${att.size} bytes)`);
    }
  }

  // Test text content preview
  if (content.text) {
    const preview = content.text.slice(0, 100).replace(/\n/g, " ");
    console.log("\nText preview:", preview + (content.text.length > 100 ? "..." : ""));
  }

  console.log("\n[PASS] MIME parsing verification complete");
}

async function verifyBase64Encoding(): Promise<void> {
  console.log("\n=== Test: Base64url Encoding/Decoding ===");

  // Test cases with various content
  const testCases = [
    { name: "Simple text", input: "Hello, World!" },
    { name: "Unicode text", input: "Hello, 世界! Привет! 🌍" },
    { name: "Special chars", input: "Test+with/special=chars" },
    { name: "Newlines", input: "Line 1\r\nLine 2\nLine 3" },
    { name: "Email content", input: "From: sender@example.com\r\nTo: recipient@example.com\r\nSubject: Test\r\n\r\nBody" }
  ];

  console.log("Testing encode/decode roundtrip:");
  let allPassed = true;

  for (const tc of testCases) {
    const encoded = encodeBase64url(tc.input);
    const decoded = decodeBase64url(encoded);
    const passed = decoded === tc.input;

    if (!passed) {
      allPassed = false;
    }

    console.log(`  ${passed ? "[OK]" : "[FAIL]"} ${tc.name}`);
    if (!passed) {
      console.log(`      Input: "${tc.input}"`);
      console.log(`      Decoded: "${decoded}"`);
    }
  }

  // Verify base64url format (no +, /, or = padding)
  console.log("\nVerifying base64url format characteristics:");
  const testString = "This is a test string with padding test!";
  const encoded = encodeBase64url(testString);

  const hasPlus = encoded.includes("+");
  const hasSlash = encoded.includes("/");
  const hasPadding = encoded.includes("=");

  console.log("  Contains '+' (should be false):", hasPlus);
  console.log("  Contains '/' (should be false):", hasSlash);
  console.log("  Contains '=' padding (should be false):", hasPadding);

  if (hasPlus || hasSlash || hasPadding) {
    console.log("  [WARN] Encoded string may not be proper base64url format");
    allPassed = false;
  } else {
    console.log("  [OK] Proper base64url format confirmed");
  }

  // Compare with Node.js built-in base64url
  console.log("\nComparing with Node.js built-in base64url:");
  const builtinEncoded = Buffer.from(testString).toString("base64url");
  const ourEncoded = encodeBase64url(testString);

  console.log("  Our implementation:", ourEncoded);
  console.log("  Node.js base64url:", builtinEncoded);
  console.log("  Match:", ourEncoded === builtinEncoded);

  if (allPassed) {
    console.log("\n[PASS] Base64url encoding verification complete");
  } else {
    console.log("\n[FAIL] Some base64url tests failed");
  }
}

async function verifyNullBehavior(): Promise<void> {
  console.log("\n=== Test: Null/Undefined Behavior ===");

  // Test 1: Non-existent message
  console.log("Test 1: Getting non-existent message...");
  try {
    await gmail.users.messages.get({
      userId: "me",
      id: "nonexistent-message-id-12345"
    });
    console.log("  Result: API did NOT throw (unexpected)");
  } catch (error: any) {
    console.log("  Result: API threw error");
    console.log("  Error code:", error.code);
    console.log("  Error message:", error.message?.slice(0, 80));
    console.log("  Error.code === 404:", error.code === 404);
  }

  // Test 2: Non-existent label
  console.log("\nTest 2: Getting non-existent label...");
  try {
    await gmail.users.labels.get({
      userId: "me",
      id: "Label_nonexistent_12345"
    });
    console.log("  Result: API did NOT throw (unexpected)");
  } catch (error: any) {
    console.log("  Result: API threw error");
    console.log("  Error code:", error.code);
    console.log("  Error.code === 404:", error.code === 404);
  }

  // Test 3: Empty message list query
  console.log("\nTest 3: List messages with impossible query...");
  const emptyResult = await gmail.users.messages.list({
    userId: "me",
    q: "from:impossible-address-that-does-not-exist-12345@impossible-domain-xyz.com",
    maxResults: 10
  });
  console.log("  Result: API returned successfully");
  console.log("  messages property:", emptyResult.data.messages);
  console.log("  messages === undefined:", emptyResult.data.messages === undefined);
  console.log("  messages === null:", emptyResult.data.messages === null);
  console.log("  resultSizeEstimate:", emptyResult.data.resultSizeEstimate);

  // Test 4: Message with missing headers
  console.log("\nTest 4: Message header access patterns...");
  const messages = await gmail.users.messages.list({
    userId: "me",
    maxResults: 1
  });

  if (messages.data.messages && messages.data.messages.length > 0) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: messages.data.messages[0].id!,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "X-Nonexistent-Header"]
    });

    const headers = msg.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

    console.log("  'From' header:", getHeader("From") ? "(present)" : "(missing)");
    console.log("  'Subject' header:", getHeader("Subject") ? "(present)" : "(missing)");
    console.log("  'X-Nonexistent-Header':", getHeader("X-Nonexistent-Header"));
    console.log("  Missing header returns:", getHeader("X-Nonexistent-Header") === undefined ? "undefined" : "other");
  } else {
    console.log("  [SKIP] No messages available for header test");
  }

  // Test 5: Attachment on message without attachments
  console.log("\nTest 5: Attachment API behavior...");
  const messagesForAtt = await gmail.users.messages.list({
    userId: "me",
    maxResults: 1,
    q: "-has:attachment"  // Find a message without attachments
  });

  if (messagesForAtt.data.messages && messagesForAtt.data.messages.length > 0) {
    try {
      await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: messagesForAtt.data.messages[0].id!,
        id: "nonexistent-attachment-id"
      });
      console.log("  Result: API did NOT throw for invalid attachment ID");
    } catch (error: any) {
      console.log("  Result: API threw error for invalid attachment ID");
      console.log("  Error code:", error.code);
    }
  } else {
    console.log("  [SKIP] No messages without attachments found");
  }

  console.log("\n[PASS] Null/undefined behavior documented");
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  console.log("Gmail SDK Behavior Verification");
  console.log("================================");
  console.log("Credentials path:", CREDENTIALS_PATH);

  try {
    await verifyAuthentication();
    await verifyTokenRefresh();
    await verifyMimeParsing();
    await verifyBase64Encoding();
    await verifyNullBehavior();

    console.log("\n=== Summary ===");
    console.log("All verifications completed. Check output above for actual behavior.");

  } catch (error: any) {
    console.error("\nError during verification:", error.message);

    if (error.code === 401) {
      console.error("\nAuthentication failed. Your tokens may be expired or revoked.");
      console.error("Delete tokens.json and re-run the authorization flow.");
    } else if (error.code === 403) {
      console.error("\nPermission denied. Check your OAuth scopes.");
    }

    process.exit(1);
  }
}

main();
