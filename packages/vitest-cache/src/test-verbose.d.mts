/**
 * Resolve the explicit host verbosity switch for project provide values.
 *
 * @param environment - Host environment containing GOODFOOT_TEST_VERBOSE.
 * @returns False for unset/empty/0, true for 1.
 * @throws For any other switch value.
 * @summary Resolve explicit test diagnostic verbosity from the environment.
 */
export type TestVerbosityPolicy = (environment?: NodeJS.ProcessEnv) => boolean;
/** Runtime verbosity resolver checked against the canonical policy. */
export declare const testVerbose: TestVerbosityPolicy;
