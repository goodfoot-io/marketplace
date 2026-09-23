# Tool: wiki

Scope: find, author, and validate wiki pages that explain cross-file relationships. Owns page selection, source citations, and the review loop for line-range links.

## When a page belongs in the wiki

Use a wiki page for durable synthesis that crosses files and can cite its sources. Keep one-component detail in its README or code-adjacent docs. Any Markdown file with non-empty `title` and `summary` frontmatter is a wiki page, regardless of its path or filename.

- **Cross-cutting synthesis** (spans packages, no single home): centralize under `wiki/`.
- **About one component**: embed beside its source where a separate page helps.

## Mode separation (Diátaxis)

Keep explanation, how-to, and reference in separate pages or strict `##` sections; never mix modes on one page — mixed pages go stale unevenly and serve no reader well.

## Find and author

`wiki "<query>"` searches existing pages; `wiki list` lists their titles and `wiki summary <title>` returns one summary. Search before adding a page to avoid a title or alias collision. Cite source with Markdown links to `path#Lstart-Lend`; a whole-file link can navigate but cannot detect line-range drift. `wiki check` validates target paths and heading fragments; link text need not match a page title.

## Review loop

1. Write or edit the page with `title` and `summary` frontmatter and source citations.
2. Run `wiki check --fix <page>` to relocate moved links and initialize `links-reviewed:` when absent.
3. Read remaining diagnostics and review each affected source range against the prose. Correct the prose or link, then bump `links-reviewed:` once after all citations on the page are reviewed.
4. Run `wiki check <page>` and `git span drift`; both must exit clean.

## Failure modes

- **`anchor_epoch_missing`**: `links-reviewed:` is absent; `wiki check --fix` initializes it.
- **`link_uncertified` / `link_drift`**: review the cited source and prose, repair as needed, then bump `links-reviewed:`.
- **`link_broken` / `link_unverified`**: repair or remove the citation after reviewing its history; do not guess at a replacement.
- **`broken_link` / `broken_anchor`**: fix the target path or heading fragment. **`collision`**: make page titles and aliases unique.

## Drift gate

Gate with the read-only `wiki check`; `--source index` checks staged pages and `--source head` checks committed pages. CI needs full git history for citation certification. `wiki check --fix` changes the working tree and cannot resolve substantive drift by itself.

## Hub threshold

A directory with three or more pages and no overview → add a hub page. Fewer → let the directory name carry it; a hub that says little is worse than none.

Related: record unenforced couplings with `git-span.md`; hub design `../../how-to/build-hubs.md`; frontmatter as metadata `../metadata-fields.md`; drift gating `../../how-to/govern.md`.
