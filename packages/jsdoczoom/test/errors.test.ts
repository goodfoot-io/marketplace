import { describe, it, expect } from 'vitest';
import { JsdocError } from '../src/errors.js';

describe('JsdocError', () => {
  it('stores code and message properties', () => {
    const err = new JsdocError('PARSE_ERROR', 'failed to parse');
    expect(err.code).toBe('PARSE_ERROR');
    expect(err.message).toBe('failed to parse');
    expect(err).toBeInstanceOf(Error);
  });

  it('toJSON() returns { error: { code, message } } shape', () => {
    const err = new JsdocError('FILE_NOT_FOUND', 'not found');
    expect(err.toJSON()).toEqual({
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'not found',
      },
    });
  });
});
