/**
 * Declare cache policy values injected into Vitest project context.
 *
 * @summary Declare cache policy values injected into Vitest project context.
 */
import type { CacheContract, UncachedContract } from './contract.ts';

/** Values `withTestOutput` provides to every cached project. */
declare module 'vitest' {
  interface ProvidedContext {
    /** Explicit host verbosity policy supplied to test-side diagnostic helpers. */
    goodfootTestVerbose: boolean;
    /** Whether the current command owns a native diagnostic capture boundary. */
    goodfootNativeCapture: boolean;
    /** Explicit cache input declaration or sole nonreuse reason. */
    goodfootCacheInputs: CacheContract | UncachedContract;
    /** Optional suite fallback dispatch order after configuration validation. */
    goodfootTestSequence: string[];
  }
}
