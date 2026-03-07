---
name: expansion
description: Manage text expansions — short terms that auto-inject context into prompts
argument-hint: "`<term>` [is <description>] | Remove `<term>` | List terms"
disable-model-invocation: "true"
hide-from-slash-command-tool: "true"
context: fork
allowed-tools: Bash, Grep, Glob, Read
---

<user-message>
$ARGUMENTS
</user-message>

<placeholder-variables>
[TERM] — Short term associated with [FACTS] to the expansion database
[FACTS] - Array of facts related to the term
[SHOULD_REMOVE_TERM] - `<user-message>` indicates [TERM] should be removed from the expansion database
[SHOULD_LIST_TERMS] - `<user-message>` indicates a list of the terms stored in the expansion database is requested.
[SHOULD_LIST_FACTS] - `<user-message>` indicates the [FACTS] about [TERM] stored in the expansion database are requested.
</placeholder-variables>


**If [SHOULD_LIST_TERMS]:**

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/expansion.mjs --list
```

**If [SHOULD_LIST_FACTS]:**

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/expansion.mjs "TERM"
```

**If [SHOULD_REMOVE_TERM]:**

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/expansion.mjs "[TERM]" -d
```

**Else:**

1. Extract the [TERM] and parse the remaining description into [FACTS]
2. Call `AskUserQuestion` with `multiSelect: true` where each proposed fact in [FACTS] is a separate option, asking the user to confirm which facts to store
3. ```bash
   node ${CLAUDE_PLUGIN_ROOT}/bin/expansion.mjs "[TERM]" "[FACTS][0]" "[FACTS][1]"
   ```
