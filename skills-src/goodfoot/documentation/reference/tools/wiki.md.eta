# Tool: wiki

Scope: author source-anchored cross-file pages and check them mechanically. Owns the wiki authoring loop, the inclusion and embed-vs-centralize tests, Diátaxis mode separation, and SHA-pinned fragment links.

## When a page belongs in the wiki

Include content only if it is anchorable to source, spans files, answers "why / how it connects," and stays relevant across commits. Otherwise: a single component → a `README` or code-adjacent doc; ephemeral (a checklist, a one-time runbook) → not the wiki.

- **Cross-cutting synthesis** (spans packages, no single home): centralize under `wiki/`.
- **About one component**: embed as `*.wiki.md` beside it.

## Mode separation (Diátaxis)

Keep explanation, how-to, and reference in separate pages or strict `##` sections; never mix modes on one page — mixed pages go stale unevenly and serve no reader well.

## Authoring loop

1. Write the page — frontmatter `title` + `summary`; fragment links into source.
2. `wiki check --fix <page>` — pins fragment-link SHAs. Never hand-edit a SHA.
3. `wiki scaffold <page>` — proposes covering meshes for line-ranged links.
4. Consolidate the scaffold into meaningful per-file or per-subsystem meshes; write a real `why`.
5. Commit the page — anchored paths (including the page itself) must exist in HEAD before `git mesh add`.
6. Create and commit each covering mesh (`git add .mesh && git commit`).
7. `wiki check <page>` — exits clean.

## Failure modes

- **`missing_sha`**: run `wiki check --fix`.
- **`broken_wikilink`**: the link text matches no page `title`/`aliases`, or the target is outside the wiki roots — fix the frontmatter or the link.
- **`mesh_uncovered`**: a line-ranged fragment link has no covering mesh — `wiki scaffold`, then add and commit the mesh.

## Drift gate

Gate with the read-only `wiki check` (no `--fix`), which fails on drift without mutating. `wiki check --fix` rewrites pinned SHAs in the working tree; never put it in an auto-commit hook, which can sweep unrelated changes into the commit. Prefer a verify-only hook or CI.

## Hub threshold

A directory with three or more pages and no overview → add a hub page. Fewer → let the directory name carry it; a hub that says little is worse than none.

Related: covering meshes and the mesh gate `git-mesh.md`; hub design `../../how-to/build-hubs.md`; frontmatter as metadata `../metadata-fields.md`; drift gating `../../how-to/govern.md`.
