/**
 * Report heuristic IO findings for tests lacking explicit per-file declarations.
 *
 * @summary Report heuristic IO findings for tests lacking explicit per-file declarations.
 */
import path from 'node:path';
import { auditImports, inventory } from './audit-lib.ts';

const config = process.argv[2];
if (!config) throw new Error('usage: node scripts/audit-unlisted.ts <vitest-config> [--all]');
const result = await inventory(path.resolve(config));
const audited = auditImports(
  result.root,
  result.project,
  process.argv.includes('--all') ? result.tests : result.unlisted
);
console.log(JSON.stringify({ ...result, audited }, null, 2));
