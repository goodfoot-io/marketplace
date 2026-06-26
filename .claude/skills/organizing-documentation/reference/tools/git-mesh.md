# Tool: git-mesh

Scope: record a load-bearing, unenforced coupling as a mesh and detect its drift. Owns mesh mechanics, the should-this-be-a-mesh gate, and the durable-mesh-name form of a repo-native stable identifier.

## Gate — should this be a mesh?

Mesh only when a coupling between two anchors is real, the developer at one anchor needs to know about the other, and **no type, schema, validator, test, or import already enforces it**.

- **Already enforced**: skip — the mechanism is the dependency.
- **A note-to-self**: skip — write a commit message or PR comment.
- **An anchor would point at a mesh file**: never — a mesh does not anchor another mesh.
- **Load-bearing and unenforced** (a client request shape and the server parser; an ADR rule and the code that relies on it; a runbook step and the alert handler; a doc page and the source it describes): mesh it.

## Create

```bash
git mesh add <name> '<path>#Lstart-Lend' '<path2>#La-Lb'
git mesh why <name> -m "<standing property, present tense>"
git add .mesh && git commit
```

- **name** — kebab-case naming the *relationship*, not either side; hierarchical `<category>/<sub>/<slug>`. The leaf survives a rename of either anchor.
- **why** — a definition of the current bytes ("X is a Y that does Z"), still true a year out; not a changelog ("added", "5× faster").
- **anchor** — line-range for code; whole-file for prose whose identity is the contract.

## Inspect and detect drift

```bash
git mesh list [<target>]            # what meshes exist (path or name)
git mesh show <name>                # anchors + why + config
git mesh history <name>             # how the mesh changed
git mesh tree <glob>                # blast radius: coupling-based path through a change
git mesh stale [--fix]              # drift; --fix re-anchors in place
```

Meshes are tracked files: persist with `git add .mesh && git commit`; they fetch/push/pull like any file. Gate the read-only `git mesh stale` (it fails on drift without mutating) in a hook or CI so a code move surfaces the affected docs; never run `git mesh stale --fix` inside an auto-commit hook — it rewrites anchors in the working tree and can sweep unrelated changes into the commit.

A **durable mesh name** is a repo-native stable identifier (`../../explanation/foundations.md` §2) — cite a coupling by name, not by line number.

Related: find candidates by mining history `git-history.md`; use `git mesh tree` as a non-tree path `../../how-to/add-paths.md`; gate drift in governance `../../how-to/govern.md`; wiki pages require covering meshes `wiki.md`.
