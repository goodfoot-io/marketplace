# Cross-linking

Scope: wire inbound and outbound links so each page connects to its prerequisites, next steps, reference, and recovery. Owns inter-page linking for Principle 4.

## Diagnostics → actions

- **Add inbound links from every likely entry context** — `entry-points.md`.
- **Add outbound links by role and place them where they help**: prerequisites before the instructions; next steps after the answer; related concepts in a related section; troubleshooting near failure points; reference near exact values; decision-history links near rationale; "do not confuse with" links in disambiguation notes — `reference/principles/06-information-scent/disambiguation.md`.
- **Authors assumed a connection readers do not have**: add the explicit bridge link.
- **A link is generated, cited externally, or consumed by retrieval**: use a durable identifier, not a volatile title — `reference/foundations.md` stable-identifier section.
- **A cross-reference points at a volatile line number**: replace it with a SHA-pinned fragment link or a mesh name so it survives edits and moves — `reference/tools/git-mesh.md`.
- **You need the set of files a change should link or notify**: run `git mesh tree <glob>` for the blast radius — `reference/tools/git-mesh.md`.
