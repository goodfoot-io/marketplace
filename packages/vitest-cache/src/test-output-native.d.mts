/** Prefix that marks a fixture-owned diagnostic stack written by `frameExpectedNativeError`.
 *
 * @summary Frame fixture-owned native errors without reclassifying production diagnostics.
 */
export declare const NATIVE_MARKER: string;

/**
 * Returns `error` unchanged when `token` is absent/empty. Otherwise replaces its stack with the encoded expected-native diagnostic and returns the same error. Throws when `token` fails the 36-character lowercase hex/hyphen shape or the encoded diagnostic exceeds 32768 bytes.
 *
 * @param error - Original fixture-owned Error; identity/message are preserved.
 * @param token - Fixture token matching the 36-character lowercase hex/hyphen shape, or undefined/empty to leave error unchanged.
 * @template E - Concrete Error subtype whose identity is preserved.
 * @returns The same Error with framed stack, or unchanged when token is absent/empty.
 * @throws For invalid token shape or encoded diagnostic exceeding 32768 bytes.
 */
export type NativeErrorFramer = <E extends Error>(error: E, token: string | undefined) => E;
/** Runtime framer whose concrete Error identity is preserved. */
export declare const frameExpectedNativeError: NativeErrorFramer;
