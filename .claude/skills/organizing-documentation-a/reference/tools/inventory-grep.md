# Tool: inventory with grep, Glob, git ls-files

Scope: produce the baseline counts every audit starts from — corpus size, existing hubs, orphans, duplicates — with `grep`, `Glob`, and `git ls-files`.

## Commands

```bash
git ls-files | wc -l                                                    # corpus size
git ls-files '*.md' | wc -l                                             # doc count
git ls-files '**/README.md' '**/AGENTS.md' 'CLAUDE.md' '**/CLAUDE.md'   # existing hubs
git grep -rIl '<defining-phrase>' -- '*.md'                             # pages claiming a topic
```

## Diagnostics → actions

- **Hub inventory is empty for a directory that holds docs**: candidate missing hub — see `reference/principles/03-hubs-orientation-and-routing/hub-necessity.md`.
- **One directory holds more docs than a single overview can route**: it needs sub-hubs — `reference/principles/03-hubs-orientation-and-routing/hub-necessity.md`.
- **A defining phrase returns more than one owner**: duplicate topic — pick one source of truth in `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.

## Find orphans

A doc whose name and path are never mentioned elsewhere has no inbound path.

```bash
for f in $(git ls-files '*.md'); do
  hits=$(git grep -lF "$(basename "$f")" -- '*.md' ':!'"$f" | wc -l)
  [ "$hits" -eq 0 ] && echo "orphan: $f"
done
```

- **A file is reported orphan**: link it from a hub, give it an entry point, redirect it with a link, or remove it — `reference/principles/04-multiple-paths/orphans-and-dead-ends.md`.

## Used by

`reference/procedure.md` Step 2; `reference/principles/08-validate-and-iterate/baseline-audit.md`; hub inventory in `reference/principles/03-hubs-orientation-and-routing/index.md`; orphan detection in `reference/principles/04-multiple-paths/orphans-and-dead-ends.md`.
