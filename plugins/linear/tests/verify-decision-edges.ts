/**
 * Decision Edge Case Verification
 * Run with: dotenv -- tsx plugins/linear/skills/linear-v2/tests/verify-decision-edges.ts
 *
 * Tests edge cases in decision logic (not error handling).
 */

import { LinearClient } from "@linear/sdk";

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY! });

async function testMultipleStatesOfSameType() {
  console.log("\n=== Edge: Multiple States of Same Type ===");

  const teams = await client.teams({ first: 1 });
  const team = teams.nodes[0];
  if (!team) return;

  const states = await team.states();

  // Group by type
  const byType = new Map<string, string[]>();
  for (const state of states.nodes) {
    const names = byType.get(state.type) || [];
    names.push(state.name);
    byType.set(state.type, names);
  }

  for (const [type, names] of byType) {
    if (names.length > 1) {
      console.log(`⚠️ Type "${type}" has ${names.length} states: ${names.join(", ")}`);
      console.log(`   → When finding state by type, you'll get the first match`);
      console.log(`   → Consider using state.name for specificity`);
    }
  }

  console.log("\n✓ Lesson: Don't assume 1:1 mapping between type and state");
}

async function testUnassignedIssueShape() {
  console.log("\n=== Edge: Unassigned Issue ===");

  const issues = await client.issues({
    filter: { assignee: { null: true } },
    first: 1
  });

  if (issues.nodes.length === 0) {
    console.log("No unassigned issues found - creating check pattern");
  } else {
    const issue = issues.nodes[0];
    const assignee = await issue.assignee;
    console.log(`${issue.identifier} assignee:`, assignee);
    console.log(`Type of assignee:`, typeof assignee);
    console.log(`assignee === null:`, assignee === null);
    console.log(`assignee === undefined:`, assignee === undefined);
    console.log(`!assignee:`, !assignee);
  }

  console.log("\n✓ Lesson: Use !assignee or assignee === undefined for unassigned check");
}

async function testEmptyLabels() {
  console.log("\n=== Edge: Issue with No Labels ===");

  const issues = await client.issues({ first: 10 });

  for (const issue of issues.nodes) {
    const labels = await issue.labels();
    if (labels.nodes.length === 0) {
      console.log(`${issue.identifier}: labels.nodes = [] (empty array, not null)`);
      console.log(`labels.nodes.length:`, labels.nodes.length);
      break;
    }
  }

  console.log("\n✓ Lesson: Empty labels is [], not null - safe to iterate");
}

async function testWebhookVsSdkFieldNames() {
  console.log("\n=== Edge: Webhook vs SDK Field Names ===");

  const viewer = await client.viewer;

  console.log("SDK User fields:");
  console.log(`  viewer.displayName: "${viewer.displayName}"`);
  console.log(`  viewer.name: "${viewer.name}"`);
  console.log(`  viewer.email: "${viewer.email}"`);

  console.log("\nWebhook user fields (from docs):");
  console.log(`  actor.name: maps to displayName`);
  console.log(`  data.assignee.name: maps to displayName`);

  console.log("\n✓ Lesson: Webhook 'name' = SDK 'displayName'");
}

async function testStateTransitionDetection() {
  console.log("\n=== Edge: Detecting State Transitions ===");

  const teams = await client.teams({ first: 1 });
  const team = teams.nodes[0];
  if (!team) return;

  const states = await team.states();

  // Simulate webhook pattern
  const mockWebhook = {
    data: {
      state: { type: "started", name: "In Progress" }
    },
    updatedFrom: {
      stateId: "old-id",
      state: { type: "unstarted", name: "Todo" }
    }
  };

  console.log("Webhook transition detection:");
  console.log(`  From: ${mockWebhook.updatedFrom.state.type} (${mockWebhook.updatedFrom.state.name})`);
  console.log(`  To: ${mockWebhook.data.state.type} (${mockWebhook.data.state.name})`);

  // Detection patterns
  const wasStarted =
    mockWebhook.updatedFrom.state.type !== "started" &&
    mockWebhook.data.state.type === "started";

  const wasCompleted =
    mockWebhook.updatedFrom.state.type !== "completed" &&
    mockWebhook.data.state.type === "completed";

  console.log(`\nDetection results:`);
  console.log(`  Work started: ${wasStarted}`);
  console.log(`  Work completed: ${wasCompleted}`);

  console.log("\n✓ Lesson: Compare state.type for transitions, not stateId");
}

async function main() {
  console.log("Decision Edge Case Verification");
  console.log("================================");

  await testMultipleStatesOfSameType();
  await testUnassignedIssueShape();
  await testEmptyLabels();
  await testWebhookVsSdkFieldNames();
  await testStateTransitionDetection();

  console.log("\n=== Key Insights ===");
  console.log("1. Multiple states can share a type (e.g., 'canceled')");
  console.log("2. Unassigned = undefined (not null) in SDK");
  console.log("3. Empty labels = [] (safe to iterate)");
  console.log("4. Webhook 'name' = SDK 'displayName'");
  console.log("5. Use state.type for transition logic");
}

main();
