#!/usr/bin/env node

/**
 * Export this workspace member's dependency closure from Yarn's lockfile.
 *
 * Yarn's checksums identify its cache archives, but they are not npm SRI
 * values. The exporter therefore reads the exact version metadata for every
 * lockfile entry from the npm registry and fails closed if that metadata is
 * unavailable or incomplete.
 */

import { readFile, writeFile } from "node:fs/promises";
import { parseSyml } from "@yarnpkg/parsers";

const packageRoot = new URL("..", import.meta.url);
const repositoryRoot = new URL("../..", packageRoot);
const manifestPath = new URL("./package.json", packageRoot);
const lockfilePath = new URL("./yarn.lock", repositoryRoot);

const [manifest, lockfileText, repositoryManifest] = await Promise.all([
  readJson(manifestPath),
  readFile(lockfilePath, "utf8"),
  readJson(new URL("./package.json", repositoryRoot)),
]);
const lock = parseSyml(lockfileText);
const aliases = new Map();
const entriesByIdent = new Map();

for (const [key, value] of Object.entries(lock)) {
  if (key === "__metadata") continue;
  for (const alias of key.split(/,\s*/u)) {
    const entry = { key, value };
    aliases.set(alias, entry);
    const ident = packageIdent(alias);
    const entries = entriesByIdent.get(ident) ?? [];
    entries.push(entry);
    entriesByIdent.set(ident, entries);
  }
}

const directSections = ["dependencies", "devDependencies", "optionalDependencies"];
const roots = [];
const unresolved = [];
for (const section of directSections) {
  for (const [ident, range] of Object.entries(manifest[section] ?? {})) {
    roots.push({ ident, range, section, optional: section === "optionalDependencies" });
  }
}

const visited = new Map();
const edges = [];
const queue = roots.map((root) => ({ ...root, from: null, edgeType: "root" }));

while (queue.length > 0) {
  const request = queue.shift();
  const alias = resolveEntry(request.ident, request.range, request.edgeType === "peerDependencies");
  if (!alias) {
    unresolved.push({ from: request.from, ident: request.ident, range: request.range, edge_type: request.edgeType, optional: request.optional });
    continue;
  }

  const { key, value } = alias;
  const resolution = String(value.resolution ?? "");
  const packageKey = resolution || key;
  if (request.from !== null) {
    edges.push({ from: request.from, ident: request.ident, range: request.range, edge_type: request.edgeType, optional: request.optional, to: packageKey });
  }
  let record = visited.get(packageKey);
  if (record === undefined) {
    record = { key, value, requested: [] };
    visited.set(packageKey, record);
  }
  record.requested.push({ ident: request.ident, range: request.range, section: request.section ?? null });
  if (record.requested.length > 1) continue;

  for (const dependencyType of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [ident, range] of Object.entries(value[dependencyType] ?? {})) {
      const peerMeta = value.peerDependenciesMeta?.[ident];
      queue.push({
        ident,
        range: normalizeRange(range),
        from: packageKey,
        edgeType: dependencyType,
        section: null,
        optional: dependencyType === "optionalDependencies" || (dependencyType === "peerDependencies" && (peerMeta?.optional === true || peerMeta?.optional === "true")),
      });
    }
  }
}

const packageRecords = [...visited.values()]
  .map(({ key, value, requested }) => ({
    lock_key: key,
    requested_by: requested,
    ident: packageIdent(String(value.resolution ?? key)),
    version: value.version ?? null,
    resolution: value.resolution ?? null,
    ...(value.checksum === undefined ? {} : { checksum: value.checksum }),
    ...(value.conditions === undefined ? {} : { conditions: value.conditions }),
    ...(value.languageName === undefined ? {} : { language_name: value.languageName }),
    ...(value.linkType === undefined ? {} : { link_type: value.linkType }),
    ...(value.dependencies === undefined ? {} : { dependencies: value.dependencies }),
    ...(value.optionalDependencies === undefined ? {} : { optional_dependencies: value.optionalDependencies }),
    ...(value.peerDependencies === undefined ? {} : { peer_dependencies: value.peerDependencies }),
    ...(value.peerDependenciesMeta === undefined ? {} : { peer_dependencies_meta: value.peerDependenciesMeta }),
  }))
  .sort((a, b) => `${a.ident}@${a.version}`.localeCompare(`${b.ident}@${b.version}`));

const roles = new Map(packageRecords.map(({ resolution }) => [resolution, new Set()]));
const directResolutions = new Set();
for (const root of roots) {
  const entry = resolveEntry(root.ident, root.range, false);
  if (!entry) continue;
  const resolution = String(entry.value.resolution ?? entry.key);
  directResolutions.add(resolution);
  roles.get(resolution)?.add(`${roleFamily(root.section)} direct`);
}

// Propagate the root's runtime/development family through the graph. This is
// intentionally separate from `requested_by`: the same lock entry can be
// reachable from both runtime and development roots, and can also be a peer or
// optional edge at the same time.
const rootFamilies = new Map();
for (const [resolution, values] of roles) {
  rootFamilies.set(resolution, new Set([...values].map((role) => role.split(" ")[0])));
}
let changed = true;
while (changed) {
  changed = false;
  for (const edge of edges) {
    const sourceFamilies = rootFamilies.get(edge.from);
    const targetFamilies = rootFamilies.get(edge.to);
    if (!sourceFamilies || !targetFamilies) continue;
    for (const family of sourceFamilies) {
      if (!targetFamilies.has(family)) {
        targetFamilies.add(family);
        changed = true;
      }
    }
  }
}
for (const [resolution, families] of rootFamilies) {
  const roleSet = roles.get(resolution);
  if (!roleSet) continue;
  for (const family of families) {
    if (!directResolutions.has(resolution)) roleSet.add(`${family} transitive`);
  }
}
for (const edge of edges) {
  const roleSet = roles.get(edge.to);
  if (!roleSet) continue;
  if (edge.edge_type === "peerDependencies") roleSet.add("peer");
  if (edge.optional) roleSet.add("optional");
}

const registryErrors = [];
const registryMetadata = await Promise.all(
  packageRecords.map(async (record) => {
    try {
      return [record.resolution, await readRegistryMetadata(record.ident, record.version)];
    } catch (error) {
      registryErrors.push({
        ident: record.ident,
        version: record.version,
        error: error instanceof Error ? error.message : String(error),
      });
      return [record.resolution, null];
    }
  }),
);
const registryByResolution = new Map(registryMetadata);

const packages = packageRecords.map((record) => {
  const metadata = registryByResolution.get(record.resolution);
  const roleList = [...(roles.get(record.resolution) ?? [])].sort();
  if (metadata?.applicability.os || metadata?.applicability.cpu || metadata?.applicability.libc || record.conditions) {
    roleList.push("platform-conditional");
  }
  return {
    ...record,
    role: roleList.join("; ") || "transitive",
    roles: roleList,
    published_tarball_url: metadata?.published_tarball_url ?? null,
    resolved_tarball_url: metadata?.published_tarball_url ?? null,
    integrity: metadata?.integrity ?? null,
    applicability: {
      ...(metadata?.applicability ?? {
        os: null,
        cpu: null,
        libc: null,
        engines: null,
      }),
      lockfile_conditions: record.conditions ?? null,
    },
  };
});

const output = {
  format: "shell-mcp-dependency-closure-v1",
  package: {
    name: manifest.name,
    version: manifest.version,
    package_manager: repositoryManifest.packageManager ?? null,
  },
  provenance: {
    source: "workspace Yarn lockfile",
    manifest: "packages/shell-mcp/package.json",
    lockfile: "yarn.lock",
    registry: "https://registry.npmjs.org",
    registry_verified: registryErrors.length === 0,
    integrity_values_emitted: registryErrors.length === 0,
    distribution_urls_emitted: registryErrors.length === 0,
    metadata_method: "GET /{package}/{exact-version}; dist.tarball and dist.integrity",
  },
  direct: Object.fromEntries(directSections.map((section) => [section, manifest[section] ?? {}])),
  packages,
  edges,
  unresolved,
  registry_errors: registryErrors,
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
const artifactArgument = process.argv.find((argument) => argument.startsWith("--write="));
if (artifactArgument) {
  const relativePath = artifactArgument.slice("--write=".length);
  await writeFile(new URL(relativePath, packageRoot), serialized, "utf8");
} else {
  process.stdout.write(serialized);
}
if (unresolved.some(({ optional }) => !optional) || registryErrors.length > 0) process.exitCode = 1;

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

function normalizeRange(range) {
  const text = String(range);
  return text.startsWith("npm:") ? text.slice(4) : text;
}

function packageIdent(locator) {
  const marker = String(locator).lastIndexOf("@npm:");
  return marker < 0 ? String(locator) : String(locator).slice(0, marker);
}

function resolveEntry(ident, range, allowPeerFallback) {
  const exact = aliases.get(`${ident}@npm:${range}`);
  if (exact || !allowPeerFallback) return exact;
  return (entriesByIdent.get(ident) ?? []).find(({ value }) => satisfies(String(value.version ?? ""), range));
}

/** Handles the semver forms used by the workspace peer ranges without adding a resolver dependency. */
function satisfies(version, range) {
  const actual = parseVersion(version);
  if (!actual) return false;
  return String(range).split("||").some((part) => {
    const clause = part.trim();
    if (clause === "*" || clause === "") return true;
    const match = /^(\^|~|>=|<=|>|<)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/u.exec(clause);
    if (!match) return false;
    const operator = match[1] ?? "=";
    const requested = [Number(match[2]), Number(match[3] ?? 0), Number(match[4] ?? 0)];
    const comparison = compareVersion(actual, requested);
    if (operator === ">=") return comparison >= 0;
    if (operator === ">") return comparison > 0;
    if (operator === "<=") return comparison <= 0;
    if (operator === "<") return comparison < 0;
    if (operator === "^") return actual[0] === requested[0] && comparison >= 0;
    if (operator === "~") return actual[0] === requested[0] && actual[1] === requested[1] && comparison >= 0;
    return comparison === 0;
  });
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)/u.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersion(left, right) {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function roleFamily(section) {
  if (section === "devDependencies") return "development";
  if (section === "optionalDependencies") return "optional";
  return "runtime";
}

async function readRegistryMetadata(ident, version) {
  const registryIdent = encodeURIComponent(ident);
  const url = `https://registry.npmjs.org/${registryIdent}/${encodeURIComponent(version)}`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "goodfoot-shell-mcp-dependency-export/1" },
      });
      if (!response.ok) throw new Error(`registry returned ${response.status} for ${ident}@${version}`);
      const metadata = await response.json();
      const tarball = metadata?.dist?.tarball;
      const integrity = metadata?.dist?.integrity;
      if (typeof tarball !== "string" || typeof integrity !== "string" || !/^sha(?:1|224|256|384|512)-[A-Za-z0-9+/=]+$/u.test(integrity)) {
        throw new Error(`registry metadata lacks a published tarball URL or npm SRI integrity for ${ident}@${version}`);
      }
      return {
        published_tarball_url: tarball,
        integrity,
        applicability: {
          lockfile_conditions: null,
          os: metadata.os ?? null,
          cpu: metadata.cpu ?? null,
          libc: metadata.libc ?? null,
          engines: metadata.engines ?? null,
        },
      };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw lastError;
}
