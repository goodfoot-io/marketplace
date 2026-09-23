# Tool: git-span

Scope: record a load-bearing, unenforced coupling as a span and detect its drift. Owns the decision to create a span, the current commands, and span names as stable references.

## Gate — should this be a span?

Span only when a coupling between two anchors is real, the developer at one anchor needs to know about the other, and **no type, schema, validator, test, or import already enforces it**.

- **Already enforced**: skip — the mechanism is the dependency.
- **A note-to-self**: skip — write a commit message or PR comment.
- **An anchor would point at `.span/`**: never — span metadata is not an anchor.
- **Load-bearing and unenforced** (a client request shape and the server parser; an ADR rule and the code that relies on it; a runbook step and the alert handler; a doc page and the source it describes): span it.

## Create

```bash
git span add <name> '<path>#Lstart-Lend' '<path2>#La-Lb'
git span why <name> "<standing property, present tense>"
git add .span && git commit -o .span -m "Record the coupling"
```

- **name** — kebab-case segments naming the *relationship*, not either side; hierarchical `<category>/<sub>/<slug>` is valid. The name survives an anchor rename.
- **why** — one or two present-tense clauses explaining the relationship and its invariant; not a changelog ("added", "5× faster").
- **anchor** — line-range for code; whole-file for prose whose identity is the contract.

## Inspect and detect drift

```bash
git span list [<target>...]         # what spans exist (path or name)
git span show <name>                # anchors + why + config
git span history <name>             # how the span changed
git span list <path>                # couplings touching a path
git span drift [<name-or-path>]     # report drift; exits nonzero on drift
git span drift --fix                # repair moved/whitespace-only anchors
```

Spans are tracked under `.span/`. After changing a span, stage and commit `.span/` with the coupled edits in the same commit. Gate the read-only `git span drift` in a hook or CI. `git span drift --fix` repairs moved and whitespace-only anchors; changed content needs review and a refreshed anchor with `git span add` (or `git span replace` when its path or range changes). Keep repair commands out of an auto-commit hook.

A **durable span name** is a repo-native stable identifier (`../../explanation/foundations.md` §2) — cite a coupling by name, not by line number.

Related: find candidates by mining history `git-history.md`; inspect couplings for a path with `git span list` in `../../how-to/add-paths.md`; gate drift in governance `../../how-to/govern.md`; cite source from wiki pages with `wiki.md`.
