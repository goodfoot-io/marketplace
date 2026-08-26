# Foundations

Scope: the key distinctions and four design dimensions every other topic assumes, for a git repository organized as a documentation corpus with `grep` / `git` / `git-mesh` / `wiki`. Explanation mode — the why; load before authoring.

## 1. Layered source of truth

A repository has no single source-of-truth page. Route each fact to its owning layer; when a doc restates what a lower layer owns, cut it and link.

| Layer | Owns | Reach it with |
|---|---|---|
| Code & config | Behavior; contracts the machine enforces | the file; jump-to-definition |
| `README` / `AGENTS.md` / `CLAUDE.md` | Orientation, working norms, routing | the hub at that boundary |
| Wiki page (`*.wiki.md`, `wiki/**`) | Cross-file synthesis anchored to source | `wiki check`, fragment links |
| Mesh (`.mesh/<name>`) | One load-bearing, unenforced coupling | `git mesh show <name>` |
| Commit / PR / `CHANGELOG` / ADR | Decision history | `git log`, `git blame` |

- **A README or page restates what code owns**: cut it; link the code as source of truth and keep only synthesis the code cannot express.
- **Two layers contradict**: resolve toward the more-enforced layer (code over prose), fix the prose, and record the resolution in the commit.
- **Wiki inclusion test**: include content only if it is anchorable to source, spans files, and answers "why / how it connects" — not "what" (the code answers "what").

## 2. Repo-native stable identifier

The durable reference target is a **SHA-pinned fragment link** (`path#Lstart-Lend` with a pinned SHA) or a **durable mesh name**. Never a bare line number; never a renamable title. There is no SEO "canonical URL" here — do not invent one.

- **A durable reference uses a bare line number or a title**: re-anchor it as a SHA-pinned fragment link or a mesh name.
- Pin SHAs with tooling (`wiki check --fix`), never by hand. Mechanism: `../reference/tools/git-mesh.md`, `../reference/tools/wiki.md`.

## 3. Agents are first-class readers

Agents enter through `AGENTS.md`/`CLAUDE.md`, `grep`, and retrieval — usually with no navigation context, one chunk at a time.

- Make every landing file self-orienting: a scope line up top, headings that survive extraction.
- Put a cross-file relationship an agent cannot infer from one chunk into a mesh `why`, not tribal memory.
- Put working norms and routing in root and module-level `AGENTS.md`/`CLAUDE.md`; route by both reader intent and task; carry the layered source-of-truth model (§1) and the repo type so an agent knows which layer owns what and what infra exists; reduce the file to norms, routing, and conventions, not code facts. It complements directory READMEs — those own navigation for both audiences — rather than duplicating them. Author it via `../how-to/build-hubs.md`.
- The agent organizes docs and detects/records governance gaps; it does not own or execute the human governance process — the maintainer sets cadence, authority, and approvals. Docs are ownerless by default: provenance (`CODEOWNERS`, `git log --author`) is authorship and audience signal, not accountability, and an unowned doc is not a gap.

## 4. The four design dimensions

Type every topic on four independent dimensions; do not collapse them into one page-type field.

| Dimension | Question it answers | Values |
|---|---|---|
| Documentation mode | The reader's intent | learning (tutorial) · doing (how-to) · looking up (reference) · understanding (explanation) |
| Topic type | The information structure | concept · task · reference · troubleshooting · glossary |
| Page genre | How the content is used | hub · runbook · migration guide · changelog · architecture overview · policy · checklist · decision record |
| Metadata | Scope and retrieval context | scope · ownership · applicability · status · version |

- Mode and topic type often differ on one page; keep them separated structurally rather than merged.
- In a repo, learning (tutorial) is usually served by the code, inline docs, and package READMEs next to what is learned — rarely a standalone page; the modes most often authored here are doing, looking up, and understanding.
- This skill applies mode separation to itself: `explanation/` is understanding, `how-to/` is doing, `reference/` is looking up.

## 5. Term distinctions

- **Source-of-truth** = the editorial authority for a topic — here, the owning layer in §1 — not the highest-ranked or most-linked file.
- **Preferred term** = the vocabulary-controlled label for a concept.
- **Stable identifier** = the durable reference target in §2 — distinct from the preferred term and from any title.
- **Canonical URL** = not applicable here — there is no SEO canonical URL in a git repo; the durable reference target is the stable identifier in §2.

## Apply these

- Type and author a topic on the four dimensions: `../how-to/type-a-topic.md` (genres/types cataloged in `../reference/page-genres.md`, `../reference/topic-types.md`).
- Carry the metadata dimension: `../how-to/set-vocabulary-and-metadata.md` (field catalog in `../reference/metadata-fields.md`).
- Why each practice matters: `principles/index.md`. The loop that applies all of this: `../how-to/procedure.md`.
