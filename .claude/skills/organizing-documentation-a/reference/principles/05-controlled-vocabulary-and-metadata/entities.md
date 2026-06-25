# Entities

Scope: make the domain's core entities first-class objects with consistent names and metadata. Owns the entity model for Principle 5.

## Diagnostics → actions

- **Name the core entities of the domain** and make each a first-class glossary and metadata object. Enumerate: systems, components, services, data objects, actors and roles, workflows, states, events, APIs, permissions, environments, customers/tenants/deployment types, and error codes/alerts/logs/metrics.
- **A system, service, or component exists**: give it a page and a metadata value; for services, name owners and dependencies — `reference/principles/02-typed-source-of-truth-topics/reference-pages.md`.
- **A component, role, or workflow is a way readers navigate**: expose it as a facet — `reference/principles/04-multiple-paths/facets.md`.
- **Data objects, states, or events exist**: create entity reference pages, state tables or lifecycle diagrams, and event reference pages with troubleshooting links — `reference/principles/02-typed-source-of-truth-topics/reference-pages.md`.
- **Roles and permissions exist**: create role and permission vocabulary and gate tasks by it — `reference/principles/02-typed-source-of-truth-topics/task-pages.md`.
- **Observability signals exist** (error codes, alerts, logs, metrics): link them to troubleshooting pages — `reference/principles/02-typed-source-of-truth-topics/troubleshooting-and-runbooks.md`.
- **External controls, policies, or contracts refer to these entities**: map the internal entity to the compliance or customer-facing vocabulary — `metadata-fields.md`.
