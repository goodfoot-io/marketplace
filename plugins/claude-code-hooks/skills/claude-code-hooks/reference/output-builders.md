# Output Builders & Types

> [Back to SKILL.md](../SKILL.md) | [Installation](installation.md) | [Porting](porting.md) | [Logging](logging.md)

<instructions>

## 1. The Golden Rule

**Always use a Factory and an Output Builder together.**

Do not manually construct JSON. Do not manually parse `process.stdin`. The library handles the protocol safety for you.

## 2. All 12 Hook Types

| Hook Type | Factory | Builder | Input Key |
| :--- | :--- | :--- | :--- |
| **PreToolUse** | `preToolUseHook` | `preToolUseOutput` | `toolName` |
| **PostToolUse** | `postToolUseHook` | `postToolUseOutput` | `toolName` |
| **PostToolUseFailure** | `postToolUseFailureHook` | `postToolUseFailureOutput` | `toolName` |
| **SessionStart** | `sessionStartHook` | `sessionStartOutput` | `source` |
| **SessionEnd** | `sessionEndHook` | `sessionEndOutput` | `reason` |
| **Stop** | `stopHook` | `stopOutput` | N/A |
| **UserPromptSubmit** | `userPromptSubmitHook` | `userPromptSubmitOutput` | N/A |
| **Notification** | `notificationHook` | `notificationOutput` | `notificationType` |
| **SubagentStart** | `subagentStartHook` | `subagentStartOutput` | `agentType` |
| **SubagentStop** | `subagentStopHook` | `subagentStopOutput` | `agentType` |
| **PreCompact** | `preCompactHook` | `preCompactOutput` | `trigger` |
| **PermissionRequest** | `permissionRequestHook` | `permissionRequestOutput` | `toolName` |

## 3. Anti-Patterns (Don't Do This)

### ❌ The "Console Logger"
```typescript
// WRONG
console.log("Checking command..."); 
// Result: Corrupts JSON stdout. Claude fails silently.
```

### ❌ The "Manual Return"
```typescript
// WRONG
return { stdout: { decision: 'allow' } };
// Result: Likely to miss protocol fields or structure.
```

### ❌ The "Type Assumption"
```typescript
// WRONG
const cmd = input.toolInput.command;
// Result: TypeScript error. input.toolInput is 'unknown'.
// FIX: const cmd = (input.toolInput as { command: string }).command;
```

## 4. Detailed Builder Usage

### 4.1 preToolUseOutput
Control tool execution.

```typescript
// Allow
preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } });

// Deny
preToolUseOutput({ 
  hookSpecificOutput: { 
    permissionDecision: 'deny', 
    permissionDecisionReason: 'Policy violation' 
  } 
});

// Modify Input
preToolUseOutput({
  hookSpecificOutput: {
    permissionDecision: 'allow',
    updatedInput: { command: 'ls -la' }
  }
});
```

### 4.2 stopOutput
Control whether Claude can exit.

```typescript
// Allow Exit
stopOutput({ decision: 'approve' });

// Block Exit
stopOutput({ 
  decision: 'block', 
  reason: 'You must commit changes first.' 
});
```

### 4.3 sessionStartOutput
Inject context at startup.

```typescript
sessionStartOutput({
  hookSpecificOutput: {
    additionalContext: 'Project Guidelines: ...'
  },
  systemMessage: 'Always prioritize performance.'
});
```

### 4.4 Common Options
All builders accept these:

```typescript
{
  stopReason: "Fatal error", // Exits with code 2 (Block)
  systemMessage: "Inject instruction",
  continue: true // Continue even if error
}
```

</instructions>