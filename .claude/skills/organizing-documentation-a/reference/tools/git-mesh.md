# Tool: git-mesh

Scope: document load-bearing couplings that no type, test, schema, or import enforces, and detect when they drift. `git mesh`.

## The gate — mesh only unenforced couplings

- **A type system, schema, validator, test, or import already binds the two sides**: do not mesh it — that mechanism is the dependency and rejects violations automatically.
- **It is load-bearing but unenforced** (a contract honored by hand, a doc a responder follows under pressure, an ordering or sort invariant relied on at another site, a regen target and its source, a load-bearing flush/import whose role is invisible locally): mint a mesh.
- **An anchor would point at a mesh file**: never — a mesh does not anchor another mesh.

## Commands

```bash
git mesh add <name> '<path>#Lstart-Lend' '<path2>#Lstart-Lend'   # line-range anchors
git mesh add <name> <path>                                       # whole-file anchor
git mesh why <name> -m "<standing property, present tense>"
git add .mesh && git commit                                      # persist
git mesh stale [--fix]   # report drift; --fix re-anchors in place
git mesh tree <glob>     # blast radius of a change → a coupling-based path
git mesh list | show <name> | history <name>
```

## Rules

- **Name the relationship, not either side**: hierarchical kebab-case `<category>/<sub>/<slug>`; the leaf slug survives a rename of either anchor.
- **Write `why` as a standing property in present tense** ("X is a Y that does Z") — a definition still true and verifiable from the anchored bytes a year on, not a changelog of the last change.
- **Anchor prose whole-file by default**; use line ranges on prose only with stable landmarks (numbered ADR clauses, IDs) and willingness to re-anchor on edits.
- **Persist correctly**: every anchored path must already exist in `HEAD` before `git add .mesh && git commit`; land code and its mesh in one commit.
- **Re-anchor after drift, do not rewrite the `why`**: `git mesh stale --fix` re-points moved/changed anchors.
- **Gate with the read-only form**: `git mesh stale` reports drift without mutating — safe in a verify-only hook or CI. `git mesh stale --fix` rewrites anchors in the working tree; never run it inside an auto-commit hook, which can sweep unrelated changes into the commit.
- **`git mesh stale` checks anchor integrity, not claim truth**: it fails when an anchored range moves or changes — a prompt to re-verify the claim, not proof the `why` still holds; behavior can change outside any anchor with the gate green.

## Find candidates

Mine git history for implicit couplings (mine → shortlist → explain); see `reference/tools/git-history.md`.

## Used by

Couplings in `reference/principles/02-typed-source-of-truth-topics/topic-identity.md`; the mesh-as-non-tree-path and `git mesh tree` blast-radius path in `reference/principles/04-multiple-paths/facets.md` and `reference/principles/04-multiple-paths/cross-linking.md`; cross-file relationships for grep-arrivals in `reference/principles/07-nonlinear-information-seeking/cross-reference.md`; the `git mesh stale` drift gate in `reference/principles/08-validate-and-iterate/index.md`.
