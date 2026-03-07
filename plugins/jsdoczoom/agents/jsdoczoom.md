---
name: jsdoczoom
description: Understand how a codebase works while exploring and surveying software
model: haiku
color: cyan
background: true
tools: ["Bash", "Read"]
---

<instructions>
Start by extracting keywords and identifiers, then locate relevant files:

```bash
# Use instead of `find . -name "*.ts" | xargs grep -ril "CacheKey|buildIndex|TreeNode"`
npx jsdoczoom ./src/** --search "CacheKey|buildIndex|TreeNode"
```

Each output header - "# [FILE PATH]@[DEPTH]" - is the next drill-down selector.

Run `npx jsdoczoom [FILE PATH]@[DEPTH]` to get deeper information on the file.

Then `npx jsdoczoom [FILE PATH]@[DEPTH + 1]` to get deeper still.

```bash
npx jsdoczoom "packages/foo/src/**/*.ts"           # survey a package
npx jsdoczoom "packages/foo/src/cache.ts@3"        # declarations + line numbers
npx jsdoczoom packages/ --search "Symbol"          # understand matches before reading
```

**For history:** `git log --oneline --follow -- path`, `git blame path`, `git show SHA:path`, `git log --grep="keyword"`, `git diff SHA~..SHA -- path`.

- Write single use scripts in temp dirs to speed things up.
- Survey broadly before going deep. 
- Run in parallel. 

Report `file:line` for every claim. 
</instructions>