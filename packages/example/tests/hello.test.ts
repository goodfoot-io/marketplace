import { hello } from '../src/index.js';

describe('hello', () => {
  it('should return hello world message', () => {
    expect(hello()).toBe('Hello, World!');
  });

  it('should return personalized greeting when name provided', () => {
    expect(hello('Claude')).toBe('Hello, Claude!');
  });
});
