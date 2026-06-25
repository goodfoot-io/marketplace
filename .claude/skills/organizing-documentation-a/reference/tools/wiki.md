# Tool: wiki

Scope: author source-anchored pages that own cross-file synthesis, and keep them honest against the code. `wiki`.

## Inclusion test — what belongs in a page

- **Content is anchorable to source, synthesizes across files, answers "why" or "how it connects", and stays relevant across commits**: write a wiki page.
- **It describes one file, cannot be anchored to source, or is ephemeral** (a one-time checklist, a session report): keep it in code, JSDoc, or a README — or do not write it.

## Embed vs. centralize

- **Cross-cutting** (spans packages, needed by someone who does not know where to look): centralize in the `wiki/` tree.
- **About one component**: embed as a `*.wiki.md` file beside it, so whoever changes the code meets the doc.

## Mode separation

Do not mix Diátaxis modes in one page (`reference/concepts/design-dimensions.md`). Small component: one H2 per mode. Large component: split files by mode.

## Authoring loop

1. Write the page — frontmatter `title` + `summary`, fragment links into source.
2. `wiki check --fix <page>` — auto-pins fragment-link SHAs. Never hand-edit a SHA.
3. `wiki scaffold <page>` — proposes covering meshes for line-ranged links.
4. Consolidate into per-file or per-subsystem meshes with a real `why` (`reference/tools/git-mesh.md`).
5. Commit the page — anchors must exist in `HEAD` before `git mesh add`.
6. `git mesh add` + `git mesh why` each covering mesh; `git add .mesh && git commit`.
7. `wiki check <page>` — exits clean.

## Commands and failure modes

```bash
wiki list ; wiki check [--fix] ; wiki scaffold <page> ; wiki stale
```

- **`missing_sha`**: a fragment link is unpinned → `wiki check --fix`.
- **`broken_wikilink`**: link text matches no page `title`/`alias`, or the target is outside the wiki roots → fix the term or the location.
- **`mesh_uncovered`**: a line-ranged fragment link has no covering mesh → `wiki scaffold`, then create and commit the mesh.

## Drift gate

Gate with the read-only form: `wiki check` (no `--fix`) fails on drift without mutating. `wiki check --fix` rewrites pinned SHAs in the working tree; never put it in an auto-commit hook, which can sweep unrelated changes into the commit. Prefer a verify-only hook or CI. `wiki check` verifies anchor integrity, not claim truth: a clean exit means the fragment links resolve to their pinned SHAs, not that the prose is true — a changed anchor is a prompt to re-verify the claim, and a claim with no anchor is never checked.

## Hub threshold

A subdirectory that accumulates three or more pages with no overview earns a hub page — not before (`reference/principles/03-hubs-orientation-and-routing/hub-necessity.md`).

## Used by

Synthesis pages and mode separation in `reference/principles/02-typed-source-of-truth-topics/index.md`; wiki hubs and thresholds in `reference/principles/03-hubs-orientation-and-routing/index.md`; title/summary resolution in `reference/principles/06-information-scent/index.md`; the `wiki check` drift gate in `reference/principles/08-validate-and-iterate/index.md`.
