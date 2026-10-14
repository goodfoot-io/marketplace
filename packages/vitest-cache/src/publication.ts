/**
 * Stage and atomically publish owned positive passing-test records.
 *
 * @summary Stage and atomically publish owned positive passing-test records.
 */
import { hash, randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { errnoCode } from './errors.ts';

/**
 * Result records. A reporter stages candidate records during the run and
 * commits them only after global teardown succeeds; a command that wraps
 * Vitest with its own output checks commits them after those checks pass.
 * Revocation is immediate: removing a record never creates a false pass.
 */
const SCHEMA = 3;
const HASH = /^[a-f0-9]{64}$/;

/** Named digest components for result keys and bounded miss diagnostics. */
export type Components = Record<string, string | null>;
/** Candidate positive passing assertion record, reusable only after enclosing output/teardown acceptance. */
export type StagedRecord = { key: string; tests: number; identity: string; components: Components };
type ResultRecord = {
  schema: number;
  key: string;
  tests: number;
  identity: string;
  components: Components;
  recordedAt: string;
};

function digest(value: string) {
  return hash('sha256', value, 'hex');
}

/**
 * The current user id; cache ownership checks are only possible where it exists.
 *
 * @returns Current POSIX user ID.
 * @throws When the platform exposes no POSIX user ID.
 */
export function currentUid() {
  const uid = process.getuid?.();
  if (uid === undefined) throw new Error('the test cache requires POSIX user ids');
  return uid;
}

/**
 * Create/validate an owned directory with no group/other write bits; this does not assert read confidentiality.
 *
 * @param directory - Cache directory to create or validate.
 * @returns Validated directory path.
 * @throws On wrong ownership, non-directory, writable mode or filesystem error.
 */
export async function ownedDirectory(directory: string) {
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fsp.lstat(directory);
  if (!stat.isDirectory() || stat.uid !== currentUid() || stat.mode & 0o022)
    throw new Error(`unsafe cache directory: ${directory}`);
  return directory;
}

async function safeFile(file: string) {
  const stat = await fsp.lstat(file).catch((error: unknown) => {
    if (errnoCode(error) === 'ENOENT') return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.uid !== currentUid() || stat.mode & 0o022) throw new Error(`unsafe cache record: ${file}`);
  return stat;
}

async function writeAtomic(file: string, value: unknown) {
  const temporary = path.join(path.dirname(file), `.${randomUUID()}.tmp`);
  try {
    await fsp.writeFile(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
    await fsp.rename(temporary, file);
  } finally {
    await fsp.rm(temporary, { force: true });
  }
}

function recordPath(folder: string, key: string) {
  if (!HASH.test(key)) throw new Error('invalid result key');
  return path.join(folder, 'records', `${key}.json`);
}

function indexPath(folder: string, identity: string) {
  return path.join(folder, 'index', `${digest(identity)}.json`);
}

/**
 * Read a schema/key/positive-safe-test-count-validated result record; identity/components are not comprehensively validated.
 *
 * @param folder - Owned result-cache folder.
 * @param key - Canonical SHA-256 result key.
 * @returns Validated passing record or null for absence, malformed JSON or invalid checked fields.
 * @throws For unsafe ownership/mode, invalid result key or other filesystem errors.
 */
export async function readRecord(folder: string, key: string): Promise<ResultRecord | null> {
  const file = recordPath(folder, key);
  try {
    if (!(await safeFile(file))) return null;
    const entry = JSON.parse(await fsp.readFile(file, 'utf8'));
    return entry.schema === SCHEMA && entry.key === key && Number.isSafeInteger(entry.tests) && entry.tests > 0
      ? entry
      : null;
  } catch (error) {
    if (errnoCode(error) === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

/**
 * The last committed component digests for a test identity, for miss diagnostics.
 *
 * @param folder - Owned result-cache folder.
 * @param identity - Exact project/file identity.
 * @returns Last matching schema/identity component record or null when absent/malformed.
 * @throws For unsafe ownership/mode or other filesystem errors.
 */
export async function readIndex(folder: string, identity: string): Promise<Components | null> {
  const file = indexPath(folder, identity);
  try {
    if (!(await safeFile(file))) return null;
    const entry = JSON.parse(await fsp.readFile(file, 'utf8'));
    return entry.schema === SCHEMA && entry.identity === identity ? entry.components : null;
  } catch (error) {
    if (errnoCode(error) === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

/**
 * Remove the original passing result immediately; revocation cannot create a false pass.
 *
 * @param folder - Owned result-cache folder.
 * @param key - Exact canonical result key.
 * @throws For invalid key, unsafe existing record or filesystem failure.
 */
export async function revokeRecord(folder: string, key: string) {
  const file = recordPath(folder, key);
  if (await safeFile(file)) await fsp.unlink(file);
}

/**
 * Write a staged run to `file`. The stage names the result folder and the candidate records; nothing in it is reusable until committed.
 *
 * @param file - New private stage path.
 * @param folder - Target owned result folder.
 * @param records - Candidate positive passing records.
 * @throws When stage exists, parent is unsafe or exclusive creation fails.
 */
export async function writeStage(file: string, folder: string, records: StagedRecord[]) {
  const stat = await fsp.lstat(file).catch((error: unknown) => {
    if (errnoCode(error) === 'ENOENT') return null;
    throw error;
  });
  if (stat) throw new Error(`cache stage already exists: ${file}`);
  const directory = path.dirname(file);
  const parent = await fsp.lstat(directory);
  if (!parent.isDirectory() || parent.uid !== currentUid() || parent.mode & 0o022)
    throw new Error(`unsafe cache stage directory: ${directory}`);
  await fsp.writeFile(file, JSON.stringify({ schema: SCHEMA, folder, records }), { flag: 'wx', mode: 0o600 });
}

/**
 * Publish staged candidate records.
 *
 * @param folder - Owned result-cache folder.
 * @param records - Validated candidate passing records.
 * @returns Number of committed records.
 * @throws For unsafe folders, invalid key/test count/identity or atomic write failure.
 */
export async function commitRecords(folder: string, records: StagedRecord[]) {
  await ownedDirectory(path.join(folder, 'records'));
  await ownedDirectory(path.join(folder, 'index'));
  const recordedAt = new Date().toISOString();
  for (const { key, tests, identity, components } of records) {
    if (!HASH.test(key) || !Number.isSafeInteger(tests) || tests <= 0 || typeof identity !== 'string')
      throw new Error('invalid staged cache record');
    await writeAtomic(recordPath(folder, key), { schema: SCHEMA, key, tests, identity, components, recordedAt });
    await writeAtomic(indexPath(folder, identity), { schema: SCHEMA, identity, components });
  }
  return records.length;
}

/**
 * Commit a stage written by a Vitest child after the enclosing command has accepted the run. A missing stage means the child staged nothing.
 *
 * @param file - Original private stage path.
 * @returns Committed record count, or zero when stage is absent.
 * @throws For unsafe stage, malformed stage shape or publication failure.
 */
export async function commitStage(file: string) {
  if (!(await safeFile(file))) return 0;
  const stage = JSON.parse(await fsp.readFile(file, 'utf8'));
  if (stage.schema !== SCHEMA || typeof stage.folder !== 'string' || !Array.isArray(stage.records))
    throw new Error(`invalid cache stage: ${file}`);
  return await commitRecords(await ownedDirectory(stage.folder), stage.records);
}
