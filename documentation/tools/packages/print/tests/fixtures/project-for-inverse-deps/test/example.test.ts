import { formatDate } from '../src/utils/formatter';

describe('formatter', () => {
  it('should format date correctly', () => {
    const date = new Date(2025, 0, 15); // January 15, 2025
    expect(formatDate(date)).toBe('2025-01-15');
  });
});
