# Link labels

Scope: make link text — and the directory and file names that act as labels — predict the destination. Owns link labeling for Principle 6.

## In the repo

A directory or file name is the link label in a tree listing and in grep output. Make the name self-describing so the destination is predictable before opening it.

## Diagnostics → actions

- **The link text does not predict the destination**: rewrite it to name the destination's value, with object, action, or scope.
- **The link does not carry the reader's goal**: phrase it around the intended outcome.
- **The link uses "click here", "more", "details", or "advanced"**: replace it with a descriptive label.
- **Two links point at near-neighbor pages**: add qualifiers that separate them; align the label with the destination title unless context requires variation — `titles.md`.
- **The reason to click is not obvious**: add enough surrounding sentence to raise the scent.
- **Related links are ungrouped or unranked**: group them under meaningful headings and emphasize the high-value ones; remove or demote noise — `reference/principles/03-hubs-orientation-and-routing/link-selection.md`, `reference/principles/04-multiple-paths/facets.md`.
- **The destination carries risk, permission, or applicability constraints**: disclose them before the click — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
