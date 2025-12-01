/**
 * GitHub SDK Behavior Verification
 * Run: GITHUB_TOKEN=... tsx plugins/github/skills/github/tests/verify-sdk-behavior.ts
 */

import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function verifyAuthentication() {
  console.log("\n=== Authentication ===");
  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log("login:", user.login);
  console.log("name:", user.name);
  console.log("type:", user.type);
}

async function verifyFileContentEncoding() {
  console.log("\n=== File Content Encoding ===");
  const { data } = await octokit.rest.repos.getContent({
    owner: "octocat",
    repo: "Hello-World",
    path: "README",
  });
  if ("content" in data) {
    console.log("encoding:", data.encoding);
    console.log("content type:", typeof data.content);
    const decoded = Buffer.from(data.content, "base64").toString("utf8");
    console.log("decoded length:", decoded.length);
  }
}

async function verifyPagination() {
  console.log("\n=== Pagination ===");
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: "octocat",
    repo: "Hello-World",
    per_page: 10,
    state: "all",
  });
  console.log("total issues fetched:", issues.length);
}

async function verifyRateLimits() {
  console.log("\n=== Rate Limits ===");
  const { data } = await octokit.rest.rateLimit.get();
  console.log("limit:", data.rate.limit);
  console.log("remaining:", data.rate.remaining);
  console.log("resets at:", new Date(data.rate.reset * 1000).toISOString());
}

async function verifyNullBehavior() {
  console.log("\n=== Null/Undefined Behavior ===");
  try {
    await octokit.rest.issues.get({
      owner: "octocat",
      repo: "Hello-World",
      issue_number: 999999,
    });
  } catch (e: any) {
    console.log("missing issue status:", e.status);
    console.log("error message:", e.message);
  }
}

async function main() {
  await verifyAuthentication();
  await verifyFileContentEncoding();
  await verifyPagination();
  await verifyRateLimits();
  await verifyNullBehavior();
}

main().catch(console.error);
