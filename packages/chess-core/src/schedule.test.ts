import { describe, expect, it } from 'vitest';
import { nextOccurrence } from './schedule';

describe('nextOccurrence', () => {
  const start = new Date(2026, 0, 31, 19, 0);
  it('hằng ngày, hằng tuần, hằng tháng (31/1 → 28/2)', () => {
    expect(nextOccurrence(start, 'daily', null)).toEqual(new Date(2026, 1, 1, 19, 0));
    expect(nextOccurrence(start, 'weekly', null)).toEqual(new Date(2026, 1, 7, 19, 0));
    expect(nextOccurrence(start, 'monthly', null)).toEqual(new Date(2026, 1, 28, 19, 0));
  });
  it('không lặp hoặc đã quá hạn lặp', () => {
    expect(nextOccurrence(start, 'none', null)).toBeNull();
    expect(nextOccurrence(start, 'weekly', new Date(2026, 1, 1))).toBeNull();
  });
});
