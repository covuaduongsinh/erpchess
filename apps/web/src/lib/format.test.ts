import { describe, expect, it } from 'vitest';
import { formatDuration, localInputToIso } from './format';

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
});
