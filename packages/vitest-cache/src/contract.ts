/**
 * Validate a suite's cache contract. Invalid shapes throw at configuration
 * time. See the package README for field meanings.
 * @summary Validate explicit cache input declarations before configuration executes.
 */
const SCOPED = ['roots', 'hostRoots', 'wrangler', 'toolchain', 'executables'];
const KEYS = new Set([
  'all',
  'projects',
  'files',
  'fallback',
  'opaqueImports',
  'dynamicImports',
  'sharedStateHygiene',
  'hostImportAliases',
  ...SCOPED
]);

/** Additional declared inputs selected for all tests, an exact project or one repository-relative test file. */
export type Scoped = { all?: string[]; projects?: Record<string, string[]>; files?: Record<string, string[]> };
/** Exact host importer/literal-specifier/target redirect mirroring configured plugin resolution. */
export type HostImportAlias = { importer: string; from: string; to: string };
/** Explicit suite input graph supplement, including nonimport reads, opaque build inputs, host redirects, executables and co-selection hygiene. */
export type CacheContract = {
  all?: string[];
  projects?: Record<string, string[]>;
  files?: Record<string, string[]>;
  fallback?: string[];
  opaqueImports?: string[];
  dynamicImports?: Record<string, string[]>;
  sharedStateHygiene?: Record<string, string>;
  hostImportAliases?: HostImportAlias[];
  roots?: Scoped;
  hostRoots?: Scoped;
  wrangler?: Scoped;
  toolchain?: Scoped;
  executables?: Scoped;
};
/** Sole explicit nonempty reason preventing content-result reuse for live or measured suites. */
export type UncachedContract = { uncached: string };
type Check = (value: unknown, context: string) => void;

function strings(value: unknown, context: string, pattern?: RegExp): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.length > 0))
    throw new Error(`invalid test cache contract: ${context} must be an array of nonempty strings`);
  if (pattern && !value.every((item) => pattern.test(item)))
    throw new Error(`invalid test cache contract: ${context} has an invalid entry`);
}

function record(value: unknown, context: string, check: Check): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`invalid test cache contract: ${context} must be an object`);
  for (const [name, entry] of Object.entries(value)) check(entry, `${context}.${name}`);
}

function paths(value: unknown, context: string): asserts value is string[] {
  strings(value, context);
  for (const item of value) {
    if (item.startsWith('/') || item.split(/[\\/]/).includes('..'))
      throw new Error(`invalid test cache contract: ${context} has a non-repository path ${item}`);
  }
}

/**
 * `{ importer, from, to }` entries redirecting one literal import specifier to another file, mirroring a host-side Vite plugin's `resolveId`. `importer` and `to` may be absolute (a plugin's own `import.meta.url`-derived paths) or repository-relative; `from` is the literal specifier being replaced, not a path, so it is not checked against the repository-path shape.
 *
 * @param value - Candidate literal import redirect array.
 * @param context - Diagnostic path identifying the declaration.
 * @throws When an entry has unknown fields or missing/non-string importer, source or target.
 */
function hostImportAliases(value: unknown, context: string) {
  if (!Array.isArray(value)) throw new Error(`invalid test cache contract: ${context} must be an array`);
  for (const [index, entry] of value.entries()) {
    const entryContext = `${context}[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error(`invalid test cache contract: ${entryContext} must be an object`);
    for (const key of Object.keys(entry)) {
      if (!['importer', 'from', 'to'].includes(key))
        throw new Error(`invalid test cache contract: unknown ${entryContext}.${key}`);
    }
    const fields = entry as Record<string, unknown>;
    for (const field of ['importer', 'from', 'to']) {
      if (typeof fields[field] !== 'string' || !fields[field])
        throw new Error(`invalid test cache contract: ${entryContext}.${field} must be a nonempty string`);
    }
  }
}

function scoped(value: unknown, context: string, check: Check) {
  record(value, context, () => {});
  for (const name of Object.keys(value)) {
    if (!['all', 'projects', 'files'].includes(name))
      throw new Error(`invalid test cache contract: unknown ${context}.${name}`);
  }
  if (value.all !== undefined) check(value.all, `${context}.all`);
  if (value.projects !== undefined) record(value.projects, `${context}.projects`, check);
  if (value.files !== undefined) record(value.files, `${context}.files`, check);
}

/**
 * Validate cached declaration shapes or an explicit sole uncached reason.
 *
 * @param contract - Unknown configuration declaration.
 * @returns Validated cached or uncached contract object; no input safety proof beyond these shape checks.
 * @throws When fields, paths, scoped maps or uncached reason violate the declared shape.
 */
export function validateContract(contract: unknown): CacheContract | UncachedContract {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract))
    throw new Error('withTestOutput requires a cache contract object or { uncached: reason }');
  if ('uncached' in contract) {
    if (typeof contract.uncached !== 'string' || !contract.uncached.trim() || Object.keys(contract).length !== 1)
      throw new Error('invalid test cache contract: { uncached } takes only a nonempty reason');
    return contract as UncachedContract;
  }
  const fields = contract as Record<string, unknown>;
  for (const name of Object.keys(fields)) {
    if (!KEYS.has(name)) throw new Error(`invalid test cache contract: unknown field ${name}`);
  }
  if (fields.all !== undefined) paths(fields.all, 'all');
  if (fields.fallback !== undefined) paths(fields.fallback, 'fallback');
  if (fields.opaqueImports !== undefined) paths(fields.opaqueImports, 'opaqueImports');
  if (fields.projects !== undefined) record(fields.projects, 'projects', paths);
  if (fields.files !== undefined) record(fields.files, 'files', paths);
  if (fields.dynamicImports !== undefined) record(fields.dynamicImports, 'dynamicImports', paths);
  if (fields.hostImportAliases !== undefined) hostImportAliases(fields.hostImportAliases, 'hostImportAliases');
  if (fields.sharedStateHygiene !== undefined) {
    record(fields.sharedStateHygiene, 'sharedStateHygiene', (value, context) => paths([value], context));
  }
  for (const name of ['roots', 'hostRoots', 'wrangler']) {
    if (fields[name] !== undefined) scoped(fields[name], name, paths);
  }
  if (fields.toolchain !== undefined)
    scoped(fields.toolchain, 'toolchain', (value, context) => strings(value, context));
  if (fields.executables !== undefined) {
    scoped(fields.executables, 'executables', (value, context) => strings(value, context, /^[a-zA-Z0-9._+-]+$/));
  }
  // Every field above is validated, so the object now has the contract's shape.
  return fields as CacheContract;
}
