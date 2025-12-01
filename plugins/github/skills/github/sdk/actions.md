# GitHub Actions

> [Back to SKILL.md](../SKILL.md) | [Issues](issues.md) | [Pull Requests](pull-requests.md) | [Files](files.md) | [Git](git.md) | [Search](search.md)

> **Official docs**: https://docs.github.com/en/rest/actions

## Quick Reference

| Operation | Method | Anchor |
|-----------|--------|--------|
| List workflows | `actions.listRepoWorkflows()` | #workflows |
| List runs | `actions.listWorkflowRunsForRepo()` | #runs |
| Get run | `actions.getWorkflowRun()` | #get-run |
| List jobs | `actions.listJobsForWorkflowRun()` | #jobs |
| Get logs | `actions.downloadJobLogsForWorkflowRun()` | #logs |
| Trigger | `actions.createWorkflowDispatch()` | #trigger |
| Cancel | `actions.cancelWorkflowRun()` | #cancel |
| Re-run | `actions.reRunWorkflow()` | #rerun |

---

## List Workflows {#workflows}

```typescript
const { data } = await octokit.rest.actions.listRepoWorkflows({
  owner: "owner",
  repo: "repo",
});

console.log("Total workflows:", data.total_count);

for (const workflow of data.workflows) {
  console.log(workflow.name);
  console.log("  ID:", workflow.id);
  console.log("  Path:", workflow.path);
  console.log("  State:", workflow.state);  // "active", "disabled", etc.
}
```

### Get Single Workflow

```typescript
const { data: workflow } = await octokit.rest.actions.getWorkflow({
  owner: "owner",
  repo: "repo",
  workflow_id: "ci.yml",  // Can be ID number or filename
});

console.log("Workflow:", workflow.name);
console.log("State:", workflow.state);
```

---

## List Workflow Runs {#runs}

```typescript
const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
  owner: "owner",
  repo: "repo",
  per_page: 10,
});

console.log("Total runs:", data.total_count);

for (const run of data.workflow_runs) {
  console.log(run.name + " #" + run.run_number);
  console.log("  Status:", run.status);           // "queued", "in_progress", "completed"
  console.log("  Conclusion:", run.conclusion);   // "success", "failure", "cancelled", etc.
  console.log("  Branch:", run.head_branch);
  console.log("  SHA:", run.head_sha.substring(0, 7));
  console.log("  URL:", run.html_url);
}
```

### Filter Runs

```typescript
// Runs for specific workflow
const { data: ciRuns } = await octokit.rest.actions.listWorkflowRuns({
  owner: "owner",
  repo: "repo",
  workflow_id: "ci.yml",
  per_page: 10,
});

// Runs on specific branch
const { data: mainRuns } = await octokit.rest.actions.listWorkflowRunsForRepo({
  owner: "owner",
  repo: "repo",
  branch: "main",
  per_page: 10,
});

// Only failed runs
const { data: failedRuns } = await octokit.rest.actions.listWorkflowRunsForRepo({
  owner: "owner",
  repo: "repo",
  status: "completed",
  conclusion: "failure",
  per_page: 10,
});

// Runs triggered by specific event
const { data: prRuns } = await octokit.rest.actions.listWorkflowRunsForRepo({
  owner: "owner",
  repo: "repo",
  event: "pull_request",
  per_page: 10,
});
```

### Run Status Values

| Status | Description |
|--------|-------------|
| `queued` | Waiting to start |
| `in_progress` | Currently running |
| `completed` | Finished (check conclusion) |

### Run Conclusion Values

| Conclusion | Description |
|------------|-------------|
| `success` | All jobs succeeded |
| `failure` | One or more jobs failed |
| `cancelled` | Run was cancelled |
| `skipped` | Run was skipped |
| `timed_out` | Run timed out |
| `action_required` | Requires approval |

---

## Get Run Details {#get-run}

```typescript
const { data: run } = await octokit.rest.actions.getWorkflowRun({
  owner: "owner",
  repo: "repo",
  run_id: 12345678,
});

console.log("Run #" + run.run_number);
console.log("Workflow:", run.name);
console.log("Status:", run.status);
console.log("Conclusion:", run.conclusion);
console.log("Event:", run.event);
console.log("Branch:", run.head_branch);
console.log("Commit:", run.head_sha);
console.log("Actor:", run.actor?.login);
console.log("Started:", run.run_started_at);
console.log("URL:", run.html_url);
```

---

## List Jobs {#jobs}

```typescript
const { data } = await octokit.rest.actions.listJobsForWorkflowRun({
  owner: "owner",
  repo: "repo",
  run_id: 12345678,
});

console.log("Total jobs:", data.total_count);

for (const job of data.jobs) {
  console.log(job.name);
  console.log("  ID:", job.id);
  console.log("  Status:", job.status);
  console.log("  Conclusion:", job.conclusion);
  console.log("  Started:", job.started_at);
  console.log("  Completed:", job.completed_at);

  // List steps
  if (job.steps) {
    console.log("  Steps:");
    for (const step of job.steps) {
      const status = step.conclusion || step.status;
      console.log("    " + step.number + ". " + step.name + " [" + status + "]");
    }
  }
}
```

### Filter Jobs

```typescript
// Only failed jobs
const { data } = await octokit.rest.actions.listJobsForWorkflowRun({
  owner: "owner",
  repo: "repo",
  run_id: 12345678,
  filter: "latest",  // "latest" or "all" (for re-runs)
});

const failedJobs = data.jobs.filter(job => job.conclusion === "failure");
```

---

## Get Job Logs {#logs}

```typescript
// Get logs for a specific job
const { data: logs } = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
  owner: "owner",
  repo: "repo",
  job_id: 12345678,
});

// logs is a string containing the full log output
console.log("Job logs:");
console.log(logs);
```

### Download Run Logs (All Jobs)

```typescript
const { data: logs } = await octokit.rest.actions.downloadWorkflowRunLogs({
  owner: "owner",
  repo: "repo",
  run_id: 12345678,
});

// Returns a redirect URL to download a zip file
console.log("Download URL:", logs);
```

---

## Trigger Workflow {#trigger}

Manually trigger a workflow that has `workflow_dispatch` enabled:

```typescript
await octokit.rest.actions.createWorkflowDispatch({
  owner: "owner",
  repo: "repo",
  workflow_id: "deploy.yml",  // Workflow filename or ID
  ref: "main",                // Branch or tag to run on
  inputs: {                   // Optional: workflow inputs
    environment: "production",
    debug: "false",
  },
});

console.log("Workflow triggered");
```

### Requirements

The workflow must have `workflow_dispatch` trigger:

```yaml
# .github/workflows/deploy.yml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        type: choice
        options:
          - staging
          - production
      debug:
        description: 'Enable debug mode'
        required: false
        type: boolean
        default: false
```

---

## Cancel Run {#cancel}

```typescript
await octokit.rest.actions.cancelWorkflowRun({
  owner: "owner",
  repo: "repo",
  run_id: 12345678,
});

console.log("Run cancelled");
```

---

## Re-run Workflow {#rerun}

### Re-run All Jobs

```typescript
await octokit.rest.actions.reRunWorkflow({
  owner: "owner",
  repo: "repo",
  run_id: 12345678,
});

console.log("Workflow re-run triggered");
```

### Re-run Failed Jobs Only

```typescript
await octokit.rest.actions.reRunWorkflowFailedJobs({
  owner: "owner",
  repo: "repo",
  run_id: 12345678,
});

console.log("Failed jobs re-run triggered");
```

---

## Workflow Artifacts

### List Artifacts

```typescript
const { data } = await octokit.rest.actions.listWorkflowRunArtifacts({
  owner: "owner",
  repo: "repo",
  run_id: 12345678,
});

for (const artifact of data.artifacts) {
  console.log(artifact.name);
  console.log("  ID:", artifact.id);
  console.log("  Size:", artifact.size_in_bytes);
  console.log("  Expired:", artifact.expired);
}
```

### Download Artifact

```typescript
const { data } = await octokit.rest.actions.downloadArtifact({
  owner: "owner",
  repo: "repo",
  artifact_id: 12345,
  archive_format: "zip",
});

// data is the zip file content or redirect URL
```

---

## Complete Example: Monitor CI Status

```typescript
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = "owner";
const repo = "repo";

// Get latest CI runs
const { data: runs } = await octokit.rest.actions.listWorkflowRuns({
  owner,
  repo,
  workflow_id: "ci.yml",
  per_page: 5,
});

console.log("Recent CI runs:\n");

for (const run of runs.workflow_runs) {
  const status = run.conclusion ?? run.status;
  const emoji = run.conclusion === "success" ? "✓" :
                run.conclusion === "failure" ? "✗" : "•";

  console.log(emoji + " Run #" + run.run_number);
  console.log("  Branch:", run.head_branch);
  console.log("  Status:", status);
  console.log("  Commit:", run.head_sha.substring(0, 7));

  // If failed, show failed jobs
  if (run.conclusion === "failure") {
    const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: run.id,
    });

    const failedJobs = jobs.jobs.filter(j => j.conclusion === "failure");
    console.log("  Failed jobs:");
    for (const job of failedJobs) {
      console.log("    - " + job.name);
    }
  }

  console.log();
}
```
