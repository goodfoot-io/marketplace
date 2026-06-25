# Creating a guidebook for organizing a git repository as a documentation corpus

These are instructions for you, Claude. Your deliverable is a **guidebook**: a how-to that teaches a reader to create, update, and organize a git repository — for example `third_party/reference/codex` (a vendored reference) or `/workspace` itself (a repository you own) — treated as a documentation corpus. These instructions tell you how to produce that guidebook. They do not ask you to reorganize any repository right now; organize one only when that is the actual task.

Keep three artifacts distinct and never collapse them:

- **The repository** — the corpus you are organizing (code, config, docs, history).
- **The guidebook** — the how-to you are writing *about* organizing such a repository.
- **These instructions** — the meta-guide you are reading now.

`documentation/organizing-a-documention-corpus.md` is the **source of truth** for the organizing principles and their question banks. Do not copy its questions into the guidebook. Cite it and project it onto a git repository — restating it would duplicate a source-of-truth page, which the framework itself forbids. Your value is the translation to a git repository and its tools, plus the procedure below.

# How to use these instructions

Work in four movements. **Ground** (§1): read the inputs and audit the target repository. **Translate** (§2): map each of the eight principles onto the repository and its tools. **Produce** (§3): follow the ordered procedure to write and validate the guidebook. **Check** (§4): hold the result to the quality bar. Carry the distinctions below through all four.

# Key distinctions

The framework opens by separating terms that are easily conflated. A git repository needs its own set:

- **Layered source of truth.** A repository has no single source-of-truth page. Route each fact to its owner: **code and config** own behavior; a **README / `AGENTS.md` / `CLAUDE.md`** owns orientation and working norms; a **wiki page** (`*.wiki.md`, `wiki/**`) owns cross-file synthesis anchored to source; a **mesh** (`.mesh/<name>`) owns one load-bearing, unenforced coupling; **commits, PRs, `CHANGELOG.md`, and ADRs** own decision history. When a README or the guidebook restates what the code owns, cut it and link instead.
- **Repo-native stable identifier.** The durable reference target is a SHA-pinned fragment link (`path#L10-L20 rk64:…`) or a durable mesh name — not a bare line number and not a renamable title. This is the framework's "stable permalink / durable ID" in concrete form; there is no SEO "canonical URL" here.
- **First-party vs. vendored — different permissions.** Branch on ownership before touching anything:
  - **You own the repo (e.g. `/workspace`):** you may add and repair READMEs, move/rename/split files, and write `*.wiki.md` and `.mesh/` entries in place.
  - **The repo is a vendored reference (e.g. `third_party/reference/codex`, which carries its own nested `.git`):** treat the imported tree as read-only. Layer organization *on top* from outside the subtree — meshes and wiki pages in the parent repo that anchor *into* the vendored files by path — so upstream diffs and re-sync stay clean. Never edit vendored files to "organize" them.
- **Agents are first-class readers.** Claude and codex enter through `AGENTS.md`/`CLAUDE.md`, grep, and retrieval, usually with no navigation context. Design for them alongside humans, not as an afterthought.
- **Three jobs, one loop.** *Creating* a repository establishes conventions and a root hub early. *Updating* audits first, then changes only what a failure signal justifies. *Organizing* (maintenance) runs drift detection and governance on a cadence. All three use the same audit → translate → author → validate → govern loop.

# 1. Ground the guidebook in real inputs

Read these before drafting. Each row is a source to mine, not prose to copy.

| Input | Read or run | What it gives the guidebook |
|---|---|---|
| `documentation/organizing-a-documention-corpus.md` | Read in full | The eight principles and question banks — the backbone to cite, not copy. |
| The **wiki** tool | `.claude/rules/wiki.md`; `wiki/meta/wiki-organization.md` | How to author source-anchored pages; Diátaxis mode separation; embed-vs-centralize; hub thresholds; reorganization signals. |
| **git-mesh** | `git-mesh:handbook` skill; `git-mesh:expert` agent; `finding-mesh-candidates` | How to document and detect implicit semantic dependencies — the drift-control layer. |
| The target repo's hubs | Root `README`, `AGENTS.md`/`CLAUDE.md`, nested READMEs, `docs/` | The current state you are organizing — audit it before recommending changes. |
| Git history | `git log`, `git blame`, `git log --follow`, mining scripts | Decision history and co-change coupling — evidence for what is load-bearing and what is stale. |
| `grep` / `Glob` / `git ls-files` | Inventory queries | Corpus size, hubs, orphans, duplicates — the baseline counts. |

Then run the baseline audit in §3, Step 2, so every recommendation in the guidebook is grounded in the target repository's real state.

# 2. Translate the eight principles to a git repository

Restate each principle in repository terms, name the tool, and add only the questions the framework does not already cover. For the full question banks, send the reader to `organizing-a-documention-corpus.md`.

## Principle 1 — Organize around user intent

- **Readers of a repository:** maintainers changing a package, contributors locating code, reviewers judging a diff, operators running build/release, newcomers onboarding, engineers vendor-syncing third-party code, and agents retrieving by grep with no navigation context.
- **Tools:** `git shortlog -sn` and `git log --author` (who works where), `CODEOWNERS`, PR/issue templates; read existing `AGENTS.md`/`CLAUDE.md` for the agent's intended path.
- **Is a primary reader an agent with no navigation context?** → Put working norms in root and module-level `AGENTS.md`/`CLAUDE.md` and make each landing file self-orienting (codex keeps a large `AGENTS.md` handbook plus a nested one under `codex-rs/tui/src/bottom_pane/`).
- **Did the reader arrive from a stack trace or file path?** → Make the owning directory's README the high-scent landing for that path.
- **Is the reader vendor-syncing?** → Give them a re-sync procedure and the layer-on-top rule, not a tour of files to hand-edit.

## Principle 2 — Use typed, source-of-truth topics

- **In the repo:** code and config are the source of truth for behavior. Separate by Diátaxis mode the way the wiki already does: explanation (architecture `*.wiki.md`), how-to (a `justfile`/`scripts/` task or guide), reference (generated API docs, schemas, a `config.md`), decision (ADR/commit/PR). Do not let one README be all four.
- **Tools:** wiki pages for cross-file synthesis; `git-mesh` for one unenforced coupling; generated reference from code where possible.
- **Does a README or page restate what the code defines?** → Cut it; link the code as source of truth and keep only synthesis the code cannot express (the wiki's inclusion test: anchorable, cross-file, answers "why / how it connects").
- **Is the coupling already enforced by a type, test, or import?** → Do not mesh or document it as a contract — that mechanism *is* the dependency (the `git-mesh:expert` gate).
- **Is it load-bearing but unenforced?** → Mint a mesh whose `why` names the standing property, not the last change.
- **Is it decision history?** → It belongs in the commit/PR/ADR; link it rather than folding it into current instructions.

## Principle 3 — Make hubs orientation and routing layers

- **In the repo:** the root README is the product hub; `AGENTS.md`/`CLAUDE.md` are agent hubs; a README at each major module boundary is a local hub (codex places them at `codex-rs/`, `core/`, `tui/`, `app-server/`, `sdk/*`). A hub routes and orients; it does not duplicate code facts.
- **Tools:** `wiki` hub pages for cross-cutting domains; `git ls-files '**/README.md' '**/AGENTS.md'` to inventory hubs.
- **Does a directory hold three or more docs with no overview?** → Add a hub. Fewer? Let the directory name carry it — do not build a hub that says little (wiki-organization's threshold).
- **Is `AGENTS.md`/`CLAUDE.md` duplicating code facts?** → Reduce it to norms plus routing; move facts to owned pages or code.
- **Does a module need its own working norms?** → Add a nested `AGENTS.md`/README at that boundary.

## Principle 4 — Provide multiple paths to the same topic

- **In the repo:** the directory tree is one hierarchy. Add projections for the other ways people seek: a lifecycle path (setup → build → test → release), a role path, a failure-mode index, an API-surface path. Express them with hub links, wiki hub pages, `CODEOWNERS`, and meshes.
- **Tools:** `git mesh tree <glob>` surfaces a change's blast radius as a coupling-based path; wiki wikilinks; `CODEOWNERS` as the ownership projection.
- **Can a topic be reached only by knowing its directory?** → Add at least one non-tree entry point (a hub link, an alias, a mesh).
- **Does a cross-reference point at a volatile line number?** → Replace it with a SHA-pinned fragment link or mesh name so it survives edits and moves.

## Principle 5 — Use controlled vocabulary and structured metadata

- **In the repo:** names are the vocabulary — directories, files, packages, crates, mesh names. Keep one convention (kebab-case; project prefixes such as codex's `codex-*` crates). The repo already carries metadata: `CODEOWNERS`, `package.json`, wiki frontmatter (`title`/`summary`/`aliases`/`tags`), mesh `why`.
- **Tools:** wiki `aliases` for synonyms and old names; `git log --follow` and `git mv` for renames; reuse existing metadata before inventing fields.
- **Do file, directory, and mesh names follow one convention?** → Normalize to kebab-case; record deprecated paths and redirect readers with links, not silent deletion.
- **Does the repo already store this metadata?** → Reuse `CODEOWNERS`/`package.json`/frontmatter before adding a new field (the framework's "generate, don't duplicate").
- **Is a durable reference using a bare line number?** → Re-anchor it as `path#Lx-Ly rk64:…`.

## Principle 6 — Maximize information scent at every click

- **In the repo:** the first line of each README is the scope promise; directory and file names are link labels; headings are signposts; commit subjects are the scent on history.
- **Tools:** `wiki check` (titles and summaries resolve), read each `README.md` opening, `git log --oneline` to judge subject scent.
- **Does each README's first line state scope and "use this when"?** → Rewrite until the promise is obvious in a link list or search result.
- **Do commit subjects name the standing property or just the diff?** → Write the why (the `git-mesh:expert` rule) so history carries scent.
- **Would a file name predict its contents out of context?** → Rename vague files; a reader greps names before opening them.

## Principle 7 — Design for nonlinear information seeking

- **In the repo:** no one reads a repository top to bottom. They grep, jump to definition, blame, and retrieve. Every file and directory must be self-orienting on arrival.
- **Tools:** `git blame` and `git log -L` for berrypicking a region's history; a mesh `why` supplies the cross-file relationship an agent cannot infer from one chunk; history mining (mine → shortlist → explain) recovers couplings that live only in memory.
- **Will an agent retrieve this file with no neighbors?** → Give it a heading path and a scope line, and put the cross-file relationship in a mesh `why`, not in tribal memory.
- **Is a load-bearing coupling recorded only in someone's head?** → Mine git history (co-change, SZZ) and mint a mesh, or dispatch `git-mesh:expert`.

## Principle 8 — Validate and iterate using observed behavior

- **In the repo:** here a repository beats a generic wiki — doc↔code drift is mechanically detectable. Anchor docs with fragment links and meshes so `wiki check` and `git mesh stale` fail when code moves out from under prose; gate them in a git hook or CI.
- **Tools:** `wiki check`, `git mesh stale [--fix]`, `git mesh doctor`, `git log -1 --format=%cs -- <path>` for staleness, `git ls-files` for orphan and coverage counts.
- **Is doc↔code drift detectable mechanically?** → If not, the doc is not anchored — convert load-bearing claims to fragment links and meshes.
- **How do you know a page is stale?** → `git mesh stale`, `wiki check`, and last-commit dates; trigger review on release and on every vendor re-sync.
- **Should you reorganize now?** → Only when a reader fails to find or finds the wrong thing — never for tidiness (wiki-organization's rule).

# 3. Produce the guidebook: an ordered procedure

Run one real pass of this loop on the target repository so the guidebook's examples are grounded, then write it up as reusable instructions. The guidebook you write should mirror §2 and this procedure, specialized to the target repository, and should link `organizing-a-documention-corpus.md` for the question banks rather than copying them.

**Step 1 — Set scope and mode.** Identify the repository root and which job this is (creating, updating, or maintaining). Then branch on ownership:
- **First-party (you own it):** you may edit the tree.
- **Vendored reference (own nested `.git`, e.g. `third_party/reference/codex`):** treat as read-only; layer all docs and meshes from outside the subtree.

**Step 2 — Inventory and baseline-audit.** Establish the corpus's real state:
```bash
git ls-files | wc -l                                                  # corpus size
git ls-files '**/README.md' '**/AGENTS.md' 'CLAUDE.md' '**/CLAUDE.md' # existing hubs
git mesh ; git mesh stale                                             # existing couplings + drift
wiki list ; wiki check                                                # existing pages + validity
git log -1 --format='%cs' -- <path>                                   # per-path staleness
```
Record counts, missing hubs, orphans, stale pages and meshes, and unowned areas. This audit is the evidence base for every recommendation.

**Step 3 — Read for intent and decision history.** Read the existing root README and `AGENTS.md`/`CLAUDE.md`. Use `git log`/`git blame` and the history-mining workflow (mine → shortlist → explain) to learn what is load-bearing and why. Distrust pairs whose authors are identical or whose coupling a type or test already enforces.

**Step 4 — Draft the guidebook outline against the eight principles.** Write it as a how-to (Diátaxis): keep procedure separate from rationale, and link the rationale. Each section maps to a principle in §2, specialized to this repository.

**Step 5 — Establish or repair the navigation layer.** Add or fix hubs (root README, module READMEs, `AGENTS.md`/`CLAUDE.md`), wire the alternate projections from Principle 4, and resolve orphans. Reorganize existing structure only where Step 2 surfaced a real failure signal.

**Step 6 — Author durable docs with the tools.** For cross-cutting synthesis, follow the wiki loop (authoritative source: `.claude/rules/wiki.md`):
1. Write the page — frontmatter `title` + `summary`, fragment links into source.
2. `wiki check --fix <page>` — pin fragment-link SHAs (never hand-edit a SHA).
3. `wiki scaffold <page>` — propose covering meshes for line-ranged links.
4. Consolidate the scaffold into meaningful per-file or per-subsystem meshes; write a real `why`.
5. Commit the page — anchors must exist in HEAD before `git mesh add`.
6. Create and commit each covering mesh: `git mesh add <name> <anchor>… ; git mesh why <name> -m "…" ; git add .mesh && git commit`.
7. `wiki check <page>` — exits clean.

For an unenforced coupling that needs no page, dispatch `git-mesh:expert` or run mine → shortlist → explain, then add and commit the mesh. **Vendored repos:** keep every page and mesh outside the imported subtree, anchoring into it by path.

**Step 7 — Set vocabulary and metadata.** Normalize names to one convention, add wiki `aliases` for old or informal terms, assign owners (`CODEOWNERS`), and mark status and freshness where they affect trust.

**Step 8 — Validate.** `wiki check` and `git mesh stale` exit clean; wikilinks resolve; spot-check first-click scent on each hub (can a reader predict the destination?). Fix what fails before handing off.

**Step 9 — Govern and hand off.** Record owners and review triggers (release, vendor re-sync, ownership change) and how to update the guidebook itself. Commit per the repository's norms; for a vendored reference, never commit into the imported tree. If a tool errors unexpectedly, stop and report it (per `CLAUDE.md`).

# 4. Quality bar

Hold the finished guidebook to these:

- It is a mode-separated how-to that **cites** `organizing-a-documention-corpus.md` for the question banks instead of copying them.
- It distinguishes first-party from vendored and never instructs a reader to edit a vendored tree.
- Every repository claim it makes is **anchored** (fragment link or mesh) or links to the owning README/code; it does not restate what code owns.
- It treats agents as readers — `AGENTS.md`/`CLAUDE.md` coverage and retrieval-friendly, self-contained sections.
- It specifies mechanical drift detection (`wiki check`, `git mesh stale`) and a governance cadence with named owners and review triggers.
- It validates clean: `wiki check` and `git mesh stale` pass; links resolve.
- Naming is one convention; durable references use SHA-pinned anchors or mesh names, never bare line numbers.
- **Voice:** imperative, each directive stated once, no filler ("ensure", "crucial", "delve"); branches written as bolded conditions, not buried in prose. This is a documentation guide (plain markdown, `#` headings) like its sibling, not a `SKILL.md`.

# Inputs and references

- `documentation/organizing-a-documention-corpus.md` — source of truth for the eight principles and the question banks. Project it; do not copy it.
- The **wiki** tool — `.claude/rules/wiki.md` (authoring loop and failure modes) and `wiki/meta/wiki-organization.md` (Diátaxis modes, embed-vs-centralize, hub thresholds, reorganization signals). Mechanics: `wiki check [--fix]`, `wiki scaffold`, `wiki list`, `wiki stale`.
- **git-mesh** — the `git-mesh:handbook` skill (anchor grammar, why-writing, drift) and the `git-mesh:expert` agent (documents implicit semantic dependencies); `finding-mesh-candidates` for history mining. Mechanics: `git mesh add/why/show/list/stale/tree/history`, persisted with `git add .mesh && git commit`.
- **git history** — `git log`, `git blame`, `git log --follow`, `git log -L`, and the mine → shortlist → explain scripts: decision history and co-change coupling.
- **grep / Glob / `git ls-files`** — corpus inventory and baseline counts.
- Worked examples — `third_party/reference/codex` (vendored: a README product hub, an `AGENTS.md` development handbook plus a nested one, module READMEs at each major boundary, a thin `docs/` index pointing to external source-of-truth, a minimal `CHANGELOG.md`, no ADRs) and `/workspace` (first-party: nested `CLAUDE.md` hubs and a populated `.mesh/`, including doc↔code meshes such as `.mesh/codex-hooks/output-reference`).
