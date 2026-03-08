---
description: Find dead code from broken data flow (unused parameters, unread writes, untriggered branches)
argument-hint: [directory-or-commit-range]
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
---

## Philosophy: The Cost of Broken Data Flow

Code that adds capability without connectivity is worse than no code at all. When a function accepts a parameter that no caller passes, or writes data that nothing reads, it creates an illusion of functionality. The code *appears* to handle a case, but the path is never exercised.

**The principle**: Every read must have a write. Every write must have a read. Every parameter must have a caller. Every branch must have a trigger. If you find yourself adding capability, stop and ask: "Who provides this data, and who consumes it?"

---

## Phase 1: Identify Candidates

Search "$ARGUMENTS" for patterns that suggest broken data flow. Look for:

### Unused Parameter Patterns
1. **Optional parameters never passed**: `function foo(required, optional?: T)` where callers only pass `required`
2. **Default parameters always used**: `function foo(x = defaultValue)` where no caller overrides the default
3. **Rest parameters ignored**: `function foo(a, ...rest)` where callers never pass additional arguments
4. **Destructured options unused**: `function foo({ used, unused }: Options)` where `unused` is never provided

### Unread Write Patterns
5. **Properties set but never read**: `this.value = computed;` where no code accesses `this.value`
6. **Cache populated but never queried**: `cache.set(key, value)` without corresponding `cache.get(key)`
7. **State updated without observers**: `state.field = newValue` where nothing reacts to field changes
8. **Return values ignored**: `const result = compute();` where `result` is never used

### Write Without Source Patterns
9. **Reads from never-written sources**: `const x = config.setting` where nothing ever sets `config.setting`
10. **URI parameters expected but not embedded**: `parseQuery(uri).get('param')` where no code adds `param` to URIs
11. **Accessors returning empty**: `getData: () => []` as placeholder that's never replaced with real implementation

### Untriggered Branch Patterns
12. **Conditions that can't be true**: `if (alwaysFalse) { deadCode(); }`
13. **Fallback paths as primary paths**: Fallback intended as safety net becomes the only execution path
14. **Feature flags never enabled**: `if (featureEnabled) { ... }` where nothing enables the feature

For each candidate found, capture:
- File path and line number
- The capability that appears to exist
- What data source or sink is missing
- Confidence level (definite / likely / possible)

---

## Phase 2: Verify with Tracers

For each candidate identified, verify whether the data flow is actually broken using parallel goodfoot:Tracer subagents.

### Verification Questions

For **unused parameters**, trace:
- All call sites of the function
- Whether any caller passes the parameter
- Whether the parameter is used within the function body

For **unread writes**, trace:
- All reads of the written location (property, cache key, state field)
- Whether any code path reaches the read after the write
- Whether the read is in production code (not just tests)

For **writes without source**, trace:
- All writes to the location being read
- Whether the write happens before the read in execution order
- Whether the write is conditional and the condition is ever true

For **untriggered branches**, trace:
- All code paths that could set the condition to true
- Whether any production code exercises the branch
- Whether tests are the only trigger (indicating dead production code)

### Tracer Invocation Pattern

Launch Tracer subagents in parallel for independent candidates:

```xml
<invoke name="Agent">
<parameter name="description">trace-[candidate-id]</parameter>
<parameter name="subagent_type">goodfoot:Tracer</parameter>
<parameter name="prompt"># Verify Data Flow: [candidate description]

## Suspect Location
File: [file path]
Line: [line number]
Pattern: [unused-param | unread-write | write-without-source | untriggered-branch]

## Trace Request
[Specific questions for this pattern type]

## Expected Evidence
- If flow is CONNECTED: Show the caller/reader/writer/trigger
- If flow is BROKEN: Confirm no such path exists

## Response Format
## Verdict
[CONNECTED | BROKEN | INCONCLUSIVE]

## Evidence
[Code locations that prove the verdict]

## Impact
[What functionality is affected if flow is broken]
</parameter>
</invoke>
```

Group candidates by file or module to enable efficient parallel tracing. Launch up to 5 Tracers concurrently.

---

## Phase 3: Synthesize Report

After all Tracers complete, compile findings. **Only include issues with verdict BROKEN** - do not report CONNECTED or INCONCLUSIVE cases.

### Report Format

If issues found:

```markdown
## Data Flow Assessment: $ARGUMENTS

### Summary
- Candidates analyzed: [N]
- Issues confirmed: [M]
- Connected (no issue): [X]
- Inconclusive (needs manual review): [Y]

### Confirmed Issues

#### Issue 1: [Brief description]
**Location**: `file:line`
**Pattern**: [Unused parameter | Unread write | Write without source | Untriggered branch]
**Problem**: [Specific data flow gap]
**Evidence**: [What the Tracer found]
**Impact**: [What functionality is broken or illusory]
**Suggested fix**: [How to connect the flow or remove the dead code]

#### Issue 2: ...

### Inconclusive Cases (Optional Manual Review)
[List cases where Tracer couldn't determine definitively]
```

If no issues found:

```markdown
## Data Flow Assessment: $ARGUMENTS

### Summary
- Candidates analyzed: [N]
- Issues confirmed: 0

All identified candidates were verified to have connected data flow.
No dead code or broken data paths detected.
```

---

## Common Broken Flow Scenarios

### Scenario: Parameter Added But Callers Not Updated

```typescript
// functions.ts - added optional parameter
export function createUri(path: string, extraData?: string[]): Uri {
  const query = extraData ? `&data=${extraData.join(',')}` : '';
  return Uri.from({ path, query });
}

// callers.ts - still uses old signature
const uri = createUri(node.path);  // extraData never passed
```

**Why it happens**: Developer adds parameter to fix a bug, but doesn't update all call sites.
**How to detect**: Search for optional parameters, then trace all callers.

### Scenario: Content Provider Reads URI Data Never Written

```typescript
// provider.ts - expects data in URI
const data = queryParams.get('extraData');
if (data) {
  return processData(data);
}
return '';  // Always hits this branch

// uri-creator.ts - never adds extraData to URI
const uri = Uri.from({ scheme, path, query: `id=${id}` });
```

**Why it happens**: Two parts of system have mismatched expectations about data format.
**How to detect**: Search for URI parsing, trace back to URI construction.

### Scenario: Accessor Functions Return Placeholder Values

```typescript
// registration.ts - placeholder accessors
const provider = new DataProvider(
  () => [],        // "Will be replaced later" - but never is
  () => undefined  // "Caller provides this" - but doesn't
);

// provider.ts - trusts accessors
const data = this.getData();  // Always []
if (data.length === 0) return '';  // Always returns empty
```

**Why it happens**: Accessor pattern chosen for flexibility, but wiring never completed.
**How to detect**: Search for arrow function accessors, verify they're replaced with real implementations.


