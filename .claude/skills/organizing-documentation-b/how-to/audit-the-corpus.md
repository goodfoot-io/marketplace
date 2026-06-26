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

## 3. Detect structural gaps

- **Thin READMEs** (≤3 lines): flag for expansion — each needs a heading, a scope statement, a how-to or quick-start section, and cross-references. Use `wc -l` per file to identify.
- **Long documents** (>500 lines): flag for TOC addition. Every document over 500 lines needs both a scope statement at the top AND a table of contents.
- **Directories with 3+ .md files and no README**: flag for a directory-level hub.
- **Empty or stub files** (`find . -name '*.md' -size -2c`, or near-empty): flag for populate-or-remove, not just documentation.
- **Enumerating indexes** (any page that lists files — a translation index, a resource list, a directory table): diff against `git ls-files <dir>` to find entries the index is missing or that point to deleted files.
- **Orphan scoping**: when detecting orphans, skip files in well-known template directories (`.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE/`) unless the project has an explicit convention that those files should be linked. Focus on files genuinely undocumented.

## 4. Route each finding to the technique that fixes it

- **Orphan** → `add-paths.md`.
- **Duplicate / contradiction** → `type-a-topic.md`.
- **Missing metadata** → `set-vocabulary-and-metadata.md`.
- **Unclassified page** → `type-a-topic.md`.
- **Missing hub** → `build-hubs.md`.
- **Weak scent** → `strengthen-scent.md`.
- **Stale** → `govern.md`.
- **Thin README (≤3 lines)** → `build-hubs.md`.
- **Long document, no TOC (>500 lines)** → `build-hubs.md`.
- **Directory with 3+ .md files, no README** → `build-hubs.md`.
- **Empty / stub file** → `add-paths.md`.
- **Index out of sync with the filesystem** → `build-hubs.md` (re-enumerate), `validate.md`.

Treat counts as the evidence base; do not change anything not justified by a finding.

Related: why audit precedes change `../explanation/principles/08-validate-and-iterate.md`; the signal catalog `../reference/validation-signals.md`; ongoing checks `validate.md`.
