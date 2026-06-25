# Job: creating a corpus

Scope: stand up a repository's documentation from little — establish conventions and a root hub before volume accumulates. Runs `reference/procedure.md` with creation emphasis (Principles 3, 5, 6).

## First moves

- **Set one naming convention** (kebab-case; stable project prefixes) before files multiply — `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
- **Add the root hub now, module hubs as boundaries appear** — `reference/principles/03-hubs-orientation-and-routing/hub-necessity.md`; do not build hubs that say little.
- **Type each page from the start** along the four dimensions — `reference/concepts/design-dimensions.md`; do not let one README become all four modes.
- **Make names and first lines carry scent** so grep arrivals land — `reference/principles/06-information-scent/index.md`.
- **Anchor load-bearing claims** so drift is detectable later — `reference/tools/wiki.md`, `reference/tools/git-mesh.md`.

## Agent orientation file

When creating an AGENTS.md or CLAUDE.md, include ALL of the following — not one or the other:

1. **Directory tree or table** showing the actual file layout with per-file annotations. This is the actionable reference an agent needs to find the right file for any task.
2. **Documentation philosophy** explaining the layered source-of-truth model and how documents relate to each other. This teaches the agent the *why* behind the structure.
3. **Working norms** covering: Python version, package manager, virtual environment, test commands, linting, CI conventions, changelog format.
4. **Routing table** — a quick-lookup reference mapping task categories to the files that own them.
5. **Important conventions** — the non-obvious rules that prevent common mistakes: where CLI arguments are defined, whether any documentation sections are generated, how the test suite is run, legacy format notes, meta-CLI vs. request command distinctions.

## Thin README expansion

For any README that is currently 3 lines or fewer, expand it to include at minimum: a heading, a scope statement (one sentence identifying what this directory/file owns), a "How it works" or "Quick start" section, and cross-references to related documents. Do not leave a stub.

## Directory READMEs

For every directory containing 3 or more .md files that lacks a README, create a directory-level README covering: what the directory contains, how to find things in it, naming conventions, and links to related resources.

Then run the full loop: `reference/procedure.md`.
