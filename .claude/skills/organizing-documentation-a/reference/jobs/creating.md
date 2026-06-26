# Job: creating a corpus

Scope: stand up a repository's documentation from little — establish conventions and a root hub before volume accumulates. Runs `reference/procedure.md` with creation emphasis (Principles 3, 5, 6).

## First moves

- **Set one naming convention** (kebab-case; stable project prefixes) before files multiply — `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`.
- **Add the root hub now, module hubs as boundaries appear** — `reference/principles/03-hubs-orientation-and-routing/hub-necessity.md`; do not build hubs that say little.
- **Type each page from the start** along the four dimensions — `reference/concepts/design-dimensions.md`; do not let one README become all four modes.
- **Make names and first lines carry scent** so grep arrivals land — `reference/principles/06-information-scent/index.md`.
- **Anchor load-bearing claims** so drift is detectable later — `reference/tools/wiki.md`, `reference/tools/git-mesh.md`.

## Agent orientation file

The agent orientation file is a typed hub for agents and contributors (`reference/principles/03-hubs-orientation-and-routing/index.md`). Name it for the repo's existing convention — the file the toolchain already loads (`AGENTS.md`, `CLAUDE.md`); add a second only if the project wants both. Include ALL of the following — not one or the other:

1. **One-line repo description and type** — state whether the repo is a documentation corpus, a software project, or mixed, so an agent does not hunt for build, test, or source infrastructure that is not there.
2. **Annotated directory tree or table** to the file level for the key directories, each file with a one-line purpose; add a size cue (line count) for any file too large to read whole, so an agent knows what to sample versus read.
3. **Documentation philosophy** — the layered source-of-truth model and what wins when a fact has two homes (`reference/foundations.md`). This teaches the agent the *why* behind the structure.
4. **Working norms** — language/runtime version, package manager, build, test, lint/format, CI, and commit conventions, in the project's own terms.
5. **Routing table** by both reader intent ("understand X → …") and task ("change Y → these specific files"); both are legitimate facets — do not force one.
6. **Important conventions** — the non-obvious rules an agent would violate blind (formatting, ordering, policy boundaries, generated sections, CI constraints), each naming the specific files it governs.

State how this file relates to directory READMEs: the orientation file owns agent-specific conventions and routing; directory READMEs own navigation for both audiences; neither duplicates the other. Link the orientation file from the root README and the docs index so humans discover it.

## Thin README expansion

Expand any README too thin to orient a direct arrival — 3 lines or fewer, or any directory README that gives only a name or one-sentence purpose with no file listing, navigation, or cross-references. At minimum: a heading with a purpose clause, a scope / "where you are" statement (`reference/principles/06-information-scent/summaries-and-previews.md`), a "How it works" or "Quick start" section, a file table when the directory holds several files (below), and see-also cross-references to related documents. Do not leave a stub.

## Directory READMEs

For every directory containing 3 or more .md files that lacks a README, create a directory-level hub covering: where the reader is, what the directory holds, how to find things in it, naming conventions, and links to sibling directories and the root. When the directory holds many files on a naming convention (per-language, per-component, …), make a complete file-index table its primary content — `reference/principles/03-hubs-orientation-and-routing/hub-content.md`.

Then run the full loop: `reference/procedure.md`.
