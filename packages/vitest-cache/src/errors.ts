/**
 * The errno code (`ENOENT`, `EEXIST`, ...) of a caught Node.js system error, or `undefined` for anything else.
 *
 * @param error - Caught unknown JavaScript value.
 * @returns String errno only for an Error with a string code, otherwise undefined.
 * @summary Project caught JavaScript values into diagnostic errno and message forms.
 */
export function errnoCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const { code } = error as NodeJS.ErrnoException;
  return typeof code === 'string' ? code : undefined;
}

/**
 * The message of a caught value, which JavaScript does not restrict to `Error`.
 *
 * @param error - Caught unknown JavaScript value.
 * @returns Error.message or String(value).
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
