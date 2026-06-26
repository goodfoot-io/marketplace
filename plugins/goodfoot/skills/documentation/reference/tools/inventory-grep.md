# Tool: inventory (grep / Glob / git ls-files)

Scope: take the corpus's baseline — size, hubs, orphans, duplicates, `CODEOWNERS` coverage — with `grep`/`Glob`/`git ls-files`. Owns inventory queries. This is Step 1 of the loop; record every count.

## Counts

```bash
git ls-files | wc -l                                                   # corpus size
git ls-files '*.md' '**/*.md' '**/*.wiki.md'                           # doc inventory
git ls-files '**/README.md' '**/AGENTS.md' 'CLAUDE.md' '**/CLAUDE.md'  # existing hubs
```

## Detect

- **Orphans (no inbound reference)**: for each doc, grep the corpus for its name; zero hits outside itself is an orphan candidate.
  ```bash
  for f in $(git ls-files '*.md'); do
    n=$(basename "$f")
    [ "$(git grep -lF -- "$n" | grep -vc "^$f$")" -eq 0 ] && echo "orphan: $f"
  done
  ```
- **Duplicate / competing topics**: grep a candidate title or term across the corpus; multiple authoritative-looking files = competing pages → resolve to one owner.
  ```bash
  git grep -liF '<topic phrase>'
  ```
- **Missing hubs**: list directories holding three or more docs with no `README`/`index`.
  ```bash
  git ls-files '*.md' | xargs -n1 dirname | sort | uniq -c | sort -rn
  ```
- **`CODEOWNERS` coverage (provenance, not a gap)**: directories matched by `CODEOWNERS` map to maintainers for provenance and audience; an unmatched area is not a doc defect.
- **Agent-entry gaps**: each major directory should hold a `README` or `AGENTS.md`; flag those that do not.

## Use

Feed the counts into the baseline audit and route each finding to its owning principle.

Related: baseline method `../../how-to/audit-the-corpus.md`; orphan/dead-end repair `../../how-to/add-paths.md`; hub thresholds `../../how-to/build-hubs.md`; duplicate resolution `../../how-to/type-a-topic.md`.
