# Tools

Scope: orientation hub for `reference/tools/` — the four repo-native tools that power the framework: inventory (`grep`/`git ls-files`), git history, `git-mesh`, and `wiki`. Pure routing; each tool's commands and rules are in its owning file below.

## What is here

Each file is the reference for one tool: its scope, commands, rules, and failure modes. The process that uses them lives in `reference/procedure.md`; the principles that explain why live in `reference/principles/`.

## Browse by tool

| Tool file | Owns | Use it for |
|---|---|---|
| `inventory-grep.md` | Corpus baseline counts — size, hubs, orphans, duplicates | Step 2 of the procedure; every audit |
| `git-history.md` | Decision history, co-change coupling, staleness | Step 3 (translate) — learn what is load-bearing |
| `git-mesh.md` | Load-bearing unenforced couplings and drift detection | Step 6 (author) — anchor claims mechanically |
| `wiki.md` | Source-anchored cross-file synthesis and drift checks | Step 6 (author) — write durable wiki pages |

## Tool usage by procedure stage

1. **Audit** → `inventory-grep.md` + `git-history.md` (staleness)
2. **Translate** → `git-history.md` (readers, decision history, co-change)
3. **Author** → `wiki.md` + `git-mesh.md` (durable docs and couplings)
4. **Validate** → `wiki check` + `git mesh stale` (mechanical drift gates)
5. **Govern** → `git-history.md` (freshness) + `git-mesh.md` + `wiki.md` (drift gates)

## Related

- The procedure that uses them: `reference/procedure.md`.
- The principles that motivate them: `reference/principles/`.
- The root routing hub: `../SKILL.md`.
