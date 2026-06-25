# How to audit the corpus

Scope: establish the corpus's real state before changing anything — the first loop stage. How-to.

## 1. Run the inventory

```bash
git ls-files | wc -l                                                   # corpus size
git ls-files '*.md' '**/*.md' '**/*.wiki.md'                           # doc inventory
git ls-files '**/README.md' '**/AGENTS.md' 'CLAUDE.md' '**/CLAUDE.md'  # existing hubs
git mesh ; git mesh stale                                              # couplings + drift
wiki list ; wiki check                                                 # pages + validity
git log -1 --format=%cs -- <path>                                      # per-path staleness
```

Commands: `../reference/tools/inventory-grep.md`, `../reference/tools/git-history.md`.

## 2. Record the counts

Size; stale (last-commit date vs release cadence); orphans (no inbound reference); pages with no useful outbound links; duplicates and contradictions; obsolete pages; unclassified (no topic-type / mode / genre); missing required metadata; high-churn pages (protect); never-touched pages (reassess); pages cited from tickets/alerts/code/external (protect with a stable identifier).

## 3. Route each finding to the technique that fixes it

- **Orphan** → `add-paths.md`.
- **Duplicate / contradiction** → `type-a-topic.md`.
- **Missing metadata** → `set-vocabulary-and-metadata.md`.
- **Unclassified page** → `type-a-topic.md`.
- **Missing hub** → `build-hubs.md`.
- **Weak scent** → `strengthen-scent.md`.
- **Stale** → `govern.md`.

Treat counts as the evidence base; do not change anything not justified by a finding.

Related: why audit precedes change `../explanation/principles/08-validate-and-iterate.md`; the signal catalog `../reference/validation-signals.md`; ongoing checks `validate.md`.
