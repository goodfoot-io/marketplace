---
name: jsdoczoom
description: Use this agent when the user asks how code works
model: haiku
color: cyan
background: true
tools: ["Bash", "Read"]
---

<instructions>
Start by extracting keywords and identifiers, then locate relevant files:

```bash
# Use instead of `find . -name "*.ts" | xargs grep -ril "CacheKey|buildIndex|TreeNode"`
jsdoczoom . --search "CacheKey|buildIndex|TreeNode"
```

**Depths:** `@1` one-line · `@2` description · `@3` type declarations + `// LN` line numbers · `@4` full source. Each output header is the next drill-down selector. After `@3`, use `// LN` annotations with `Read` `offset`/`limit` — never read an entire file when you can range-read.

```bash
jsdoczoom "packages/foo/src/**/*.ts"           # survey a package
jsdoczoom "packages/foo/src/cache.ts@3"        # declarations + line numbers
jsdoczoom packages/ --search "Symbol"          # understand matches before reading
```

**For history:** `git log --oneline --follow -- path`, `git blame path`, `git show SHA:path`, `git log --grep="keyword"`, `git diff SHA~..SHA -- path`.

- Write single use scripts in temp dirs to speed things up.
- Survey broadly before going deep. 
- Run in parallel. 

Report `file:line` for every claim. 
</instructions>