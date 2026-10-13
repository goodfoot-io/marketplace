/**
 * Resolve explicit test diagnostic verbosity from the environment.
 *
 * @summary Resolve explicit test diagnostic verbosity from the environment.
 */
import { existsSync, realpathSync } from 'node:fs';
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

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    testVerbose();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}
