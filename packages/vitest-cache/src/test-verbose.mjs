/**
 * Resolve explicit test diagnostic verbosity from the environment.
 *
 * @summary Resolve explicit test diagnostic verbosity from the environment.
 */
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { errorMessage } from './errors.ts';

/**
 * Resolve the explicit host verbosity switch for project provide values.
 *
 * @param environment - Host environment containing GOODFOOT_TEST_VERBOSE.
 * @returns False for unset/empty/0, true for 1.
 * @throws For any other switch value.
 * @type {import('./test-verbose.d.mts').TestVerbosityPolicy}
 */
export const testVerbose = function testVerbose(environment = process.env) {
  const value = environment.GOODFOOT_TEST_VERBOSE;
  if (value === undefined || value === '' || value === '0') return false;
  if (value === '1') return true;
  throw new Error('GOODFOOT_TEST_VERBOSE must be unset, 0, or 1');
};

if (process.argv[1]) {
  Promise.all([realpath(process.argv[1]), realpath(fileURLToPath(import.meta.url))])
    .then(([entry, own]) => {
      if (entry === own) testVerbose();
    })
    .catch((error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
      console.error(errorMessage(error));
      process.exitCode = 1;
    });
}
