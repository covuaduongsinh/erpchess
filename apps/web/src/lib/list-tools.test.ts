import { describe, expect, it } from 'vitest';
import { inDateRange, paginate } from './list-tools';

describe('inDateRange', () => {
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

  it('không đặt khoảng thì mọi mục đều qua, kể cả không có ngày', () => {
    expect(inDateRange(at(2026, 5, 1), '', '')).toBe(true);
    expect(inDateRange(null, '', '')).toBe(true);
  });

  it('có khoảng thì mục không có ngày bị loại', () => {
    expect(inDateRange(null, '2026-05-01', '')).toBe(false);
    expect(inDateRange(undefined, '', '2026-05-31')).toBe(false);
  });

  it('tính cả hai đầu (đến hết ngày cuối)', () => {
    expect(inDateRange(at(2026, 5, 1, 0), '2026-05-01', '2026-05-31')).toBe(true);
    expect(inDateRange(at(2026, 5, 31, 23), '2026-05-01', '2026-05-31')).toBe(true);
    expect(inDateRange(at(2026, 4, 30, 23), '2026-05-01', '2026-05-31')).toBe(false);
    expect(inDateRange(at(2026, 6, 1, 0), '2026-05-01', '2026-05-31')).toBe(false);
  });

  it('chỉ đặt một đầu', () => {
    expect(inDateRange(at(2030, 1, 1), '2026-05-01', '')).toBe(true);
    expect(inDateRange(at(2020, 1, 1), '', '2026-05-31')).toBe(true);
    expect(inDateRange(at(2027, 1, 1), '', '2026-05-31')).toBe(false);
  });

  it('chuỗi ngày hỏng thì loại', () => {
    expect(inDateRange('không phải ngày', '2026-05-01', '')).toBe(false);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('cắt đúng trang', () => {
    expect(paginate(items, 1, 10)).toEqual(items.slice(0, 10));
    expect(paginate(items, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  it('kẹp trang ngoài khoảng và cỡ trang không hợp lệ', () => {
    expect(paginate(items, 99, 10)).toEqual([21, 22, 23, 24, 25]);
    expect(paginate(items, 0, 10)).toEqual(items.slice(0, 10));
    expect(paginate(items, 1, 0)).toEqual([1]);
    expect(paginate([], 1, 10)).toEqual([]);
  });
});
