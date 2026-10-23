import { describe, expect, it } from 'vitest';
import { formatDuration, formatRemaining, localInputToIso } from './format';

describe('format', () => {
  it('formatDuration', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(10_500)).toBe('0:11');
    expect(formatDuration(125_000)).toBe('2:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });

  it('localInputToIso', () => {
    expect(localInputToIso('')).toBeUndefined();
    expect(localInputToIso('không phải ngày')).toBeUndefined();
    expect(localInputToIso('2026-10-30T10:00')).toMatch(/^2026-10-30T\d\d:00:00\.000Z$/);
  });

  it('formatRemaining', () => {
    expect(formatRemaining(-5)).toBe('0:00');
    expect(formatRemaining(249_000)).toBe('4:09');
    expect(formatRemaining(3_909_000)).toBe('1:05:09');
    expect(formatRemaining(2 * 86_400_000 + 3_909_000)).toBe('2d 1:05:09');
  });
});
