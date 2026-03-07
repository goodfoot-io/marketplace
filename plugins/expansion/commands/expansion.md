---
name: expansion
description: Manage text expansions — short terms that auto-inject context into prompts
argument-hint: "`<term>` [is <description>] | Remove `<term>` | --list"
---

```!
if [ -f ~/.expansion.json ]; then
  COUNT=$(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.env.HOME+'/.expansion.json','utf8'))).length)" 2>/dev/null || echo "0")
  echo "Current expansions: $COUNT term(s) stored"
  node "${CLAUDE_PLUGIN_ROOT}/bin/expansion.mjs" --list 2>/dev/null || true
else
  echo "No expansions stored yet (~/.expansion.json does not exist)"
fi
```

You are managing text expansions. Parse `$ARGUMENTS` to detect the operation:

**Detecting operation:**
- Starts with `Remove` or `remove` → remove operation
- Contains a backtick-quoted term and additional description → set operation
- Contains only a backtick-quoted term alone → view operation
- `--list` or `list` → list operation

**Set operation:**
1. Extract the key (text between backticks) and parse the remaining description into individual facts (split on natural sentence boundaries: "stored at", "is a", "located at", etc.)
2. Call `AskUserQuestion` with `multiSelect: true` where each proposed fact is a separate option, asking the user to confirm which facts to store
3. Call `node ${CLAUDE_PLUGIN_ROOT}/bin/expansion.mjs "key" "fact1" "fact2" ...` with only the confirmed facts

**View operation:**
Call `node ${CLAUDE_PLUGIN_ROOT}/bin/expansion.mjs "key"` and display the output.

**Remove operation:**
Call `node ${CLAUDE_PLUGIN_ROOT}/bin/expansion.mjs "key" -d` and confirm to user.

**List operation:**
Call `node ${CLAUDE_PLUGIN_ROOT}/bin/expansion.mjs --list` and display the output.
