/**
 * Report selected unlisted/stale tests and unmatched declared input globs.
 *
 * @summary Report selected unlisted/stale tests and unmatched declared input globs.
 */
import path from 'node:path';
import { inventory } from './audit-lib.ts';

const config = process.argv[2];
if (!config) throw new Error('usage: node scripts/list-unlisted.ts <vitest-config>');
const result = await inventory(path.resolve(config));
console.log(JSON.stringify(result, null, 2));
