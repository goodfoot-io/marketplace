/**
 * Bound asynchronous content reads and record writes alongside streaming digest descriptors.
 * @summary Share the process-wide stream budget for small filesystem descriptions too.
 */
import fs from 'node:fs';
import { withFilesystemStream } from './filesystem-batch.ts';

/**
 * Read current description bytes under the shared descriptor budget.
 * @param filename - File whose complete bytes form a metadata or configuration description.
 * @returns Exact current file bytes.
 * @throws Native read errors after descriptor cleanup.
 */
export function readContent(filename: string): Promise<Buffer> {
  return withFilesystemStream(() => fs.promises.readFile(filename));
}

/**
 * Read a UTF-8 filesystem description under the shared descriptor budget.
 * @param filename - Metadata or configuration description path.
 * @returns Current UTF-8 text.
 * @throws Native read errors after descriptor cleanup.
 */
export async function readText(filename: string): Promise<string> {
  return (await readContent(filename)).toString('utf8');
}
