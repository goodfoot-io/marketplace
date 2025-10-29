import { shouldSuppressError } from '../src/utils/file-utils.js';
describe('Error Handling', () => {
  it('should suppress file system errors', () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    const eaccesError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    const enotdirError = Object.assign(new Error('ENOTDIR: not a directory'), { code: 'ENOTDIR' });
    expect(shouldSuppressError(enoentError)).toBe(true);
    expect(shouldSuppressError(eaccesError)).toBe(true);
    expect(shouldSuppressError(enotdirError)).toBe(true);
  });
  it('should not suppress other errors', () => {
    const parseError = new Error('Parse error');
    const memoryError = Object.assign(new Error('Out of memory'), { code: 'ENOMEM' });
    const networkError = Object.assign(new Error('Network error'), { code: 'ECONNREFUSED' });
    const plainError = 'string error';
    expect(shouldSuppressError(parseError)).toBe(false);
    expect(shouldSuppressError(memoryError)).toBe(false);
    expect(shouldSuppressError(networkError)).toBe(false);
    expect(shouldSuppressError(plainError)).toBe(false);
    expect(shouldSuppressError(null)).toBe(false);
    expect(shouldSuppressError(undefined)).toBe(false);
  });
});
