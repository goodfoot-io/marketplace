# Principle 6 — Maximize information scent at every click

Scope: make every cue — name, first line, heading, commit subject — predict what lies behind it, so readers do not waste clicks, backtrack, or abandon.

## In the repo

The first line of each README is the scope promise; directory and file names are link labels and titles; headings are signposts; commit subjects are the scent on history. Check scent with `wiki check` (titles and summaries resolve) and `git log --oneline` (judge subject scent) — `reference/tools/wiki.md`, `reference/tools/git-history.md`.

## Route within this principle

- **A title or file name does not predict its contents**: read `titles.md` — titles and file names that predict contents out of context.
- **Link text does not predict its destination**: read `link-labels.md` — link text and name-labels that predict the destination.
- **A page opens without a scope/value statement**: read `summaries-and-previews.md` — one-line scope/value openings that survive as previews.
- **Headings do not reveal the page logic**: read `headings.md` — headings as signposts that reveal logic and survive extraction.
- **Pages, concepts, or names are easily confused**: read `disambiguation.md` — separate confusable pages, concepts, and names with comparisons and "not X" notes.
- **High-value content takes too many clicks**: read `cost-of-click.md` — shorten paths to high-value and emergency content; cut low-value hops.
