/**
 * Compose explicit cache, output and worker-teardown policy into Vitest configuration.
 *
 * @summary Compose explicit cache, output and worker-teardown policy into Vitest configuration.
 */

import './provided-context.js';
import type { ConfigEnv } from 'vite';
import type { CacheContract, UncachedContract } from './contract.ts';

export type { CacheContract, UncachedContract };

/**
 * Apply output defaults. `contract` is a cache contract or `{ uncached: reason }`. `sequence` is a suite's declared execution order (`loadTestSequence`); it is validated at configuration time, so its parsed JSON stays `unknown` here.
 *
 * @param configuration - Original Vitest configuration object.
 * @param contract - Explicit cached inputs or sole uncached reason.
 * @param sequence - Optional unknown declared suite order, validated before use.
 * @returns Configuration object with output/cache/teardown policy.
 * @throws For invalid contract/order, stale sequence or invalid host setup.
 */
export type TestOutputObjectPolicy = <Configuration extends object>(
  configuration: Configuration,
  contract: CacheContract | UncachedContract,
  sequence?: unknown
) => PolicyConfiguration<Configuration>;
/**
 * Await a synchronous or asynchronous configuration factory before applying the policy.
 *
 * @param configuration - Factory evaluated against the original Vite configuration environment.
 * @param contract - Explicit cached inputs or sole uncached reason.
 * @param sequence - Optional unknown declared suite order, validated before use.
 * @returns Awaited factory producing the policy-bearing configuration object.
 * @throws For invalid contract/order, stale sequence or invalid host setup.
 */
export type TestOutputFactoryPolicy = <Configuration extends object>(
  configuration: (environment: ConfigEnv) => Configuration | Promise<Configuration>,
  contract: CacheContract | UncachedContract,
  sequence?: unknown
) => (environment: ConfigEnv) => Promise<PolicyConfiguration<Configuration>>;
/** Object inputs produce objects; factory inputs produce awaited factories. */
export type TestOutputPolicy = TestOutputFactoryPolicy & TestOutputObjectPolicy;
/** Fields added by the policy without importing nominal consumer plugin types. */
export type PolicyFields = {
  test: { provide: Record<string, unknown>; silent: boolean | 'passed-only' };
};
/** Retain consumer config types while replacing fields changed by the policy. */
export type PolicyConfiguration<Configuration extends object> = Omit<Configuration, 'test'> & {
  test: Omit<Configuration extends { test?: infer Test } ? NonNullable<Test> : object, 'provide' | 'silent'> &
    PolicyFields['test'];
};
/** Canonical runtime policy provider for both configuration entry forms. */
export declare const withTestOutput: TestOutputPolicy;
/**
 * Read and validate a JSON cache contract immediately; withTestOutput later validates composition.
 *
 * @param url - JSON contract file URL.
 * @returns Validated object-form cached contract; explicitly uncached JSON refuses.
 * @throws For read/JSON/shape failures or uncached declaration.
 */
export type CacheContractLoader = (url: URL) => CacheContract;
/** Runtime contract-file loader checked against its canonical callable. */
export declare const loadCacheContract: CacheContractLoader;
/**
 * Reads a suite's declared execution order as parsed JSON. `withTestOutput` validates it.
 *
 * @param url - JSON declared sequence file URL.
 * @returns Parsed unknown JSON; withTestOutput later validates order shape and path existence.
 * @throws For file read or JSON parsing errors.
 */
export type TestSequenceLoader = (url: URL) => unknown;
/** Runtime sequence-file loader checked against its canonical callable. */
export declare const loadTestSequence: TestSequenceLoader;
