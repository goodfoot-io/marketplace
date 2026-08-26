# How to add multiple paths

Scope: give every topic more than one path beyond the directory tree. How-to (author stage). Applies Principle 4.

## 1. List the facets readers use

Product area, component, role, task, lifecycle stage, environment, customer type, failure mode, version, API surface, ownership, compliance domain, entity, business process, source system. Express each with hub links, wiki hub pages, `CODEOWNERS`, and meshes. Reuse controlled metadata as facet values; add only facets readers actually seek.

## 2. Choose the primary hierarchy

The directory tree is the default backbone; pick the one for main navigation by common intent, value, risk, onboarding, and urgency. Demote other legitimate hierarchies (architecture, workflow, ownership, learning order, troubleshooting) to hubs, filters, tags, or related links; keep maintainer-only hierarchies backstage.

## 3. Cross-link by kind

Inbound links from all likely contexts; outbound links placed by kind — prerequisites before, next steps after, related in a section, troubleshooting at failure points, reference near values, decision-history near rationale, "do not confuse with" in disambiguation notes. Add the bridge links authors assumed. Use durable targets — SHA-pinned fragment links or mesh names, not bare line numbers (`../explanation/foundations.md` §2); `git mesh tree <glob>` surfaces a coupling-based path. Match the corpus's native markup: typed cross-reference roles, see-also callouts, and a local table of contents in reStructuredText; tables and relative links in Markdown. Never a bare URL where the format offers a typed link, and do not mix one format's constructs into the other.

## 4. Cover entry points per role

Novice, expert, operator-in-incident, developer-from-code, support, product, and security each get a handle (labels, aliases, symptom links, code aliases, audit metadata). A wrong term → aliases; an arrival from a ticket/alert/dashboard → link the artifact back; agent retrieval → headings, scoped aliases, explicit scope, source-of-truth links, and local context per chunk.

## 5. Build a matrix view where it helps choosing

Two complementary, user-meaningful facets; each cell links to a hub and/or a source-of-truth page; label empty cells (missing, not-applicable, intentionally-absent, unclassified); collapse artificial categories; resolve duplicates it exposes; generate from controlled metadata with provenance.

## 6. Fix orphans and dead-ends

Orphan → link from a hub or matrix, redirect, archive, or delete. An empty or stub file is an orphan too: populate it with a minimal stub that states its purpose, redirects to the right resource, and invites contribution, or redirect/delete it — do not merely note it in the orientation file. No useful outbound → add prerequisite/next/related. Buried → promote. Over-linked → prune noise. Post-task dead end → verification and next steps. Should-redirect → redirect to the source-of-truth or replacement. Retrieval dead end → summary, stable identifier, explicit relationships, source-of-truth links.

**Orphan scoping**: do not flag files in well-known template directories (`.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE/`) as orphans. These are consumed by platform automation and typically do not need README links. Focus on files genuinely undocumented — policy files, standalone docs, unlinked guides.

## 7. Audit cross-layer links (bidirectional)

After authoring, sweep for resources that cover the same topic in different layers but do not link to each other — the most common silent gap. If resource X and resource Z both cover topic Y, each links to the other, and the link carries a one-line description (no bare link lists). Check, at minimum:

- a doc page and its runnable example link both ways;
- a source-directory README links out to the doc pages for that module, and they link back;
- the root README and the agent orientation file reference each other, and the docs index links the orientation file;
- every hub links its leaves and each leaf links back to its hub.

A topic documented in one layer with no path from the others is an orphan across layers even when it has inbound links within its own; `validate.md` re-checks this. To confirm a return path after adding a link X → Y, `git grep` Y's path for every file that references it and check each has a counterpart back-link — or a reason not to (Y is a leaf, external, or a utility file). One-way links strand whoever starts at the far end.

Related: why multiple paths `../explanation/principles/04-multiple-paths.md`; facets reuse metadata `set-vocabulary-and-metadata.md`; durable targets `../explanation/foundations.md`; coupling paths `../reference/tools/git-mesh.md`.
