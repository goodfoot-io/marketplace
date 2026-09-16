# Dependency provenance

The package uses the repository's Yarn 4 lockfile at [`/workspace/yarn.lock`](../../../yarn.lock) as its dependency-resolution record. Run this from the package directory to export the package's direct dependencies and the transitive lockfile closure:

```bash
node scripts/export-dependencies.mjs > /tmp/shell-mcp-dependencies.json
```

For the checked-in delivery artifact, use the exporter’s explicit write option:

```bash
node scripts/export-dependencies.mjs --write=docs/dependency-closure.json
```

The exporter parses the final workspace lockfile and then requests exact-version metadata from `https://registry.npmjs.org/{package}/{version}`. For every resolved entry, [`dependency-closure.json`](./dependency-closure.json) records the package name and version, role, Yarn resolution and checksum, published `.tgz` URL, npm SRI `integrity`, dependency edges, and applicability. `applicability` includes the lockfile’s conditional selector plus registry `os`, `cpu`, `libc`, and `engines` metadata. Roles identify runtime, development, optional, peer, transitive, direct, and platform-conditional use; a package can carry more than one role when the graph reaches it in several ways.

The exporter fails with a nonzero status if a non-optional lockfile edge cannot be resolved or if any exact registry response lacks a published tarball URL or SRI integrity. It emits `registry_errors` for diagnosis. The registry values are metadata evidence for the exact lockfile versions; Yarn’s checksum is retained separately because it identifies Yarn’s cache archive rather than npm SRI.

The direct manifest versions are:

| Section | Package | Requested version |
| --- | --- | --- |
| runtime | `@modelcontextprotocol/node` | `2.0.0` |
| runtime | `@modelcontextprotocol/server` | `2.0.0` |
| runtime | `hono` | `4.13.8` |
| runtime | `zod` | `4.6.5` |
| development | `@biomejs/biome` | `2.5.13` |
| development | `@modelcontextprotocol/client` | `2.0.0` |
| development | `@types/node` | `^24.13.5` |
| development | `tsx` | `^4.23.13` |
| development | `typescript` | `^7.0.0` |
| development | `vite` | `^8.3.0` |
| development | `vitest` | `5.0.1` |

The exact resolved versions and Yarn checksums in the exported JSON are paired with registry metadata fetched for those exact versions. The exporter downloads no tarballs: the closure is assembled from the lockfile's resolutions and the registry's exact-version metadata, and makes no offline-bundle claim. A checksum is retained exactly as Yarn stores it and is not relabeled as npm registry metadata.

The lockfile currently resolves the direct ranges to `typescript@7.0.2`, `@types/node@24.13.5`, `tsx@4.23.13`, `vite@8.3.0`, and `vitest@5.0.1`, and the exact runtime pins listed above. The generated artifact contains 353 resolved package records and 438 dependency edges from this package’s runtime, development, peer, optional, and conditional graph. Re-run the exporter after dependency changes so the closure can be reviewed against the updated lockfile and exact registry metadata.
