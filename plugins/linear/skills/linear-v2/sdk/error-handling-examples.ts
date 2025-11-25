/**
 * Error Handling Examples for Linear SDK
 * These examples demonstrate robust patterns for handling invalid/non-existent issue references
 */

import { LinearClient } from "@linear/sdk";

// ============================================================================
// Example 1: Basic Pattern - Fetch Each Reference Independently
// ============================================================================

interface IssueResult {
  valid: Array<{ identifier: string; title: string; id: string }>;
  invalid: string[];
  errors: Array<{ ref: string; error: string }>;
}

async function example1_resolveIssueReferences(
  references: string[],
  client: LinearClient
): Promise<IssueResult> {
  const results: IssueResult = {
    valid: [],
    invalid: [],
    errors: []
  };

  // Process each reference independently
  for (const ref of references) {
    try {
      const issue = await client.issue(ref);
      results.valid.push({
        identifier: issue.identifier,
        title: issue.title,
        id: issue.id
      });
    } catch (error: any) {
      // Capture error but continue processing
      results.invalid.push(ref);
      results.errors.push({
        ref,
        error: error.message
      });
    }
  }

  return results;
}

// ============================================================================
// Example 2: Try-Catch with Fallback (Single Issue)
// ============================================================================

async function example2_getIssueOrNull(
  identifier: string,
  client: LinearClient
) {
  try {
    return await client.issue(identifier);
  } catch (error: any) {
    // Log and return null instead of throwing
    console.warn(`Could not resolve issue: ${identifier}`, error.message);
    return null;
  }
}

// ============================================================================
// Example 3: Batch Fetch with Promise.allSettled
// ============================================================================

interface BatchFetchResult {
  successful: Map<string, any>;
  failed: Map<string, string>;
}

async function example3_batchFetchIssues(
  identifiers: string[],
  client: LinearClient
): Promise<BatchFetchResult> {
  const result: BatchFetchResult = {
    successful: new Map(),
    failed: new Map()
  };

  // Create promises for each issue fetch
  const promises = identifiers.map(id =>
    client.issue(id).then(
      issue => ({ status: "fulfilled" as const, id, issue }),
      error => ({ status: "rejected" as const, id, error })
    )
  );

  // Wait for all to settle (don't throw on first failure)
  const outcomes = await Promise.allSettled(promises);

  for (const outcome of outcomes) {
    if (outcome.status === "fulfilled") {
      const { status, id, issue, error } = outcome.value;
      if (status === "fulfilled") {
        result.successful.set(id, issue);
      } else {
        result.failed.set(id, error.message);
      }
    } else {
      // Unexpected error in the promise itself
      console.error("Unexpected error in batch:", outcome.reason);
    }
  }

  return result;
}

// ============================================================================
// Example 4: Webhook Comment Handler
// ============================================================================

interface WebhookError {
  ref: string;
  reason: "not_found" | "malformed" | "unknown";
  message: string;
}

interface CommentAnalysis {
  issueReferences: Array<{ ref: string; issue: any }>;
  brokenReferences: WebhookError[];
  wasMentioned: boolean;
  mentions: string[];
}

async function example4_analyzeCommentWebhook(
  webhook: any,
  client: LinearClient
): Promise<CommentAnalysis> {
  const body = webhook.data.body;
  const analysis: CommentAnalysis = {
    issueReferences: [],
    brokenReferences: [],
    wasMentioned: /@claude\b/i.test(body),
    mentions: body.match(/@[\w-]+/g) || []
  };

  // Extract and validate issue references
  const issueRefs = body.match(/[A-Z]+-\d+/g) || [];

  for (const ref of issueRefs) {
    try {
      const issue = await client.issue(ref);
      analysis.issueReferences.push({ ref, issue });
    } catch (error: any) {
      // Classify error type
      let reason: WebhookError["reason"] = "unknown";
      if (error.message.includes("Entity not found")) {
        reason = "not_found";
      }

      analysis.brokenReferences.push({
        ref,
        reason,
        message: error.message
      });
    }
  }

  return analysis;
}

// ============================================================================
// Example 5: Error Classification
// ============================================================================

class IssueResolutionError extends Error {
  constructor(
    public ref: string,
    public reason: "not_found" | "network" | "auth" | "unknown",
    message: string
  ) {
    super(message);
  }
}

async function example5_resolveIssueWithClassification(
  ref: string,
  client: LinearClient
): Promise<any> {
  try {
    return await client.issue(ref);
  } catch (error: any) {
    // Classify the error for better handling
    let reason: IssueResolutionError["reason"] = "unknown";

    if (error.message.includes("Entity not found")) {
      reason = "not_found";
    } else if (error.message.includes("Unauthorized")) {
      reason = "auth";
    } else if (error.message.includes("timeout")) {
      reason = "network";
    }

    throw new IssueResolutionError(ref, reason, error.message);
  }
}

// ============================================================================
// Example 6: Retry with Exponential Backoff
// ============================================================================

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

async function example6_resolveIssueWithRetry(
  ref: string,
  client: LinearClient,
  options: RetryOptions = {}
): Promise<any> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await client.issue(ref);
    } catch (error: any) {
      lastError = error;

      // Don't retry permanent errors
      if (error.message.includes("Entity not found")) {
        throw error;
      }
      if (error.message.includes("Unauthorized")) {
        throw error;
      }

      // Retry transient errors with exponential backoff
      if (attempt < maxAttempts - 1) {
        const delayMs = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );
        console.log(`Retry ${ref} attempt ${attempt + 1} after ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Example 7: Full Webhook Handler Implementation
// ============================================================================

async function example7_handleCommentWebhook(webhook: any, client: LinearClient) {
  const body = webhook.data.body;

  // Step 1: Check if mentioned
  const wasMentioned = /@claude\b/i.test(body);
  if (!wasMentioned) {
    console.log("Not mentioned in comment, skipping");
    return;
  }

  console.log("Processing mention in:", webhook.data.issue.identifier);

  // Step 2: Extract issue references
  const issueRefs = body.match(/[A-Z]+-\d+/g) || [];
  console.log("Found issue references:", issueRefs);

  // Step 3: Resolve each reference independently
  const validIssues = [];
  const invalidRefs = [];

  for (const ref of issueRefs) {
    try {
      const issue = await client.issue(ref);
      validIssues.push(issue);
    } catch (error: any) {
      invalidRefs.push(ref);
      console.log(`Failed to resolve ${ref}: ${error.message}`);
    }
  }

  // Step 4: Build response with partial results
  let response = "I've reviewed the referenced issues:\n\n";

  if (validIssues.length > 0) {
    response += "**Valid issues found:**\n";
    for (const issue of validIssues) {
      response += `- ${issue.identifier}: ${issue.title}\n`;
    }
  }

  if (invalidRefs.length > 0) {
    response += "\n**Could not resolve:**\n";
    for (const ref of invalidRefs) {
      response += `- ${ref} (not found or invalid team)\n`;
    }
  }

  response += `\nProcessed ${validIssues.length} valid and ${invalidRefs.length} invalid references.`;

  // Step 5: Reply with what was found
  if (validIssues.length > 0 || invalidRefs.length > 0) {
    await client.createComment({
      issueId: webhook.data.issue.id,
      body: response
    });
  }
}

// ============================================================================
// Example 8: Comprehensive Testing
// ============================================================================

async function example8_testAllPatterns() {
  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

  const testRefs = ["GOO-1", "GOO-99999", "FAKE-123", "GOO-2"];

  console.log("=== Example 1: Basic Pattern ===");
  const result1 = await example1_resolveIssueReferences(testRefs, client);
  console.log(`Found ${result1.valid.length} valid, ${result1.invalid.length} invalid`);
  console.log("Invalid:", result1.invalid);

  console.log("\n=== Example 2: Try-Catch Fallback ===");
  for (const ref of testRefs) {
    const issue = await example2_getIssueOrNull(ref, client);
    console.log(`${ref}:`, issue ? `${issue.title}` : "null");
  }

  console.log("\n=== Example 3: Batch Fetch ===");
  const result3 = await example3_batchFetchIssues(testRefs, client);
  console.log(`Successful: ${result3.successful.size}, Failed: ${result3.failed.size}`);
  for (const [ref, error] of result3.failed) {
    console.log(`  ${ref}: ${error}`);
  }

  console.log("\n=== Example 4: Comment Analysis ===");
  const webhook = {
    data: {
      body: "@claude Check GOO-1 (exists), GOO-99999 (doesn't exist), and FAKE-123 (invalid team)",
      issue: { id: "issue-id", identifier: "GOO-42" }
    }
  };
  const result4 = await example4_analyzeCommentWebhook(webhook, client);
  console.log(`Mentions: ${result4.wasMentioned}`);
  console.log(`Valid: ${result4.issueReferences.length}, Broken: ${result4.brokenReferences.length}`);

  console.log("\n=== Example 5: Error Classification ===");
  for (const ref of ["GOO-1", "INVALID-999"]) {
    try {
      const issue = await example5_resolveIssueWithClassification(ref, client);
      console.log(`✓ ${ref}: ${issue.title}`);
    } catch (error) {
      if (error instanceof IssueResolutionError) {
        console.log(`✗ ${error.ref} (${error.reason}): ${error.message}`);
      }
    }
  }

  console.log("\nAll examples completed!");
}

// ============================================================================
// Main Entry Point (for testing)
// ============================================================================

if (require.main === module) {
  example8_testAllPatterns().catch(console.error);
}

export {
  example1_resolveIssueReferences,
  example2_getIssueOrNull,
  example3_batchFetchIssues,
  example4_analyzeCommentWebhook,
  example5_resolveIssueWithClassification,
  example6_resolveIssueWithRetry,
  example7_handleCommentWebhook,
  IssueResolutionError,
  IssueResult,
  BatchFetchResult,
  CommentAnalysis,
  WebhookError
};
