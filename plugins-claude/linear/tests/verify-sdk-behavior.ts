/**
 * SDK Behavior Verification Script
 * Run with: dotenv -- tsx plugins-claude/linear/tests/verify-sdk-behavior.ts
 *
 * Tests actual SDK behavior to verify documentation accuracy.
 */

import { LinearClient } from "@linear/sdk";

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY! });

async function verifyViewerForLoopPrevention() {
  console.log("\n=== Test: Viewer (Bot Identity) ===");
  const viewer = await client.viewer;
  console.log("viewer.id:", viewer.id);
  console.log("viewer.email:", viewer.email);
  console.log("viewer.displayName:", viewer.displayName);
  console.log("✓ Use viewer.id to detect self-authored comments");
}

async function verifyParentBehavior() {
  console.log("\n=== Test: Parent Issue Behavior ===");

  // Get any issue to test parent behavior
  const issues = await client.issues({ first: 5 });

  for (const issue of issues.nodes) {
    const parent = await issue.parent;
    console.log(`${issue.identifier}: parent =`, parent === undefined ? "undefined" : parent === null ? "null" : parent.identifier);
  }
  console.log("✓ Document: parent returns undefined (not null) for top-level issues");
}

async function verifyStateTypes() {
  console.log("\n=== Test: Workflow State Types ===");

  const teams = await client.teams({ first: 1 });
  const team = teams.nodes[0];

  if (!team) {
    console.log("No teams found");
    return;
  }

  const states = await team.states();
  console.log(`Team ${team.key} workflow states:`);

  const typeOrder = ["backlog", "unstarted", "started", "completed", "canceled"];
  const sortedStates = states.nodes.sort((a, b) =>
    typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
  );

  for (const state of sortedStates) {
    console.log(`  ${state.type.padEnd(12)} → "${state.name}" (id: ${state.id.slice(0, 8)}...)`);
  }
  console.log("✓ Use state.type for logic, state.name for display");
}

async function verifyAssigneeShape() {
  console.log("\n=== Test: Assignee Data Shape ===");

  const issues = await client.issues({
    filter: { assignee: { null: false } },
    first: 3
  });

  for (const issue of issues.nodes) {
    const assignee = await issue.assignee;
    if (assignee) {
      console.log(`${issue.identifier} assignee:`);
      console.log(`  id: ${assignee.id}`);
      console.log(`  email: ${assignee.email}`);
      console.log(`  displayName: ${assignee.displayName}`);
    }
  }
  console.log("✓ Compare webhook.data.assignee.id with viewer.id for assignment detection");
}

async function verifyLabelShape() {
  console.log("\n=== Test: Label Data Shape ===");

  const teams = await client.teams({ first: 1 });
  const team = teams.nodes[0];

  if (!team) return;

  const labels = await team.labels();
  console.log(`Team ${team.key} labels (first 5):`);

  for (const label of labels.nodes.slice(0, 5)) {
    console.log(`  "${label.name}" (id: ${label.id.slice(0, 8)}..., color: ${label.color})`);
  }
  console.log("✓ Label IDs are UUIDs, use team.labels() to map IDs to names");
}

async function main() {
  console.log("Linear SDK Behavior Verification");
  console.log("================================");

  try {
    await verifyViewerForLoopPrevention();
    await verifyParentBehavior();
    await verifyStateTypes();
    await verifyAssigneeShape();
    await verifyLabelShape();

    console.log("\n=== Summary ===");
    console.log("All verifications completed. Check output above for actual behavior.");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
