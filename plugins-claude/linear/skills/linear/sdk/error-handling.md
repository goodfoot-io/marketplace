# Error Handling

> **Official docs**: https://developers.linear.app/docs/sdk/getting-started

## Error Types

The Linear SDK throws errors for invalid references:

```
Error: Entity not found: Issue - Could not find referenced Issue.
```

**Both non-existent issues AND invalid teams throw the same error.** You cannot distinguish between `GOO-99999` (doesn't exist) and `FAKE-123` (invalid team).

## Pattern 1: Independent Processing (Recommended)

Process each reference with its own try-catch to get partial results:

```typescript
const validIssues = [];
const invalidRefs = [];

for (const ref of issueRefs) {
  try {
    const issue = await client.issue(ref);
    validIssues.push(issue);
  } catch (error) {
    invalidRefs.push(ref);
  }
}

console.log("Found:", validIssues.map(i => i.identifier));
console.log("Invalid:", invalidRefs);
```

## Pattern 2: Single Issue with Fallback

```typescript
async function getIssueOrNull(identifier: string, client: LinearClient) {
  try {
    return await client.issue(identifier);
  } catch (error) {
    return null;
  }
}

const issue = await getIssueOrNull("GOO-1", client);
if (issue) {
  console.log("Found:", issue.title);
}
```

## Pattern 3: Parallel Batch Fetch

```typescript
const results = await Promise.allSettled(
  issueRefs.map(ref => client.issue(ref))
);

const valid = results
  .filter(r => r.status === "fulfilled")
  .map(r => r.value);

const failed = results
  .filter(r => r.status === "rejected")
  .map((r, i) => issueRefs[i]);
```

## Best Practices

1. **Always wrap `client.issue()` in try-catch** - it throws for invalid refs
2. **Process references independently** - one bad ref shouldn't stop others
3. **Return partial results** - tell users what was found and what failed
4. **Don't retry "not found" errors** - they're permanent
