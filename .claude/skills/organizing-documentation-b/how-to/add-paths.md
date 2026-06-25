# How to add multiple paths

Scope: give every topic more than one path beyond the directory tree. How-to (author stage). Applies Principle 4.

## 1. List the facets readers use

Product area, component, role, task, lifecycle stage, environment, customer type, failure mode, version, API surface, ownership, compliance domain, entity, business process, source system. Express each with hub links, wiki hub pages, `CODEOWNERS`, and meshes. Reuse controlled metadata as facet values; add only facets readers actually seek.

## 2. Choose the primary hierarchy

The directory tree is the default backbone; pick the one for main navigation by common intent, value, risk, onboarding, and urgency. Demote other legitimate hierarchies (architecture, workflow, ownership, learning order, troubleshooting) to hubs, filters, tags, or related links; keep maintainer-only hierarchies backstage.

## 3. Cross-link by kind

Inbound links from all likely contexts; outbound links placed by kind — prerequisites before, next steps after, related in a section, troubleshooting at failure points, reference near values, decision-history near rationale, "do not confuse with" in disambiguation notes. Add the bridge links authors assumed. Use durable targets — SHA-pinned fragment links or mesh names, not bare line numbers (`../explanation/foundations.md` §2); `git mesh tree <glob>` surfaces a coupling-based path.

## 4. Cover entry points per role

Novice, expert, operator-in-incident, developer-from-code, support, product, and security each get a handle (labels, aliases, symptom links, code aliases, audit metadata). A wrong term → aliases; an arrival from a ticket/alert/dashboard → link the artifact back; agent retrieval → headings, scoped aliases, explicit scope, source-of-truth links, and local context per chunk.

## 5. Build a matrix view where it helps choosing

Two complementary, user-meaningful facets; each cell links to a hub and/or a source-of-truth page; label empty cells (missing, not-applicable, intentionally-absent, unclassified); collapse artificial categories; resolve duplicates it exposes; generate from controlled metadata with provenance.

## 6. Fix orphans and dead-ends

Orphan → link from a hub or matrix, redirect, archive, or delete. No useful outbound → add prerequisite/next/related. Buried → promote. Over-linked → prune noise. Post-task dead end → verification and next steps. Should-redirect → redirect to the source-of-truth or replacement. Retrieval dead end → summary, stable identifier, explicit relationships, source-of-truth links.

Related: why multiple paths `../explanation/principles/04-multiple-paths.md`; facets reuse metadata `set-vocabulary-and-metadata.md`; durable targets `../explanation/foundations.md`; coupling paths `../reference/tools/git-mesh.md`.
