/**
 * Frame fixture-owned native errors without reclassifying production diagnostics.
 *
 * @summary Frame fixture-owned native errors without reclassifying production diagnostics.
 */
// Test fixtures only. Never classify a production error by message or severity.
export const NATIVE_MARKER = '__GOODFOOT_EXPECTED_NATIVE__';

/**
 * Preserve error identity/message and encode only a fixture-owned diagnostic stack.
 *
 * @param error - Original fixture-owned Error; identity/message are preserved.
 * @param token - Fixture token matching the 36-character lowercase hex/hyphen shape, or undefined/empty to leave error unchanged.
 * @returns The same Error with framed stack, or unchanged when token is absent/empty.
 * @throws For invalid token shape or encoded diagnostic exceeding 32768 bytes.
 * @type {import('./test-output-native.d.mts').NativeErrorFramer}
 */
export const frameExpectedNativeError = function frameExpectedNativeError(error, token) {
  if (!token) return error;
  if (!/^[0-9a-f-]{36}$/.test(token)) throw new Error('Invalid expected-native diagnostic token');
  const bytes = new TextEncoder().encode(JSON.stringify({ token, message: error.message, stack: error.stack }));
  if (bytes.length > 32_768) throw new Error('Expected-native diagnostic exceeds the 32768-byte fixture bound');
  const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  error.stack = `${NATIVE_MARKER}${bytes.length}:${encoded}`;
  return error;
};
