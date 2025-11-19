Use this component when:
- Creating incident response runbooks
- Building self-service debugging guides
- Documenting diagnostic procedures
- Training support teams
- Reducing mean time to resolution (MTTR)

**Example user message:**
Create a troubleshooting guide for when users can't connect to the database.

## Template

## Troubleshooting: [Problem Description]

### 🔍 Quick Diagnosis Checklist
- [ ] Check [symptom 1]: `[diagnostic command]`
- [ ] Verify [symptom 2]: `[diagnostic command]`
- [ ] Confirm [symptom 3]: `[diagnostic command]`

**All checks pass?** → [Escalate to Level 2]
**Some checks fail?** → Continue to investigation

### 🔬 Systematic Investigation

#### Step 1: Gather Symptoms
```bash
# Run diagnostics
[command 1] | grep [pattern]    # Check [what this reveals]
[command 2] --flag              # Verify [what this shows]
[command 3]                     # Examine [what to look for]

# Collect evidence
[log command] --since "1 hour ago"
[metric command] --last 10m
```

#### Step 2: Identify Patterns
```text
If you see...                   It likely means...           Next step...
────────────────────────────────────────────────────────────────────────
[Error pattern 1]               [Root cause 1]               Go to Fix A
[Error pattern 2]               [Root cause 2]               Go to Fix B
[Error pattern 3]               [Root cause 3]               Go to Fix C
[Multiple patterns]             [Complex issue]              Escalate
```

#### Step 3: Apply Solutions

**Fix A: [Solution Name]**
```bash
# Verify the issue
[verification command]

# Apply the fix
[fix command 1]
[fix command 2]

# Confirm resolution
[validation command]
```

**Fix B: [Solution Name]**
```bash
[Similar structure]
```

### 🌳 Decision Tree
```text
                    [Problem Starts]
                          │
                    [Can connect?]
                    /            \
                  Yes             No
                  /                \
          [Auth works?]         [Network OK?]
           /       \              /        \
         Yes       No           Yes         No
         /          \           /            \
    [Check logs] [Fix auth] [Check firewall] [Fix network]
```

### 📊 Common Root Causes
```text
Frequency   Cause                    Typical Fix           Time to Fix
────────────────────────────────────────────────────────────────────────
45%         [Cause 1]               [Solution 1]          5 min
25%         [Cause 2]               [Solution 2]          15 min
15%         [Cause 3]               [Solution 3]          30 min
10%         [Cause 4]               [Solution 4]          1 hour
5%          Other                   Investigate           Varies
```

### ⚡ Emergency Actions
If the issue is critical and affecting production:

1. **Immediate mitigation:** `[emergency command]`
2. **Notify:** Page [on-call team] via [method]
3. **Rollback if needed:** `[rollback command]`
4. **Document:** Create incident ticket with findings

### 📝 Post-Resolution Checklist
- [ ] Verify service is fully operational
- [ ] Check for any side effects
- [ ] Document root cause in ticket
- [ ] Update monitoring if gap found
- [ ] Schedule postmortem if needed
