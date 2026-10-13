/**
 * Verify in-memory host import redirect record validation.
 *
 * @summary Verify in-memory host import redirect record validation.
 */
import { expect, test } from 'vitest';
import { validateContract } from '../src/contract.ts';

const VALID_ENTRY = {
  importer: '/repo/packages/pkg/src/worker.mjs',
  from: '../build/shim.mjs',
  to: '/repo/packages/pkg/build-test/shim.mjs'
};

test('a well-formed hostImportAliases entry is accepted', () => {
  expect(() => validateContract({ hostImportAliases: [VALID_ENTRY] })).not.toThrow();
});

test('hostImportAliases must be an array', () => {
  expect(() => validateContract({ hostImportAliases: VALID_ENTRY })).toThrow('hostImportAliases must be an array');
});

test('an entry missing a required field is rejected', () => {
  const { to: _to, ...missingTo } = VALID_ENTRY;
  expect(() => validateContract({ hostImportAliases: [missingTo] })).toThrow(
    'hostImportAliases[0].to must be a nonempty string'
  );
});

test('an entry with a non-string field is rejected', () => {
  expect(() => validateContract({ hostImportAliases: [{ ...VALID_ENTRY, from: 12 }] })).toThrow(
    'hostImportAliases[0].from must be a nonempty string'
  );
});

test('an entry with an unknown field is rejected', () => {
  expect(() => validateContract({ hostImportAliases: [{ ...VALID_ENTRY, extra: 'x' }] })).toThrow(
    'unknown hostImportAliases[0].extra'
  );
});

test('an entry that is not an object is rejected', () => {
  expect(() => validateContract({ hostImportAliases: ['not-an-object'] })).toThrow(
    'hostImportAliases[0] must be an object'
  );
});
